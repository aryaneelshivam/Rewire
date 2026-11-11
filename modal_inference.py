"""
Rewire cloud inference on a Modal GPU.

Deploy once:      modal deploy modal_inference.py
The backend then calls the deployed `Predictor.predict_video` and streams its progress.

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
CACHE_DIR = "/root/.cache"

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
    .env({"HF_HOME": f"{CACHE_DIR}/huggingface"})
)

# Weights (about 19 GB) and extracted features persist here, so they download once, not on every run.
cache = modal.Volume.from_name("rewire-model-cache", create_if_missing=True)

app = modal.App(name=APP_NAME, image=image)


@app.cls(
    gpu="L4",
    timeout=3600,
    scaledown_window=300,          # stay warm for five minutes between videos
    volumes={CACHE_DIR: cache},
    secrets=[modal.Secret.from_name("hf-secret")],
)
class Predictor:
    @modal.enter()
    def load(self):
        from pathlib import Path
        from tribev2.demo_utils import TribeModel

        started = time.time()
        self.features = Path(CACHE_DIR) / "tribev2"
        self.features.mkdir(parents=True, exist_ok=True)
        self.model = TribeModel.from_pretrained("facebook/tribev2", cache_folder=self.features)
        cache.commit()
        self.load_seconds = round(time.time() - started, 1)

    @modal.method()
    def predict_video(self, video_bytes: bytes, suffix: str = ".mp4"):
        """Yields {"stage": ...} progress events, then {"result": {"preds", "transcript"}}."""
        yield {"stage": "model_ready", "detail": f"Model loaded in {self.load_seconds}s"}

        # A fresh name per run, so features cached for an earlier upload are never reused for this one.
        path = f"/tmp/{uuid.uuid4().hex}{suffix}"
        with open(path, "wb") as f:
            f.write(video_bytes)

        try:
            yield {"stage": "transcribing", "detail": f"{len(video_bytes) / 1e6:.1f} MB received"}
            events = self.model.get_events_dataframe(video_path=path)

            yield {"stage": "predicting", "detail": f"{len(events)} events extracted"}
            preds, _segments = self.model.predict(events=events, verbose=False)
            cache.commit()

            yield {"result": {"preds": preds, "transcript": events.to_dict("records")}}
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
    result = None
    for event in Predictor().predict_video.remote_gen(video_bytes, os.path.splitext(video_path)[1] or ".mp4"):
        if "stage" in event:
            print(f"[{event['stage']}] {event.get('detail', '')}")
        else:
            result = event["result"]
    joblib.dump(result, out_file)
    print(f"Saved predictions {result['preds'].shape} to {out_file}")
