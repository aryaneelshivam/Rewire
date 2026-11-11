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
        import uuid
        import modal
        import modal.exception

        try:
            predictor = modal.Cls.from_name(self.app_name, self.class_name)()
            progress = modal.Dict.from_name("rewire-progress", create_if_missing=True)
        except Exception as exc:  # not deployed, or not signed in
            raise RuntimeError("The cloud GPU service is not reachable. Run `modal deploy modal_inference.py` and check `modal token` is set.") from exc

        run_id = uuid.uuid4().hex
        call = predictor.predict.spawn(video_path.read_bytes(), video_path.suffix or ".mp4", run_id)
        started, seen = time.time(), None
        lost_since = None             # when contact with Modal last dropped, if it has
        on_progress("starting", "Requesting a GPU")
        try:
            while True:
                if should_stop():
                    call.cancel()
                    raise Cancelled()
                try:
                    result = call.get(timeout=2)
                    break
                except (TimeoutError, modal.exception.TimeoutError):   # still running
                    pass
                except (ConnectionError, OSError, modal.exception.ConnectionError) as exc:
                    # A dropped connection is not a failed prediction: the GPU keeps working. Retry for a while.
                    lost_since = lost_since or time.time()
                    if time.time() - lost_since > 300:
                        raise RuntimeError("Lost contact with the cloud GPU for five minutes. Check the connection and try again.") from exc
                    time.sleep(min(15, 2 + (time.time() - lost_since) / 4))
                    continue
                lost_since = None
                try:
                    update = progress.get(run_id)
                except Exception:
                    update = seen
                if update and update != seen:
                    seen = update
                    on_progress({"model_ready": "starting"}.get(update["stage"], update["stage"]), update.get("detail", ""))
                elif not update and time.time() - started > 30:
                    # No container yet: Modal is still finding a free GPU.
                    on_progress("starting", f"Waiting for a free GPU, {int(time.time() - started)}s")
        finally:
            try:
                progress.pop(run_id, None)
            except Exception:
                pass
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
