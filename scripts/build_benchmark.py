"""
Builds the Rewire Score benchmark: the library of ads every new creative is ranked against.

    python scripts/build_benchmark.py add <folder> [--manifest ads.csv] [--parallel 4] [--yes]
    python scripts/build_benchmark.py build
    python scripts/build_benchmark.py status

add     Sends every video in the folder to the GPU service and keeps the prediction. Files already in the library
        (matched by content, not name) are skipped, so an interrupted run picks up where it stopped. Prediction
        files (.pkl with "preds") are taken as they are, without GPU work.
build   Recomputes the benchmark file the app reads: the hold level, then every ad's measures, ranked within its
        length band. Needs no GPU, so it can be rerun at any time.
status  How many ads each length band holds, and how many more it needs before scores are ranked.

The manifest is an optional CSV with a "file" column and any of: title, brand, category, year, source_url.
Videos must be ones you have the right to analyse; the library records where each came from.

Everything lives in backend/data/benchmark/ (not in git):
    ads/<id>/prediction.pkl     the predicted response and transcript
    ads/<id>/ad.json            title, brand, category, year, source, length, when added
    rewire-score-v1.json        what the app reads
"""
import argparse
import csv
import hashlib
import json
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import score  # noqa: E402

LIBRARY = score.BENCHMARK_PATH.parent
ADS = LIBRARY / "ads"
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
# Measured on the deployed service: about 20 GPU-seconds per second of video, on GPUs around $0.80 an hour.
RUPEES_PER_VIDEO_SECOND = 0.40


def file_id(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:12]


def video_seconds(path: Path) -> float | None:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, timeout=30)
        return float(out.stdout.strip())
    except Exception:
        return None


def read_manifest(path: Path | None) -> dict:
    if not path:
        return {}
    with open(path, newline="") as f:
        return {row["file"].strip(): {k: (v or "").strip() for k, v in row.items() if k != "file"} for row in csv.DictReader(f)}


def save_ad(ad_id: str, preds, transcript, meta: dict):
    folder = ADS / ad_id
    folder.mkdir(parents=True, exist_ok=True)
    joblib.dump({"preds": np.asarray(preds, dtype=np.float32), "transcript": transcript}, folder / "prediction.pkl")
    meta = {**meta, "id": ad_id, "seconds": int(len(preds)), "added": int(time.time())}
    (folder / "ad.json").write_text(json.dumps(meta, indent=2))


def cmd_add(args):
    folder = Path(args.folder)
    manifest = read_manifest(Path(args.manifest) if args.manifest else None)
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in VIDEO_SUFFIXES | {".pkl"})
    if not files:
        sys.exit(f"No videos or prediction files in {folder}")

    todo, skipped, imported = [], 0, 0
    for p in files:
        ad_id = file_id(p)
        if (ADS / ad_id / "prediction.pkl").exists():
            skipped += 1
            continue
        info = manifest.get(p.name, {})
        meta = {"title": info.get("title") or p.stem, "brand": info.get("brand", ""), "category": info.get("category", ""),
                "year": info.get("year", ""), "source_url": info.get("source_url", ""), "file": p.name}
        if p.suffix.lower() == ".pkl":
            data = joblib.load(p)
            save_ad(ad_id, data["preds"], data.get("transcript", []), {**meta, "origin": "prediction file"})
            print(f"  added   {p.name} (prediction file)")
            imported += 1
            continue
        secs = video_seconds(p)
        if secs is None:
            print(f"  skip    {p.name}: not a readable video")
        elif secs > args.max_seconds:
            print(f"  skip    {p.name}: {secs:.0f} s is over the {args.max_seconds} s limit")
        else:
            todo.append((p, ad_id, secs, meta))

    print(f"{len(files)} files: {skipped} already in the library, {imported} prediction files added, {len(todo)} to analyse.")
    if not todo:
        return
    total = sum(s for _, _, s, _ in todo)
    print(f"About {total / 60:.1f} minutes of video, roughly ₹{total * RUPEES_PER_VIDEO_SECOND:,.0f} of GPU time.")
    if not args.yes and input("Go ahead? [y/N] ").strip().lower() != "y":
        return

    from engines import ModalEngine
    stop = threading.Event()
    lock = threading.Lock()

    def one(item):
        path, ad_id, secs, meta = item
        started = time.time()
        preds, transcript = ModalEngine().run(path, lambda stage, detail: None, stop.is_set)
        save_ad(ad_id, preds, transcript, {**meta, "origin": "video"})
        return path.name, time.time() - started

    done = failed = 0
    pool = ThreadPoolExecutor(max_workers=args.parallel)
    futures = {pool.submit(one, item): item for item in todo}
    try:
        for fut in as_completed(futures):
            name = futures[fut][0].name
            with lock:
                try:
                    _, took = fut.result()
                    done += 1
                    print(f"  [{done + failed}/{len(todo)}] done    {name} in {took:.0f} s")
                except Exception as exc:
                    failed += 1
                    print(f"  [{done + failed}/{len(todo)}] failed  {name}: {exc}")
    except KeyboardInterrupt:
        print("Stopping: cancelling the videos still running. Finished ones are kept.")
        stop.set()
    finally:
        pool.shutdown(wait=True, cancel_futures=True)
    print(f"Added {done}, failed {failed}. Run `build` to update the benchmark.")


def library():
    for folder in sorted(ADS.iterdir()) if ADS.exists() else []:
        if (folder / "prediction.pkl").exists() and (folder / "ad.json").exists():
            yield json.loads((folder / "ad.json").read_text()), folder / "prediction.pkl"


def cmd_build(args):
    ads = [(meta, np.asarray(joblib.load(pkl)["preds"])) for meta, pkl in library()]
    if not ads:
        sys.exit("The library is empty. Add ads first.")

    # The hold level is the typical per-second response across the library: the median of each ad's median, so
    # long ads count once like everything else.
    medians = []
    for _, preds in ads:
        curve, _ = score.response_curves(preds)
        medians.append(float(np.median(curve[score.BUILD_UP_S:] if len(curve) > score.BUILD_UP_S + 1 else curve)))
    hold_level = float(np.median(medians))

    rows = []
    for meta, preds in ads:
        m = score.raw_measures(preds, hold_level)
        band, _ = score.band_for(m["seconds"])
        rows.append({**{k: meta.get(k, "") for k in ("id", "title", "brand", "category", "year", "source_url")},
                     "seconds": m["seconds"], "band": band, "measures": {k: round(v, 5) for k, v in m["values"].items()}})

    bands = {}
    for key, label, _, _ in score.BANDS:
        members = [r for r in rows if r["band"] == key]
        values = {k: sorted(r["measures"][k] for r in members) for k in (members[0]["measures"] if members else {})}
        bands[key] = {"label": label, "count": len(members), "values": values}
        if len(members) >= score.MIN_ADS_PER_BAND:   # each ad's own score, for a leaderboard
            for r in members:
                pct = {k: score.percentile(values[k], r["measures"][k]) for k in score.HEADLINE_WEIGHTS}
                r["score"] = int(round(sum(pct[k] * w for k, w in score.HEADLINE_WEIGHTS.items())
                                       / sum(score.HEADLINE_WEIGHTS.values())))

    out = {"method": score.METHOD, "built": int(time.time()), "ads_total": len(rows), "hold_level": round(hold_level, 5),
           "min_ads_per_band": score.MIN_ADS_PER_BAND, "bands": bands, "ads": rows}
    tmp = score.BENCHMARK_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(out, indent=1))
    tmp.replace(score.BENCHMARK_PATH)
    print(f"Built {score.BENCHMARK_PATH.name} from {len(rows)} ads, hold level {hold_level:.3f}.")
    cmd_status(args)


def cmd_status(args):
    counts = {}
    for meta, _ in library():
        key, _ = score.band_for(meta["seconds"])
        counts[key] = counts.get(key, 0) + 1
    built = score.load_benchmark()
    print(f"Library: {sum(counts.values())} ads. Benchmark file: "
          + (f"built {time.strftime('%d %b %Y %H:%M', time.localtime(built['built']))} from {built['ads_total']} ads" if built else "not built"))
    for key, label, _, _ in score.BANDS:
        n = counts.get(key, 0)
        need = max(0, score.MIN_ADS_PER_BAND - n)
        print(f"  {label:12} {n:4d} ads   " + ("ranked" if not need else f"needs {need} more before scores are ranked"))


def main():
    parser = argparse.ArgumentParser(description="Build the Rewire Score benchmark.")
    sub = parser.add_subparsers(dest="command", required=True)
    add = sub.add_parser("add", help="Analyse a folder of ads and add them to the library")
    add.add_argument("folder")
    add.add_argument("--manifest", help="CSV with file, title, brand, category, year, source_url")
    add.add_argument("--parallel", type=int, default=4, help="Videos analysed at once (default 4)")
    add.add_argument("--max-seconds", type=float, default=180, help="Skip videos longer than this (default 180)")
    add.add_argument("--yes", action="store_true", help="Do not ask before spending GPU time")
    sub.add_parser("build", help="Recompute the benchmark file from the library")
    sub.add_parser("status", help="Show how many ads each length band holds")
    args = parser.parse_args()
    {"add": cmd_add, "build": cmd_build, "status": cmd_status}[args.command](args)


if __name__ == "__main__":
    main()
