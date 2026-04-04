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
        "47": (0.70, 0.13),
        "PCC": (0.85, 0.12), "PGi": (0.80, 0.10),
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
        "47": (0.78, 0.13),
        "PCC": (0.90, 0.12), "PGi": (1.00, 0.10),
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
        "47": (1.00, 0.11),
        "PCC": (1.00, 0.10), "PGi": (1.00, 0.09),
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
        "47": (1.25, 0.14),
        "PCC": (1.30, 0.13), "PGi": (1.10, 0.11),
    },
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
# ENSEMBLE GENERATOR  (Cell 5)
# =============================================================================

def generate_demographic_ensemble(
    base_preds: np.ndarray,
    demographic: str,
    n_subjects: int = 50,
    spatial_smoothing: int = 3,
    seed: int = 42,
) -> np.ndarray:
    """Generate synthetic ensemble of brain predictions for a target demographic."""
    assert demographic in DEMOGRAPHIC_PROFILES
    profile = DEMOGRAPHIC_PROFILES[demographic]
    rng = np.random.default_rng(seed)
    T, V = base_preds.shape
    ensemble = []

    for _ in range(n_subjects):
        global_scalar = rng.normal(1.0, 0.12)
        subj = base_preds * global_scalar

        for roi_name, (scalar, sigma) in profile.items():
            if roi_name not in _hcp_labels:
                continue
            idx = _hcp_labels[roi_name]
            raw_noise = rng.normal(0, sigma, size=(T, len(idx)))
            if spatial_smoothing > 0 and len(idx) > spatial_smoothing * 2:
                raw_noise = gaussian_filter1d(raw_noise, sigma=spatial_smoothing, axis=1)
                raw_noise = raw_noise / (raw_noise.std() + 1e-8) * sigma
            subj[:, idx] = subj[:, idx] * scalar + raw_noise

        ensemble.append(subj)

    return np.stack(ensemble)  # (n_subjects, T, 20484)


# =============================================================================
# ENGAGEMENT SCORING  (Cell 7)
# =============================================================================

def compute_engagement_score(
    roi_matrix: np.ndarray,
    roi_labels: list = ROI_LABEL_NAMES,
    weights: dict = ENGAGEMENT_WEIGHTS,
) -> dict:
    """Collapse (T, n_rois) matrix into engagement scores."""
    time_avg = roi_matrix.mean(axis=0)
    scores = {}
    total_weight = 0
    weighted_sum = 0
    dimensions = ["visual", "auditory", "reward", "memory", "attention", "narrative", "personal", "action", "overall"]
    for dim_name, (roi_names, w) in weights.items():
        idxs = [
            i for i, lbl in enumerate(roi_labels)
            if any(r in lbl for r in roi_names)
        ]
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
            spatial_smoothing=3,
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
