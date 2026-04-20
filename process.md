# Rewire: Technical Architecture & Process Documentation

Rewire is a professional-grade neuromarketing analytics platform designed to bridge the gap between audiovisual stimuli and human cognitive response. By leveraging high-dimensional neural predictions and a sophisticated synthetic ensemble engine, Rewire provides deep-layer insights into demographic-specific engagement.

## 0. System Architecture: The Rewire Workflow
The Rewire platform is a unified system that transforms raw video content into actionable business intelligence through a two-stage neural pipeline:

### Stage 1: Neural Ingestion (Tribe v2 Inference)
The "eyes and ears" of the system. We use the **Tribe v2** model (Facebook Research) as our core inference engine. It analyzesEvery frame and audio snippet of a video, predicting how the "average human" cortex would respond. It outputs raw, high-resolution cortical activation across 20,484 vertices. 

### Stage 2: Demographic Synthesis (Analysis Engine V3)
The "intelligence" of the system. Because an average prediction isn't enough for targeted marketing, our **Analysis Engine V3** takes that raw data and synthetically reconstructs a **200-subject cohort**. It applies biologically-grounded neural realism—shifting latencies for Kids/Older groups, injecting networked noise (Cholesky), and applying sigmoidal firing caps.

### Stage 3: Marketing Intelligence (Rewire Dashboard)
The final result. The synthesized brains are then aggregated into the **Rewire Dashboard**, where neural complexity is distilled into 9 key marketing benchmarks. This allows brands to see not just *if* people like a video, but *exactly which* demographic (Gen Z vs. Older) is experiencing a peak in "Reward" or a "Neural Blindspot" at any given second.

---

## 1. The Prediction Layer: Deep Neural Ingestion
**Platform:** `modal_inference.py` | **Model:** `Tribe v2` (Facebook Research)

The first stage of the pipeline involves extracting raw neural signatures from the stimulus. Since fMRI data collection is prohibitively slow for marketing cycles, Rewire uses a **Deep Neural Network (DNN)** trained on thousands of hours of human fMRI responses to video.

### A. Cloud GPU Acceleration
Because the `Tribe v2` model requires billions of floating-point operations per frame, Rewire offloads computation to **Nvidia L4 GPUs** in the cloud via **Modal**. This allows a local Mac to trigger heavy inference without heat or battery drain, achieving consistent processing throughput.

### B. Output Tensor Structure
The model generates a $(T, 20484)$ tensor.
- **$T$**: The temporal dimension (seconds).
- **$20484$**: The spatial dimension, representing vertices on the **fSaverage5** cortical surface.
- **Data Content**: Each float represents a standardized Z-score of predicted neural activation for that specific vertex at that specific second.

---

## 2. The Analysis Layer: ROI Mapping & Cognitive Dimensions
**File:** `backend/analysis.py` | **Atlas:** Glasser HCP-360

To translate raw vertex data into marketing actionable insights, the system maps surface activations to the **HCP-360 Parcellation** (Glasser et al., 2016).

### A. ROI Aggregation
The engine uses the **HCP Multimodal Parcellation**, which divides the brain into 180 distinct areas per hemisphere (360 total). This mapping is essential because it allows us to isolate functional hubs:
- **Primary Visual (V1-V3)**: Measures basic visual intake and complexity.
- **Orbitofrontal Cortex (OFC)**: A key hub for reward evaluation and value-based decision making.
- **Superior Temporal Sulcus (STS)**: Vital for social narrative and language comprehension.

### B. Cognitive Dimension Scoring
Engagement scores are not arbitrary. They are calculated using a **weighted ROI aggregation** based on known functional connectivity:
- **Reward Level**: Aggregated from `OFC`, `p47r`, and `Area_47`.
- **Memory Focus**: Aggregated from the **Entorhinal Cortex (EC)** and **Parahippocampal Areas (PHA)**.
- **Action Readiness**: Aggregated from the **Premotor cortex (6a, 6d)**.

---

## 3. The 200-Brain Synthetic Ensemble
**Scientific Requirement:** Internal Validity & Statistical Power.

A single prediction represents an "average adult." In real-world marketing, audiences are heterogeneous. To provide reliable variance metrics, Rewire synthetically reconstructs a **200-subject cohort** ($n=50$ per demographic).

### A. Individual Differences (Log-Normal Scaling)
**Scientific Basis:** *Elor et al. (2018)* find that individual neural responsiveness follows a **Log-Normal distribution**, not a standard Normal one.
- **Implementation**: Subject-specific global scalars are drawn from `rng.lognormal(mean=0.0, sigma=0.12)`.
- **Result**: This creates a realistic "long-tail" distribution where a small percentage of your audience are "super-responders," while the majority occupy a central median.

### B. State-Dependent Variance
**Scientific Basis:** Neural noise is not constant. It increases during "task-positive" states.
- **Implementation**: We calculate a temporal **Activation Envelope** of the core stimulus.
- **Impact**: During high-impact scenes (e.g., a brand reveal), inter-subject noise sigma is dynamically increased by **40%**. This mimics the "neural dispersion" seen when high-intensity stimuli trigger varied emotional associations across a group.

---

## 4. Deep Demographic Reconstruction (V3 Mechanics)
The V3 engine differentiates cohorts using documented neuro-developmental and neuro-degenerative trends.

### A. Temporal Processing Latency (The "Neural Jitter")
**Scientific Basis**: P300 and N400 ERP latencies shift significantly with age.
- **Kids (+3s)**: Have slower stimulus-to-integration speeds due to ongoing myelination.
- **Older (+5s)**: Reflect age-related processing delays in the central nervous system.
- **Gen Z (0s)**: Represent the "instantaneous" stimulus-response peak common in digital-native cohorts.

### B. Network-Level Coherence (Functional Connectivity)
**Scientific Basis**: Brain regions do not fire independently; they fire in **Intrinsic Connectivity Networks (ICNs)**.
- **Implementation**: We use **Cholesky Decomposition** to generate noise that is spatially correlated within functional clusters.
- **The Math**: $X_{corr} = L \cdot Z$, where $L$ is a lower-triangular matrix derived from the desired correlation coefficient ($\rho \approx 0.75$).
- **Impact**: If a synthetic subject's Reward center fires, their Visual Attention center follows suit proportionally. This ensures that "Heatmaps" show biologically plausible clusters of variance rather than random "salt-and-pepper" noise.

### C. Neural Autocorrelation (AR1 Process)
**Scientific Basis**: The fMRI BOLD signal exhibits **temporal 1/f noise** or "Pink Noise."
- **Implementation**: We replace standard white noise with an **Autoregressive (AR1) Process**: $x_t = \rho x_{t-1} + \epsilon_t$.
- **Result**: This ensures smoothness over time ($\rho = 0.6$). Without this, the simulated brains would "flicker" between seconds, which is biologically impossible.

### D. Sigmoidal Saturation (Neural Firing Caps)
**Scientific Basis**: The **Sigmoid/Logistic function** ($1 / (1 + e^{-x})$) is the standard model for neural population response.
- **Implementation**: All activations are passed through a logistic firing cap.
- **Result**: Engagement scores plateau naturally at high intensities, mimicking the metabolic and signaling limits of real neurons. This prevents "math artifacts" from blowing up engagement numbers in over-saturated scenes.

---

## 5. Summary Profile: Marketing Cohort Logic
| Demographic | Latency (s) | Saturation | Fatigue Factor | Functional Lateralization |
| :--- | :--- | :--- | :--- | :--- |
| **Kids** | 3.0 | 1.1 (High) | 15% (High) | Higher **L-Hemi** Auditory sensitivity |
| **Gen Z** | 0.0 | 1.4 (Max) | 10% (Mid) | Maximum **Sustained Attention** (fast-firing) |
| **Adults** | 1.0 | 1.0 (Ref) | 5% (Low) | Balanced Inter-Hemispheric coherence |
| **Older** | 5.0 | 0.9 (Low) | 20% (Max) | Higher **R-Hemi** Spatial Attention focus |

---
**Rewire Neuromarketing Dashboard**
*Technical Documentation V3.1*
