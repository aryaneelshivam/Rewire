"""How much the overall engagement score moves between runs (different simulated audiences) at each audience size,
and how long the simulation takes, on sample ad A (brand_A_predictions.pkl). The audience picker in
frontend-chat/src/audience.js (MEASURED) uses these numbers.

    cd backend && python3 ../scripts/measure_viewers.py out.json
"""
import json, sys, time, warnings
import numpy as np, joblib
warnings.filterwarnings("ignore")
sys.path.insert(0, ".")
from analysis import run_full_analysis, DEMO_ORDER

preds = np.asarray(joblib.load("../brand_A_predictions.pkl")["preds"])
seconds = preds.shape[0]
out = {"video_seconds": int(seconds), "sizes": {}}
for n in [200, 400, 600, 800, 1000]:
    scores, times = [], []
    for seed in [11, 23, 42, 57, 89]:
        t0 = time.perf_counter()
        c = run_full_analysis(preds, n_subjects=n // len(DEMO_ORDER), seed=seed)
        times.append(time.perf_counter() - t0)
        eng = c["engagement_scores"]
        scores.append(float(np.mean([eng[d]["overall"] for d in DEMO_ORDER])))
    s = np.array(scores)
    out["sizes"][n] = {"mean": float(s.mean()), "sd_pct": float(s.std(ddof=1) / s.mean() * 100),
                       "range_pct": float((s.max() - s.min()) / s.mean() * 100), "seconds": float(np.median(times))}
    print(n, out["sizes"][n], flush=True)
json.dump(out, open(sys.argv[1], "w"), indent=1)
