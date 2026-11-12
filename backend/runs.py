"""
The workspace: every completed analysis is a folder under backend/data/runs/<id>/ (sign-in off) or
backend/data/users/<user id>/runs/<id>/ (each signed-in user's own workspace), holding

  run.json            title, mode, variants, file names, durations, creative details, result summary
  <variant>.pkl       the predictions ({"preds", "transcript"}), from the GPU or an import
  <variant>.<ext>     the original video, when one was analysed (kept for playback)
  <variant>.jpg       a thumbnail frame from that video

Nothing here holds analysed results in memory; opening a run re-runs the (fast, seeded) synthesis.
"""
import json
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path

import numpy as np

from auth import LOCAL_USER, current_user

# backend/data locally; REWIRE_DATA_DIR points it elsewhere, such as a mounted volume when hosted.
DATA_DIR = Path(os.environ.get("REWIRE_DATA_DIR", Path(__file__).resolve().parent / "data"))
RUNS_DIR = DATA_DIR / "runs"          # the local user's runs (sign-in off), where runs have always lived


def runs_dir() -> Path:
    """The signed-in user's runs folder. Each user sees only their own; without sign-in, everything is local."""
    user = current_user()
    return RUNS_DIR if user == LOCAL_USER else DATA_DIR / "users" / user / "runs"
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
DIMENSIONS = ["visual", "auditory", "reward", "memory", "attention", "narrative", "personal", "action"]


def new_run_id() -> str:
    return time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]


def folder(run_id: str) -> Path:
    # Run ids are generated here; reject anything that could walk out of the runs folder.
    if not run_id or "/" in run_id or "\\" in run_id or run_id.startswith("."):
        raise KeyError(run_id)
    path = runs_dir() / run_id
    if not (path / "run.json").exists():
        raise KeyError(run_id)
    return path


def read(run_id: str) -> dict:
    return json.loads((folder(run_id) / "run.json").read_text())


def write(path: Path, info: dict):
    tmp = path / "run.json.tmp"
    tmp.write_text(json.dumps(info, indent=2))
    tmp.replace(path / "run.json")


def update(run_id: str, **fields) -> dict:
    path = folder(run_id)
    info = read(run_id)
    info.update(fields)
    write(path, info)
    return info


def delete(run_id: str):
    shutil.rmtree(folder(run_id))


def video_file(run_id: str, variant: str) -> Path | None:
    path = folder(run_id)
    return next((p for p in path.glob(f"{variant}.*") if p.suffix.lower() in VIDEO_SUFFIXES), None)


def thumbnail(video: Path, out: Path, at: float = 1.0):
    """A small frame from the video, for the workspace list. Missing thumbnails are not an error."""
    try:
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-ss", str(at), "-i", str(video), "-frames:v", "1",
             "-vf", "scale=320:-2", "-q:v", "4", str(out)],
            capture_output=True, timeout=30,
        )
    except Exception:
        pass


def default_title(names: dict) -> str:
    stems = [Path(n).stem for n in names.values() if n]
    if len(stems) == 2:
        return f"{stems[0]} vs {stems[1]}"
    return stems[0] if stems else "Untitled analysis"


def summarise(results: dict) -> dict:
    """The headline of an analysis, for the workspace list: per-variant numbers and, when comparing, the winner."""
    per = {}
    for v, c in results.items():
        eng = c["engagement_scores"]
        best = c["best_demographic"]
        top_dim = max(DIMENSIONS, key=lambda d: eng[best].get(d, 0))
        per[v] = {
            "mean": round(float(np.mean(c["preds"].mean(axis=1))), 4),
            "peak": round(float(c["preds"].max()), 4),
            "seconds": int(c["n_timesteps"]),
            "best_cohort": best,
            "best_cohort_label": c.get("demo_labels", {}).get(best, best),
            "top_dimension": top_dim,
        }
        rs = c.get("rewire_score")
        if rs:
            per[v]["rewire_score"] = rs["score"]
            per[v]["rewire_status"] = rs["status"]
            per[v]["rewire_measures"] = {k: rs["measures"][k] for k in ("hook", "depth", "peak", "hold")}
    summary = {"variants": per}
    if len(results) == 2 and {"A", "B"} <= set(results):
        a, b = results["A"]["engagement_scores"], results["B"]["engagement_scores"]
        from analysis import contest_winner, overall_verdict
        wins = {"A": 0, "B": 0, "TIE": 0}
        for demo in a:
            for dim in DIMENSIONS:
                wins[contest_winner(a[demo].get(dim, 0), b[demo].get(dim, 0))] += 1
        summary["contests"] = wins
        verdict = overall_verdict(a, b)
        summary["winner"] = verdict["winner"]
        summary["lead_pct"] = verdict["lead_pct"]
    return summary


def list_runs() -> list[dict]:
    """Every saved run, newest first, with what the workspace list shows."""
    base = runs_dir()
    if not base.exists():
        return []
    out = []
    for path in sorted(base.iterdir(), reverse=True):
        if not (path / "run.json").exists():
            continue
        try:
            info = json.loads((path / "run.json").read_text())
        except Exception:
            continue
        variants = info.get("variants", [])
        out.append({
            "id": info.get("id", path.name),
            "title": info.get("title") or default_title(info.get("names", {})),
            "mode": info.get("mode", "compare" if len(variants) > 1 else "single"),
            "source": info.get("source", "video"),
            "engine": info.get("engine"),
            "created": info.get("created"),
            "variants": variants,
            "names": info.get("names", {}),
            "durations": info.get("durations", {}),
            "videos": {v: any(p.suffix.lower() in VIDEO_SUFFIXES for p in path.glob(f"{v}.*")) for v in variants},
            "thumbs": {v: (path / f"{v}.jpg").exists() for v in variants},
            # A comparison summarised before the overall verdict existed named its winner by contest count; leave it
            # out until the run is opened again and re-summarised, rather than show a winner that may have changed.
            "summary": None if len(variants) > 1 and "lead_pct" not in (info.get("summary") or {}) else info.get("summary"),
            "size_mb": round(sum(p.stat().st_size for p in path.iterdir() if p.is_file()) / 1e6, 1),
        })
    return out


def latest_run() -> Path | None:
    """The most recent completed run folder, if any."""
    base = runs_dir()
    if not base.exists():
        return None
    runs = sorted((p for p in base.iterdir() if (p / "run.json").exists()), reverse=True)
    return runs[0] if runs else None
