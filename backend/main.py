"""
Rewire Dashboard — FastAPI Backend (A/B Testing Mode)
Serves pre-computed analysis from brand_A_predictions.pkl & brand_B_predictions.pkl
"""

import os
import sys
import math
from pathlib import Path
from contextlib import asynccontextmanager

import joblib
import numpy as np
from fastapi import FastAPI, Form, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from analysis import run_full_analysis, cohens_d, CONTENT_METADATA_DEFAULTS

# ---------------------------------------------------------------------------
# Global cache — computed once at startup, holds both variants
# ---------------------------------------------------------------------------
_cache_A: dict = {}
_cache_B: dict = {}


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
                else:
                    clean_evt[k] = v
            clean.append(clean_evt)
        return clean
    else:
        return [
            {"start": 3.0, "end": 4.0, "text": "[Narrator starts speaking]"},
            {"start": 12.0, "end": 14.5, "text": "Brand Logo Revealed"},
            {"start": 21.0, "end": 22.0, "text": "[Upbeat Music]"},
            {"start": 28.0, "end": 30.0, "text": "Call to Action"},
        ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load both pkl files and run analysis on startup."""
    global _cache_A, _cache_B

    print("🟡  Backend started. Awaiting PKL upload files from frontend...")
    yield
    _cache_A.clear()
    _cache_B.clear()


app = FastAPI(title="Rewire A/B Dashboard API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_cache(variant: str) -> dict:
    if variant == "A":
        return _cache_A
    elif variant == "B":
        return _cache_B
    raise HTTPException(status_code=400, detail="Variant must be 'A' or 'B'")


# =============================================================================
# API ENDPOINTS — All return { A: ..., B: ... } for comparison
# =============================================================================


@app.get("/api/status")
def get_status():
    return {"loaded": bool(_cache_A and _cache_B)}

@app.post("/api/upload-predictions")
async def upload_predictions(
    fileA: UploadFile = File(...),
    fileB: UploadFile = File(...),
    # V4: Content metadata for enhanced analysis
    genre_A: str = Form("general"),
    genre_B: str = Form("general"),
    content_type_A: str = Form("video_ad"),
    content_type_B: str = Form("video_ad"),
    pacing_A: str = Form("medium"),
    pacing_B: str = Form("medium"),
    audio_profile_A: str = Form("mixed"),
    audio_profile_B: str = Form("mixed"),
    brand_reveal_A: int = Form(-1),
    brand_reveal_B: int = Form(-1),
):
    global _cache_A, _cache_B
    
    base_dir = Path(__file__).resolve().parent.parent
    path_a = base_dir / "brand_A_predictions.pkl"
    path_b = base_dir / "brand_B_predictions.pkl"
    
    with open(path_a, "wb") as f:
        content_a = await fileA.read()
        f.write(content_a)
    with open(path_b, "wb") as f:
        content_b = await fileB.read()
        f.write(content_b)

    # Build content metadata dicts (V4)
    meta_a = {
        "genre": genre_A, "content_type": content_type_A,
        "pacing": pacing_A, "audio_profile": audio_profile_A,
        "brand_reveal_timestamp": brand_reveal_A,
    }
    meta_b = {
        "genre": genre_B, "content_type": content_type_B,
        "pacing": pacing_B, "audio_profile": audio_profile_B,
        "brand_reveal_timestamp": brand_reveal_B,
    }

    print(f"📦  Processing Variant A (genre={genre_A}, pacing={pacing_A})...")
    data_a = joblib.load(str(path_a))
    preds_a = data_a["preds"]
    transcript_a = _clean_transcript(data_a)
    _cache_A = run_full_analysis(preds_a, content_metadata=meta_a, transcript=transcript_a, n_subjects=50, seed=42)
    _cache_A["transcript"] = transcript_a
    
    print(f"📦  Processing Variant B (genre={genre_B}, pacing={pacing_B})...")
    data_b = joblib.load(str(path_b))
    preds_b = data_b["preds"]
    transcript_b = _clean_transcript(data_b)
    _cache_B = run_full_analysis(preds_b, content_metadata=meta_b, transcript=transcript_b, n_subjects=50, seed=43)
    _cache_B["transcript"] = transcript_b
    
    return {"status": "success", "message": "Files analyzed (V4 content-aware engine).", "content_A": meta_a, "content_B": meta_b}

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
    return {"A": _build(_cache_A), "B": _build(_cache_B)}


@app.get("/api/top-rois")
def get_top_rois():
    """Top 5 ROIs by peak activation + their time-series — both variants."""
    return {"A": _cache_A["top_rois"], "B": _cache_B["top_rois"]}


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
    return {"A": _build(_cache_A), "B": _build(_cache_B)}


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
    return {"A": _build(_cache_A), "B": _build(_cache_B)}


@app.get("/api/heatmap")
def get_heatmap():
    """Inter-subject variance heatmap — both variants."""
    return {"A": _cache_A["heatmap"], "B": _cache_B["heatmap"]}


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
    return {"A": _build(_cache_A), "B": _build(_cache_B)}


@app.get("/api/content-profile")
def get_content_profile():
    """V4: Return content analysis metadata for both variants."""
    return {
        "A": _cache_A.get("content_profile", {"engine_version": "V3", "content_aware": False}),
        "B": _cache_B.get("content_profile", {"engine_version": "V3", "content_aware": False}),
    }


@app.get("/api/ab-summary")
def get_ab_summary():
    """Quick A/B comparison summary — who wins overall? (V4: includes effect sizes)"""
    a_eng = _cache_A["engagement_scores"]
    b_eng = _cache_B["engagement_scores"]

    # Overall score per demographic
    a_overall = {d: a_eng[d]["overall"] for d in a_eng}
    b_overall = {d: b_eng[d]["overall"] for d in b_eng}

    a_global_mean = float(np.mean(_cache_A["preds"].mean(axis=1)))
    b_global_mean = float(np.mean(_cache_B["preds"].mean(axis=1)))

    a_peak = float(_cache_A["preds"].max())
    b_peak = float(_cache_B["preds"].max())

    # Dimension-level winner for each demographic
    dimension_winners = {}
    dims = ["visual", "auditory", "reward", "memory", "attention", "narrative", "personal", "action", "overall"]
    for demo in a_eng:
        dimension_winners[demo] = {}
        for dim in dims:
            a_val = a_eng[demo].get(dim, 0)
            b_val = b_eng[demo].get(dim, 0)
            diff = b_val - a_val
            dimension_winners[demo][dim] = {
                "A": round(a_val, 4),
                "B": round(b_val, 4),
                "diff": round(diff, 4),
                "winner": "B" if diff > 0 else "A" if diff < 0 else "TIE",
            }

    return {
        "A_overall_engagement": a_overall,
        "B_overall_engagement": b_overall,
        "A_global_mean": round(a_global_mean, 4),
        "B_global_mean": round(b_global_mean, 4),
        "A_peak_activation": round(a_peak, 4),
        "B_peak_activation": round(b_peak, 4),
        "dimension_winners": dimension_winners,
        "n_timesteps_A": _cache_A["n_timesteps"],
        "n_timesteps_B": _cache_B["n_timesteps"],
    }
