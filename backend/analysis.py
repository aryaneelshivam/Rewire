"""
NeuraPulse Analysis Engine
Ported from triberewire6_updated.py (Cells 5-12)
All computation is pure numpy/scipy — no GPU required.
"""

import numpy as np
from scipy.ndimage import gaussian_filter1d
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
    "visual":    (["V1","V2","V3","VMV3","MT","MST"], 0.75),   
    "reward":    (["OFC","p47r","Area_47"],            0.65),
    "salience":  (["a24pr","p32pr","IFSa"],            0.60),
    "dmn":       (["PCC","PGi","PGp","PCV"],           0.70),
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

# =============================================================================
# ENSEMBLE GENERATOR  (Upgraded V3)
# =============================================================================

def generate_demographic_ensemble(
    base_preds: np.ndarray,
    demographic: str,
    n_subjects: int = 50,
    seed: int = 42,
) -> np.ndarray:
    """Generate synthetic ensemble of brain predictions for a target demographic (V3)."""
    assert demographic in DEMOGRAPHIC_PROFILES
    profile = DEMOGRAPHIC_PROFILES[demographic]
    params = DEMOGRAPHICS_PARAMS[demographic]
    rng = np.random.default_rng(seed)
    T, V = base_preds.shape
    V_split = V // 2
    ensemble = []

    # 1. Activation Envelope for State-Dependent Noise
    # Noise scales up to 1.4x at high-activation moments
    activation_envelope = base_preds.mean(axis=1, keepdims=True)  # (T,1)
    env_min, env_ptp = activation_envelope.min(), np.ptp(activation_envelope)
    norm_envelope = (activation_envelope - env_min) / (env_ptp + 1e-8)

    # 2. Network-level Noise Cache
    # Pre-generate correlated noise for each network unit
    network_noise_units = {}
    for net_name, (rois, rho) in NETWORK_COVARIANCE.items():
        # We'll use a standard sigma=1.0 and scale later
        network_noise_units[net_name] = correlated_roi_noise(rng, rois, _hcp_labels, T, 1.0, rho)

    for _ in range(n_subjects):
        # A. Log-Normal Global Scalar (Right-skewed individual differences)
        global_scalar = rng.lognormal(mean=0.0, sigma=0.12)
        
        # B. Temporal Shift (Processing Latency)
        shift = params["latency_shift"]
        if shift != 0:
            subj = np.roll(base_preds, shift, axis=0) * global_scalar
            # Clamp roll artifacts at boundaries
            if shift > 0: subj[:shift] = subj[shift]
            else: subj[shift:] = subj[shift-1]
        else:
            subj = base_preds * global_scalar

        # C. Attention Fatigue (Linear decay over time)
        fatigue_vec = 1.0 - (np.linspace(0, 1, T) * params["fatigue"]).reshape(-1, 1)
        subj *= fatigue_vec

        # D. Add AR(1) ROI Noise with State-Dependence & Network Coherence
        processed_rois = set()

        # D1. Apply Network-Correlated Noise
        for net_idx, (net_name, (net_rois, _)) in enumerate(NETWORK_COVARIANCE.items()):
            net_noise = network_noise_units[net_name] # (T, n_rois_in_net)
            for i, r_name in enumerate(net_rois):
                if r_name not in _hcp_labels: continue
                idx = _hcp_labels[r_name]
                scalar, sigma = profile.get(r_name, (1.0, 0.08))
                
                # Dynamic sigma (1.0x to 1.4x based on activation)
                dynamic_sigma = sigma * (1.0 + 0.4 * norm_envelope)
                
                # Combine AR(1) structure with network correlation
                # We reuse the correlated unit and apply AR(1) smoothing to it
                roi_noise = ar1_noise(rng, (T, len(idx)), 1.0, rho=0.6)
                # Blend: (Network correlation) + (Unique ROI variance)
                final_noise = (net_noise[:, [i]] * 0.7 + roi_noise * 0.3) * dynamic_sigma
                
                subj[:, idx] = (subj[:, idx] * scalar) + final_noise
                processed_rois.add(r_name)

        # D2. Apply Remaining Independent ROI Noise
        for r_name, (scalar, sigma) in profile.items():
            if r_name in processed_rois or r_name not in _hcp_labels:
                continue
            idx = _hcp_labels[r_name]
            dynamic_sigma = sigma * (1.0 + 0.4 * norm_envelope)
            raw_noise = ar1_noise(rng, (T, len(idx)), dynamic_sigma, rho=0.6)
            subj[:, idx] = (subj[:, idx] * scalar) + raw_noise

        # E. Hemisphere Bias (Functional Lateralization)
        for r_name, (hemi, bias) in HEMISPHERE_BIAS.items():
            if r_name in _hcp_labels:
                indices = _hcp_labels[r_name]
                # Filter indices by hemisphere
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

def run_full_analysis(preds: np.ndarray, n_subjects: int = 50, seed: int = 42) -> dict:
    """
    Run the entire analysis pipeline on raw predictions.
    Returns a dict with all computed data ready for API serialization.
    """
    T, V = preds.shape

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

    # ── 4. Demographic ensembles (Cells 5-6) ──────────────────────────────
    ensembles = {}
    for demo in DEMO_ORDER:
        ensembles[demo] = generate_demographic_ensemble(
            base_preds=preds,
            demographic=demo,
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

    # ── 6. Engagement scores (Cell 7) ─────────────────────────────────────
    engagement_scores = {}
    for demo, roi_mat in demo_roi_matrices.items():
        engagement_scores[demo] = compute_engagement_score(roi_mat)

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
    }
