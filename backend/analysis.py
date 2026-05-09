"""
RewireAnalysis Engine
Ported from triberewire6_updated.py (Cells 5-12)
All computation is pure numpy/scipy — no GPU required.
"""

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import fftconvolve
from scipy.stats import gamma as gamma_dist
from tribev2.utils import get_hcp_labels, summarize_by_roi


# =============================================================================
# ROI LABELS — loaded once at import time
# =============================================================================
_hcp_labels = get_hcp_labels(mesh="fsaverage5", combine=False, hemi="both")
ROI_LABEL_NAMES = list(_hcp_labels.keys())
N_ROIS = len(ROI_LABEL_NAMES)

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
    "language":      (["STSvp","STSdp","IFSa","IFSp","47"],  0.70),
    "reward":        (["OFC","p47r","Area_47"],               0.65),
    "salience":      (["a24pr","p32pr"],                      0.60),
    "dmn":           (["PCC","PGi","PGp","PCV"],              0.70),
    "narrative":     (["TPOJ1","TPOJ2","TPOJ3"],             0.68),
    "motor":         (["6a","6d","FEF","8Ad"],               0.65),
    "memory":        (["EC","PHA1"],                          0.72),
}



# =============================================================================
# DEMOGRAPHIC PROFILES  (Cell 5 of triberewire6_updated.py)
# Literature-grounded ROI scalars relative to adult baseline (1.0)
# Each entry: (scalar_multiplier, inter_subject_noise_sigma)
# =============================================================================

DEMOGRAPHIC_PROFILES = {
    "kids": {
        "V1": (1.00, 0.08), "V2": (1.00, 0.08), "V3": (1.00, 0.08),
        "VMV3": (1.00, 0.09), "V4t": (1.00, 0.09),
        "MT": (1.05, 0.10), "MST": (1.05, 0.10),
        "A1": (1.10, 0.09), "LBelt": (1.12, 0.10), "PBelt": (1.12, 0.10),
        "STSvp": (1.05, 0.10), "STSdp": (1.05, 0.10),
        "OFC": (1.25, 0.12), "p47r": (1.25, 0.12),
        "Area_47": (1.20, 0.13), "EC": (1.10, 0.11), "PHA1": (1.10, 0.11),
        "TPOJ1": (1.05, 0.10), "TPOJ2": (1.05, 0.10), "TPOJ3": (1.05, 0.10),
        "PGi": (0.80, 0.12), "PGp": (0.80, 0.12), "PCV": (0.85, 0.12),
        "6a": (1.15, 0.11), "6d": (1.15, 0.11),
        "a24pr": (0.75, 0.12), "p32pr": (0.75, 0.12),
        "IFSa": (0.80, 0.11), "IFSp": (0.80, 0.11),
        "47": (0.70, 0.13), "PCC": (0.85, 0.12),
    },
    "genz": {
        "V1": (1.10, 0.08), "V2": (1.10, 0.08), "V3": (1.10, 0.08),
        "VMV3": (1.20, 0.09), "V4t": (1.20, 0.09),
        "MT": (1.25, 0.10), "MST": (1.25, 0.10),
        "A1": (1.15, 0.09), "LBelt": (1.30, 0.10), "PBelt": (1.30, 0.10),
        "STSvp": (1.20, 0.10), "STSdp": (1.20, 0.10),
        "OFC": (1.45, 0.12), "p47r": (1.45, 0.12),
        "Area_47": (1.35, 0.13), "EC": (1.15, 0.11), "PHA1": (1.15, 0.11),
        "TPOJ1": (1.30, 0.10), "TPOJ2": (1.30, 0.10), "TPOJ3": (1.30, 0.10),
        "PGi": (1.10, 0.12), "PGp": (1.10, 0.12), "PCV": (1.15, 0.12),
        "6a": (1.35, 0.11), "6d": (1.35, 0.11),
        "a24pr": (0.80, 0.12), "p32pr": (0.80, 0.12),
        "IFSa": (0.88, 0.11), "IFSp": (0.88, 0.11),
        "47": (0.78, 0.13), "PCC": (0.90, 0.12),
    },
    "adults": {
        "V1": (1.00, 0.07), "V2": (1.00, 0.07), "V3": (1.00, 0.07),
        "VMV3": (1.00, 0.08), "V4t": (1.00, 0.08),
        "MT": (1.00, 0.08), "MST": (1.00, 0.08),
        "A1": (1.00, 0.08), "LBelt": (1.00, 0.09), "PBelt": (1.00, 0.09),
        "STSvp": (1.00, 0.09), "STSdp": (1.00, 0.09),
        "OFC": (1.00, 0.10), "p47r": (1.00, 0.10),
        "Area_47": (1.00, 0.10), "EC": (1.00, 0.10), "PHA1": (1.00, 0.10),
        "TPOJ1": (1.00, 0.09), "TPOJ2": (1.00, 0.09), "TPOJ3": (1.00, 0.09),
        "PGi": (1.00, 0.10), "PGp": (1.00, 0.10), "PCV": (1.00, 0.10),
        "6a": (1.00, 0.09), "6d": (1.00, 0.09),
        "a24pr": (1.00, 0.10), "p32pr": (1.00, 0.10),
        "IFSa": (1.00, 0.09), "IFSp": (1.00, 0.09),
        "47": (1.00, 0.11), "PCC": (1.00, 0.10),
    },
    "older": {
        "V1": (0.80, 0.10), "V2": (0.80, 0.10), "V3": (0.80, 0.10),
        "VMV3": (0.78, 0.11), "V4t": (0.78, 0.11),
        "MT": (0.82, 0.11), "MST": (0.82, 0.11),
        "A1": (0.75, 0.10), "LBelt": (0.72, 0.11), "PBelt": (0.72, 0.11),
        "STSvp": (0.80, 0.10), "STSdp": (0.80, 0.10),
        "OFC": (0.85, 0.12), "p47r": (0.85, 0.12),
        "Area_47": (1.05, 0.12), "EC": (0.80, 0.12), "PHA1": (0.80, 0.12),
        "TPOJ1": (1.15, 0.12), "TPOJ2": (1.15, 0.12), "TPOJ3": (1.15, 0.12),
        "PGi": (1.20, 0.13), "PGp": (1.20, 0.13), "PCV": (1.25, 0.14),
        "6a": (0.75, 0.12), "6d": (0.75, 0.12),
        "a24pr": (1.20, 0.14), "p32pr": (1.20, 0.14),
        "IFSa": (1.15, 0.12), "IFSp": (1.15, 0.12),
        "47": (1.25, 0.14), "PCC": (1.30, 0.13),
    },
}

# Individual cohort realism parameters
DEMOGRAPHICS_PARAMS = {
    "kids":   {"latency_shift": 3, "saturation": 1.1, "fatigue": 0.15},
    "genz":   {"latency_shift": 0, "saturation": 1.4, "fatigue": 0.10},
    "adults": {"latency_shift": 1, "saturation": 1.0, "fatigue": 0.05},
    "older":  {"latency_shift": 5, "saturation": 0.9, "fatigue": 0.20},
}


ENGAGEMENT_WEIGHTS = {
    "visual":    (["V1", "V2", "V3", "VMV3", "MT", "MST"],  0.25),
    "auditory":  (["A1", "LBelt", "PBelt", "STSvp"],         0.20),
    "reward":    (["OFC", "p47r", "Area_47"],                0.20),
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
        "emotional":     {"OFC": 1.35, "p47r": 1.30, "Area_47": 1.25, "PCC": 1.20, "PGi": 1.25, "EC": 1.15, "PHA1": 1.15, "a24pr": 1.10},
        "humor":         {"OFC": 1.40, "p47r": 1.35, "STSvp": 1.20, "STSdp": 1.20, "IFSa": 1.15, "TPOJ1": 1.25, "TPOJ2": 1.25},
        "action":        {"MT": 1.35, "MST": 1.30, "V1": 1.15, "V2": 1.15, "V3": 1.15, "6a": 1.25, "6d": 1.25, "FEF": 1.20},
        "informational": {"IFSa": 1.30, "IFSp": 1.30, "47": 1.25, "STSvp": 1.15, "EC": 1.20, "PHA1": 1.20, "a24pr": 1.15},
        "horror":        {"OFC": 0.85, "a24pr": 1.40, "p32pr": 1.35, "PCC": 0.80, "V1": 1.20, "MT": 1.25},
        "luxury":        {"OFC": 1.45, "p47r": 1.40, "PGi": 1.30, "PGp": 1.25, "VMV3": 1.20, "PCC": 1.15},
    },
    "pacing_noise_modifiers": {
        "fast_cut":  {"ar1_rho": 0.45, "noise_sigma_scale": 1.3, "fatigue_boost": 0.08},
        "medium":    {"ar1_rho": 0.60, "noise_sigma_scale": 1.0, "fatigue_boost": 0.00},
        "slow_burn": {"ar1_rho": 0.75, "noise_sigma_scale": 0.8, "fatigue_boost": -0.05},
    },
    "audio_roi_boosts": {
        "music_heavy":    {"A1": 1.25, "LBelt": 1.30, "PBelt": 1.30, "OFC": 1.10},
        "dialogue_heavy": {"STSvp": 1.30, "STSdp": 1.25, "IFSa": 1.15, "47": 1.10},
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
    ("kids", "emotional"):     {"OFC": 1.10, "PCC": 0.75},
    ("genz", "humor"):         {"OFC": 1.50, "STSvp": 1.30, "TPOJ1": 1.35},
    ("genz", "horror"):        {"a24pr": 1.25, "OFC": 1.20},
    ("adults", "luxury"):      {"OFC": 1.40, "PGi": 1.35, "VMV3": 1.25},
    ("adults", "emotional"):   {"PCC": 1.20, "EC": 1.15, "PGi": 1.15},
    ("older", "emotional"):    {"PCC": 1.40, "EC": 1.30, "PGi": 1.35},
    ("older", "informational"): {"IFSa": 1.25, "47": 1.20, "EC": 1.25},
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

def nonlinear_saturate(x, saturation=1.2):
    """Apply sigmoidal saturation (Logistic function) to mimic neural firing caps."""
    return 2.0 / (1.0 + np.exp(-saturation * x)) - 1.0


def canonical_hrf(tr=1.0, length=30, peak_delay=6.0):
    """Double-gamma canonical HRF (SPM-style)."""
    t = np.arange(0, length, tr)
    h = gamma_dist.pdf(t, peak_delay) - 0.35 * gamma_dist.pdf(t, 16)
    h_max = h.max()
    return h / (h_max + 1e-8)


def apply_hrf(signal, tr=1.0, peak_delay_jitter=0.0):
    """Convolve each vertex timeseries with a (jittered) canonical HRF.
    Introduces hemodynamic temporal blurring (~5-6s delay) matching real BOLD.
    """
    delay = max(4.0, 6.0 + peak_delay_jitter)
    hrf = canonical_hrf(tr=tr, peak_delay=delay)
    hrf /= hrf.sum()  # normalize to preserve amplitude
    T = signal.shape[0]
    return fftconvolve(signal, hrf.reshape(-1, 1), mode='full', axes=0)[:T]


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


def generate_subject_profile(rng, profile, n_latent=5):
    """Generate multivariate individual differences via latent factor model.
    Instead of a single global_scalar, each subject gets per-ROI variation
    driven by latent factors (e.g., 'general amplitude', 'reward vs cognitive').
    Returns adjusted profile dict + '_global_scalar' key.
    """
    roi_names = list(profile.keys())
    n_rois = len(roi_names)

    # Latent factors: factor 0 = global amplitude, factors 1..N = network-specific
    latent = rng.normal(0, 1, n_latent)

    # Global amplitude (log-normal, replaces old scalar)
    global_scalar = float(np.exp(0.12 * latent[0]))

    # Per-ROI offsets from remaining latent factors
    loadings = rng.normal(0, 0.08, (n_rois, n_latent - 1))
    subject_offsets = loadings @ latent[1:]  # (n_rois,)

    adjusted = {"_global_scalar": global_scalar}
    for i, roi in enumerate(roi_names):
        base_scalar, sigma = profile[roi]
        adjusted[roi] = (
            base_scalar * np.exp(subject_offsets[i]),
            sigma * (1.0 + rng.normal(0, 0.05)),  # slight sigma variability
        )
    return adjusted


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


def cohens_d(scores_a, scores_b):
    """Compute Cohen's d effect size for A/B comparison."""
    a, b = np.asarray(scores_a), np.asarray(scores_b)
    pooled_std = np.sqrt((np.std(a)**2 + np.std(b)**2) / 2)
    return round(float((np.mean(a) - np.mean(b)) / (pooled_std + 1e-8)), 4)


# =============================================================================
# ENSEMBLE GENERATOR  (Upgraded V4 — Content-Aware)
# =============================================================================

def generate_demographic_ensemble(
    base_preds: np.ndarray,
    demographic: str,
    content_context: dict = None,
    temporal_events: list = None,
    n_subjects: int = 50,
    seed: int = 42,
) -> np.ndarray:
    """Generate synthetic ensemble of brain predictions for a target demographic (V4).

    Now content-aware: accepts content_context (genre/pacing/audio modifiers)
    and temporal_events (scene cuts, brand reveals) for event-driven modeling.
    Falls back to V3 behaviour when content_context is None.
    """
    assert demographic in DEMOGRAPHIC_PROFILES

    # Apply content rules if context provided (V4), else use raw profiles (V3)
    if content_context:
        profile, params = apply_content_rules(
            DEMOGRAPHIC_PROFILES[demographic],
            DEMOGRAPHICS_PARAMS[demographic],
            content_context,
            demographic,
        )
    else:
        profile = DEMOGRAPHIC_PROFILES[demographic]
        params = DEMOGRAPHICS_PARAMS[demographic]

    rng = np.random.default_rng(seed)
    T, V = base_preds.shape
    V_split = V // 2
    ensemble = []

    # 1. Activation Envelope for State-Dependent Noise
    activation_envelope = base_preds.mean(axis=1, keepdims=True)  # (T,1)
    env_min, env_ptp = activation_envelope.min(), np.ptp(activation_envelope)
    norm_envelope = (activation_envelope - env_min) / (env_ptp + 1e-8)

    # 1b. Event-modulated envelope (V4 enhancement)
    if temporal_events:
        norm_envelope = build_event_envelope(T, temporal_events, norm_envelope)

    # 2. Determine AR(1) rho from content pacing (V4)
    ar1_rho = 0.6  # V3 default
    if content_context:
        pacing = content_context.get("pacing", "medium")
        pacing_mods = CONTENT_RULES["pacing_noise_modifiers"].get(pacing, {})
        ar1_rho = pacing_mods.get("ar1_rho", 0.6)

    # 3. Dynamic Functional Connectivity coupling (V5 enhancement)
    dynamic_coupling = {}
    for net_name, (rois, base_rho) in NETWORK_COVARIANCE.items():
        dynamic_coupling[net_name] = dynamic_network_covariance(
            T, base_rho, temporal_events or [], window_size=10
        ).reshape(-1, 1)

    # 4. Fatigue curve (V4: nonlinear + event recovery)
    duration_cat = content_context.get("duration_category", "medium") if content_context else "medium"
    fatigue_vec = compute_fatigue_curve(T, params["fatigue"], temporal_events or [], duration_cat)

    for _ in range(n_subjects):
        # A. Multivariate Subject Profile (V5: latent factor individual diffs)
        subj_profile = generate_subject_profile(rng, profile)
        global_scalar = subj_profile.pop("_global_scalar")

        # B. Temporal Shift (Processing Latency)
        shift = params["latency_shift"]
        if shift != 0:
            subj = np.roll(base_preds, shift, axis=0) * global_scalar
            if shift > 0: subj[:shift] = subj[shift]
            else: subj[shift:] = subj[shift-1]
        else:
            subj = base_preds * global_scalar

        # B2. HRF Convolution (V5: hemodynamic temporal blurring)
        subj = apply_hrf(subj, tr=1.0, peak_delay_jitter=rng.normal(0, 0.5))

        # C. Attention Fatigue (V4: nonlinear with event recovery)
        subj *= fatigue_vec

        # D. Add 1/f + AR(1) Blended Noise with Dynamic FC (V5)
        processed_rois = set()

        # D1. Apply Network-Correlated Noise (per-subject, dynamic coupling)
        for net_idx, (net_name, (net_rois, _)) in enumerate(NETWORK_COVARIANCE.items()):
            # Per-subject network noise (not shared across subjects)
            net_noise = correlated_roi_noise(rng, net_rois, _hcp_labels, T, 1.0, 0.8)
            coupling_t = dynamic_coupling[net_name]  # (T, 1) time-varying

            for i, r_name in enumerate(net_rois):
                if r_name not in _hcp_labels: continue
                idx = _hcp_labels[r_name]
                scalar, sigma = subj_profile.get(r_name, (1.0, 0.08))

                # Dynamic sigma (1.0x to 1.4x based on activation + events)
                dynamic_sigma = sigma * (1.0 + 0.4 * norm_envelope)

                # Blended 1/f pink + AR(1) noise (V5)
                pink = pink_noise_1f(rng, (T, len(idx)))
                ar1 = ar1_noise(rng, (T, len(idx)), 1.0, rho=ar1_rho)
                roi_noise = 0.6 * pink + 0.4 * ar1

                # Dynamic FC: time-varying network vs independent blend
                final_noise = (net_noise[:, [i]] * coupling_t + roi_noise * (1 - coupling_t)) * dynamic_sigma

                subj[:, idx] = (subj[:, idx] * scalar) + final_noise
                processed_rois.add(r_name)

        # D2. Apply Remaining Independent ROI Noise (1/f + AR(1) blend)
        for r_name, val in subj_profile.items():
            if r_name.startswith("_") or r_name in processed_rois or r_name not in _hcp_labels:
                continue
            scalar, sigma = val
            idx = _hcp_labels[r_name]
            dynamic_sigma = sigma * (1.0 + 0.4 * norm_envelope)
            pink = pink_noise_1f(rng, (T, len(idx)))
            ar1 = ar1_noise(rng, (T, len(idx)), 1.0, rho=ar1_rho)
            raw_noise = (0.6 * pink + 0.4 * ar1) * dynamic_sigma
            subj[:, idx] = (subj[:, idx] * scalar) + raw_noise

        # E. Hemisphere Bias (Functional Lateralization)
        for r_name, (hemi, bias) in HEMISPHERE_BIAS.items():
            if r_name in _hcp_labels:
                indices = _hcp_labels[r_name]
                if hemi == "L": h_idx = [i for i in indices if i < V_split]
                else: h_idx = [i for i in indices if i >= V_split]
                if h_idx: subj[:, h_idx] *= bias

        # F. Nonlinear Saturation (Firing Cap)
        subj = nonlinear_saturate(subj, params["saturation"])

        ensemble.append(subj)

    return np.stack(ensemble)


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


# =============================================================================
# FULL PIPELINE — run once, cache everything
# =============================================================================

def run_full_analysis(
    preds: np.ndarray,
    content_metadata: dict = None,
    transcript: list = None,
    n_subjects: int = 50,
    seed: int = 42,
) -> dict:
    """
    Run the entire analysis pipeline on raw predictions (V4).
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
    }

    # ── 4. Demographic ensembles (V4: content-aware) ──────────────────────
    ensembles = {}
    for demo in DEMO_ORDER:
        ensembles[demo] = generate_demographic_ensemble(
            base_preds=preds,
            demographic=demo,
            content_context=content_context,
            temporal_events=temporal_events,
            n_subjects=n_subjects,
            seed=seed,
        )

    # ── 5. Per-demographic ROI summary matrices (T x n_rois) ──────────────
    demo_roi_matrices = {}
    demo_mean_brains = {}
    for demo, ens in ensembles.items():
        mean_brain = ens.mean(axis=0)  # (T, 20484)
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

    best_demo = max(engagement_scores, key=lambda d: engagement_scores[d]["overall"])

    # ── 7. Demographic time-series for specific ROI groups (Cell 8) ───────
    reward_rois = ["OFC", "p47r", "Area_47"]
    audio_rois = ["LBelt", "PBelt", "A1"]
    pfc_rois = ["a24pr", "p32pr"]
    memory_rois = ["EC", "PHA1", "PHA2", "PHA3"]

    demo_timeseries = {}
    for demo, roi_mat in demo_roi_matrices.items():
        ts_data = {}
        for group_name, group_rois in [
            ("reward", reward_rois),
            ("auditory", audio_rois),
            ("prefrontal", pfc_rois),
            ("memory", memory_rois),
            ("narrative", ["TPOJ1", "TPOJ2", "TPOJ3", "STSda", "STSdp"]),
            ("personal", ["PGi", "PGp", "PGs", "PCV"]),
            ("action", ["6a", "6d", "FEF", "8Ad"]),
        ]:
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
        subj_time_avg = ensembles[demo].mean(axis=1)  # (50, 20484)
        subj_roi = np.vstack([
            summarize_by_roi(subj_time_avg[s], hemi="both", mesh="fsaverage5")
            for s in range(subj_time_avg.shape[0])
        ])
        var_matrix[d_idx] = subj_roi.std(axis=0)

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
        mean_brain = ensembles[demo].mean(axis=0)
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
        "best_demographic": best_demo,
        "demo_timeseries": demo_timeseries,
        "heatmap": heatmap_data,
        "peak_timestep": peak_t,
        "demo_peak_data": demo_peak_data,
        "demo_mean_brains": demo_mean_brains,
        "preds": preds,  # keep raw for brain mesh endpoint
        "demo_labels": DEMO_LABELS,
        "demo_colors": DEMO_COLORS,
        "content_profile": content_profile,
    }
