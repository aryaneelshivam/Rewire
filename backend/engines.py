"""
Inference engines: turn a video file into per-second cortical predictions plus a transcript.

REWIRE_ENGINE picks one:
  modal   (default) the deployed GPU service in modal_inference.py
  replay  development only: returns the bundled sample predictions after simulated stages, no GPU cost
A local engine for machines that can hold the model slots in behind the same interface.
"""
import os
import time
from pathlib import Path
from typing import Callable

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parent.parent

# Progress callback: (stage key, detail line) for one video. Stage keys match pipeline.VIDEO_STAGES.
Progress = Callable[[str, str], None]


class Cancelled(Exception):
    pass


class ModalEngine:
    name = "modal"

    def __init__(self, app_name: str = "rewire-inference", class_name: str = "Predictor"):
        self.app_name, self.class_name = app_name, class_name

    def run(self, video_path: Path, on_progress: Progress, should_stop: Callable[[], bool]):
        import modal

        try:
            predictor = modal.Cls.from_name(self.app_name, self.class_name)()
        except Exception as exc:  # not deployed, or not signed in
            raise RuntimeError("The cloud GPU service is not reachable. Run `modal deploy modal_inference.py` and check `modal token` is set.") from exc

        on_progress("starting", "Starting a GPU and loading the model")
        data = video_path.read_bytes()
        result = None
        for event in predictor.predict_video.remote_gen(data, video_path.suffix or ".mp4"):
            if should_stop():
                raise Cancelled()
            if "stage" in event:
                stage = {"model_ready": "starting"}.get(event["stage"], event["stage"])
                on_progress(stage, event.get("detail", ""))
            else:
                result = event["result"]
        if result is None:
            raise RuntimeError("The GPU service finished without returning predictions.")
        return np.asarray(result["preds"]), result.get("transcript", [])


class ReplayEngine:
    """Returns the sample predictions, so the pipeline and dashboard can be exercised without a GPU."""
    name = "replay"
    samples = ["brand_A_predictions.pkl", "brand_B_predictions.pkl"]

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.calls = 0

    def run(self, video_path: Path, on_progress: Progress, should_stop: Callable[[], bool]):
        sample = ROOT / self.samples[self.calls % 2]
        self.calls += 1
        for stage, detail in [
            ("starting", "Replay engine: no GPU is used"),
            ("transcribing", "Replaying sample transcript"),
            ("predicting", "Replaying sample predictions"),
        ]:
            if should_stop():
                raise Cancelled()
            on_progress(stage, detail)
            time.sleep(self.delay)
        data = joblib.load(sample)
        return np.asarray(data["preds"]), data.get("transcript", [])


def get_engine():
    name = os.environ.get("REWIRE_ENGINE", "modal").lower()
    if name == "replay":
        return ReplayEngine(delay=float(os.environ.get("REWIRE_REPLAY_DELAY", "1.5")))
    if name == "modal":
        return ModalEngine()
    raise ValueError(f"Unknown REWIRE_ENGINE '{name}'. Use 'modal' or 'replay'.")
