# Rewire Score, method v1

The Rewire Score is one number from 0 to 100 for a video ad. It says how a creative's predicted brain response compares with other ads of a similar length. It's built to be quoted on its own ("this ad has a Rewire Score of 74"), so it follows three rules:

- **Repeatable.** It is computed from the predicted cortical response alone, with no simulated viewers. The same video always gets the same score.
- **Comparable.** It is a rank against a benchmark library of ads in the same length band, not a raw value.
- **Versioned.** Every constant below is frozen for v1. Any change becomes v2, and a score always carries its version.

The code is in `backend/score.py`; the benchmark tooling is `scripts/build_benchmark.py`.

## Why a rank, not a raw value

We checked the raw scores on every video we had (November 2026):

- **Predictions are not rescaled per video.** Each video's average response sits at its own level, from 0.08 to 0.16. So raw values can be compared between unrelated ads.
- **They are exactly repeatable.** The same video analysed three times gave identical predictions.
- **A plain time-average depends on length.** The same ad scored anywhere from 0.12 to 0.28 depending on where it was cut. Part of this is because the response builds over the first two seconds.
- **The raw range is narrow** (0.11 to 0.24 overall), which is meaningless to a reader.

So v1 uses measures that hold up across lengths, and ranks them within length bands.

## The four measures

All four come from one per-second response curve: a fixed weighted average of eight dimensions over named cortical regions.

| Dimension | Weight |
|---|---|
| Visual | 0.25 |
| Auditory | 0.20 |
| Reward | 0.20 |
| Memory | 0.15 |
| Narrative | 0.15 |
| Self-relevance | 0.10 |
| Action | 0.10 |
| Attention | 0.05 |

| Measure | Definition | Weight in the score |
|---|---|---|
| **Hook** | Mean response from second 2 to second 7. This reflects roughly the first five seconds of content, once the response has built. | 30% |
| **Depth** | Mean response after the first 2 seconds of build-up | 30% |
| **Peak** | The strongest three-second stretch | 20% |
| **Hold** | Share of seconds after the build-up at or above the benchmark's typical level (the median of each ad's median response) | 20% |

Hook and peak don't change when an ad is cut shorter or longer. Depth and hold change only with what is actually in the extra seconds.

Each dimension's mean after the build-up is also kept (`dim_visual` and so on) and ranked the same way. That makes per-dimension bars on a scorecard possible.

## Ranking

Ads are ranked within four length bands:

- up to 20 s
- 21 to 45 s
- 46 to 90 s
- over 90 s

Each measure becomes a mid-rank percentile against the ads in that band, and the score is the weighted average of the four percentiles.

A band needs **at least 30 ads** before ranks are reported. Below that, the API returns the raw measures with `"status": "provisional"` and `"score": null`, and the product shows no headline number.

## Building the benchmark

```bash
python scripts/build_benchmark.py add path/to/ads --manifest ads.csv --parallel 4
python scripts/build_benchmark.py build
python scripts/build_benchmark.py status
```

**`add`**
- Sends each video to the GPU service and keeps the prediction in `backend/data/benchmark/ads/<id>/`.
- Ads are identified by file content, so reruns skip what is already there, and an interrupted batch resumes.
- Prediction files (`.pkl`) can be added without GPU work.
- It prints the video minutes and an estimated GPU cost first. That's roughly ₹0.40 per second of video, or about ₹3,000 to ₹5,000 for 300 ads.

**The manifest** is optional. It is a CSV with `file` and any of `title`, `brand`, `category`, `year` and `source_url`. Only add videos you have the right to analyse; the library records where each came from.

**`build`** needs no GPU. It:
- recomputes the hold level;
- computes every ad's measures and percentiles within its band;
- writes `rewire-score-v1.json`, which the app reads (the path can be overridden with `REWIRE_BENCHMARK`).

Once a band holds 30 ads, each ad in it also gets its own score, ready for a leaderboard.

**Target:** 300 or more ads spread across bands and categories (FMCG, e-commerce, fintech, auto and others), so every band clears the minimum with room for category norms later.

## API

`GET /api/score` returns, per variant:

- `score`, `status`, `band_label` and `benchmark_ads`;
- the four measures, each with its value and, once ranked, its percentile;
- the per-second response curve.

Saved runs keep the score and measures in their summary.

## What the score is not, yet

- **It is a prediction of the average brain response, not a measurement of real viewers.** Every published score should say so.
- **It has not been validated against outcomes.** The next step after the benchmark is a validation study. That means scoring ads with known results (award winners, ads-leaderboard entries, effectiveness cases) and publishing how well the score tracks them.
- **The response falls in the last 3 to 4 seconds of every ad tested so far.** This is likely end cards (a static logo and the music stopping). It's left in because it treats every ad alike, and the benchmark will show whether it's universal.
