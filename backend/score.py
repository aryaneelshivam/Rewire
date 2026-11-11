"""
Rewire Score, method v1: one number for a creative, comparable across brands, categories and lengths.

The score is computed from the predicted cortical response alone (no simulated viewers), so the same video always
gets the same score. Four measures describe the response; each is ranked against a benchmark of other ads in the same
length band, and the headline score is a weighted average of those ranks.

  hook   the response to the opening: seconds 2 to 7, i.e. roughly the first five seconds of content once the
         response has had time to build (the predicted response lags the picture by a couple of seconds)
  depth  the average response after the build-up, so a long ad is not penalised for its first seconds
  peak   the strongest three-second stretch
  hold   the share of seconds after the build-up that stay at or above the benchmark's typical level

The per-second response is a fixed weighted average of eight dimensions (visual, auditory, reward, memory,
attention, narrative, self-relevance, action) over named cortical regions. Everything in this file is frozen for v1:
changing any constant is a new method version, and old scores keep their version.

Until the benchmark holds enough ads in a band, the measures are reported without ranks and the score is None
("provisional"): a 0-100 number without a benchmark behind it would not mean anything.
"""
import json
import os
from pathlib import Path

import numpy as np

from analysis import ROI_AVERAGER, ROI_LABEL_NAMES

METHOD = "rewire-score-v1"

# Frozen copy of the v1 dimension definitions; not tied to the dashboard's genre weights.
DIMENSIONS = {
    "visual":    (["V1", "V2", "V3", "VMV3", "MT", "MST"], 0.25),
    "auditory":  (["A1", "LBelt", "PBelt", "STSvp"], 0.20),
    "reward":    (["OFC", "p47r", "47m"], 0.20),
    "memory":    (["EC", "PHA1", "PHA2", "PHA3"], 0.15),
    "attention": (["a24pr", "p32pr"], 0.05),
    "narrative": (["TPOJ1", "TPOJ2", "TPOJ3", "STSda", "STSdp"], 0.15),
    "personal":  (["PGi", "PGp", "PGs", "PCV"], 0.10),
    "action":    (["6a", "6d", "FEF", "8Ad"], 0.10),
}
BUILD_UP_S = 2                 # seconds of response build-up skipped by depth and hold
HOOK_WINDOW = (2, 7)           # response seconds that reflect roughly the first five seconds of content
PEAK_WINDOW_S = 3
HEADLINE_WEIGHTS = {"hook": 0.30, "depth": 0.30, "hold": 0.20, "peak": 0.20}
MEASURES = list(HEADLINE_WEIGHTS)
# Length bands, in seconds: a 15-second bumper is ranked against bumpers, not against two-minute films.
BANDS = [("short", "Up to 20 s", 0, 20), ("standard", "21 to 45 s", 20, 45), ("long", "46 to 90 s", 45, 90),
         ("extended", "Over 90 s", 90, float("inf"))]
MIN_ADS_PER_BAND = 30          # fewer than this and ranks are not reported
PROVISIONAL_HOLD_LEVEL = 0.18  # placeholder until a benchmark exists (median of the first test videos); the benchmark sets it

BENCHMARK_PATH = Path(os.environ.get(
    "REWIRE_BENCHMARK", Path(__file__).resolve().parent / "data" / "benchmark" / f"{METHOD}.json"))

_index = {name: i for i, name in enumerate(ROI_LABEL_NAMES)}
_DIM_IDX = {d: [_index[r] for r in rois if r in _index] for d, (rois, _) in DIMENSIONS.items()}
_DIM_W = {d: w for d, (_, w) in DIMENSIONS.items()}


def band_for(seconds: float) -> tuple[str, str]:
    for key, label, lo, hi in BANDS:
        if lo < seconds <= hi or (lo == 0 and seconds <= hi):
            return key, label
    return BANDS[-1][0], BANDS[-1][1]


def response_curves(preds) -> tuple[np.ndarray, dict]:
    """Per-second overall response and per-dimension responses, from a (T, vertices) prediction."""
    roi = np.asarray(np.asarray(preds, dtype=np.float64) @ ROI_AVERAGER)
    dims = {d: roi[:, idx].mean(axis=1) for d, idx in _DIM_IDX.items()}
    total = sum(_DIM_W.values())
    curve = sum(dims[d] * _DIM_W[d] for d in dims) / total
    return curve, dims


def raw_measures(preds, hold_level: float) -> dict:
    """The v1 measures, unranked. Works for any length; very short clips use what they have."""
    curve, dims = response_curves(preds)
    T = len(curve)
    after = curve[BUILD_UP_S:] if T > BUILD_UP_S + 1 else curve
    lo, hi = HOOK_WINDOW
    hook_part = curve[lo:hi] if T > lo else curve
    w = min(PEAK_WINDOW_S, T)
    rolling = np.convolve(curve, np.ones(w) / w, mode="valid")
    out = {
        "hook": float(hook_part.mean()),
        "depth": float(after.mean()),
        "peak": float(rolling.max()),
        "hold": float((after >= hold_level).mean()),
    }
    for d, series in dims.items():
        s = series[BUILD_UP_S:] if T > BUILD_UP_S + 1 else series
        out[f"dim_{d}"] = float(s.mean())
    return {"seconds": T, "values": out, "curve": curve}


def percentile(sorted_values: list, x: float) -> float:
    """Mid-rank percentile of x among the benchmark values (ties count half)."""
    a = np.asarray(sorted_values)
    below = np.searchsorted(a, x, side="left")
    equal = np.searchsorted(a, x, side="right") - below
    return float(100.0 * (below + 0.5 * equal) / len(a))


_cache = {"mtime": None, "data": None}


def load_benchmark() -> dict | None:
    try:
        mtime = BENCHMARK_PATH.stat().st_mtime
    except FileNotFoundError:
        return None
    if _cache["mtime"] != mtime:
        data = json.loads(BENCHMARK_PATH.read_text())
        _cache.update(mtime=mtime, data=data if data.get("method") == METHOD else None)
    return _cache["data"]


def rewire_score(preds) -> dict:
    """The Rewire Score of one creative: measures, their ranks within its length band, and the headline 0-100."""
    bench = load_benchmark()
    hold_level = bench["hold_level"] if bench else PROVISIONAL_HOLD_LEVEL
    m = raw_measures(preds, hold_level)
    band, band_label = band_for(m["seconds"])
    ref = (bench or {}).get("bands", {}).get(band)
    ranked = bool(ref and ref["count"] >= MIN_ADS_PER_BAND)

    measures = {}
    for key, value in m["values"].items():
        entry = {"value": round(value, 4)}
        if ranked and key in ref["values"]:
            entry["percentile"] = round(percentile(ref["values"][key], value), 1)
        measures[key] = entry

    score = None
    if ranked:
        score = int(round(sum(measures[k]["percentile"] * w for k, w in HEADLINE_WEIGHTS.items())
                          / sum(HEADLINE_WEIGHTS.values())))
    return {
        "method": METHOD,
        "status": "benchmarked" if ranked else "provisional",
        "score": score,
        "seconds": m["seconds"],
        "band": band,
        "band_label": band_label,
        "benchmark_ads": ref["count"] if ref else 0,
        "measures": measures,
        "curve": [round(float(v), 4) for v in m["curve"]],
    }
