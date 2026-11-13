"""
RewireAnalysis Engine
Ported from triberewire6_updated.py (Cells 5-12)
All computation is pure numpy/scipy — no GPU required.
"""

import os
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy import sparse
from scipy.signal import fftconvolve
from scipy.stats import gamma as gamma_dist
from tribev2.utils import get_hcp_labels, summarize_by_roi


# =============================================================================
# ROI LABELS — loaded once at import time
# =============================================================================
_hcp_labels = get_hcp_labels(mesh="fsaverage5", combine=False, hemi="both")
ROI_LABEL_NAMES = list(_hcp_labels.keys())
N_ROIS = len(ROI_LABEL_NAMES)

# Every vertex belongs to exactly one HCP region, so a sparse averaging matrix turns any
# (rows, vertices) array into (rows, regions) in one multiply. "?" is the unlabelled medial wall.
N_VERTICES = int(sum(len(v) for v in _hcp_labels.values()))
VERTEX_ROI = np.full(N_VERTICES, -1, dtype=np.int32)
for _r, _idx in enumerate(_hcp_labels.values()):
    VERTEX_ROI[_idx] = _r
ROI_AVERAGER = sparse.csr_matrix(
    (1.0 / np.array([len(_hcp_labels[name]) for name in ROI_LABEL_NAMES])[VERTEX_ROI],
     (np.arange(N_VERTICES), VERTEX_ROI)),
    shape=(N_VERTICES, N_ROIS),
)
LABELLED_ROIS = [i for i, name in enumerate(ROI_LABEL_NAMES) if name != "?"]

# Dorsolateral prefrontal cortex and frontal pole, per hemisphere: the regions frontal-asymmetry research refers to.
# Hemisphere labels index the full mesh (left 0-10241, right 10242-20483).
PREFRONTAL_REGIONS = ["46", "9-46d", "a9-46v", "p9-46v", "9a", "9p", "8Av", "8BL", "10p", "a10p", "p10p"]
def _region_vertices(hemi):
    labels = get_hcp_labels(mesh="fsaverage5", combine=False, hemi=hemi)
    return np.concatenate([np.asarray(labels[n]) for n in PREFRONTAL_REGIONS if n in labels])
PREFRONTAL_LEFT, PREFRONTAL_RIGHT = _region_vertices("left"), _region_vertices("right")

# Hemisphere-Aware Bias (Functional Lateralization)
# Many ROI asymmetries are documented (language L>R, spatial attention R>L)
HEMISPHERE_BIAS = {
    "STSvp": ("L", 1.15),   # left STS stronger for language
    "STSdp": ("L", 1.15),
    "MT":    ("R", 1.08),   # right MT slightly stronger for motion
    "PGi":   ("R", 1.10),   # right angular for spatial attention
}

# ROI Covariance Structure (Functional Networks)
# Regions in the same network should have correlated noise
NETWORK_COVARIANCE = {
    "visual_early":  (["V1","V2","V3"],                       0.80),
    "visual_motion": (["MT","MST","V4t","VMV3"],              0.75),
    "auditory":      (["A1","LBelt","PBelt"],                 0.78),
    "language":      (["STSvp","STSdp","IFSa","IFSp","47l"],  0.70),
    "reward":        (["OFC","p47r","47m"],               0.65),
    "salience":      (["a24pr","p32pr"],                      0.60),
    "dmn":           (["v23ab","PGi","PGp","PCV"],              0.70),
    "narrative":     (["TPOJ1","TPOJ2","TPOJ3"],             0.68),
    "motor":         (["6a","6d","FEF","8Ad"],               0.65),
    "memory":        (["EC","PHA1"],                          0.72),
}



# =============================================================================
# DEMOGRAPHIC PROFILES  (Cell 5 of triberewire6_updated.py)
# Hand-set ROI scalars relative to adult baseline (1.0). The directions follow common findings
# (for example, older adults: weaker early sensory, stronger default-mode); the sizes are assumptions,
# not values taken from a cited study. Each cohort's scalars are normalised to an average of 1 before use
# (see _normalised_profile), so they shape the response pattern without making one cohort louder overall.
# Each entry: (scalar_multiplier, inter_subject_noise_sigma). Names are HCP-MMP atlas areas.
# =============================================================================

DEMOGRAPHIC_PROFILES = {
    "kids": {
        "V1": (1.00, 0.08), "V2": (1.00, 0.08), "V3": (1.00, 0.08),
        "VMV3": (1.00, 0.09), "V4t": (1.00, 0.09),
        "MT": (1.05, 0.10), "MST": (1.05, 0.10),
        "A1": (1.10, 0.09), "LBelt": (1.12, 0.10), "PBelt": (1.12, 0.10),
        "STSvp": (1.05, 0.10), "STSdp": (1.05, 0.10),
        "OFC": (1.25, 0.12), "p47r": (1.25, 0.12),
        "47m": (1.20, 0.13), "EC": (1.10, 0.11), "PHA1": (1.10, 0.11),
        "TPOJ1": (1.05, 0.10), "TPOJ2": (1.05, 0.10), "TPOJ3": (1.05, 0.10),
        "PGi": (0.80, 0.12), "PGp": (0.80, 0.12), "PCV": (0.85, 0.12),
        "6a": (1.15, 0.11), "6d": (1.15, 0.11),
        "a24pr": (0.75, 0.12), "p32pr": (0.75, 0.12),
        "IFSa": (0.80, 0.11), "IFSp": (0.80, 0.11),
        "47l": (0.70, 0.13), "v23ab": (0.85, 0.12),
    },
    "genz": {
        "V1": (1.10, 0.08), "V2": (1.10, 0.08), "V3": (1.10, 0.08),
        "VMV3": (1.20, 0.09), "V4t": (1.20, 0.09),
        "MT": (1.25, 0.10), "MST": (1.25, 0.10),
        "A1": (1.15, 0.09), "LBelt": (1.30, 0.10), "PBelt": (1.30, 0.10),
        "STSvp": (1.20, 0.10), "STSdp": (1.20, 0.10),
        "OFC": (1.45, 0.12), "p47r": (1.45, 0.12),
        "47m": (1.35, 0.13), "EC": (1.15, 0.11), "PHA1": (1.15, 0.11),
        "TPOJ1": (1.30, 0.10), "TPOJ2": (1.30, 0.10), "TPOJ3": (1.30, 0.10),
        "PGi": (1.10, 0.12), "PGp": (1.10, 0.12), "PCV": (1.15, 0.12),
        "6a": (1.35, 0.11), "6d": (1.35, 0.11),
        "a24pr": (0.80, 0.12), "p32pr": (0.80, 0.12),
        "IFSa": (0.88, 0.11), "IFSp": (0.88, 0.11),
        "47l": (0.78, 0.13), "v23ab": (0.90, 0.12),
    },
    "adults": {
        "V1": (1.00, 0.07), "V2": (1.00, 0.07), "V3": (1.00, 0.07),
        "VMV3": (1.00, 0.08), "V4t": (1.00, 0.08),
        "MT": (1.00, 0.08), "MST": (1.00, 0.08),
        "A1": (1.00, 0.08), "LBelt": (1.00, 0.09), "PBelt": (1.00, 0.09),
        "STSvp": (1.00, 0.09), "STSdp": (1.00, 0.09),
        "OFC": (1.00, 0.10), "p47r": (1.00, 0.10),
        "47m": (1.00, 0.10), "EC": (1.00, 0.10), "PHA1": (1.00, 0.10),
        "TPOJ1": (1.00, 0.09), "TPOJ2": (1.00, 0.09), "TPOJ3": (1.00, 0.09),
        "PGi": (1.00, 0.10), "PGp": (1.00, 0.10), "PCV": (1.00, 0.10),
        "6a": (1.00, 0.09), "6d": (1.00, 0.09),
        "a24pr": (1.00, 0.10), "p32pr": (1.00, 0.10),
        "IFSa": (1.00, 0.09), "IFSp": (1.00, 0.09),
        "47l": (1.00, 0.11), "v23ab": (1.00, 0.10),
    },
    "older": {
        "V1": (0.80, 0.10), "V2": (0.80, 0.10), "V3": (0.80, 0.10),
        "VMV3": (0.78, 0.11), "V4t": (0.78, 0.11),
        "MT": (0.82, 0.11), "MST": (0.82, 0.11),
        "A1": (0.75, 0.10), "LBelt": (0.72, 0.11), "PBelt": (0.72, 0.11),
        "STSvp": (0.80, 0.10), "STSdp": (0.80, 0.10),
        "OFC": (0.85, 0.12), "p47r": (0.85, 0.12),
        "47m": (1.05, 0.12), "EC": (0.80, 0.12), "PHA1": (0.80, 0.12),
        "TPOJ1": (1.15, 0.12), "TPOJ2": (1.15, 0.12), "TPOJ3": (1.15, 0.12),
        "PGi": (1.20, 0.13), "PGp": (1.20, 0.13), "PCV": (1.25, 0.14),
        "6a": (0.75, 0.12), "6d": (0.75, 0.12),
        "a24pr": (1.20, 0.14), "p32pr": (1.20, 0.14),
        "IFSa": (1.15, 0.12), "IFSp": (1.15, 0.12),
        "47l": (1.25, 0.14), "v23ab": (1.30, 0.13),
    },
}

# Cohort timing and dynamics.
#  latency_s   extra response delay in seconds. Age-related differences in the haemodynamic response are
#              well under a second (later peaks in older adults), so these are kept small. The model's output
#              is already an fMRI-style signal, so no extra haemodynamic delay is applied on top.
#  saturation  a ceiling (in z units) that only bends the largest responses; it has no gain at normal levels.
#  fatigue     slow decline over a video. There is no good evidence that it differs by age over ad-length
#              stimuli, so it is the same for every cohort.
DEMOGRAPHICS_PARAMS = {
    "kids":   {"latency_s": 0.3, "saturation": 2.5, "fatigue": 0.05},
    "genz":   {"latency_s": 0.0, "saturation": 2.5, "fatigue": 0.05},
    "adults": {"latency_s": 0.0, "saturation": 2.5, "fatigue": 0.05},
    "older":  {"latency_s": 0.6, "saturation": 2.5, "fatigue": 0.05},
}
LATENCY_JITTER_S = 0.2      # per-viewer timing spread
N_LATENT = 5                # shared individual-difference factors per cohort


ENGAGEMENT_WEIGHTS = {
    "visual":    (["V1", "V2", "V3", "VMV3", "MT", "MST"],  0.25),
    "auditory":  (["A1", "LBelt", "PBelt", "STSvp"],         0.20),
    "reward":    (["OFC", "p47r", "47m"],                0.20),
    "memory":    (["EC", "PHA1", "PHA2", "PHA3"],            0.15),
    "attention": (["a24pr", "p32pr"],                         0.05),
    "narrative": (["TPOJ1", "TPOJ2", "TPOJ3", "STSda", "STSdp"], 0.15),
    "personal":  (["PGi", "PGp", "PGs", "PCV"],               0.10),
    "action":    (["6a", "6d", "FEF", "8Ad"],                 0.10),
}

DEMO_ORDER = ["kids", "genz", "adults", "older"]
DEMO_LABELS = {
    "kids": "Kids (6–12)",
    "genz": "Gen Z (13–24)",
    "adults": "Adults (25–54)",
    "older": "Older (55+)",
}
DEMO_COLORS = {
    "kids":   "#E85D24",
    "genz":   "#7F77DD",
    "adults": "#1D9E75",
    "older":  "#BA7517",
}

# =============================================================================
# CONTENT-AWARE RULE ENGINE (V4 Enhancement)
# =============================================================================

CONTENT_METADATA_DEFAULTS = {
    "content_type": "video_ad",
    "genre": "general",
    "duration_category": "medium",
    "audio_profile": "mixed",
    "pacing": "medium",
    "brand_reveal_timestamp": -1,
    "target_emotion": "neutral",
}

CONTENT_RULES = {
    "genre_roi_modifiers": {
        "general":       {},
        "emotional":     {"OFC": 1.35, "p47r": 1.30, "47m": 1.25, "v23ab": 1.20, "PGi": 1.25, "EC": 1.15, "PHA1": 1.15, "a24pr": 1.10},
        "humor":         {"OFC": 1.40, "p47r": 1.35, "STSvp": 1.20, "STSdp": 1.20, "IFSa": 1.15, "TPOJ1": 1.25, "TPOJ2": 1.25},
        "action":        {"MT": 1.35, "MST": 1.30, "V1": 1.15, "V2": 1.15, "V3": 1.15, "6a": 1.25, "6d": 1.25, "FEF": 1.20},
        "informational": {"IFSa": 1.30, "IFSp": 1.30, "47l": 1.25, "STSvp": 1.15, "EC": 1.20, "PHA1": 1.20, "a24pr": 1.15},
        "horror":        {"OFC": 0.85, "a24pr": 1.40, "p32pr": 1.35, "v23ab": 0.80, "V1": 1.20, "MT": 1.25},
        "luxury":        {"OFC": 1.45, "p47r": 1.40, "PGi": 1.30, "PGp": 1.25, "VMV3": 1.20, "v23ab": 1.15},
    },
    "pacing_noise_modifiers": {
        "fast_cut":  {"ar1_rho": 0.45, "noise_sigma_scale": 1.3, "fatigue_boost": 0.08},
        "medium":    {"ar1_rho": 0.60, "noise_sigma_scale": 1.0, "fatigue_boost": 0.00},
        "slow_burn": {"ar1_rho": 0.75, "noise_sigma_scale": 0.8, "fatigue_boost": -0.05},
    },
    "audio_roi_boosts": {
        "music_heavy":    {"A1": 1.25, "LBelt": 1.30, "PBelt": 1.30, "OFC": 1.10},
        "dialogue_heavy": {"STSvp": 1.30, "STSdp": 1.25, "IFSa": 1.15, "47l": 1.10},
        "mixed":          {},
        "silent":         {"A1": 0.70, "LBelt": 0.65, "V1": 1.15, "MT": 1.10},
    },
    "duration_fatigue": {
        "short":  {"curve": "minimal",     "max_decay": 0.05},
        "medium": {"curve": "linear",      "max_decay": 0.15},
        "long":   {"curve": "exponential", "max_decay": 0.30},
    },
}

GENRE_ENGAGEMENT_WEIGHTS = {
    "general":       {"visual": 0.25, "auditory": 0.20, "reward": 0.20, "memory": 0.15, "attention": 0.05, "narrative": 0.15, "personal": 0.10, "action": 0.10},
    "emotional":     {"visual": 0.15, "auditory": 0.15, "reward": 0.25, "memory": 0.20, "attention": 0.05, "narrative": 0.10, "personal": 0.15, "action": 0.05},
    "action":        {"visual": 0.30, "auditory": 0.15, "reward": 0.15, "memory": 0.05, "attention": 0.10, "narrative": 0.05, "personal": 0.05, "action": 0.25},
    "humor":         {"visual": 0.15, "auditory": 0.20, "reward": 0.30, "memory": 0.05, "attention": 0.05, "narrative": 0.25, "personal": 0.05, "action": 0.05},
    "informational": {"visual": 0.15, "auditory": 0.20, "reward": 0.10, "memory": 0.25, "attention": 0.15, "narrative": 0.15, "personal": 0.05, "action": 0.05},
    "horror":        {"visual": 0.25, "auditory": 0.20, "reward": 0.10, "memory": 0.10, "attention": 0.20, "narrative": 0.10, "personal": 0.10, "action": 0.15},
    "luxury":        {"visual": 0.25, "auditory": 0.10, "reward": 0.30, "memory": 0.10, "attention": 0.05, "narrative": 0.05, "personal": 0.20, "action": 0.05},
}

DEMO_CONTENT_INTERACTIONS = {
    ("kids", "action"):        {"MT": 1.15, "6a": 1.20, "OFC": 1.30},
    ("kids", "emotional"):     {"OFC": 1.10, "v23ab": 0.75},
    ("genz", "humor"):         {"OFC": 1.50, "STSvp": 1.30, "TPOJ1": 1.35},
    ("genz", "horror"):        {"a24pr": 1.25, "OFC": 1.20},
    ("adults", "luxury"):      {"OFC": 1.40, "PGi": 1.35, "VMV3": 1.25},
    ("adults", "emotional"):   {"v23ab": 1.20, "EC": 1.15, "PGi": 1.15},
    ("older", "emotional"):    {"v23ab": 1.40, "EC": 1.30, "PGi": 1.35},
    ("older", "informational"): {"IFSa": 1.25, "47l": 1.20, "EC": 1.25},
}


# =============================================================================
# MATHEMATICAL ENGINE CORE — Advanced Neural Modeling
# =============================================================================

def ar1_noise(rng, shape, sigma=1.0, rho=0.6):
    """Generate AR(1) temporally correlated noise (mimics BOLD signals)."""
    T, V = shape
    noise = np.zeros((T, V))
    # Generate standard AR(1) with unit variance
    noise[0] = rng.normal(0, 1.0, V)
    innov_std = np.sqrt(1 - rho**2)
    for t in range(1, T):
        noise[t] = rho * noise[t-1] + rng.normal(0, innov_std, V)
    return noise * sigma

def correlated_roi_noise(rng, network_rois, hcp_labels, T, base_sigma, rho):
    """Generate correlated noise across ROIs in the same network using Cholesky."""
    n_nets = len(network_rois)
    cov = np.full((n_nets, n_nets), rho * base_sigma**2)
    np.fill_diagonal(cov, base_sigma**2)
    L = np.linalg.cholesky(cov)
    white = rng.standard_normal((T, n_nets))
    return white @ L.T # (T, n_nets)

def nonlinear_saturate(x, ceiling=2.5):
    """A soft ceiling: ceiling * tanh(x / ceiling). Slope 1 near zero, so ordinary responses pass unchanged
    and only the largest ones are compressed. (The old form, 2 / (1 + e^(-s x)) - 1, scaled every response
    by about s / 2, which made the saturation setting act as a per-cohort volume knob.)"""
    return ceiling * np.tanh(x / ceiling)


def shift_time(x, delay_s):
    """Delays a (T, V) signal by a fraction of a second using linear interpolation. The start is held rather
    than wrapped, and nothing is cut from the end beyond the delay itself."""
    if abs(delay_s) < 1e-6:
        return x.copy()
    T = x.shape[0]
    t = np.clip(np.arange(T) - delay_s, 0, T - 1)
    i0 = np.floor(t).astype(int)
    i1 = np.minimum(i0 + 1, T - 1)
    w = (t - i0)[:, None].astype(x.dtype)
    return x[i0] * (1 - w) + x[i1] * w


def pink_noise_1f(rng, shape, alpha=1.0):
    """Generate 1/f^alpha noise via spectral shaping.
    Produces long-range temporal dependencies matching real BOLD power spectra.
    """
    T, V = shape
    white = rng.standard_normal((T, V))
    freqs = np.fft.rfftfreq(T, d=1.0)
    freqs[0] = 1.0  # avoid div by zero
    power_filter = 1.0 / (freqs ** (alpha / 2.0))
    power_filter[0] = 0  # remove DC component
    ft = np.fft.rfft(white, axis=0)
    ft *= power_filter[:, np.newaxis]
    pink = np.fft.irfft(ft, n=T, axis=0)
    pink /= (pink.std(axis=0, keepdims=True) + 1e-8)
    return pink


def cohort_arrays(profile):
    """Per-region (scalar, sigma) arrays for every atlas region, from a cohort's sparse profile.

    Scalars are normalised to an average of 1 over the listed regions, so a cohort's profile changes the
    shape of the response (which regions lead) without making the whole cohort louder. Regions the profile
    does not list keep a scalar of 1 and the profile's median noise level, so every region varies across
    viewers, not only the listed ones.
    """
    listed = [r for r in profile if r in _hcp_labels]
    mean_scalar = float(np.mean([profile[r][0] for r in listed])) if listed else 1.0
    default_sigma = float(np.median([profile[r][1] for r in listed])) if listed else 0.09
    scalars = np.ones(N_ROIS)
    sigmas = np.full(N_ROIS, default_sigma)
    for r in listed:
        k = ROI_LABEL_NAMES.index(r)
        scalars[k] = profile[r][0] / mean_scalar
        sigmas[k] = profile[r][1]
    return scalars, sigmas


def subject_profile(rng, scalars, sigmas, loadings):
    """One simulated viewer's individual differences, from a latent factor model.

    `loadings` (regions x factors) belongs to the cohort and is shared by all of its viewers; each viewer draws
    their own factor scores. Factor 0 is overall responsiveness (log-normal); the rest move groups of regions
    together, so viewers differ in structured, network-like ways rather than by independent per-region noise.
    """
    latent = rng.normal(0, 1, loadings.shape[1] + 1)
    global_scalar = float(np.exp(0.12 * latent[0]))
    roi_scalars = scalars * np.exp(loadings @ latent[1:])
    roi_sigmas = sigmas * (1.0 + rng.normal(0, 0.05, len(sigmas)))
    return global_scalar, roi_scalars, roi_sigmas


def dynamic_network_covariance(T, base_rho, events, window_size=10):
    """Generate time-varying coupling weight for a functional network.
    Events temporarily increase within-network synchronization.
    """
    rho_series = np.full(T, base_rho)
    for t_evt, etype, intensity in events:
        window = np.exp(-0.5 * ((np.arange(T) - t_evt) / window_size) ** 2)
        if etype == "scene_cut":
            rho_series += window * 0.15 * intensity
        elif etype == "brand_reveal":
            rho_series += window * 0.20 * intensity
        else:
            rho_series += window * 0.10 * intensity
    return np.clip(rho_series, 0.1, 0.95)


def apply_content_rules(base_profile, base_params, content_metadata, demographic):
    """Apply content-aware rule engine to modify demographic profile and params."""
    profile = {k: v for k, v in base_profile.items()}
    params = {k: v for k, v in base_params.items()}
    genre = content_metadata.get("genre", "general")
    pacing = content_metadata.get("pacing", "medium")
    audio = content_metadata.get("audio_profile", "mixed")

    # 1. Genre ROI modifiers
    for roi, mod in CONTENT_RULES["genre_roi_modifiers"].get(genre, {}).items():
        if roi in profile:
            s, sig = profile[roi]
            profile[roi] = (s * mod, sig)

    # 2. Audio ROI boosts
    for roi, mod in CONTENT_RULES["audio_roi_boosts"].get(audio, {}).items():
        if roi in profile:
            s, sig = profile[roi]
            profile[roi] = (s * mod, sig)

    # 3. Pacing fatigue boost
    pacing_mods = CONTENT_RULES["pacing_noise_modifiers"].get(pacing, {})
    params["fatigue"] = params["fatigue"] + pacing_mods.get("fatigue_boost", 0)

    # 4. Demographic × Content interaction
    interaction_key = (demographic, genre)
    if interaction_key in DEMO_CONTENT_INTERACTIONS:
        for roi, mod in DEMO_CONTENT_INTERACTIONS[interaction_key].items():
            if roi in profile:
                s, sig = profile[roi]
                profile[roi] = (s * mod, sig)

    return profile, params


def detect_temporal_events(preds, transcript=None, metadata=None):
    """Detect scene cuts, brand reveals, and speech events from data."""
    events = []
    # A. Activation-derivative peaks (scene cuts)
    global_mean = preds.mean(axis=1)
    derivative = np.abs(np.diff(global_mean))
    if len(derivative) > 0:
        threshold = np.percentile(derivative, 90)
        for t in np.where(derivative > threshold)[0]:
            events.append((int(t), "scene_cut", 1.2))

    # B. Transcript-derived events
    if transcript:
        for seg in transcript:
            t = int(seg.get("start", 0))
            text = str(seg.get("text", "")).lower()
            if any(w in text for w in ["brand", "logo", "reveal"]):
                events.append((t, "brand_reveal", 1.5))
            elif any(w in text for w in ["music", "beat", "drop"]):
                events.append((t, "music_event", 1.3))

    # C. User-specified brand reveal
    if metadata and metadata.get("brand_reveal_timestamp", -1) >= 0:
        events.append((metadata["brand_reveal_timestamp"], "brand_reveal", 1.8))

    return sorted(events, key=lambda x: x[0])


def build_event_envelope(T, events, base_envelope):
    """Boost noise sigma around event timestamps."""
    envelope = base_envelope.copy()
    for t, etype, intensity in events:
        window = np.exp(-0.5 * ((np.arange(T) - t) / 2.0) ** 2)
        envelope[:, 0] += window * (intensity - 1.0) * 0.3
    return np.clip(envelope, 0, 2.0)


def compute_fatigue_curve(T, fatigue_rate, events, duration_cat):
    """Nonlinear fatigue with recovery spikes at detected events."""
    t = np.linspace(0, 1, T)
    if duration_cat == "short":
        curve = 1.0 - (t ** 2) * fatigue_rate * 0.5
    elif duration_cat == "long":
        curve = np.exp(-fatigue_rate * t * 2.0)
    else:
        curve = 1.0 - t * fatigue_rate

    # Recovery bumps at event timestamps
    for evt_t, etype, intensity in events:
        frac = evt_t / max(T, 1)
        recovery = np.exp(-3.0 * np.abs(t - frac)) * 0.1 * intensity
        curve += recovery

    return np.clip(curve, 0.5, 1.2).reshape(-1, 1)


def split_half_reliability(preds, demographic, n_subjects=50):
    """Run ensemble twice with different seeds and correlate for reliability."""
    ens_a = generate_demographic_ensemble(preds, demographic, n_subjects=n_subjects, seed=42)
    ens_b = generate_demographic_ensemble(preds, demographic, n_subjects=n_subjects, seed=99)
    mean_a = ens_a.mean(axis=0).mean(axis=1)
    mean_b = ens_b.mean(axis=0).mean(axis=1)
    r = np.corrcoef(mean_a, mean_b)[0, 1]
    return round(float(r), 4)


# A contest is too close to call when the two scores differ by less than this share of the larger one, or by
# less than CONTEST_MIN_GAP outright. The simulated viewers are synthetic, so a statistical test would only measure
# the simulation's own noise; a practical-difference margin is the honest rule.
CONTEST_MARGIN = 0.05
CONTEST_MIN_GAP = 0.002


def contest_winner(a: float, b: float) -> str:
    """'A', 'B', or 'TIE' when the difference is too small to call."""
    gap = b - a
    if abs(gap) < max(CONTEST_MIN_GAP, CONTEST_MARGIN * max(abs(a), abs(b))):
        return "TIE"
    return "B" if gap > 0 else "A"


def overall_verdict(a_eng: dict, b_eng: dict) -> dict:
    """The headline of a comparison: the variant with the higher overall score, averaged over the cohorts.

    Every surface (dashboard, scorecard, report, workspace) names the winner from this, so they never disagree. The
    same margin as the individual contests applies, so a difference under 5% is called a tie. The cohort and
    dimension contests stay as supporting detail.
    """
    cohorts = [d for d in a_eng if d in b_eng]
    a = float(np.mean([a_eng[d]["overall"] for d in cohorts]))
    b = float(np.mean([b_eng[d]["overall"] for d in cohorts]))
    winner = contest_winner(a, b)
    lead = None
    if winner != "TIE":
        hi, lo = (a, b) if winner == "A" else (b, a)
        lead = round(100 * (hi - lo) / abs(lo), 1) if abs(lo) > 1e-9 else None
    led = {"A": 0, "B": 0, "TIE": 0}
    for d in cohorts:
        led[contest_winner(a_eng[d]["overall"], b_eng[d]["overall"])] += 1
    return {"winner": winner, "A": round(a, 4), "B": round(b, 4), "lead_pct": lead, "cohorts_led": led, "cohorts": len(cohorts)}


def cohens_d(scores_a, scores_b):
    """Compute Cohen's d effect size for A/B comparison."""
    a, b = np.asarray(scores_a), np.asarray(scores_b)
    pooled_std = np.sqrt((np.std(a)**2 + np.std(b)**2) / 2)
    return round(float((np.mean(a) - np.mean(b)) / (pooled_std + 1e-8)), 4)


# =============================================================================
# ENSEMBLE GENERATOR  (Upgraded V4 — Content-Aware)
# =============================================================================

def cohort_setup(demographic: str, content_context: dict = None):
    """A cohort's per-region scalars and noise levels, and its timing parameters, after any content rules.
    Content rules multiply the (already normalised) pattern: genre and audio boosts apply to every cohort
    alike; the few cohort x genre interactions are applied as given."""
    scalars, sigmas = cohort_arrays(DEMOGRAPHIC_PROFILES[demographic])
    params = dict(DEMOGRAPHICS_PARAMS[demographic])
    if content_context:
        boosted, params = apply_content_rules(
            {r: (scalars[k], sigmas[k]) for k, r in enumerate(ROI_LABEL_NAMES)}, params, content_context, demographic,
        )
        scalars = np.array([boosted[r][0] for r in ROI_LABEL_NAMES])
    return scalars, sigmas, params


def hemisphere_bias(V: int) -> np.ndarray:
    bias = np.ones(V, dtype=np.float32)
    for r_name, (hemi, factor) in HEMISPHERE_BIAS.items():
        if r_name in _hcp_labels:
            idx = np.asarray(_hcp_labels[r_name])
            bias[idx[idx < V // 2] if hemi == "L" else idx[idx >= V // 2]] *= factor
    return bias


def cohort_baseline_roi_matrix(base_preds, demographic, content_context=None, temporal_events=None):
    """How a cohort responds to a content-neutral version of the video: the same overall level and timing
    everywhere on the cortex, but no region-specific pattern. Passed through the cohort's deterministic
    transforms (latency, fatigue, region scalars, ceiling) with no noise. A cohort's score above this baseline
    is its lift: how much the video's regional pattern suits that cohort, independent of how strongly the
    cohort's profile weights the scored regions. Returns (T, n_rois)."""
    scalars, _, params = cohort_setup(demographic, content_context)
    T, V = base_preds.shape
    neutral = np.repeat(base_preds.mean(axis=1, keepdims=True), V, axis=1).astype(np.float32)
    duration_cat = content_context.get("duration_category", "medium") if content_context else "medium"
    fatigue_vec = compute_fatigue_curve(T, params["fatigue"], temporal_events or [], duration_cat).astype(np.float32)
    resp = shift_time(neutral, params["latency_s"]) * fatigue_vec * scalars[VERTEX_ROI] * hemisphere_bias(V)
    resp = nonlinear_saturate(resp, params["saturation"])
    return np.asarray(resp @ ROI_AVERAGER)


# How many simulated viewers an analysis uses, split evenly across the four cohorts. More viewers only smooth the
# averages (the same first viewers are always included), so the default stays at 200.
VIEWERS_DEFAULT = 200
VIEWERS_MIN = 200
VIEWERS_MAX = 1000
VIEWERS_STEP = 100
# Cohorts simulated at once (numpy does the heavy lifting outside the GIL). Match it to the CPU cores available.
SIM_THREADS = max(1, int(os.environ.get("REWIRE_SIM_THREADS", "2")))


def check_viewers(viewers) -> int:
    """The audience size as a whole number in range, or ValueError with a message for people."""
    try:
        n = int(viewers)
    except (TypeError, ValueError):
        raise ValueError("Choose how many viewers to simulate.") from None
    if not VIEWERS_MIN <= n <= VIEWERS_MAX or n % VIEWERS_STEP:
        raise ValueError(f"Simulate between {VIEWERS_MIN} and {VIEWERS_MAX:,} viewers, in steps of {VIEWERS_STEP}.")
    return n


def iter_demographic_viewers(
    base_preds: np.ndarray,
    demographic: str,
    content_context: dict = None,
    temporal_events: list = None,
    n_subjects: int = 50,
    seed: int = 42,
):
    """Simulated viewers of one cohort watching one video, one at a time: n_subjects (T, V) float32 arrays.

    Yielded one by one so a large audience never has to fit in memory at once; the draws are the same, in the same
    order, as generating them all together, and the first n viewers are the same whatever n_subjects is.

    Each viewer is the model's prediction, delayed by the cohort's (sub-second) latency plus personal jitter,
    scaled by their overall responsiveness and per-region factors, given slow fatigue, plus noise with
    realistic structure (1/f and AR(1) over time, correlated within functional networks), then passed through
    a soft ceiling.

    Seeding: the cohort is part of the seed, so each cohort has its own viewers; the variant is not, so the
    same viewers watch Variant A and Variant B and A/B differences come from the videos, not the sampling.
    """
    assert demographic in DEMOGRAPHIC_PROFILES
    cohort_index = DEMO_ORDER.index(demographic)

    scalars, sigmas, params = cohort_setup(demographic, content_context)

    T, V = base_preds.shape
    base = base_preds.astype(np.float32)

    # Cohort-level structure, shared by all of this cohort's viewers
    cohort_rng = np.random.default_rng([seed, cohort_index, 0])
    loadings = cohort_rng.normal(0, 0.08, (N_ROIS, N_LATENT - 1))
    rng = np.random.default_rng([seed, cohort_index, 1])

    # Noise is louder when the brain is more active, and around detected events
    envelope = base.mean(axis=1, keepdims=True)
    envelope = (envelope - envelope.min()) / (np.ptp(envelope) + 1e-8)
    if temporal_events:
        envelope = build_event_envelope(T, temporal_events, envelope)

    ar1_rho = 0.6
    if content_context:
        ar1_rho = CONTENT_RULES["pacing_noise_modifiers"].get(content_context.get("pacing", "medium"), {}).get("ar1_rho", 0.6)

    # Within-network coupling over time, per region (0 for regions outside the listed networks)
    networks = []
    coupling = np.zeros((T, N_ROIS), dtype=np.float32)
    for name, (rois, base_rho) in NETWORK_COVARIANCE.items():
        idx = [ROI_LABEL_NAMES.index(r) for r in rois if r in _hcp_labels]
        if len(idx) < 2:
            continue
        coupling[:, idx] = dynamic_network_covariance(T, base_rho, temporal_events or [], window_size=10)[:, None]
        networks.append((idx, base_rho))

    duration_cat = content_context.get("duration_category", "medium") if content_context else "medium"
    fatigue_vec = compute_fatigue_curve(T, params["fatigue"], temporal_events or [], duration_cat).astype(np.float32)
    coupling_v = coupling[:, VERTEX_ROI]
    blend_sd = np.sqrt(0.6 ** 2 + 0.4 ** 2)        # pink and AR(1) are independent, unit variance each

    hemi_bias = hemisphere_bias(V)

    for _ in range(n_subjects):
        global_scalar, roi_scalars, roi_sigmas = subject_profile(rng, scalars, sigmas, loadings)
        delay = max(0.0, params["latency_s"] + rng.normal(0, LATENCY_JITTER_S))
        subj = shift_time(base, delay) * global_scalar * fatigue_vec

        # Independent per-vertex noise: 1/f plus AR(1), unit variance
        indep = (0.6 * pink_noise_1f(rng, (T, V)) + 0.4 * ar1_noise(rng, (T, V), 1.0, rho=ar1_rho)) / blend_sd
        # Shared noise within each functional network, correlated at that network's own strength
        shared = np.zeros((T, N_ROIS))
        for idx, rho in networks:
            shared[:, idx] = correlated_roi_noise(rng, idx, None, T, 1.0, rho)
        noise = shared[:, VERTEX_ROI] * coupling_v + indep * (1 - coupling_v)
        noise *= roi_sigmas[VERTEX_ROI] * (1.0 + 0.4 * envelope)

        subj = subj * roi_scalars[VERTEX_ROI] + noise
        subj *= hemi_bias
        yield np.asarray(nonlinear_saturate(subj, params["saturation"]), dtype=np.float32)


def generate_demographic_ensemble(base_preds, demographic, content_context=None, temporal_events=None,
                                  n_subjects: int = 50, seed: int = 42) -> np.ndarray:
    """All of one cohort's simulated viewers as one (n_subjects, T, V) float32 array. Only for small audiences."""
    T, V = base_preds.shape
    ensemble = np.empty((n_subjects, T, V), dtype=np.float32)
    for s_i, viewer in enumerate(iter_demographic_viewers(base_preds, demographic, content_context, temporal_events,
                                                          n_subjects, seed)):
        ensemble[s_i] = viewer
    return ensemble


def simulate_cohort(base_preds, demographic, content_context=None, temporal_events=None,
                    n_subjects: int = 50, seed: int = 42) -> dict:
    """Simulates one cohort viewer by viewer, keeping only what the analysis uses, so memory stays small at any
    audience size. Gives the same numbers as summarising the full (n_subjects, T, V) ensemble:

      mean_brain  (T, V)     the cohort's average response (summed in viewer order, as numpy's mean does)
      roi         (S, T, R)  each viewer's response per region, per second
      trajectory  (S, T)     each viewer's whole-brain response per second
      time_avg_roi (S, R)    each viewer's time-averaged response per region (for the variation heatmap)
    """
    T, V = base_preds.shape
    total = None
    roi = np.empty((n_subjects, T, N_ROIS), dtype=np.float32)
    trajectory = np.empty((n_subjects, T), dtype=np.float32)
    time_avg_roi = np.empty((n_subjects, N_ROIS))
    for s_i, viewer in enumerate(iter_demographic_viewers(base_preds, demographic, content_context, temporal_events,
                                                          n_subjects, seed)):
        if total is None:
            total = viewer.copy()
        else:
            total += viewer
        roi[s_i] = np.asarray(viewer @ ROI_AVERAGER)
        trajectory[s_i] = viewer.mean(axis=1)
        time_avg_roi[s_i] = summarize_by_roi(viewer.mean(axis=0), hemi="both", mesh="fsaverage5")
    return {"mean_brain": total / np.float32(n_subjects), "roi": roi, "trajectory": trajectory, "time_avg_roi": time_avg_roi}


# =============================================================================
# ENGAGEMENT SCORING  (Upgraded V3)
# =============================================================================

def compute_engagement_score(
    roi_matrix: np.ndarray,
    roi_labels: list = ROI_LABEL_NAMES,
    weights: dict = ENGAGEMENT_WEIGHTS,
) -> dict:
    """Collapse (T, n_rois) matrix into engagement scores using exact matching."""
    time_avg = roi_matrix.mean(axis=0)
    scores = {}
    total_weight = 0
    weighted_sum = 0
    
    # Pre-build ROI set for O(1) exact lookups
    label_to_idx = {lbl: i for i, lbl in enumerate(roi_labels)}

    for dim_name, (roi_names, w) in weights.items():
        # Exact match check
        idxs = [label_to_idx[r] for r in roi_names if r in label_to_idx]
        
        if not idxs:
            scores[dim_name] = 0.0
            continue
            
        dim_score = float(time_avg[idxs].mean())
        scores[dim_name] = round(dim_score, 4)
        weighted_sum += dim_score * w
        total_weight += w
        
    scores["overall"] = round(weighted_sum / total_weight, 4) if total_weight else 0.0
    return scores


NETWORK_GROUPS = [
    ("reward", ["OFC", "p47r", "47m"]),
    ("auditory", ["LBelt", "PBelt", "A1"]),
    ("prefrontal", ["a24pr", "p32pr"]),
    ("memory", ["EC", "PHA1", "PHA2", "PHA3"]),
    ("narrative", ["TPOJ1", "TPOJ2", "TPOJ3", "STSda", "STSdp"]),
    ("personal", ["PGi", "PGp", "PGs", "PCV"]),
    ("action", ["6a", "6d", "FEF", "8Ad"]),
]


def build_profiles(cohort_stats: dict, weights: dict) -> dict:
    """Keep a compact record of every simulated viewer (from simulate_cohort's per-viewer summaries).

    For each of the cohorts' viewers (4 x 50 = 200 by default, up to 1,000): the per-region response at every
    second, the whole-brain trajectory, the network trajectories, and the engagement score on each dimension.
    """
    cohorts, roi_parts, traj_parts = [], [], []
    for demo in DEMO_ORDER:
        stats = cohort_stats[demo]
        roi_parts.append(stats["roi"])
        traj_parts.append(stats["trajectory"])
        cohorts += [demo] * stats["roi"].shape[0]
    roi_tensor = np.concatenate(roi_parts)          # (N, T, R)
    networks = {}
    for name, group in NETWORK_GROUPS:
        idxs = [i for i, lbl in enumerate(ROI_LABEL_NAMES) if any(r in lbl for r in group)]
        networks[name] = roi_tensor[:, :, idxs].mean(axis=2) if idxs else np.zeros(roi_tensor.shape[:2], np.float32)
    scores = [compute_engagement_score(roi_tensor[n], weights=weights) for n in range(len(cohorts))]
    dimensions = {k: np.array([sc[k] for sc in scores], np.float32) for k in scores[0]}
    return {
        "cohorts": cohorts,
        "roi_tensor": roi_tensor,
        "trajectory": np.concatenate(traj_parts),
        "networks": networks,
        "dimensions": dimensions,
    }


# =============================================================================
# FULL PIPELINE — run once, cache everything
# =============================================================================

def run_full_analysis(
    preds: np.ndarray,
    content_metadata: dict = None,
    transcript: list = None,
    n_subjects: int = 50,
    seed: int = 42,
    on_step=None,
) -> dict:
    """
    Run the entire analysis pipeline on raw predictions (V4).
    on_step, when given, is called with "synthesis" before the audience ensembles and "scoring" after them.
    Now accepts content_metadata and transcript for content-aware modeling.
    Falls back to V3 behaviour when content_metadata is None.
    """
    T, V = preds.shape

    # ── 0. Build content context & detect events (V4) ─────────────────────
    content_context = None
    temporal_events = []
    if content_metadata:
        content_context = {**CONTENT_METADATA_DEFAULTS, **content_metadata}
        temporal_events = detect_temporal_events(preds, transcript, content_context)

    # ── 1. Timestep metrics (Cell 12) ──────────────────────────────────────
    left_preds = preds[:, : V // 2]
    right_preds = preds[:, V // 2 :]
    active_threshold_pctile = 95
    active_threshold = float(np.percentile(preds, active_threshold_pctile))

    timestep_metrics = {
        "timestep": list(range(T)),
        "global_mean": preds.mean(axis=1).tolist(),
        "global_std": preds.std(axis=1).tolist(),
        "global_min": preds.min(axis=1).tolist(),
        "global_max": preds.max(axis=1).tolist(),
        "left_mean": left_preds.mean(axis=1).tolist(),
        "right_mean": right_preds.mean(axis=1).tolist(),
        "left_max": left_preds.max(axis=1).tolist(),
        "right_max": right_preds.max(axis=1).tolist(),
        "hemisphere_asymmetry": (left_preds.mean(axis=1) - right_preds.mean(axis=1)).tolist(),
        # Left minus right over the prefrontal regions only; positive means the left side responds more.
        "prefrontal_asymmetry": (preds[:, PREFRONTAL_LEFT].mean(axis=1) - preds[:, PREFRONTAL_RIGHT].mean(axis=1)).tolist(),
        "active_fraction": (preds >= active_threshold).mean(axis=1).tolist(),
        "active_threshold": active_threshold,
    }

    # ── 2. ROI matrix (T x n_rois) ────────────────────────────────────────
    roi_matrix = np.vstack([
        summarize_by_roi(preds[t], hemi="both", mesh="fsaverage5")
        for t in range(T)
    ])

    # ── 3. Top ROIs ───────────────────────────────────────────────────────
    peak_activation = roi_matrix.max(axis=0)
    peak_timestep = roi_matrix.argmax(axis=0)
    top_k = 5
    top_roi_indices = np.argsort(peak_activation)[::-1][:top_k]
    top_roi_names = [ROI_LABEL_NAMES[i] for i in top_roi_indices]

    top_rois = {
        "rois": [
            {
                "name": ROI_LABEL_NAMES[i],
                "peak_activation": round(float(peak_activation[i]), 4),
                "peak_timestep": int(peak_timestep[i]),
            }
            for i in top_roi_indices
        ],
        "timeseries": {
            ROI_LABEL_NAMES[i]: roi_matrix[:, i].tolist()
            for i in top_roi_indices
        },
        # Every region's peak, so a comparison can show one variant's top regions with the other's value.
        "peaks": {
            name: [round(float(peak_activation[i]), 4), int(peak_timestep[i])]
            for i, name in enumerate(ROI_LABEL_NAMES)
        },
    }

    # ── 4. Demographic ensembles (V4: content-aware) ──────────────────────
    if on_step:
        on_step("synthesis")
    # Each cohort has its own random stream, so simulating them side by side gives the same viewers as one by one.
    with ThreadPoolExecutor(max_workers=SIM_THREADS) as pool:
        stats = pool.map(lambda demo: simulate_cohort(
            base_preds=preds,
            demographic=demo,
            content_context=content_context,
            temporal_events=temporal_events,
            n_subjects=n_subjects,
            seed=seed,
        ), DEMO_ORDER)
        cohort_stats = dict(zip(DEMO_ORDER, stats))

    if on_step:
        on_step("scoring")

    # ── 5. Per-demographic ROI summary matrices (T x n_rois) ──────────────
    demo_roi_matrices = {}
    demo_mean_brains = {}
    for demo, stats in cohort_stats.items():
        mean_brain = stats["mean_brain"]  # (T, 20484)
        demo_mean_brains[demo] = mean_brain.tolist()
        demo_roi_matrices[demo] = np.vstack([
            summarize_by_roi(mean_brain[t], hemi="both", mesh="fsaverage5")
            for t in range(mean_brain.shape[0])
        ])

    # ── 6. Engagement scores (V4: genre-adaptive weights) ─────────────────
    genre = content_context.get("genre", "general") if content_context else "general"
    genre_weights = GENRE_ENGAGEMENT_WEIGHTS.get(genre, GENRE_ENGAGEMENT_WEIGHTS["general"])
    # Convert genre_weights dict to ENGAGEMENT_WEIGHTS format for compute_engagement_score
    active_weights = {}
    for dim_name, w in genre_weights.items():
        if dim_name in ENGAGEMENT_WEIGHTS:
            rois, _ = ENGAGEMENT_WEIGHTS[dim_name]
            active_weights[dim_name] = (rois, w)
        else:
            active_weights[dim_name] = (ENGAGEMENT_WEIGHTS.get(dim_name, ([], 0))[0], w)

    engagement_scores = {}
    for demo, roi_mat in demo_roi_matrices.items():
        engagement_scores[demo] = compute_engagement_score(roi_mat, weights=active_weights)

    # Lift: each cohort's scores above its own content-neutral baseline. Absolute scores still drive the A/B
    # contests (both variants share a cohort's baseline, so the comparison is unchanged); the best cohort is
    # chosen by lift, so it reflects the video rather than which cohort's profile weights the scored regions.
    engagement_lift = {}
    for demo in DEMO_ORDER:
        base_scores = compute_engagement_score(
            cohort_baseline_roi_matrix(preds, demo, content_context, temporal_events), weights=active_weights)
        engagement_lift[demo] = {k: round(engagement_scores[demo][k] - base_scores[k], 4) for k in engagement_scores[demo]}
    ranked = sorted(engagement_lift, key=lambda d: engagement_lift[d]["overall"], reverse=True)
    best_demo = ranked[0]
    # Clear only if the leader beats the runner-up by more than the contest margin.
    best_clear = contest_winner(engagement_lift[ranked[1]]["overall"], engagement_lift[best_demo]["overall"]) == "B"

    # ── 6b. Individual profiles for the ensemble explorer ─────────────────
    profiles = build_profiles(cohort_stats, active_weights)

    # ── 7. Demographic time-series for specific ROI groups (Cell 8) ───────
    demo_timeseries = {}
    for demo, roi_mat in demo_roi_matrices.items():
        ts_data = {}
        for group_name, group_rois in NETWORK_GROUPS:
            idxs = [
                i for i, lbl in enumerate(ROI_LABEL_NAMES)
                if any(r in lbl for r in group_rois)
            ]
            if idxs:
                ts_data[group_name] = roi_mat[:, idxs].mean(axis=1).tolist()
            else:
                ts_data[group_name] = [0.0] * T
        demo_timeseries[demo] = ts_data

    # ── 8. Variance heatmap (Cell 11) ─────────────────────────────────────
    TOP_K_VARIANCE = 30
    var_matrix = np.zeros((len(DEMO_ORDER), N_ROIS))
    for d_idx, demo in enumerate(DEMO_ORDER):
        var_matrix[d_idx] = cohort_stats[demo]["time_avg_roi"].std(axis=0)

    mean_var_across_demos = var_matrix.mean(axis=0)
    top_k_var_idx = np.argsort(mean_var_across_demos)[::-1][:TOP_K_VARIANCE]

    heatmap_data = {
        "demographics": DEMO_ORDER,
        "roi_labels": [ROI_LABEL_NAMES[i] for i in top_k_var_idx],
        "values": var_matrix[:, top_k_var_idx].tolist(),
    }

    # ── 9. Peak brain data for 3D viz ─────────────────────────────────────
    peak_t = int(preds.mean(axis=1).argmax())

    # Per-demographic peak data
    demo_peak_data = {}
    for demo in DEMO_ORDER:
        mean_brain = cohort_stats[demo]["mean_brain"]
        demo_peak_t = int(mean_brain.mean(axis=1).argmax())
        demo_peak_data[demo] = {
            "peak_timestep": demo_peak_t,
            "mean_activation": round(float(mean_brain[demo_peak_t].mean()), 4),
        }

    # ── 10. Content profile metadata (V4) ─────────────────────────────────
    content_profile = {
        "engine_version": "V4",
        "content_aware": content_context is not None,
        "genre": genre,
        "n_temporal_events": len(temporal_events),
        "temporal_events": [
            {"timestep": t, "type": etype, "intensity": intensity}
            for t, etype, intensity in temporal_events
        ],
        "active_engagement_weights": {k: round(v, 3) for k, v in genre_weights.items()},
    }

    return {
        "n_timesteps": T,
        "n_vertices": V,
        "timestep_metrics": timestep_metrics,
        "top_rois": top_rois,
        "engagement_scores": engagement_scores,
        "engagement_lift": engagement_lift,
        "best_demographic": best_demo,
        "best_demographic_clear": best_clear,
        "demo_timeseries": demo_timeseries,
        "heatmap": heatmap_data,
        "peak_timestep": peak_t,
        "demo_peak_data": demo_peak_data,
        "demo_mean_brains": demo_mean_brains,
        "preds": preds,  # keep raw for brain mesh endpoint
        "demo_labels": DEMO_LABELS,
        "demo_colors": DEMO_COLORS,
        "content_profile": content_profile,
        "profiles": profiles,
        "n_viewers": n_subjects * len(DEMO_ORDER),
    }
