"""
Rewire cloud inference on a Modal GPU.

Deploy once:      modal deploy modal_inference.py
The backend spawns the deployed `Predictor.predict`, polls its stage in the `rewire-progress` dict, and can cancel it.

One-off from a terminal (no backend needed):
    modal run modal_inference.py --video-path my_video.mp4 --out-file results.pkl
"""
import os
import sys
import time
import uuid

import joblib
import modal

APP_NAME = "rewire-inference"
# The volume mounts on a path nothing else touches. Cache locations are pointed at it at container start
# (see Predictor.load), not in the image, because the container runtime writes to them before mounts.
CACHE_DIR = "/vol"

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


@app.cls(
    # L4 first; when Modal has none free, fall back to A10G, then L40S, rather than queueing.
    gpu=["L4", "A10G", "L40S"],
    timeout=3600,
    scaledown_window=300,          # stay warm for five minutes between videos
    volumes={CACHE_DIR: cache},
    secrets=[modal.Secret.from_name("hf-secret")],
)
class Predictor:
    @modal.enter()
    def load(self):
        # Model downloads (encoders, transcription, alignment) and the transcription tool's own environment
        # go to the volume, so a cold start loads them instead of downloading again. Set before any import
        # that reads them; the transcription subprocess inherits them.
        for var, sub in [("HF_HOME", "huggingface"), ("TORCH_HOME", "torch")]:
            os.environ[var] = f"{CACHE_DIR}/{sub}"
        from pathlib import Path
        from tribev2.demo_utils import TribeModel

        started = time.time()
        self.features = Path(CACHE_DIR) / "tribev2"
        self.features.mkdir(parents=True, exist_ok=True)
        self.model = TribeModel.from_pretrained("facebook/tribev2", cache_folder=self.features)
        cache.commit()
        self.load_seconds = round(time.time() - started, 1)

    @modal.method()
    def predict(self, video_bytes: bytes, suffix: str = ".mp4", run_id: str = ""):
        """Predicts one video. Stage updates go to progress[run_id]; returns {"preds", "transcript"}."""
        def stage(key, detail=""):
            if run_id:
                progress[run_id] = {"stage": key, "detail": detail, "at": time.time()}

        stage("model_ready", f"Model loaded in {self.load_seconds}s")
        # A fresh name per run, so features cached for an earlier upload are never reused for this one.
        path = f"/tmp/{uuid.uuid4().hex}{suffix}"
        with open(path, "wb") as f:
            f.write(video_bytes)
        try:
            stage("transcribing", f"{len(video_bytes) / 1e6:.1f} MB received")
            events = self.model.get_events_dataframe(video_path=path)
            stage("predicting", f"{len(events)} events extracted")
            preds, _segments = self.model.predict(events=events, verbose=False)
            cache.commit()
            return {"preds": preds, "transcript": events.to_dict("records")}
        finally:
            os.remove(path)


@app.local_entrypoint()
def main(video_path: str = "samplevideo3.mp4", out_file: str = "brand_B_predictions.pkl"):
    """Runs one video on the GPU from a terminal and saves the predictions file the dashboard can import."""
    if not os.path.exists(video_path):
        print(f"Could not find '{video_path}'.")
        sys.exit(1)
    with open(video_path, "rb") as f:
        video_bytes = f.read()
    result = Predictor().predict.remote(video_bytes, os.path.splitext(video_path)[1] or ".mp4")
    joblib.dump(result, out_file)
    print(f"Saved predictions {result['preds'].shape} to {out_file}")
