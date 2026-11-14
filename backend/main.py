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

import functools
import threading
from collections.abc import MutableMapping

import joblib
import numpy as np
from fastapi import Body, FastAPI, Form, HTTPException, Query, Request, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

import auth
import credits
import assistant
from pipeline import JobManager
from score import rewire_score
import runs
from runs import latest_run
from analysis import (run_full_analysis, contest_winner, overall_verdict, cohens_d, CONTENT_METADATA_DEFAULTS, ROI_LABEL_NAMES,
                      LABELLED_ROIS, VERTEX_ROI, DEMO_ORDER, VIEWERS_DEFAULT, VIEWERS_MIN, VIEWERS_MAX, VIEWERS_STEP,
                      check_viewers)

# ---------------------------------------------------------------------------
# Results: each user's open analysis. `_results` (the analysed variants, A then B) and `_run_info` (the run they came
# from) read and write the signed-in user's own session, so every endpoint below serves only that user's work.
# Sessions load lazily (the user's latest run) and the least recently used are released to keep memory in check;
# a released session reloads its run on its next request.
# ---------------------------------------------------------------------------
MAX_OPEN = max(1, int(os.environ.get("REWIRE_MAX_OPEN", "6")))


class _Session:
    def __init__(self):
        self.results: dict = {}
        self.info: dict = {}
        self.loaded = False
        self.used = time.time()
        self.lock = threading.RLock()


_sessions: dict[str, _Session] = {}
_sessions_lock = threading.Lock()


def _session() -> _Session:
    user = auth.current_user()
    with _sessions_lock:
        s = _sessions.get(user)
        if s is None:
            s = _sessions[user] = _Session()
        s.used = time.time()
        # Release the analyses of the least recently active users beyond the limit (their runs stay on disk).
        idle = sorted((u for u, x in _sessions.items() if u != user and x.loaded), key=lambda u: _sessions[u].used)
        for u in idle[: max(0, sum(x.loaded for x in _sessions.values()) - MAX_OPEN)]:
            _sessions[u].results, _sessions[u].loaded = {}, False
    if not s.loaded:
        with s.lock:
            if not s.loaded:
                s.loaded = True
                _restore(s)
    return s


class _View(MutableMapping):
    """A dict that is always the current user's session results or run info."""
    def __init__(self, attr):
        self.attr = attr
    def _d(self):
        return getattr(_session(), self.attr)
    def __getitem__(self, key):
        return self._d()[key]
    def __setitem__(self, key, value):
        self._d()[key] = value
    def __delitem__(self, key):
        del self._d()[key]
    def __iter__(self):
        return iter(self._d())
    def __len__(self):
        return len(self._d())


_results = _View("results")
_run_info = _View("info")

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


def _analyse(preds, transcript, metadata=None, seed=42, on_step=None, viewers=VIEWERS_DEFAULT) -> dict:
    """Runs the audience synthesis and scoring on one variant's predictions, with `viewers` simulated viewers."""
    transcript = _clean_transcript({"transcript": transcript})
    cache = run_full_analysis(np.asarray(preds), content_metadata=metadata or None, transcript=transcript,
                              n_subjects=viewers // len(DEMO_ORDER), seed=seed, on_step=on_step)
    cache["transcript"] = transcript
    cache["rewire_score"] = rewire_score(preds)
    return cache


def _load_files(files: dict, metadata: dict | None = None, viewers: int = VIEWERS_DEFAULT) -> dict:
    """Analyses saved prediction files ({variant: path}). Every variant uses the same seed, so the same simulated
    viewers watch each video and A/B differences come from the videos."""
    out = {}
    for i, (variant, path) in enumerate(files.items()):
        data = joblib.load(str(path))
        print(f"🧠  Analysing Variant {variant} from {Path(path).name}...")
        out[variant] = _analyse(data["preds"], data.get("transcript", []), (metadata or {}).get(variant), 42,
                                viewers=viewers)
    return out


def _set_results(results: dict, info: dict):
    s = _session()
    s.results, s.info = dict(results), dict(info)
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
    _set_results(_load_files(files, info.get("metadata"), info.get("viewers", VIEWERS_DEFAULT)), {**info, "source": "run"})


def _restore(s: _Session):
    """Opens a session on its user's last analysis: the run it had open, else their latest. A new signed-in user
    starts empty (the start screen); without sign-in, the local user falls back to the sample pair, as before."""
    try:
        wanted = s.info.get("id") if s.info.get("source") in ("run", "import") and not s.info.get("deleted") else None
        if wanted:
            try:
                runs.folder(wanted)
            except KeyError:
                wanted = None
        run = wanted or (latest_run().name if latest_run() else None)
        if run:
            _open_run(run)
        elif not auth.ENABLED and all(p.exists() for p in SAMPLE_FILES.values()):
            _set_results(_load_files(SAMPLE_FILES), {"source": "sample", "variants": ["A", "B"], "mode": "compare"})
    except Exception as e:
        print(f"⚠️  Could not reopen the last analysis: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Analyses load per user on their first request, so startup is quick."""
    if auth.ENABLED:
        print(f"🔐  Sign-in is on ({auth.ISSUER}). Each user has a private workspace.")
    else:
        print("🔓  Sign-in is off: one local workspace. Set CLERK_PUBLISHABLE_KEY to turn it on.")
    yield
    _sessions.clear()


app = FastAPI(title="Rewire API", version="3.0.0", lifespan=lifespan)


@app.middleware("http")
async def authenticate(request, call_next):
    """Every /api request needs a valid Clerk session (when sign-in is on), and then runs as that user.
    Media links carry their own signature, since <video> and <img> cannot send a token."""
    path = request.url.path
    if not auth.ENABLED or request.method == "OPTIONS" or not path.startswith("/api/") or path.startswith("/api/media/"):
        return await call_next(request)
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    if not token:
        return JSONResponse({"detail": "Sign in to continue."}, status_code=401)
    try:
        user = await run_in_threadpool(auth.verify, token)
    except auth.AuthError as e:
        return JSONResponse({"detail": str(e)}, status_code=401)
    marker = auth.set_user(user)
    try:
        return await call_next(request)
    finally:
        auth.reset_user(marker)


class _Compress:
    """Gzip for API responses (JSON shrinks 60 to 90%). Media links are left alone: videos are already compressed,
    and players need byte ranges, which compression would break. The chat stream is left alone too: gzip holds small
    chunks back until it has enough to compress, which would stall the answer (and the keep-alive) mid-stream."""
    def __init__(self, app):
        from starlette.middleware.gzip import GZipMiddleware
        self.app, self.gzip = app, GZipMiddleware(app, minimum_size=1024, compresslevel=6)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and not scope["path"].startswith(("/api/media/", "/api/chat")):
            return await self.gzip(scope, receive, send)
        return await self.app(scope, receive, send)


app.add_middleware(_Compress)


# Added after the sign-in check, so it wraps it: refusals carry CORS headers too and the browser can read them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(auth.AUTHORIZED_PARTIES) if auth.ENABLED else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _media(run_id: str, variants) -> dict:
    """Signed links to a run's kept videos and thumbnails, per variant (None where a file is missing)."""
    out = {}
    try:
        folder = runs.folder(run_id)
    except KeyError:
        return out
    for v in variants:
        out[v] = {
            "video": f"/api/media/{auth.sign_media(run_id, v, 'video')}" if runs.video_file(run_id, v) else None,
            "thumb": f"/api/media/{auth.sign_media(run_id, v, 'thumb')}" if (folder / f"{v}.jpg").exists() else None,
        }
    return out


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

def _email(request) -> str:
    """The email the browser says the person signed in with; used only to label them in the admin list."""
    return (request.headers.get("x-rewire-email") or "").strip()[:254]


@app.get("/api/status")
def get_status(request: Request):
    videos = {}
    if _run_info.get("id") and not _run_info.get("deleted"):
        try:
            videos = {v: bool(runs.video_file(_run_info["id"], v)) for v in _results}
        except KeyError:
            pass
    active = jobs.active_for(auth.current_user())
    media = _media(_run_info["id"], list(_results)) if _run_info.get("id") and not _run_info.get("deleted") else {}
    viewers = next((c.get("n_viewers", VIEWERS_DEFAULT) for c in _results.values()), VIEWERS_DEFAULT)
    return {"loaded": bool(_results), "variants": list(_results), "run": dict(_run_info), "videos": videos, "media": media,
            "viewers": viewers, "viewer_options": {"min": VIEWERS_MIN, "max": VIEWERS_MAX, "step": VIEWERS_STEP, "default": VIEWERS_DEFAULT},
            "active_job": active.id if active else None, "credits": credits.summary(email=_email(request))}


@app.get("/api/credits")
def get_credits(request: Request):
    """The signed-in person's test credits: balance, totals, and what one video costs."""
    return credits.summary(email=_email(request))


@app.get("/api/admin/credits")
def admin_list_credits():
    """Admins only: every tester, with their balance, usage and number of saved analyses."""
    if not credits.is_admin():
        raise HTTPException(status_code=403, detail="Only Rewire admins can see this.")
    return {"testers": credits.everyone(), "grant": credits.GRANT, "seconds_per_credit": credits.SECONDS_PER_CREDIT}


# ---------------------------------------------------------------------------
# Chat: open-ended questions about the open analysis, answered by Claude (assistant.py) with all of its data.
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    messages: list[dict]


CHAT_LIMIT = int(os.environ.get("REWIRE_CHAT_LIMIT", "40"))      # questions per person per window
CHAT_WINDOW_S = 15 * 60
_chat_log: dict[str, list[float]] = {}
_chat_lock = threading.Lock()


def _chat_allowed(user: str) -> bool:
    now = time.time()
    with _chat_lock:
        recent = [t for t in _chat_log.get(user, []) if now - t < CHAT_WINDOW_S]
        if len(recent) >= CHAT_LIMIT:
            _chat_log[user] = recent
            return False
        recent.append(now)
        _chat_log[user] = recent
        return True


@app.get("/api/chat")
def chat_status():
    """Whether the assistant is set up on this server."""
    return {"enabled": assistant.configured()}


@app.post("/api/chat")
def chat(req: ChatRequest):
    """Streams the assistant's answer as plain text. The analysis data is gathered here, while the request still knows
    whose session it is, then handed to the stream."""
    if not assistant.configured():
        raise HTTPException(status_code=503, detail="The assistant isn't set up on this server yet.")
    if not _results:
        raise HTTPException(status_code=400, detail="Open an analysis first.")
    if not _chat_allowed(auth.current_user()):
        raise HTTPException(status_code=429, detail="That's a lot of questions in a short time. Try again in a few minutes.")
    context = assistant.build_context(dict(_results), dict(_run_info), rewire_score, overall_verdict, contest_winner)

    def body():
        try:
            yield from assistant.with_heartbeat(assistant.stream_answer(context, req.messages))
        except ValueError as e:
            yield str(e)
        except Exception as e:   # the stream has started, so the status is sent: say it in the text instead
            import anthropic
            if isinstance(e, anthropic.RateLimitError):
                yield "\n\nThe assistant is busy right now. Try again in a minute."
            elif isinstance(e, anthropic.APIConnectionError):
                yield "\n\nI couldn't reach the assistant. Try again in a moment."
            elif isinstance(e, anthropic.AuthenticationError):
                yield "\n\nThe assistant isn't set up correctly on this server."
            else:
                print(f"chat error: {type(e).__name__}: {e}", file=sys.stderr)
                yield "\n\nSomething went wrong on my side. Try asking again."

    return StreamingResponse(body(), media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


class GrantRequest(BaseModel):
    user: str
    add: int
    reason: str | None = None


@app.post("/api/admin/credits")
def admin_grant_credits(req: GrantRequest):
    """Admins only: adds credits to a tester (a negative number removes them)."""
    if not credits.is_admin():
        raise HTTPException(status_code=403, detail="Only Rewire admins can do this.")
    if not -1000 <= req.add <= 1000 or req.add == 0:
        raise HTTPException(status_code=400, detail="Add between 1 and 1000 credits (or remove up to 1000).")
    try:
        return credits.grant(req.user, req.add, (req.reason or "Added by the Rewire team").strip()[:120])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/jobs")
async def create_job(
    mode: str = Form("single"),
    videoA: UploadFile = File(...),
    videoB: UploadFile | None = File(None),
    genre_A: str = Form("general"), genre_B: str = Form("general"),
    content_type_A: str = Form("video_ad"), content_type_B: str = Form("video_ad"),
    pacing_A: str = Form("medium"), pacing_B: str = Form("medium"),
    audio_profile_A: str = Form("mixed"), audio_profile_B: str = Form("mixed"),
    viewers: int = Form(VIEWERS_DEFAULT),
):
    """Starts an analysis of one video, or two to compare, with `viewers` simulated viewers. Poll GET /api/jobs/{id}."""
    if mode not in ("single", "compare"):
        raise HTTPException(status_code=400, detail="mode must be 'single' or 'compare'")
    if mode == "compare" and videoB is None:
        raise HTTPException(status_code=400, detail="Comparing needs two videos")
    try:
        viewers = check_viewers(viewers)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    files = [("A", videoA.filename or "video-a.mp4", await videoA.read())]
    if mode == "compare":
        files.append(("B", videoB.filename or "video-b.mp4", await videoB.read()))
    metadata = {
        "A": {"genre": genre_A, "content_type": content_type_A, "pacing": pacing_A, "audio_profile": audio_profile_A},
        "B": {"genre": genre_B, "content_type": content_type_B, "pacing": pacing_B, "audio_profile": audio_profile_B},
    }
    metadata = {v: metadata[v] for v, _, _ in files}
    try:
        job = jobs.create(mode, files, metadata, viewers)
    except credits.InsufficientCredits as e:
        raise HTTPException(status_code=402, detail=str(e))
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
    viewers: int = Form(VIEWERS_DEFAULT),
):
    """Imports saved prediction files: one to analyse, or two to compare."""
    try:
        viewers = check_viewers(viewers)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    uploads = {"A": fileA, **({"B": fileB} if fileB is not None else {})}
    metadata = {
        "A": {"genre": genre_A, "content_type": content_type_A, "pacing": pacing_A, "audio_profile": audio_profile_A, "brand_reveal_timestamp": brand_reveal_A},
        "B": {"genre": genre_B, "content_type": content_type_B, "pacing": pacing_B, "audio_profile": audio_profile_B, "brand_reveal_timestamp": brand_reveal_B},
    }
    # Imported predictions are saved as a run, so they appear in the workspace like any other analysis.
    run_id = runs.new_run_id()
    path = runs.runs_dir() / run_id
    path.mkdir(parents=True, exist_ok=True)
    try:
        paths = {}
        for v, up in uploads.items():
            paths[v] = path / f"{v}.pkl"
            paths[v].write_bytes(await up.read())
        results = _load_files(paths, metadata, viewers)
    except Exception as e:
        shutil.rmtree(path, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"These files could not be read as predictions: {e}")
    names = {v: up.filename for v, up in uploads.items()}
    metadata = {v: metadata[v] for v in uploads}
    runs.write(path, {
        "id": run_id, "title": runs.default_title(names), "mode": "compare" if len(results) > 1 else "single",
        "source": "import", "engine": None, "created": time.time(), "variants": list(results), "names": names,
        "durations": {v: int(c["n_timesteps"]) for v, c in results.items()}, "metadata": metadata,
        "viewers": viewers,
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
    listed = runs.list_runs()
    for run in listed:
        run["media"] = _media(run["id"], run["variants"])
    return {"runs": listed, "current": current}


@app.post("/api/runs/{run_id}/open")
def open_run(run_id: str):
    """Loads a saved analysis into the dashboard."""
    _run_or_404(run_id)
    if jobs.active_for(auth.current_user()):
        raise HTTPException(status_code=409, detail="An analysis is running. Open saved work when it finishes.")
    _open_run(run_id)
    return {"status": "success", "variants": list(_results), "run": dict(_run_info)}


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
    active = jobs.active_for(auth.current_user())
    if active and active.id == run_id:
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


@app.get("/api/media/{token}")
def media(token: str):
    """A run's video or thumbnail, through a signed link from /api/status or /api/runs. The link names its user,
    so the file is looked up in that user's workspace."""
    try:
        claims = auth.read_media(token)
    except auth.AuthError as e:
        raise HTTPException(status_code=403, detail=str(e))
    marker = auth.set_user(claims["u"])
    try:
        if claims["k"] == "video":
            return run_video(claims["r"], claims["v"])
        if claims["k"] == "thumb":
            return run_thumb(claims["r"], claims["v"])
        raise HTTPException(status_code=404, detail="Unknown file")
    finally:
        auth.reset_user(marker)


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


@app.get("/api/score")
def get_score():
    """Per variant: the Rewire Score, its four measures (ranked within the video's length band once the benchmark
    is large enough) and the per-second response curve."""
    return _each(lambda c: c.setdefault("rewire_score", rewire_score(c["preds"])))


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
    """Fsaverage5 mesh geometry, the same for every analysis. The dashboard normally loads the static copy
    (frontend/public/brain-mesh.json, from scripts/export_mesh.py); this is the fallback, built once per process."""
    return _brain_mesh()


@functools.lru_cache(maxsize=1)
def _brain_mesh():
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
            "best_demographic_clear": c.get("best_demographic_clear", True),
            "lift": {d: c.get("engagement_lift", {}).get(d, {}).get("overall") for d in eng},
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
            dimension_winners[demo][dim] = {
                "A": round(a_val, 4), "B": round(b_val, 4), "diff": round(b_val - a_val, 4),
                "winner": contest_winner(a_val, b_val),
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
        "overall": overall_verdict(a_eng, b_eng),
        "n_timesteps_A": a["n_timesteps"],
        "n_timesteps_B": b["n_timesteps"],
    }
