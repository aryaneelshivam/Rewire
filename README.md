# Rewire

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/aryaneelshivam/Rewire)

Rewire analyses a video creative, or compares two, by their predicted brain response. A neural encoder predicts cortical activity second by second across 20,484 points on the brain's surface, and Rewire expands that prediction into 200 simulated viewers across four age cohorts. The dashboard then shows how it lands, for whom, and at which moments (and which creative wins, when comparing) before any media is bought.

All results are predictions for simulated viewers, not measurements of real people.

---

## What it does

- **One video or two**: drop in a single creative to analyse it, or two to compare them; a progress screen follows every stage of the pipeline.
- **Head-to-head verdict**: names the stronger creative across eight cognitive dimensions and four age cohorts (32 contests), with mean activation, peak activation and contests won.
- **Cortex monitor**: a 3D brain showing the predicted response at the playhead, with the active share of the surface, mean and peak response, and the left-right balance. Filter by variant and cohort.
- **Winning-creative player**: the winning video plays beside the brain and drives the playhead for the whole dashboard.
- **Creative timeline**: a filmstrip of each variant, split into scenes and narrative sections (opening hook, development, close), with markers for dialogue, scene cuts, sound changes, brand mentions, calls to action and sharp shifts in predicted response. Click to seek, drag to select a range, loop a range, bookmark moments, add notes, and jump from any moment into the matching analysis tab. It opens on the winner; more variants can be added to align them on one axis.
- **Neural ensemble explorer**: all 200 simulated viewers as a 3D graph, each joined to the viewers who respond most like them. Groups are found by clustering on the response over time, the regional pattern, a chosen segment, or the analytical dimensions. Select a group to see its brain response, how its viewers are spread, its cohort mix, and the dimensions and regions that set it apart from everyone else.
- **Analysis tabs**: Overview, Audiences, Key moments, Brain regions and Ensemble, covering whole-brain response, left–right prefrontal balance, engagement by cohort and dimension, the strongest moments with video frames, top regions, and how consistent the response is across viewers.
- **Workspace**: every analysis is saved on your computer with its videos, thumbnails and result. Search, rename, delete, and reopen any of them in the dashboard.
- **Exports**: every chart downloads as a PNG, and the full analysis exports as a printable report.
- **Light and dark themes**, meeting WCAG AA contrast.

Videos are only read in the browser to build the filmstrip, find scene cuts and detect sound changes. They are never uploaded.

---

## How it works

### 1. Prediction
`modal_inference.py` deploys the neural encoder as a GPU service on Modal. The backend sends each uploaded video to it and streams back progress, then per-second z-scores of predicted cortical activity and a transcript.

### 2. Audience synthesis
`backend/analysis.py` expands one prediction into 200 simulated viewers: 50 for each cohort (Kids 6 to 12, Gen Z 13 to 24, Adults 25 to 54, Older 55+). Each viewer gets:
- **A cohort pattern**: which regions respond relatively more or less for that age group. Each pattern is normalised to an average of 1, so no cohort is simply louder than another.
- **Individual differences** from a latent-factor model: each cohort shares its factor structure, each viewer draws their own factor scores, and every one of the 180 regions varies across viewers.
- **Timing**: a small, sub-second response delay by cohort plus per-viewer jitter. The model's output is already an fMRI-style signal, so no second haemodynamic delay is added.
- **Realistic noise**: blended 1/f and AR(1) noise, correlated within functional networks over time.
- **A soft ceiling** that only compresses the largest responses, plus mild hemisphere biases.

The same simulated viewers watch both videos in a comparison, so A/B differences come from the videos. Each cohort is judged against its own content-neutral baseline (its *lift*), so the strongest audience reflects the video, not the cohort's profile. Contests within 5% are reported as too close to call.

### 3. Scoring
Responses are averaged over 180 cortical regions and scored on eight dimensions: visual, auditory, reward, memory, attention, narrative, self-relevance and action, plus an overall score. The winner of a comparison is the variant with the higher overall score averaged across the four audiences (within 5% is a tie); the dashboard, scorecard, report and workspace all use this verdict. Variants are also compared on every cohort and dimension pair, as supporting detail.

### 4. Rewire Score
One number from 0 to 100 that can be compared across ads. It is computed from the predicted response alone, so it is repeatable. Four measures (hook, depth, peak and hold) are each ranked against a benchmark library of ads of similar length, and combined. Until a length band holds 30 benchmark ads, the score is reported as provisional, without a number. See [docs/REWIRE_SCORE.md](docs/REWIRE_SCORE.md) for the method and how to build the benchmark.

### 5. Dashboard
A FastAPI backend serves the analysis; a React frontend presents it.

---

## Tech stack

**Backend**: Python, FastAPI, NumPy, SciPy, Nilearn, Joblib. Inference runs on Modal.

**Frontend**: React 19 with Vite, the Arc design system (uiarc.dev) for components and charts, React Three Fiber and Three.js for the brain and the ensemble graph, Radix primitives, html-to-image for PNG export, and Lucide icons.

---

## Getting started

Rewire runs on your machine. Only the prediction step runs on a cloud GPU (Modal), which the backend calls for you.

### 1. Cloud GPU (once)
```bash
pip install modal
modal token new                       # sign in to Modal
modal secret create hf-secret HF_TOKEN=<your Hugging Face token>
modal deploy modal_inference.py       # deploys the inference service
```
The first run downloads the model weights into a persistent Modal volume. Later runs reuse them, and a container stays warm for five minutes between videos.

### 2. Backend
```bash
cd backend
pip install -r requirements.txt modal
uvicorn main:app --port 8000
```
On start the backend opens the latest completed run, or the bundled sample pair. Every analysis is saved under `backend/data/runs/` (predictions, videos, thumbnails) and appears in the workspace.

To try the whole flow without a GPU, start it with `REWIRE_ENGINE=replay`. Every stage runs, but the predictions come from the sample files.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:5173.

### Optional: Streamlit explorer
```bash
streamlit run app.py
```

---

## Using Rewire

1. **Start an analysis**: drop one video to analyse a single creative, or two to compare them, into the one drop zone (MP4, MOV, M4V, WebM or MKV, up to 3 minutes each). Two files become Variant A and Variant B in the order added; **Swap** reverses them. Then choose **Run analysis**.
2. **Follow the pipeline**: a progress screen shows each stage (upload, checks, prediction on the GPU, audience simulation, scoring) and each video's progress. The dashboard opens when the results are ready.
3. **Read the verdict**: the Overview tab names the winner and the numbers behind it, or summarises the single creative.
4. **Watch and scrub**: play the creative; the brain, gauge and readouts follow the playhead. Use the timeline to jump to scenes, dialogue and response shifts.
5. **Dig in**: compare cohorts and dimensions in Audiences, find the strongest seconds in Key moments, and check regions and consistency in Brain regions.
6. **Explore the ensemble**: in the Ensemble tab, find groups of viewers who respond alike and see what makes each group different.
7. **Come back later**: open **Workspace** from the header to find, rename, delete or reopen any earlier analysis.
8. **Share**: **Share scorecard** in the header makes a branded image of the result, in portrait (1080 × 1350), square, story (1080 × 1920) or wide (1200 × 630), light or dark, to download, copy or share. It shows a frame from each video at its peak, the verdict, and the 0 to 100 Rewire Score once the benchmark can rank it, plus mini visuals you pick: the response curve, the 3D cortex at the peak, the brain-network stream, a cohort-by-dimension contest or audience map, audience bars, the share of cortex engaged, and the line of dialogue at the peak. Portrait holds four, story six, square two and wide one. Any chart also downloads as a PNG, and comparisons export as a printable report.

**Use sample data** on the start screen loads the bundled pair.

---

## API

| Endpoint | Returns |
|---|---|
| `GET /api/status` | Loaded variants, the current run, and any analysis in progress |
| `POST /api/jobs` | Starts an analysis of one video (`mode=single`) or two (`mode=compare`) |
| `GET /api/jobs/{id}` | The job's stages, each video's progress, and its status |
| `POST /api/jobs/{id}/cancel` | Cancels a running analysis |
| `POST /api/upload-predictions` | Imports one or two saved `.pkl` prediction files, saved as a run |
| `GET /api/runs` | Every saved analysis, newest first, with title, files, length and result summary |
| `POST /api/runs/{id}/open` | Loads a saved analysis into the dashboard |
| `PATCH /api/runs/{id}`, `DELETE /api/runs/{id}` | Renames or deletes a saved analysis |
| `GET /api/runs/{id}/video/{variant}`, `.../thumb/{variant}` | A saved run's video and thumbnail |
| `POST /api/load-sample-data` | Loads the bundled sample pair |
| `GET /api/overview` | Per-second metrics, peak and transcript for each variant |
| `GET /api/ab-summary` | Verdict data and every cohort and dimension contest, or a summary when one creative is loaded |
| `GET /api/engagement` | Engagement scores by cohort and dimension |
| `GET /api/timeseries` | Network response over time by cohort |
| `GET /api/score` | The Rewire Score: four measures, their ranks within the video's length band, and the per-second response |
| `GET /api/top-rois` | Top regions with their time series |
| `GET /api/heatmap` | Response variance across viewers by region and cohort |
| `GET /api/demographics` | Cohort labels and colours |
| `GET /api/brain-mesh` | The cortical surface mesh |
| `GET /api/brain-activation/{t}` | Activation per vertex at one second, for a variant and cohort |
| `GET /api/ensemble` | All 200 simulated viewers: cohort, trajectory, regional pattern, networks and dimension scores |
| `POST /api/ensemble/activation` | A group of viewers' mean regional response at one second: the group, everyone else, or where the group is higher |

---

## Project structure

```text
Rewire/
├── backend/
│   ├── main.py              # FastAPI app and endpoints
│   ├── pipeline.py          # Analysis jobs: checks, GPU prediction, synthesis, scoring
│   ├── engines.py           # Inference engines: Modal GPU, or replay for testing
│   ├── runs.py              # The workspace: saved runs, thumbnails, summaries
│   ├── analysis.py          # Audience synthesis, scoring and ensemble profiles
│   ├── score.py             # Rewire Score, method v1
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Layout, playhead and tabs
│   │   ├── api.js           # API client
│   │   ├── components/      # Panels, brain viewer, player, timeline, ensemble explorer
│   │   │   └── arc/         # Arc design system components
│   │   ├── lib/             # Chart data, timeline detection, video analysis, clustering
│   │   └── index.css        # Layout on top of Arc's tokens
│   └── package.json
├── docs/
│   ├── SAAS_ARCHITECTURE.md # Plan for the hosted, multi-tenant product
│   └── REWIRE_SCORE.md      # The score's method and benchmark
├── scripts/build_benchmark.py  # Builds the benchmark library the score ranks against
├── app.py                   # Streamlit explorer
├── modal_inference.py       # Cloud inference service (deployed to Modal)
└── process.md               # Technical notes
```

---

## License
Internal and proprietary. © 2026 Rewire.
