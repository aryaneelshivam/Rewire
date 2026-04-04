"""
Rewire Dashboard — FastAPI Backend (A/B Testing Mode)
Serves pre-computed analysis from brand_A_predictions.pkl & brand_B_predictions.pkl
"""

import os
import sys
import math
from pathlib import Path
from contextlib import asynccontextmanager

import uuid
import joblib
import numpy as np
import traceback
from io import BytesIO
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from analysis import run_full_analysis

# ---------------------------------------------------------------------------
# Global Session Storage
# ---------------------------------------------------------------------------
_sessions: dict = {}


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
    global _sessions
    _sessions.clear()
    print("🟡  Backend started. Awaiting PKL upload files from frontend...")
    yield
    _sessions.clear()


app = FastAPI(title="Rewire A/B Dashboard API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_detail = traceback.format_exc()
    print(f"❌ INTERNAL SERVER ERROR:\n{error_detail}")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": str(exc), "detail": error_detail},
        headers={"Access-Control-Allow-Origin": "*"}
    )


def _get_cache(session_id: str, variant: str) -> dict:
    if session_id not in _sessions:
        raise HTTPException(status_code=400, detail="Session expired or not found. Please re-upload PKL files.")
    
    if variant not in ["A", "B"]:
        raise HTTPException(status_code=400, detail="Variant must be 'A' or 'B'")
        
    return _sessions[session_id][variant]


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/api/status")
def get_status(session_id: str = Query(None)):
    if not session_id or session_id not in _sessions:
        return {"loaded": False}
    return {"loaded": True}

@app.post("/api/upload-predictions")
async def upload_predictions(fileA: UploadFile = File(...), fileB: UploadFile = File(...)):
    global _sessions
    
    session_id = str(uuid.uuid4())
    print(f"📡  Incoming Upload Session: {session_id}")
    
    try:
        print(f"📥  Reading Variant A into memory...")
        content_a = await fileA.read()
        data_a = joblib.load(BytesIO(content_a))
        
        print(f"📥  Reading Variant B into memory...")
        content_b = await fileB.read()
        data_b = joblib.load(BytesIO(content_b))
        
        print(f"🧠  Running Analysis for Variant A...")
        preds_a = data_a["preds"]
        cache_A = run_full_analysis(preds_a, n_subjects=50, seed=42)
        cache_A["transcript"] = _clean_transcript(data_a)
        
        print(f"🧠  Running Analysis for Variant B...")
        preds_b = data_b["preds"]
        cache_B = run_full_analysis(preds_b, n_subjects=50, seed=43)
        cache_B["transcript"] = _clean_transcript(data_b)
        
        _sessions[session_id] = {"A": cache_A, "B": cache_B}
        print(f"✅  Analysis Complete. Session {session_id} active.")
        
        return {"status": "success", "session_id": session_id, "message": "Files analyzed and ready."}
        
    except Exception as e:
        print(f"💥  UPLOAD FAILED: {str(e)}")
        raise e  # Global handler catches this

@app.get("/api/overview")
def get_overview(session_id: str = Query(...)):
    """Global activation metrics per timestep + metadata — both variants."""
    try:
        cA = _get_cache(session_id, "A")
        cB = _get_cache(session_id, "B")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Session expired")
        
    def _build(c):
        return {
            "n_timesteps": c["n_timesteps"],
            "n_vertices": c["n_vertices"],
            "peak_timestep": c["peak_timestep"],
            "timestep_metrics": c["timestep_metrics"],
            "transcript": c.get("transcript", []),
        }
    return {"A": _build(cA), "B": _build(cB)}


@app.get("/api/top-rois")
def get_top_rois(session_id: str = Query(...)):
    """Top 5 ROIs by peak activation + their time-series — both variants."""
    return {"A": _get_cache(session_id, "A")["top_rois"], "B": _get_cache(session_id, "B")["top_rois"]}


@app.get("/api/engagement")
def get_engagement(session_id: str = Query(...)):
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
    return {"A": _build(_get_cache(session_id, "A")), "B": _build(_get_cache(session_id, "B"))}


@app.get("/api/timeseries")
def get_demo_timeseries(session_id: str = Query(...)):
    """Reward / auditory / PFC time-series by demographic — both variants."""
    groups = ["reward", "auditory", "prefrontal", "memory", "narrative", "personal", "action"]
    def _build(c):
        return {
            "timeseries": c["demo_timeseries"],
            "demo_labels": c["demo_labels"],
            "demo_colors": c["demo_colors"],
            "groups": groups,
        }
    return {"A": _build(_get_cache(session_id, "A")), "B": _build(_get_cache(session_id, "B"))}


@app.get("/api/heatmap")
def get_heatmap(session_id: str = Query(...)):
    """Inter-subject variance heatmap — both variants."""
    return {"A": _get_cache(session_id, "A")["heatmap"], "B": _get_cache(session_id, "B")["heatmap"]}


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
def get_brain_activation(timestep: int, session_id: str = Query(...), demographic: str = "baseline", variant: str = "A"):
    """Activation values for all 20484 vertices at a specific timestep — for a specific variant."""
    c = _get_cache(session_id, variant)

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
def get_demographics(session_id: str = Query(...)):
    """Summary stats for demographic cohorts — both variants."""
    def _build(c):
        return {
            "demographics": list(c["demo_labels"].keys()),
            "labels": c["demo_labels"],
            "colors": c["demo_colors"],
            "peak_data": c["demo_peak_data"],
            "engagement": c["engagement_scores"],
        }
    return {"A": _build(_get_cache(session_id, "A")), "B": _build(_get_cache(session_id, "B"))}


@app.get("/api/ab-summary")
def get_ab_summary(session_id: str = Query(...)):
    """Quick A/B comparison summary — who wins overall?"""
    cA = _get_cache(session_id, "A")
    cB = _get_cache(session_id, "B")
    
    a_eng = cA["engagement_scores"]
    b_eng = cB["engagement_scores"]

    # Overall score per demographic
    a_overall = {d: a_eng[d]["overall"] for d in a_eng}
    b_overall = {d: b_eng[d]["overall"] for d in b_eng}

    a_global_mean = float(np.mean(cA["preds"].mean(axis=1)))
    b_global_mean = float(np.mean(cB["preds"].mean(axis=1)))

    a_peak = float(cA["preds"].max())
    b_peak = float(cB["preds"].max())

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
