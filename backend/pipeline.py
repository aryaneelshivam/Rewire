"""
The analysis pipeline as a background job: check the videos, predict brain response on the GPU,
simulate the audience, score, and hand the results to the API. The frontend polls the job for progress.

One job runs at a time; this is a single-user local app. Runs are saved under backend/data/runs/<job id>/.
"""
import shutil
import subprocess
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable

import joblib

from engines import Cancelled, get_engine
from runs import RUNS_DIR, default_title, new_run_id, thumbnail, write
MAX_SECONDS = 180
MAX_BYTES = 500 * 1024 * 1024
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}

# Whole-job stages, in order. "predicting" covers the per-video GPU work below.
STAGES = [
    ("received", "Upload received"),
    ("checked", "Videos checked"),
    ("predicting", "Brain response predicted"),
    ("synthesis", "200 viewers simulated"),
    ("scoring", "Scored and compared"),
    ("ready", "Ready"),
]
# How each stage reads in the event log while it runs; finished stages use their label from STAGES.
STAGE_STARTS = {
    "checked": "Checking the videos",
    "predicting": "Predicting brain response",
    "synthesis": "Simulating 200 viewers",
    "scoring": "Scoring the results",
}
# Per-video events complete the video's name: "Variant A is being transcribed".
VIDEO_EVENTS = {
    "starting": "is waiting for a GPU and the model",
    "transcribing": "is being transcribed and its frames read",
    "predicting": "is going through the model",
}
VIDEO_STAGES = [
    ("queued", "Waiting for the GPU"),
    ("starting", "Starting the GPU and loading the model"),
    ("transcribing", "Transcribing speech and reading frames"),
    ("predicting", "Predicting brain response"),
    ("received", "Results received"),
]


@dataclass
class Stage:
    key: str
    label: str
    state: str = "pending"          # pending, running, done, failed
    started: float | None = None
    ended: float | None = None
    detail: str = ""


@dataclass
class VideoTask:
    variant: str
    name: str
    path: str
    size: int
    duration: float | None = None
    stage: str = "queued"
    state: str = "pending"          # pending, running, done, failed
    detail: str = ""
    started: float | None = None
    ended: float | None = None


@dataclass
class Job:
    id: str
    mode: str                       # single or compare
    engine: str
    videos: list[VideoTask]
    metadata: dict
    stages: list[Stage] = field(default_factory=lambda: [Stage(k, label) for k, label in STAGES])
    status: str = "running"         # running, done, failed, cancelled
    error: str | None = None
    created: float = field(default_factory=time.time)
    finished: float | None = None
    cancel_requested: bool = False
    events: list[dict] = field(default_factory=list)

    def log(self, title: str, actor: str | None = None, meta: str | None = None, tone: str = "neutral", detail: str | None = None):
        """Appends to the job's event log, which the progress screen shows newest first."""
        self.events.append({"id": uuid.uuid4().hex[:10], "at": time.time(), "actor": actor, "title": title,
                            "meta": meta, "tone": tone, "detail": detail})

    def who(self, v: "VideoTask") -> str:
        return "Your video" if self.mode == "single" else f"Variant {v.variant}"

    def stage(self, key: str) -> Stage:
        return next(s for s in self.stages if s.key == key)

    def to_dict(self) -> dict:
        data = asdict(self)
        data.pop("cancel_requested")
        for v in data["videos"]:
            v.pop("path")
        data["video_stages"] = [{"key": k, "label": label} for k, label in VIDEO_STAGES]
        data["now"] = time.time()
        return data


def took(seconds: float) -> str:
    s = max(0, round(seconds))
    return f"took {s // 60}m {s % 60:02d}s" if s >= 60 else f"took {s}s"


def short_error(exc: Exception) -> str:
    """A readable one or two lines for the progress screen; the full traceback stays in the backend log."""
    lines = [l.strip() for l in (str(exc) or exc.__class__.__name__).splitlines() if l.strip()]
    if len(lines) <= 2:
        return " ".join(lines)[:400]
    return f"{lines[0]} {lines[-1]}"[:400]


def probe_duration(path: Path) -> float:
    """Seconds of video, read with ffprobe."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, timeout=30,
    )
    if out.returncode != 0 or not out.stdout.strip():
        raise ValueError("This file could not be read as a video.")
    return float(out.stdout.strip())


class JobManager:
    def __init__(self, on_results: Callable[[dict, str], None], analyse: Callable):
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()
        self.on_results = on_results          # (results by variant, job id) -> None
        self.analyse = analyse                # (preds, transcript, metadata, seed, on_step) -> cache

    @property
    def active(self) -> Job | None:
        return next((j for j in self.jobs.values() if j.status == "running"), None)

    def create(self, mode: str, files: list[tuple[str, str, bytes]], metadata: dict) -> Job:
        """files: (variant, original name, bytes)."""
        if self.active:
            raise RuntimeError("Another analysis is still running. Wait for it or cancel it first.")
        job_id = new_run_id()
        folder = RUNS_DIR / job_id
        folder.mkdir(parents=True, exist_ok=True)
        videos = []
        for variant, name, data in files:
            suffix = Path(name).suffix.lower() or ".mp4"
            path = folder / f"{variant}{suffix}"
            path.write_bytes(data)
            videos.append(VideoTask(variant=variant, name=name, path=str(path), size=len(data)))
        job = Job(id=job_id, mode=mode, engine=get_engine().name, videos=videos, metadata=metadata)
        self._begin(job, "received", f"{len(videos)} video{'s' if len(videos) > 1 else ''}")
        mb = sum(v.size for v in videos) / (1024 * 1024)
        job.log("Upload received", meta=f"{', '.join(v.name for v in videos)}, {mb:.1f} MB")
        self._finish(job, "received", quiet=True)
        with self.lock:
            self.jobs[job_id] = job
        threading.Thread(target=self._run, args=(job,), daemon=True).start()
        return job

    def get(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    def cancel(self, job_id: str) -> Job | None:
        job = self.jobs.get(job_id)
        if job and job.status == "running":
            job.cancel_requested = True
        return job

    # ── stage bookkeeping ─────────────────────────────────────────────
    def _begin(self, job: Job, key: str, detail: str = ""):
        s = job.stage(key)
        s.state, s.started, s.detail = "running", time.time(), detail
        if key in STAGE_STARTS:
            job.log(STAGE_STARTS[key], meta=detail or None)

    def _finish(self, job: Job, key: str, detail: str | None = None, quiet: bool = False):
        s = job.stage(key)
        s.state, s.ended = "done", time.time()
        if detail is not None:
            s.detail = detail
        if not quiet:
            meta = ", ".join(x for x in [s.detail, took(s.ended - s.started) if s.started else ""] if x)
            job.log(s.label, meta=meta or None, tone="success")

    def _check_stop(self, job: Job):
        if job.cancel_requested:
            raise Cancelled()

    # ── the run ───────────────────────────────────────────────────────
    def _run(self, job: Job):
        current = "checked"
        try:
            self._begin(job, "checked")
            for v in job.videos:
                if Path(v.name).suffix.lower() not in VIDEO_SUFFIXES:
                    raise ValueError(f"{v.name} is not a supported video. Use MP4, MOV, M4V, WebM or MKV.")
                if v.size > MAX_BYTES:
                    raise ValueError(f"{v.name} is larger than {MAX_BYTES // (1024 * 1024)} MB.")
                v.duration = round(probe_duration(Path(v.path)), 1)
                if v.duration > MAX_SECONDS:
                    raise ValueError(f"{v.name} runs {v.duration:.0f} seconds; the limit is {MAX_SECONDS // 60} minutes.")
            self._finish(job, "checked", ", ".join(f"{v.variant}: {v.duration:.0f}s" for v in job.videos))

            current = "predicting"
            self._begin(job, "predicting", "On the cloud GPU" if job.engine == "modal" else "Replay engine")
            engine = get_engine()
            with ThreadPoolExecutor(max_workers=len(job.videos)) as pool:
                outputs = list(pool.map(lambda v: self._predict(job, engine, v), job.videos))
            self._finish(job, "predicting")

            folder = RUNS_DIR / job.id
            for v, (preds, transcript) in zip(job.videos, outputs):
                joblib.dump({"preds": preds, "transcript": transcript}, folder / f"{v.variant}.pkl")

            results = {}
            current = "synthesis"
            self._begin(job, "synthesis")
            for i, (v, (preds, transcript)) in enumerate(zip(job.videos, outputs)):
                def on_step(step, _v=v):
                    self._check_stop(job)
                    if step == "scoring" and job.stage("synthesis").state == "running" and _v is job.videos[-1]:
                        self._finish(job, "synthesis")
                        self._begin(job, "scoring")
                job.stage("synthesis").detail = f"Variant {v.variant}"
                results[v.variant] = self.analyse(preds, transcript, job.metadata.get(v.variant), 42 + i, on_step)
            current = "scoring"
            if job.stage("synthesis").state == "running":
                self._finish(job, "synthesis")
                self._begin(job, "scoring")
            self._finish(job, "scoring", "Compared" if len(results) > 1 else "Scored")

            # The videos stay with the run, so it can be played back from the workspace later.
            for v in job.videos:
                thumbnail(Path(v.path), folder / f"{v.variant}.jpg", at=min(1.0, (v.duration or 2) / 2))
            names = {v.variant: v.name for v in job.videos}
            write(folder, {
                "id": job.id, "title": default_title(names), "mode": job.mode, "source": "video", "engine": job.engine,
                "created": job.created, "variants": [v.variant for v in job.videos], "names": names,
                "durations": {v.variant: v.duration for v in job.videos}, "metadata": job.metadata,
            })
            self.on_results(results, job.id)
            self._begin(job, "ready")
            self._finish(job, "ready", quiet=True)
            job.log("Analysis ready", meta=f"Saved to the workspace, {took(time.time() - job.created)} in all", tone="success")
            job.status = "done"
        except Cancelled:
            job.status, job.error = "cancelled", "The analysis was cancelled."
            self._fail(job, current, "Cancelled")
            job.log("Analysis cancelled", meta="Nothing was saved")
            shutil.rmtree(RUNS_DIR / job.id, ignore_errors=True)
        except Exception as exc:
            traceback.print_exc()
            job.status, job.error = "failed", short_error(exc)
            self._fail(job, current, job.error)
            # The short message is the title's context; the full error opens in place for whoever needs it.
            full = (str(exc) or exc.__class__.__name__).strip()
            job.log("Analysis stopped", meta=job.error, tone="danger", detail=full[-4000:] if full != job.error else None)
            shutil.rmtree(RUNS_DIR / job.id, ignore_errors=True)
        finally:
            job.finished = time.time()

    def _fail(self, job: Job, key: str, detail: str):
        s = job.stage(key)
        s.state, s.ended, s.detail = "failed", time.time(), detail
        for v in job.videos:
            if v.state == "running":
                v.state, v.ended = "failed", time.time()

    def _predict(self, job: Job, engine, v: VideoTask):
        v.state, v.started, v.stage = "running", time.time(), "starting"
        who = job.who(v)
        seen = {"stage": None, "waiting": False, "model": False}

        def progress(stage: str, detail: str):
            v.stage, v.detail = stage, detail
            # Log changes of stage, not every refresh of a detail line (a waiting timer ticks every poll).
            if stage != seen["stage"] and stage in VIDEO_EVENTS:
                seen["stage"] = stage
                job.log(VIDEO_EVENTS[stage], actor=who)
            if detail.startswith("Waiting for a free GPU") and not seen["waiting"]:
                seen["waiting"] = True
                job.log("is queued: no GPU is free yet", actor=who, meta="Modal is finding capacity")
            if detail.startswith("Model loaded") and not seen["model"]:
                seen["model"] = True
                job.log("got a GPU and the model is ready", actor=who, meta=detail, tone="success")

        try:
            preds, transcript = engine.run(Path(v.path), progress, lambda: job.cancel_requested)
        except Exception:
            v.state, v.ended = "failed", time.time()
            raise
        v.stage, v.state, v.ended = "received", "done", time.time()
        v.detail = f"{preds.shape[0]} seconds predicted"
        job.log("came back from the GPU", actor=who, meta=f"{v.detail}, {took(v.ended - v.started)}", tone="success")
        return preds, transcript
