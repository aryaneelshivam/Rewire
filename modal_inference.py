"""
Rewire cloud inference on a Modal GPU.

Deploy once:      modal deploy modal_inference.py
The backend spawns the deployed `Predictor.predict`, polls its stage in the `rewire-progress` dict, and can cancel it.

One-off from a terminal (no backend needed):
    modal run modal_inference.py --video-path my_video.mp4 --out-file results.pkl

Speed: video encoding is about three quarters of the GPU time, one model pass per half second of video. Those
passes are independent, so Predictor fans them out to several VideoEncoder containers while it transcribes the
audio, then hands the results to the model's normal prediction code. See "Video fan-out" below.
"""
import math
import os
import sys
import time
import uuid

import joblib
import modal

APP_NAME = "rewire-inference"
# The volume mounts on a path nothing else touches. Cache locations are pointed at it at container start
# (see _use_volume_caches), not in the image, because the container runtime writes to them before mounts.
CACHE_DIR = "/vol"
GPUS = ["L4", "A10G", "L40S"]     # L4 first; when Modal has none free, fall back rather than queue
CLIPS_PER_ENCODER = 10            # one encoder per ~10 clips (5 seconds of video)...
MAX_ENCODERS = 8                  # ...up to this many in parallel

# The image matches the environment the model was validated in.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install("uv", "huggingface_hub")
    # torch with CUDA first, so whisperx finds the GPU libraries at build time
    .run_commands("pip install torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cu121")
    # whisperx before the model package, so it isn't installed again at runtime
    .run_commands("pip install whisperx")
    .run_commands(
        "uv pip install --system 'tribev2[plotting] @ git+https://github.com/facebookresearch/tribev2.git'",
        "pip uninstall -y numpy scipy",
        "pip install 'numpy<2.0.0' 'scipy<1.13.0' --force-reinstall",
    )
    .pip_install("nilearn", "joblib", "pandas")
    # Transcription runs as `uvx whisperx`, in its own environment (the main environment's torch and
    # torchaudio don't match it). Building that environment here means containers start with it ready.
    .run_commands("uvx whisperx --help > /dev/null")
)

# Weights (about 19 GB) and extracted features persist here, so they download once, not on every run.
cache = modal.Volume.from_name("rewire-model-cache", create_if_missing=True)

# Stage updates per run, written by the GPU and read by the backend while it waits for the result.
progress = modal.Dict.from_name("rewire-progress", create_if_missing=True)

app = modal.App(name=APP_NAME, image=image)


def _use_volume_caches():
    """Model downloads go to the volume, so a cold start loads them instead of downloading again. Set before any
    import that reads them; the transcription subprocess inherits them."""
    for var, sub in [("HF_HOME", "huggingface"), ("TORCH_HOME", "torch")]:
        os.environ[var] = f"{CACHE_DIR}/{sub}"


def _load_model():
    from pathlib import Path
    from tribev2.demo_utils import TribeModel

    features = Path(CACHE_DIR) / "tribev2"
    features.mkdir(parents=True, exist_ok=True)
    return TribeModel.from_pretrained("facebook/tribev2", cache_folder=features)


# ── Video fan-out ──────────────────────────────────────────────────────────────
# The model's video extractor (neuralset HuggingFaceVideo._get_data) walks each video chunk at 2 Hz. At each time
# point it reads 64 frames covering the previous 4 seconds, runs the video model once, reduces the hidden states
# over tokens and layers, and stores the row. Those passes don't depend on each other, so VideoEncoder computes
# them in parallel with exactly that code: the same frames, model, and reduction. The main container then runs the
# model's own prediction with three internals swapped for the duration: the video model is a stand-in that serves
# the precomputed rows, frame decoding is skipped, and the token reduction passes the rows through unchanged.
# Everything else (caching, text and audio features, the brain model) is the original code.

def _clip_key(offset, duration, t):
    return (round(float(offset), 2), round(float(duration), 2), round(float(t), 3))


def _video_events(model, path):
    """The model's own video chunks for this file (offset and duration), without transcribing the audio."""
    import pandas as pd
    from tribev2.demo_utils import get_audio_and_text_events

    event = {"type": "Video", "filepath": str(path), "start": 0, "timeline": "default", "subject": "default"}
    events = get_audio_and_text_events(pd.DataFrame([event]), audio_only=True)
    return [r for r in events.to_dict("records") if r.get("type") == "Video"]


def _clip_times(extractor, video_duration, event_duration):
    """The time points the extractor encodes for one chunk, computed exactly as it does."""
    import numpy as np
    from neuralset import base as nsbase

    freq = extractor.frequency
    expect_frames = nsbase.Frequency(freq).to_ind(event_duration)
    return np.linspace(0, video_duration, expect_frames + 1)[1:]


class _PrecomputedVideo:
    """Context manager that makes the model's video extractor use rows computed by VideoEncoder."""

    def __init__(self, rows: dict, num_frames: int):
        self.rows, self.num_frames = rows, num_frames
        self.current_event = None
        self.current_time = None
        self.pending = []
        self.misses = 0

    def __enter__(self):
        import PIL.Image
        import torch
        from neuralset.events import etypes
        from neuralset.extractors import base as exbase
        from neuralset.extractors import video as vid

        ctx = self
        self._saved = (vid._HFVideoModel, vid._VideoImage._read, exbase.HuggingFaceMixin._aggregate_tokens, etypes.Video.read)
        real_model, real_read, real_aggregate, real_event_read = self._saved

        class _Device:
            type = "cuda"

        class _Module:
            device = _Device()

            def to(self, *_):
                return self

        class StandIn:
            MODELS = real_model.MODELS
            check_layer_type = staticmethod(real_model.check_layer_type)

            def __init__(self, *_, **__):
                self.num_frames = ctx.num_frames
                self.model = _Module()

            def predict_hidden_states(self, *_args, **_kwargs):
                key = (*ctx.current_event, round(float(ctx.current_time), 3))
                row = ctx.rows.get(key)
                if row is None:
                    ctx.misses += 1
                    raise KeyError(f"No precomputed video row for {key}")
                ctx.pending.append(row)
                return torch.zeros((1, 1))           # shape check only; the row arrives via _aggregate_tokens

        def event_read(event_self, *a, **k):
            ctx.current_event = (round(float(event_self.offset), 2), round(float(event_self.duration), 2))
            return real_event_read(event_self, *a, **k)

        def frame_read(image_self):
            ctx.current_time = image_self.time       # the last frame read for a clip is the clip's end time
            return PIL.Image.new("RGB", (2, 2))      # the stand-in never looks at pixels

        def aggregate(ext_self, latents):
            if ctx.pending:
                return torch.from_numpy(ctx.pending.pop(0))
            return real_aggregate(ext_self, latents)

        vid._HFVideoModel = StandIn
        vid._VideoImage._read = frame_read
        exbase.HuggingFaceMixin._aggregate_tokens = aggregate
        etypes.Video.read = event_read
        return self

    def __exit__(self, *exc):
        from neuralset.events import etypes
        from neuralset.extractors import base as exbase
        from neuralset.extractors import video as vid

        vid._HFVideoModel, vid._VideoImage._read, exbase.HuggingFaceMixin._aggregate_tokens, etypes.Video.read = self._saved
        return False


@app.cls(
    gpu=GPUS,
    timeout=1800,
    scaledown_window=120,
    max_containers=MAX_ENCODERS,
    volumes={CACHE_DIR: cache},
    secrets=[modal.Secret.from_name("hf-secret")],
)
class VideoEncoder:
    """Runs the model's video encoder on a slice of a video's time points."""

    @modal.enter()
    def load(self):
        _use_volume_caches()
        from neuralset.extractors.video import _HFVideoModel

        started = time.time()
        self.extractor = _load_model().data.video_feature
        image = self.extractor.image
        self.video_model = _HFVideoModel(model_name=image.model_name, pretrained=image.pretrained,
                                         layer_type=self.extractor.layer_type, num_frames=self.extractor.num_frames)
        if self.video_model.model.device.type == "cpu":
            self.video_model.model.to(image.device)
        self.load_seconds = round(time.time() - started, 1)

    @modal.method()
    def encode(self, video_bytes: bytes, suffix: str, jobs: list):
        """jobs: [(event record, [clip indices])]. Returns ({clip key: row}, num_frames, seconds)."""
        import numpy as np
        from neuralset.events import etypes
        from neuralset.extractors.video import _VideoImage

        started = time.time()
        ext, model = self.extractor, self.video_model
        T = 1 / ext.frequency if ext.clip_duration is None else ext.clip_duration
        subtimes = [k / model.num_frames * T for k in reversed(range(model.num_frames))]
        path = f"/tmp/{uuid.uuid4().hex}{suffix}"
        with open(path, "wb") as f:
            f.write(video_bytes)
        rows = {}
        try:
            for record, indices in jobs:
                event = etypes.Video.from_dict({**record, "filepath": path})
                video = event.read()
                audio = video.audio if ext.use_audio else None
                times = _clip_times(ext, video.duration, event.duration)
                for k in indices:
                    t = times[k]
                    # The extractor's own per-clip body, unchanged.
                    ims = [_VideoImage(video=video, time=max(0, t - t2)) for t2 in subtimes]
                    audio_clip = audio.subclipped(max(0, t - T), t) if audio is not None else None
                    pil_imgs = [i.read() for i in ims]
                    if pil_imgs and ext.max_imsize is not None:
                        factor = max(pil_imgs[0].size) / ext.max_imsize
                        if factor > 1:
                            size = tuple(int(s / factor) for s in pil_imgs[0].size)
                            pil_imgs = [pi.resize(size) for pi in pil_imgs]
                    data = np.array([np.array(pi) for pi in pil_imgs])
                    t_embd = model.predict_hidden_states(data, audio_clip)[0]
                    embd = ext.image._aggregate_tokens(t_embd).cpu().numpy()
                    rows[_clip_key(event.offset, event.duration, t)] = embd
                video.close()
        finally:
            os.remove(path)
        return rows, model.num_frames, round(time.time() - started, 1), self.load_seconds


@app.cls(
    gpu=GPUS,
    timeout=3600,
    scaledown_window=300,          # stay warm for five minutes between videos
    volumes={CACHE_DIR: cache},
    secrets=[modal.Secret.from_name("hf-secret")],
)
class Predictor:
    @modal.enter()
    def load(self):
        _use_volume_caches()
        started = time.time()
        self.model = _load_model()
        cache.commit()
        self.load_seconds = round(time.time() - started, 1)

    def _spawn_encoders(self, path, video_bytes, suffix):
        """Starts VideoEncoder containers on slices of the video's clips. Returns (calls, total clips)."""
        from moviepy import VideoFileClip

        ext = self.model.data.video_feature
        slices = []
        for record in _video_events(self.model, path):
            with VideoFileClip(path) as clip:
                sub_duration = clip.subclipped(record["offset"], record["offset"] + record["duration"]).duration
            n = len(_clip_times(ext, sub_duration, record["duration"]))
            slices += [(record, k) for k in range(n)]
        if not slices:
            return [], 0
        n_workers = max(1, min(MAX_ENCODERS, math.ceil(len(slices) / CLIPS_PER_ENCODER)))
        per = math.ceil(len(slices) / n_workers)
        calls = []
        for w in range(n_workers):
            part = slices[w * per:(w + 1) * per]
            jobs = {}
            for record, k in part:
                key = (record["offset"], record["duration"])
                jobs.setdefault(key, (record, []))[1].append(k)
            calls.append(VideoEncoder().encode.spawn(video_bytes, suffix, list(jobs.values())))
        return calls, len(slices)

    @modal.method()
    def predict(self, video_bytes: bytes, suffix: str = ".mp4", run_id: str = "", fan_out: bool = True):
        """Predicts one video. Stage updates go to progress[run_id]; returns {"preds", "transcript", "timing"}."""
        def stage(key, detail=""):
            if run_id:
                progress[run_id] = {"stage": key, "detail": detail, "at": time.time()}

        t0 = time.time()
        timing = {"model_load_s": self.load_seconds}
        stage("model_ready", f"Model loaded in {self.load_seconds}s")
        # A fresh name per run, so features cached for an earlier upload are never reused for this one.
        path = f"/tmp/{uuid.uuid4().hex}{suffix}"
        with open(path, "wb") as f:
            f.write(video_bytes)
        try:
            calls, n_clips = [], 0
            if fan_out:
                try:
                    calls, n_clips = self._spawn_encoders(path, video_bytes, suffix)
                except Exception as exc:          # never let the speed-up break a run
                    print(f"Video fan-out could not start, encoding here instead: {exc!r}")
            timing["encoders"] = len(calls)
            timing["clips"] = n_clips

            # Transcription runs while the encoders work.
            stage("transcribing", f"{len(video_bytes) / 1e6:.1f} MB received")
            events = self.model.get_events_dataframe(video_path=path)
            timing["transcribe_s"] = round(time.time() - t0, 1)

            stage("predicting", f"{len(events)} events extracted")
            rows, num_frames = {}, None
            try:
                for call in calls:
                    part, num_frames, seconds, load_s = call.get()
                    rows.update(part)
                    timing.setdefault("encoder_s", []).append(seconds)
                    timing.setdefault("encoder_load_s", []).append(load_s)
            except Exception as exc:
                print(f"A video encoder failed, encoding here instead: {exc!r}")
                rows = {}
            timing["video_ready_s"] = round(time.time() - t0, 1)

            preds = None
            if rows and len(rows) == n_clips:
                try:
                    with _PrecomputedVideo(rows, num_frames):
                        preds, _segments = self.model.predict(events=events, verbose=False)
                    timing["path"] = "fan-out"
                except Exception as exc:
                    print(f"Precomputed video rows could not be used, encoding here instead: {exc!r}")
                    preds = None
            if preds is None:
                preds, _segments = self.model.predict(events=events, verbose=False)
                timing["path"] = "single"
            timing["total_s"] = round(time.time() - t0, 1)
            print(f"Timing: {timing}")
            cache.commit()
            return {"preds": preds, "transcript": events.to_dict("records"), "timing": timing}
        finally:
            os.remove(path)


@app.function(timeout=600)
def probe():
    """Checks that the model internals the fan-out relies on exist in this image."""
    from neuralset.events import etypes
    from neuralset.extractors import base as exbase
    from neuralset.extractors import video as vid
    import neuralset

    return {
        "neuralset": getattr(neuralset, "__version__", "?"),
        "_HFVideoModel": hasattr(vid, "_HFVideoModel") and hasattr(vid._HFVideoModel, "MODELS"),
        "_VideoImage._read": hasattr(vid, "_VideoImage") and hasattr(vid._VideoImage, "_read"),
        "_aggregate_tokens": hasattr(exbase, "HuggingFaceMixin") and hasattr(exbase.HuggingFaceMixin, "_aggregate_tokens"),
        "Video.read": hasattr(etypes.Video, "read"),
        "Video.from_dict": hasattr(etypes.Video, "from_dict"),
    }


@app.local_entrypoint()
def main(video_path: str = "samplevideo3.mp4", out_file: str = "brand_B_predictions.pkl", fan_out: bool = True):
    """Runs one video on the GPU from a terminal and saves the predictions file the dashboard can import."""
    if not os.path.exists(video_path):
        print(f"Could not find '{video_path}'.")
        sys.exit(1)
    with open(video_path, "rb") as f:
        video_bytes = f.read()
    result = Predictor().predict.remote(video_bytes, os.path.splitext(video_path)[1] or ".mp4", "", fan_out)
    print(f"Timing: {result.get('timing')}")
    joblib.dump({"preds": result["preds"], "transcript": result["transcript"]}, out_file)
    print(f"Saved predictions {result['preds'].shape} to {out_file}")
