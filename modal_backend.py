"""
Rewire's API on Modal. The dashboard is on Vercel (FRONTEND_URL); this app serves only the API.

    modal deploy modal_backend.py

What runs where:
  - This app (rewire-api, CPU) serves the FastAPI backend from backend/. Any other page on its address redirects to
    the dashboard, keeping the path and query, so old links (and old invitation links) still land in the app.
  - Saved runs live on the rewire-data volume, mounted at /data (REWIRE_DATA_DIR).
  - Predictions run on the separate rewire-inference GPU app; calls between apps in one workspace need no token.
  - Sign-in settings are public values, set below: the Clerk publishable key and the dashboard's address. No secret
    is needed: the key for signed media links is generated on first start and kept on the data volume.

One container at most: each user's open analysis and the job queue live in its memory. It sleeps when idle (no cost)
and wakes on the next request, which then takes 10 to 30 seconds while it starts and reopens analyses.
"""
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parent

# Public settings (the publishable key is meant to be shared; it only names the Clerk instance).
CLERK_PUBLISHABLE_KEY = "pk_test_bW92ZWQtdG91Y2FuLTc1NTEuY2xlcmsuYWNjb3VudHMuZGV2JA"
API_URL = "https://aryaneelshivam--rewire-api-web.us-east.modal.run"   # this app; the frontend's VITE_API_URL
FRONTEND_URL = "https://rewireit.vercel.app"                           # the dashboard, on Vercel
# Every address the dashboard is served from. Sign-in tokens issued anywhere else are refused, and only these origins
# may call the API from a browser. Add a custom domain here when you have one, then redeploy.
FRONTEND_ORIGINS = [
    FRONTEND_URL,
]
# Test credits for the beta: what each invited person starts with (raising it tops everyone up by the difference),
# how many seconds of video one credit covers, and who can see testers and add credits (Clerk user ids,
# comma-separated; find them under Users in the Clerk dashboard).
TEST_CREDITS = 60
SECONDS_PER_CREDIT = 10
VIEWER_SURCHARGE = 0.5      # extra share of the cost at 1,000 simulated viewers (in proportion above 200)
ADMINS = "user_3LzYeTNK3jepPAap9BnXpkcc8FD"
# The chat assistant (open-ended questions answered by Claude from the analysis data) needs an Anthropic API key,
# kept in a Modal secret, never in code. Create it once, then name it here and redeploy:
#   modal secret create rewire-anthropic ANTHROPIC_API_KEY=sk-ant-...
# Left empty, the API runs without the assistant and the chat answers from its set questions only.
CHAT_SECRET = "rewire-anthropic"

app = modal.App("rewire-api")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install("uv")
    # The same library versions as the GPU image, with CPU-only torch: the API only uses the model's atlas helpers.
    .run_commands("pip install torch==2.1.2 --index-url https://download.pytorch.org/whl/cpu")
    .run_commands(
        "uv pip install --system 'tribev2 @ git+https://github.com/facebookresearch/tribev2.git'",
        "pip uninstall -y numpy scipy",
        "pip install 'numpy<2.0.0' 'scipy<1.13.0' --force-reinstall",
    )
    .pip_install("fastapi[standard]", "joblib", "pandas", "nilearn", "pyjwt[crypto]>=2.10", "python-multipart", "modal",
                 "anthropic>=2.8")
    # The cortical atlas and surface mesh download once, into the image, not on every container start.
    .run_commands(
        "python -c \"from tribev2.utils import get_hcp_labels; [get_hcp_labels(mesh='fsaverage5', combine=False, hemi=h) for h in ('both', 'left', 'right')]\"",
        "python -c \"from nilearn import datasets; datasets.fetch_surf_fsaverage('fsaverage5')\"",
    )
    .env({"REWIRE_DATA_DIR": "/data", "REWIRE_ENGINE": "modal",
          "CLERK_PUBLISHABLE_KEY": CLERK_PUBLISHABLE_KEY, "CLERK_AUTHORIZED_PARTIES": ",".join(FRONTEND_ORIGINS),
          "REWIRE_TEST_CREDITS": str(TEST_CREDITS),
          "REWIRE_SECONDS_PER_CREDIT": str(SECONDS_PER_CREDIT), "REWIRE_VIEWER_SURCHARGE": str(VIEWER_SURCHARGE),
          "REWIRE_ADMINS": ADMINS})
    .add_local_file(ROOT / "brand_A_predictions.pkl", "/root/brand_A_predictions.pkl")
    .add_local_file(ROOT / "brand_B_predictions.pkl", "/root/brand_B_predictions.pkl")
    .add_local_dir(ROOT / "backend", "/root/backend", ignore=["data", "data/**", "**/__pycache__", "**/*.pyc", ".env", "**/.env"])
)

data = modal.Volume.from_name("rewire-data", create_if_missing=True, version=2)


@app.function(
    image=image,
    volumes={"/data": data},
    secrets=[modal.Secret.from_name(CHAT_SECRET)] if CHAT_SECRET else [],
    cpu=2.0,
    memory=4096,
    max_containers=1,          # sessions and jobs are in memory: never split them across containers
    scaledown_window=900,      # stay up 15 minutes after the last request, so a running analysis can finish
    timeout=600,
)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def web():
    import os
    import sys

    os.chdir("/root/backend")
    sys.path.insert(0, "/root/backend")
    from fastapi import HTTPException, Request
    from fastapi.responses import RedirectResponse

    import main

    # Pages live on the dashboard. Anything here that isn't the API redirects there, with its path and query kept.
    # Registered after the API routes, so those win.
    @main.app.get("/{path:path}", include_in_schema=False)
    def to_dashboard(path: str, request: Request):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        query = f"?{request.url.query}" if request.url.query else ""
        return RedirectResponse(f"{FRONTEND_URL}/{path}{query}", status_code=308)

    return main.app
