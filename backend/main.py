"""
Rewire Dashboard — FastAPI Backend (A/B Testing Mode)
Serves pre-computed analysis from brand_A_predictions.pkl & brand_B_predictions.pkl
"""

import os
import sys
import json
import math
import shutil
import time
from pathlib import Path
from contextlib import asynccontextmanager

import joblib
import numpy as np
from fastapi import Body, FastAPI, Form, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from pipeline import JobManager
import runs
from runs import latest_run
from analysis import run_full_analysis, cohens_d, CONTENT_METADATA_DEFAULTS, ROI_LABEL_NAMES, LABELLED_ROIS, VERTEX_ROI, DEMO_ORDER

# ---------------------------------------------------------------------------
# Results — the analysed variants of the current run, in order (A, then B when comparing)
# ---------------------------------------------------------------------------
_results: dict = {}
_run_info: dict = {}

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_FILES = {"A": ROOT / "brand_A_predictions.pkl", "B": ROOT / "brand_B_predictions.pkl"}


def _clean_transcript(data):
    """Extract and sanitize transcript from prediction data."""
    transcript = data.get("transcript", [])
    if transcript:
        clean = []
        for evt in transcript:
            clean_evt = {}
            for k, v in evt.items():
                if isinstance(v, float) and math.isnan(v):
                    clean_evt[k] = None
                elif isinstance(v, (str, int, float, bool)) or v is None:
                    clean_evt[k] = v
                else:
                    clean_evt[k] = str(v)
            clean.append(clean_evt)
        return clean
    return []


def _analyse(preds, transcript, metadata=None, seed=42, on_step=None) -> dict:
    """Runs the audience synthesis and scoring on one variant's predictions."""
    transcript = _clean_transcript({"transcript": transcript})
    cache = run_full_analysis(np.asarray(preds), content_metadata=metadata or None, transcript=transcript,
                              n_subjects=50, seed=seed, on_step=on_step)
    cache["transcript"] = transcript
    return cache


def _load_files(files: dict, metadata: dict | None = None) -> dict:
    """Analyses saved prediction files ({variant: path}), seeding A with 42 and B with 43 as before."""
    out = {}
    for i, (variant, path) in enumerate(files.items()):
        data = joblib.load(str(path))
        print(f"🧠  Analysing Variant {variant} from {Path(path).name}...")
        out[variant] = _analyse(data["preds"], data.get("transcript", []), (metadata or {}).get(variant), 42 + i)
    return out


def _set_results(results: dict, info: dict):
    global _results, _run_info
    _results = dict(results)
    _run_info = info
    # A saved run keeps a summary of its results, so the workspace can list outcomes without reopening each run.
    if info.get("source") in ("run", "import") and info.get("id"):
        try:
            runs.update(info["id"], summary=runs.summarise(_results))
        except Exception as e:
            print(f"⚠️  Could not save the run summary: {e}")


def _open_run(run_id: str):
    info = runs.read(run_id)
    path = runs.folder(run_id)
    files = {v: path / f"{v}.pkl" for v in info["variants"]}
    _set_results(_load_files(files, info.get("metadata")), {**info, "source": "run"})


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Loads the latest completed run, or the bundled sample pair, so the dashboard opens with data."""
    try:
        run = latest_run()
        if run:
            _open_run(run.name)
            print(f"✅  Loaded run {run.name}.")
        elif all(p.exists() for p in SAMPLE_FILES.values()):
            _set_results(_load_files(SAMPLE_FILES), {"source": "sample", "variants": ["A", "B"], "mode": "compare"})
            print("✅  Loaded the sample pair.")
        else:
            print("🟡  No data yet. Waiting for an analysis.")
    except Exception as e:
        print(f"⚠️  Startup load skipped: {e}")
    yield
    _results.clear()


app = FastAPI(title="Rewire API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_cache(variant: str) -> dict:
    if not _results:
        raise HTTPException(status_code=400, detail="No analysis is loaded yet")
    if variant not in _results:
        raise HTTPException(status_code=404, detail=f"Variant '{variant}' is not in this analysis")
    return _results[variant]


def _each(build) -> dict:
    """Applies build to every loaded variant: {"A": ..., "B": ...} or just {"A": ...}."""
    if not _results:
        raise HTTPException(status_code=400, detail="No analysis is loaded yet")
    return {v: build(c) for v, c in _results.items()}


jobs = JobManager(on_results=lambda results, job_id: None, analyse=_analyse)


def _on_job_results(results: dict, job_id: str):
    _set_results(results, {**runs.read(job_id), "source": "run"})


jobs.on_results = _on_job_results


# =============================================================================
# API ENDPOINTS — each returns one entry per loaded variant
# =============================================================================

@app.get("/api/status")
def get_status():
    videos = {}
    if _run_info.get("id") and not _run_info.get("deleted"):
        try:
            videos = {v: bool(runs.video_file(_run_info["id"], v)) for v in _results}
        except KeyError:
            pass
    return {"loaded": bool(_results), "variants": list(_results), "run": _run_info, "videos": videos,
            "active_job": jobs.active.id if jobs.active else None}


@app.post("/api/jobs")
async def create_job(
    mode: str = Form("single"),
    videoA: UploadFile = File(...),
    videoB: UploadFile | None = File(None),
    genre_A: str = Form("general"), genre_B: str = Form("general"),
    content_type_A: str = Form("video_ad"), content_type_B: str = Form("video_ad"),
    pacing_A: str = Form("medium"), pacing_B: str = Form("medium"),
    audio_profile_A: str = Form("mixed"), audio_profile_B: str = Form("mixed"),
):
    """Starts an analysis of one video, or two to compare. Poll GET /api/jobs/{id} for progress."""
    if mode not in ("single", "compare"):
        raise HTTPException(status_code=400, detail="mode must be 'single' or 'compare'")
    if mode == "compare" and videoB is None:
        raise HTTPException(status_code=400, detail="Comparing needs two videos")
    files = [("A", videoA.filename or "video-a.mp4", await videoA.read())]
    if mode == "compare":
        files.append(("B", videoB.filename or "video-b.mp4", await videoB.read()))
    metadata = {
        "A": {"genre": genre_A, "content_type": content_type_A, "pacing": pacing_A, "audio_profile": audio_profile_A},
        "B": {"genre": genre_B, "content_type": content_type_B, "pacing": pacing_B, "audio_profile": audio_profile_B},
    }
    metadata = {v: metadata[v] for v, _, _ in files}
    try:
        job = jobs.create(mode, files, metadata)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"job_id": job.id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="No such analysis")
    return job.to_dict()


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    job = jobs.cancel(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="No such analysis")
    return job.to_dict()


@app.post("/api/upload-predictions")
async def upload_predictions(
    fileA: UploadFile = File(...),
    fileB: UploadFile | None = File(None),
    genre_A: str = Form("general"), genre_B: str = Form("general"),
    content_type_A: str = Form("video_ad"), content_type_B: str = Form("video_ad"),
    pacing_A: str = Form("medium"), pacing_B: str = Form("medium"),
    audio_profile_A: str = Form("mixed"), audio_profile_B: str = Form("mixed"),
    brand_reveal_A: int = Form(-1), brand_reveal_B: int = Form(-1),
):
    """Imports saved prediction files: one to analyse, or two to compare."""
    uploads = {"A": fileA, **({"B": fileB} if fileB is not None else {})}
    metadata = {
        "A": {"genre": genre_A, "content_type": content_type_A, "pacing": pacing_A, "audio_profile": audio_profile_A, "brand_reveal_timestamp": brand_reveal_A},
        "B": {"genre": genre_B, "content_type": content_type_B, "pacing": pacing_B, "audio_profile": audio_profile_B, "brand_reveal_timestamp": brand_reveal_B},
    }
    # Imported predictions are saved as a run, so they appear in the workspace like any other analysis.
    run_id = runs.new_run_id()
    path = runs.RUNS_DIR / run_id
    path.mkdir(parents=True, exist_ok=True)
    try:
        paths = {}
        for v, up in uploads.items():
            paths[v] = path / f"{v}.pkl"
            paths[v].write_bytes(await up.read())
        results = _load_files(paths, metadata)
    except Exception as e:
        shutil.rmtree(path, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"These files could not be read as predictions: {e}")
    names = {v: up.filename for v, up in uploads.items()}
    metadata = {v: metadata[v] for v in uploads}
    runs.write(path, {
        "id": run_id, "title": runs.default_title(names), "mode": "compare" if len(results) > 1 else "single",
        "source": "import", "engine": None, "created": time.time(), "variants": list(results), "names": names,
        "durations": {v: int(c["n_timesteps"]) for v, c in results.items()}, "metadata": metadata,
    })
    _set_results(results, {**runs.read(run_id), "source": "import"})
    return {"status": "success", "variants": list(results), "run_id": run_id}


# ── Workspace: saved runs ─────────────────────────────────────────────────

def _run_or_404(run_id: str):
    try:
        return runs.folder(run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="No such analysis in the workspace")


@app.get("/api/runs")
def list_runs():
    """Every saved analysis, newest first, with its title, files, length and result summary."""
    current = _run_info.get("id")
    return {"runs": runs.list_runs(), "current": current}


@app.post("/api/runs/{run_id}/open")
def open_run(run_id: str):
    """Loads a saved analysis into the dashboard."""
    _run_or_404(run_id)
    if jobs.active:
        raise HTTPException(status_code=409, detail="An analysis is running. Open saved work when it finishes.")
    _open_run(run_id)
    return {"status": "success", "variants": list(_results), "run": _run_info}


@app.patch("/api/runs/{run_id}")
def rename_run(run_id: str, title: str = Body(..., embed=True)):
    _run_or_404(run_id)
    title = title.strip()[:120]
    if not title:
        raise HTTPException(status_code=400, detail="A title cannot be empty")
    info = runs.update(run_id, title=title)
    if _run_info.get("id") == run_id:
        _run_info["title"] = title
    return {"id": run_id, "title": info["title"]}


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str):
    """Deletes a saved analysis and its files. The dashboard keeps showing it until something else is opened."""
    _run_or_404(run_id)
    if jobs.active and jobs.active.id == run_id:
        raise HTTPException(status_code=409, detail="This analysis is still running")
    runs.delete(run_id)
    if _run_info.get("id") == run_id:
        _run_info["deleted"] = True
    return {"deleted": run_id}


@app.get("/api/runs/{run_id}/video/{variant}")
def run_video(run_id: str, variant: str):
    _run_or_404(run_id)
    path = runs.video_file(run_id, variant)
    if not path:
        raise HTTPException(status_code=404, detail="This analysis kept no video for that variant")
    return FileResponse(path)


@app.get("/api/runs/{run_id}/thumb/{variant}")
def run_thumb(run_id: str, variant: str):
    path = _run_or_404(run_id) / f"{variant}.jpg"
    if not path.exists() or variant not in ("A", "B"):
        raise HTTPException(status_code=404, detail="No thumbnail")
    return FileResponse(path, media_type="image/jpeg")


@app.post("/api/load-sample-data")
async def load_sample_data():
    """Loads the bundled sample pair."""
    if not all(p.exists() for p in SAMPLE_FILES.values()):
        raise HTTPException(status_code=404, detail="The sample prediction files are missing.")
    _set_results(_load_files(SAMPLE_FILES), {"source": "sample", "variants": ["A", "B"], "mode": "compare"})
    return {"status": "success", "message": "Sample files loaded"}


@app.get("/api/overview")
def get_overview():
    """Global activation metrics per timestep + metadata — both variants."""
    def _build(c):
        return {
            "n_timesteps": c["n_timesteps"],
            "n_vertices": c["n_vertices"],
            "peak_timestep": c["peak_timestep"],
            "timestep_metrics": c["timestep_metrics"],
            "transcript": c.get("transcript", []),
        }
    return _each(_build)


@app.get("/api/top-rois")
def get_top_rois():
    """Top 5 ROIs by peak activation + their time-series — both variants."""
    return _each(lambda c: c["top_rois"])


@app.get("/api/engagement")
def get_engagement():
    """Per-demographic engagement scores — both variants."""
    dims = ["visual", "auditory", "reward", "memory", "attention", "narrative", "personal", "action", "overall"]
    def _build(c):
        return {
            "scores": c["engagement_scores"],
            "best_demographic": c["best_demographic"],
            "demo_labels": c["demo_labels"],
            "demo_colors": c["demo_colors"],
            "dimensions": dims,
        }
    return _each(_build)


@app.get("/api/timeseries")
def get_demo_timeseries():
    """Reward / auditory / PFC time-series by demographic — both variants."""
    groups = ["reward", "auditory", "prefrontal", "memory", "narrative", "personal", "action"]
    def _build(c):
        return {
            "timeseries": c["demo_timeseries"],
            "demo_labels": c["demo_labels"],
            "demo_colors": c["demo_colors"],
            "groups": groups,
        }
    return _each(_build)


@app.get("/api/heatmap")
def get_heatmap():
    """Inter-subject variance heatmap — both variants."""
    return _each(lambda c: c["heatmap"])


@app.get("/api/brain-mesh")
def get_brain_mesh():
    """Fsaverage5 mesh geometry — shared across A and B (same brain template)."""
    from nilearn import datasets, surface as nisurf

    fsaverage = datasets.fetch_surf_fsaverage("fsaverage5")
    coords_left, faces_left = nisurf.load_surf_mesh(fsaverage["pial_left"])
    coords_right, faces_right = nisurf.load_surf_mesh(fsaverage["pial_right"])

    n_verts_left = coords_left.shape[0]
    faces_right_offset = faces_right + n_verts_left

    return {
        "vertices": np.concatenate([coords_left, coords_right]).tolist(),
        "faces": np.concatenate([faces_left, faces_right_offset]).tolist(),
        "n_vertices_left": n_verts_left,
        "n_vertices_right": coords_right.shape[0],
    }


@app.get("/api/brain-activation/{timestep}")
def get_brain_activation(timestep: int, demographic: str = "baseline", variant: str = "A"):
    """Activation values for all 20484 vertices at a specific timestep — for a specific variant."""
    c = _get_cache(variant)

    if demographic == "baseline":
        preds = c["preds"]
        if timestep < 0 or timestep >= preds.shape[0]:
            raise HTTPException(status_code=400, detail=f"Timestep must be 0–{preds.shape[0]-1}")
        activation = preds[timestep].tolist()
    else:
        demo_mean_brains = c.get("demo_mean_brains", {})
        if demographic not in demo_mean_brains:
            raise HTTPException(status_code=404, detail="Demographic not found")
        brain_data = demo_mean_brains[demographic]
        if timestep < 0 or timestep >= len(brain_data):
            raise HTTPException(status_code=400, detail="Invalid timestep")
        activation = brain_data[timestep]

    return {
        "timestep": timestep,
        "demographic": demographic,
        "variant": variant,
        "activation": activation,
    }


def _profiles(variant: str) -> dict:
    profiles = _get_cache(variant).get("profiles")
    if not profiles:
        raise HTTPException(status_code=400, detail="No analysis is loaded yet")
    return profiles


@app.get("/api/ensemble")
def get_ensemble(variant: str = "A"):
    """Every simulated viewer of one variant: who they are and how they responded, compactly.

    trajectory: whole-brain response per second; regions: time-averaged response per labelled region;
    networks: per-second response of seven functional groups; dimensions: engagement score per dimension.
    """
    p = _profiles(variant)
    r4 = lambda a: np.round(np.asarray(a, dtype=np.float64), 4).tolist()
    regions = p["roi_tensor"][:, :, LABELLED_ROIS].mean(axis=1)
    c = _get_cache(variant)
    return {
        "variant": variant,
        "n_profiles": len(p["cohorts"]),
        "n_timesteps": int(p["roi_tensor"].shape[1]),
        "cohorts": p["cohorts"],
        "cohort_order": DEMO_ORDER,
        "cohort_labels": c.get("demo_labels", {}),
        "roi_labels": [ROI_LABEL_NAMES[i] for i in LABELLED_ROIS],
        "trajectory": r4(p["trajectory"]),
        "regions": r4(regions),
        "networks": {k: r4(v) for k, v in p["networks"].items()},
        "dimensions": {k: r4(v) for k, v in p["dimensions"].items()},
    }


class EnsembleActivationRequest(BaseModel):
    variant: str = "A"
    timestep: int = 0
    ids: list[int]
    mode: str = "cluster"   # cluster, rest, or difference


@app.post("/api/ensemble/activation")
def ensemble_activation(req: EnsembleActivationRequest):
    """A group of viewers' mean regional response at one second, painted onto the cortical mesh.

    mode "difference" shows where the group responds more than everyone else, scaled to the mesh's colour range.
    """
    p = _profiles(req.variant)
    tensor = p["roi_tensor"]
    n, T, _ = tensor.shape
    t = max(0, min(req.timestep, T - 1))
    ids = sorted({i for i in req.ids if 0 <= i < n})
    if not ids:
        raise HTTPException(status_code=400, detail="Choose at least one profile")
    inside = np.zeros(n, dtype=bool)
    inside[ids] = True
    group = tensor[inside, t].mean(axis=0)
    rest = tensor[~inside, t].mean(axis=0) if (~inside).any() else np.zeros_like(group)
    if req.mode == "rest":
        values = rest
    elif req.mode == "difference":
        diff = group - rest
        top = float(np.abs(diff[LABELLED_ROIS]).max()) or 1.0
        # Only where the group is higher is painted; the colour map starts at 0.05 and saturates near 0.9.
        values = np.where(diff > 0, 0.05 + 0.85 * diff / top, 0.0)
    else:
        values = group
    values = values.astype(np.float64)
    values[[i for i, name in enumerate(ROI_LABEL_NAMES) if name == "?"]] = 0.0
    return {
        "timestep": t,
        "mode": req.mode,
        "n_selected": len(ids),
        "activation": np.round(values[VERTEX_ROI], 4).tolist(),
    }


@app.get("/api/demographics")
def get_demographics():
    """Summary stats for demographic cohorts — both variants."""
    def _build(c):
        return {
            "demographics": list(c["demo_labels"].keys()),
            "labels": c["demo_labels"],
            "colors": c["demo_colors"],
            "peak_data": c["demo_peak_data"],
            "engagement": c["engagement_scores"],
        }
    return _each(_build)


@app.get("/api/content-profile")
def get_content_profile():
    """V4: Return content analysis metadata for both variants."""
    return _each(lambda c: c.get("content_profile", {"engine_version": "V3", "content_aware": False}))


@app.get("/api/ab-summary")
def get_ab_summary():
    """Who wins overall, per cohort and dimension. With one variant, a summary of that creative instead."""
    dims = ["visual", "auditory", "reward", "memory", "attention", "narrative", "personal", "action", "overall"]
    if not _results:
        raise HTTPException(status_code=400, detail="No analysis is loaded yet")
    if len(_results) == 1:
        (variant, c), = _results.items()
        eng = c["engagement_scores"]
        return {
            "mode": "single",
            "variant": variant,
            "global_mean": round(float(np.mean(c["preds"].mean(axis=1))), 4),
            "peak_activation": round(float(c["preds"].max()), 4),
            "overall_engagement": {d: eng[d]["overall"] for d in eng},
            "best_demographic": c["best_demographic"],
            "scores": {d: {dim: round(eng[d].get(dim, 0), 4) for dim in dims} for d in eng},
            "n_timesteps": c["n_timesteps"],
        }
    a, b = _results["A"], _results["B"]
    a_eng, b_eng = a["engagement_scores"], b["engagement_scores"]
    dimension_winners = {}
    for demo in a_eng:
        dimension_winners[demo] = {}
        for dim in dims:
            a_val, b_val = a_eng[demo].get(dim, 0), b_eng[demo].get(dim, 0)
            diff = b_val - a_val
            dimension_winners[demo][dim] = {
                "A": round(a_val, 4), "B": round(b_val, 4), "diff": round(diff, 4),
                "winner": "B" if diff > 0 else "A" if diff < 0 else "TIE",
            }
    return {
        "mode": "compare",
        "A_overall_engagement": {d: a_eng[d]["overall"] for d in a_eng},
        "B_overall_engagement": {d: b_eng[d]["overall"] for d in b_eng},
        "A_global_mean": round(float(np.mean(a["preds"].mean(axis=1))), 4),
        "B_global_mean": round(float(np.mean(b["preds"].mean(axis=1))), 4),
        "A_peak_activation": round(float(a["preds"].max()), 4),
        "B_peak_activation": round(float(b["preds"].max()), 4),
        "dimension_winners": dimension_winners,
        "n_timesteps_A": a["n_timesteps"],
        "n_timesteps_B": b["n_timesteps"],
    }
