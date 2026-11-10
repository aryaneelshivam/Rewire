# Rewire

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/aryaneelshivam/Rewire)

Rewire compares two video creatives by their predicted brain response. A neural encoder predicts cortical activity second by second across 20,484 points on the brain's surface, and Rewire expands that prediction into 200 simulated viewers across four age cohorts. The dashboard then shows which creative wins, for whom, and at which moments, before any media is bought.

All results are predictions for simulated viewers, not measurements of real people.

---

## What it does

- **Head-to-head verdict**: names the stronger creative across eight cognitive dimensions and four age cohorts (32 contests), with mean activation, peak activation and contests won.
- **Cortex monitor**: a 3D brain showing the predicted response at the playhead, with the active share of the surface, mean and peak response, and the left-right balance. Filter by variant and cohort.
- **Winning-creative player**: the winning video plays beside the brain and drives the playhead for the whole dashboard.
- **Creative timeline**: a filmstrip of each variant, split into scenes and narrative sections (opening hook, development, close), with markers for dialogue, scene cuts, sound changes, brand mentions, calls to action and sharp shifts in predicted response. Click to seek, drag to select a range, loop a range, bookmark moments, add notes, and jump from any moment into the matching analysis tab. It opens on the winner; more variants can be added to align them on one axis.
- **Neural ensemble explorer**: all 200 simulated viewers as a 3D graph, each joined to the viewers who respond most like them. Groups are found by clustering on the response over time, the regional pattern, a chosen segment, or the analytical dimensions. Select a group to see its brain response, how its viewers are spread, its cohort mix, and the dimensions and regions that set it apart from everyone else.
- **Analysis tabs**: Overview, Audiences, Key moments, Brain regions and Ensemble, covering whole-brain response, approach versus avoidance, engagement by cohort and dimension, the strongest moments with video frames, top regions, and how consistent the response is across viewers.
- **Exports**: every chart downloads as a PNG, and the full analysis exports as a printable report.
- **Light and dark themes**, meeting WCAG AA contrast.

Videos are only read in the browser to build the filmstrip, find scene cuts and detect sound changes. They are never uploaded.

---

## How it works

### 1. Prediction
`modal_inference.py` runs the neural encoder on a cloud GPU (via Modal). It turns a video's frames and audio into per-second z-scores of predicted cortical activity, saved as a `.pkl` file per creative.

### 2. Audience synthesis
`backend/analysis.py` expands one prediction into 200 simulated viewers: 50 for each cohort (Kids 6 to 12, Gen Z 13 to 24, Adults 25 to 54, Older 55+). Each viewer gets:
- **Processing latency** that shifts response timing by cohort.
- **Individual differences** from a latent-factor profile per region.
- **Haemodynamic blurring** with a jittered response peak.
- **Attention fatigue** that recovers at detected events.
- **Realistic noise**: blended 1/f and AR(1) noise, coupled within functional networks over time.
- **Hemisphere biases** and **saturation caps** so responses stay plausible.

Optional creative details (genre, format, pacing, audio) adjust these rules.

### 3. Scoring
Responses are averaged over 180 cortical regions and scored on eight dimensions: visual, auditory, reward, memory, attention, narrative, self-relevance and action, plus an overall score. Variants are compared on every cohort and dimension pair.

### 4. Dashboard
A FastAPI backend serves the analysis; a React frontend presents it.

---

## Tech stack

**Backend**: Python, FastAPI, NumPy, SciPy, Nilearn, Joblib. Inference runs on Modal.

**Frontend**: React 19 with Vite, the Arc design system (uiarc.dev) for components and charts, React Three Fiber and Three.js for the brain and the ensemble graph, Radix primitives, html-to-image for PNG export, and Lucide icons.

---

## Getting started

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000
```
On start, the backend loads the sample predictions (`brand_A_predictions.pkl`, `brand_B_predictions.pkl`) so the dashboard has data straight away. Building the 200-viewer ensembles takes a short while.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:5173.

### 3. Optional: Streamlit explorer
For exploring the synthesis engine directly:
```bash
streamlit run app.py
```

---

## Using Rewire

1. **Predict**: run `modal_inference.py` on each video to produce its `.pkl` predictions.
2. **Add data**: on the start screen, add the `.pkl` file for Variant A and Variant B, and optionally each variant's MP4. Or choose **Use sample data**.
3. **Read the verdict**: the Overview tab names the winner and the numbers behind it.
4. **Watch and scrub**: play the winning creative; the brain, gauge and readouts follow the playhead. Use the timeline to jump to scenes, dialogue and response shifts.
5. **Dig in**: compare cohorts and dimensions in Audiences, find the strongest seconds in Key moments, and check regions and consistency in Brain regions.
6. **Explore the ensemble**: in the Ensemble tab, find groups of viewers who respond alike and see what makes each group different.
7. **Share**: download any chart as a PNG, or choose **Export report**.

---

## API

| Endpoint | Returns |
|---|---|
| `GET /api/status` | Whether an analysis is loaded |
| `POST /api/upload-predictions` | Runs the analysis on two uploaded `.pkl` files and optional creative details |
| `POST /api/load-sample-data` | Loads the bundled sample pair |
| `GET /api/overview` | Per-second metrics, peak and transcript for each variant |
| `GET /api/ab-summary` | Verdict data and every cohort and dimension contest |
| `GET /api/engagement` | Engagement scores by cohort and dimension |
| `GET /api/timeseries` | Network response over time by cohort |
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
│   ├── analysis.py          # Audience synthesis, scoring and ensemble profiles
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
├── app.py                   # Streamlit explorer
├── modal_inference.py       # Cloud inference
└── process.md               # Technical notes
```

---

## License
Internal and proprietary. © 2026 Rewire.
