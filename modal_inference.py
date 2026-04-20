import modal
import joblib
import os
import sys

# =============================================================================
# MODAL CONFIGURATION & ENVIRONMENT BUILD
# =============================================================================
# Modal automatically builds this environment in the cloud before running.
# It matches exactly what you had in Google Colab, ensuring no compatibility issues.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install("uv", "huggingface_hub")
    # Step 1: Pre-install torch+CUDA so whisperx finds GPU libs at build time
    .run_commands(
        "pip install torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cu121",
    )
    # Step 2: Pre-install whisperx BEFORE tribev2 so it doesn't try to install itself at runtime
    .run_commands(
        "pip install whisperx",
    )
    # Step 3: Install tribev2 with plotting extras + pin numpy/scipy for compatibility
    .run_commands(
        "uv pip install --system 'tribev2[plotting] @ git+https://github.com/facebookresearch/tribev2.git'",
        "pip uninstall -y numpy scipy",
        "pip install 'numpy<2.0.0' 'scipy<1.13.0' --force-reinstall",
    )
    .pip_install("nilearn", "joblib", "pandas")
)

app = modal.App(name="rewire-inference", image=image)


# =============================================================================
# THE GPU INFERENCE WORKER (Runs in the cloud)
# =============================================================================
# Using Nvidia L4 GPU. Giving a flexible 60-minute timeout for heavy videos.
@app.function(gpu="L4", timeout=3600, secrets=[modal.Secret.from_name("hf-secret")])
def run_tribev2_prediction(video_bytes: bytes, video_filename: str = "uploaded_video.mp4"):
    import os
    from pathlib import Path
    from tribev2.demo_utils import TribeModel
    
    print(f"☁️  [CLOUD] Received video bytes: {len(video_bytes) / (1024*1024):.2f} MB")
    
    # Save the uploaded bytes as an actual file in the cloud container
    with open(video_filename, "wb") as f:
        f.write(video_bytes)
        
    CACHE_FOLDER = Path(os.path.expanduser("~/.cache/tribev2"))
    CACHE_FOLDER.mkdir(parents=True, exist_ok=True)
    
    print("☁️  [CLOUD] Loading Rewire model weights...")
    model = TribeModel.from_pretrained(
        "facebook/tribev2",
        cache_folder=CACHE_FOLDER,
    )
    
    print(f"☁️  [CLOUD] Extracting events dataframe from {video_filename}...")
    df = model.get_events_dataframe(video_path=video_filename)
    
    # Optional: Fast-forward mode for testing. Uncomment to test quickly on Modal!
    # df = df.head(10)
    
    print(f"☁️  [CLOUD] Extracted {len(df)} chunks. Running prediction...")
    preds, segments = model.predict(events=df)
    
    # Convert transcripts to a pure python list of dicts so they survive crossing the cloud boundary
    transcript_data = df.to_dict('records') if df is not None else []
    
    print("☁️  [CLOUD] Prediction finished! Returning payload to your local Mac...")
    return preds, transcript_data


# =============================================================================
# LOCAL CLI SCRIPT (Runs on your Mac)
# =============================================================================
@app.local_entrypoint()
def main(video_path: str = "samplevideo3.mp4", out_file: str = "brand_B_predictions.pkl"):
    """
    Run this script from your terminal:
      modal run modal_inference.py --video-path my_video.mp4 --out-file results.pkl
    """
    if not os.path.exists(video_path):
        print(f"❌ Error: Could not find video file '{video_path}'. Make sure you provide the right path.")
        sys.exit(1)
        
    print(f"🚀 Uploading '{video_path}' to your Modal L4 GPU instance...")
    
    # Read the video from your Mac into memory
    with open(video_path, "rb") as f:
        video_bytes = f.read()
        
    # .remote() tells your Mac to send the data to the Cloud GPU function
    preds, transcript_data = run_tribev2_prediction.remote(video_bytes)
    
    print(f"✅ Downloaded predictions of shape {preds.shape}")
    
    # Save the final results to your Desktop (or wherever you run the script)
    joblib.dump({"preds": preds, "transcript": transcript_data}, out_file)
    print(f"💾 Saved results to {out_file}.")
    print("✨ You can now load this .pkl file into your dashboard! No more waiting 1 hour!")
