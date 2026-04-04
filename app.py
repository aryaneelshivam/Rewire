import streamlit as st
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
from scipy.ndimage import gaussian_filter1d
from plotly.subplots import make_subplots

# Check if tribev2 is installed
try:
    from tribev2.utils import get_hcp_labels, summarize_by_roi
    from tribev2.plotting import PlotBrain
except ImportError:
    st.error("Please install tribev2: `pip install 'tribev2 @ git+https://github.com/facebookresearch/tribev2.git'`")
    st.stop()

# =============================================================================
# Streamlit Setup
# =============================================================================
st.set_page_config(page_title="Rewire - Neuromarketing Dashboard", layout="wide", page_icon="🧠")

st.title("🧠 Rewire Neuromarketing Dashboard")
st.markdown("This dashboard translates multimodal media inputs into actionable business insights using synthetic demographic engagement scoring across cortical activations. *[Running on Sample Data Mode]*")

st.markdown("""
<style>
    div.block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    div[data-testid="metric-container"] {
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 10px 15px;
        border: 1px solid rgba(255,255,255,0.1);
    }
    div[data-baseweb="tab-list"] {
        gap: 1rem;
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)

# =============================================================================
# Constants & Profiles
# =============================================================================
DEMOGRAPHIC_PROFILES = {
    'kids': {  # ages 6-12
        'V1': (1.00, 0.08), 'V2': (1.00, 0.08), 'V3': (1.00, 0.08),
        'VMV3': (1.00, 0.09), 'V4t': (1.00, 0.09),
        'MT': (1.05, 0.10), 'MST': (1.05, 0.10),
        'A1': (1.10, 0.09), 'LBelt': (1.12, 0.10), 'PBelt': (1.12, 0.10),
        'STSvp': (1.05, 0.10), 'STSdp': (1.05, 0.10),
        'Caudate': (1.25, 0.12), 'Accumbens': (1.25, 0.12),
        'Amygdala': (1.20, 0.13), 'Hippocampus': (1.10, 0.11),
        'a24pr': (0.75, 0.12), 'p32pr': (0.75, 0.12),
        'IFSa': (0.80, 0.11), 'IFSp': (0.80, 0.11),
        '47': (0.70, 0.13),
        'PCC': (0.85, 0.12), 'PGi': (0.80, 0.10),
    },
    'genz': {  # ages 13-24
        'V1': (1.10, 0.08), 'V2': (1.10, 0.08), 'V3': (1.10, 0.08),
        'VMV3': (1.20, 0.09), 'V4t': (1.20, 0.09),
        'MT': (1.25, 0.10), 'MST': (1.25, 0.10),
        'A1': (1.15, 0.09), 'LBelt': (1.30, 0.10), 'PBelt': (1.30, 0.10),
        'STSvp': (1.20, 0.10), 'STSdp': (1.20, 0.10),
        'Caudate': (1.45, 0.12), 'Accumbens': (1.45, 0.12),
        'Amygdala': (1.35, 0.13), 'Hippocampus': (1.15, 0.11),
        'a24pr': (0.80, 0.12), 'p32pr': (0.80, 0.12),
        'IFSa': (0.88, 0.11), 'IFSp': (0.88, 0.11),
        '47': (0.78, 0.13),
        'PCC': (0.90, 0.12), 'PGi': (1.00, 0.10),
    },
    'adults': {  # ages 25-54 
        'V1': (1.00, 0.07), 'V2': (1.00, 0.07), 'V3': (1.00, 0.07),
        'VMV3': (1.00, 0.08), 'V4t': (1.00, 0.08),
        'MT': (1.00, 0.08), 'MST': (1.00, 0.08),
        'A1': (1.00, 0.08), 'LBelt': (1.00, 0.09), 'PBelt': (1.00, 0.09),
        'STSvp': (1.00, 0.09), 'STSdp': (1.00, 0.09),
        'Caudate': (1.00, 0.10), 'Accumbens': (1.00, 0.10),
        'Amygdala': (1.00, 0.10), 'Hippocampus': (1.00, 0.10),
        'a24pr': (1.00, 0.10), 'p32pr': (1.00, 0.10),
        'IFSa': (1.00, 0.09), 'IFSp': (1.00, 0.09),
        '47': (1.00, 0.11),
        'PCC': (1.00, 0.10), 'PGi': (1.00, 0.09),
    },
    'older': {  # ages 55+ 
        'V1': (0.80, 0.10), 'V2': (0.80, 0.10), 'V3': (0.80, 0.10),
        'VMV3': (0.78, 0.11), 'V4t': (0.78, 0.11),
        'MT': (0.82, 0.11), 'MST': (0.82, 0.11),
        'A1': (0.75, 0.10), 'LBelt': (0.72, 0.11), 'PBelt': (0.72, 0.11),
        'STSvp': (0.80, 0.10), 'STSdp': (0.80, 0.10),
        'Caudate': (0.85, 0.12), 'Accumbens': (0.85, 0.12),
        'Amygdala': (1.05, 0.12), 'Hippocampus': (0.80, 0.12),
        'a24pr': (1.20, 0.14), 'p32pr': (1.20, 0.14),
        'IFSa': (1.15, 0.12), 'IFSp': (1.15, 0.12),
        '47': (1.25, 0.14),
        'PCC': (1.30, 0.13), 'PGi': (1.10, 0.11),
    },
}

ENGAGEMENT_WEIGHTS = {
    'visual':    (['V1', 'V2', 'V3', 'VMV3', 'MT', 'MST'],  0.25),
    'auditory':  (['A1', 'LBelt', 'PBelt', 'STSvp'],         0.20),
    'reward':    (['Caudate', 'Accumbens', 'Amygdala'],       0.30),
    'memory':    (['Hippocampus'],                            0.15),
    'attention': (['a24pr', 'p32pr'],                         0.10),
}


# =============================================================================
# Core Logic & Data Generation
# =============================================================================
@st.cache_data
def generate_dummy_predictions(n_timesteps, seed=42):
    """Generates a synthetic Rewire prediction array of shape (T, 20484)."""
    rng = np.random.default_rng(seed)
    raw_noise = rng.normal(1.0, 0.3, size=(n_timesteps, 20484))
    
    for _ in range(5):
        t_peak = rng.integers(0, n_timesteps)
        v_idx = rng.choice(20484, size=1500, replace=False)
        raw_noise[t_peak, v_idx] += rng.uniform(1.0, 4.0, size=1500)
        
    smooth_noise = gaussian_filter1d(raw_noise, sigma=2.0, axis=0)
    preds = np.abs(smooth_noise)
    preds = preds / preds.max() * 2.5 
    preds += 0.1
    return preds

@st.cache_data
def cached_get_hcp_labels():
    return get_hcp_labels(mesh='fsaverage5', combine=False, hemi='both')

@st.cache_data
def process_ensembles(preds, n_subjects, seed):
    hcp_labels = cached_get_hcp_labels()
    roi_labels = list(hcp_labels.keys())
    
    ensembles = {}
    roi_matrices = {}
    
    for demo in ['kids', 'genz', 'adults', 'older']:
        profile = DEMOGRAPHIC_PROFILES[demo]
        rng = np.random.default_rng(seed)
        T, V = preds.shape
        ensemble = []
        
        for _ in range(n_subjects):
            global_scalar = rng.normal(1.0, 0.12)
            subj = preds * global_scalar
            
            for roi_name, (scalar, sigma) in profile.items():
                if roi_name not in hcp_labels:
                    continue
                idx = hcp_labels[roi_name]
                raw_noise = rng.normal(0, sigma, size=(T, len(idx)))
                if len(idx) > 6:
                    raw_noise = gaussian_filter1d(raw_noise, sigma=3, axis=1)
                    raw_noise = raw_noise / (raw_noise.std() + 1e-8) * sigma
                subj[:, idx] = subj[:, idx] * scalar + raw_noise
            ensemble.append(subj)
            
        ens = np.stack(ensemble)
        ensembles[demo] = ens
        mean_brain = ens.mean(axis=0)
        roi_matrices[demo] = np.vstack([
            summarize_by_roi(mean_brain[t], hemi='both', mesh='fsaverage5')
            for t in range(T)
        ])
        
    return ensembles, roi_matrices, roi_labels

def compute_engagement_score(roi_matrix_T_x_R, roi_labels, weights=ENGAGEMENT_WEIGHTS):
    time_avg = roi_matrix_T_x_R.mean(axis=0)
    scores = {}
    total_weight = 0
    weighted_sum = 0
    for dim_name, (roi_names, w) in weights.items():
        idxs = [i for i, lbl in enumerate(roi_labels) if any(r in lbl for r in roi_names)]
        if not idxs:
            scores[dim_name] = 0.0
            continue
        dim_score = float(time_avg[idxs].mean())
        scores[dim_name] = round(dim_score, 4)
        weighted_sum += dim_score * w
        total_weight += w
    scores['overall'] = round(weighted_sum / total_weight, 4) if total_weight else 0.0
    return scores

# =============================================================================
# Streamlit UI Setup
# =============================================================================
st.sidebar.header("Processing Limits")
n_timesteps = st.sidebar.slider("Number of Timesteps (Video Seconds)", 10, 150, 45, 5)
n_subjects = st.sidebar.slider("Synthetic Subjects (per demographic)", 10, 100, 30, 10)
random_seed = st.sidebar.number_input("Random Seed", value=42, step=1)

with st.spinner("Generating Synthetic Data & Running Ensemble Model..."):
    preds = generate_dummy_predictions(n_timesteps, random_seed)
    ensembles, roi_matrices, roi_labels = process_ensembles(preds, n_subjects, random_seed)

st.markdown("---")

tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "📊 Engagement Metrics", 
    "📈 Time-Series Dynamics", 
    "🧠 Multi-View 3D Snapshots", 
    "🎞️ Timeline Sequence",
    "🔥 Reliability Heatmap"
])

# -----------------------------------------------------------------------------
# Engagement Metrics Calculation
# -----------------------------------------------------------------------------
dims = ['visual', 'auditory', 'reward', 'memory', 'attention', 'overall']
demos = ['kids', 'genz', 'adults', 'older']
demo_lbls = ['Kids (6–12)', 'Gen Z (13–24)', 'Adults (25–54)', 'Older (55+)']
colors = ['#E85D24', '#7F77DD', '#1D9E75', '#BA7517']
DEMO_COLORS = {'kids': '#E85D24', 'genz': '#7F77DD', 'adults': '#1D9E75', 'older': '#BA7517'}

score_records = {}
for demo, roi_mat in roi_matrices.items():
    score_records[demo] = compute_engagement_score(roi_mat, roi_labels)

best_demo = max(score_records, key=lambda d: score_records[d]['overall'])

# -----------------------------------------------------------------------------
# TAB 1: Engagement Metrics
# -----------------------------------------------------------------------------
with tab1:
    st.subheader("Demographic Engagement Validation")
    st.info(f"🏆 Highest overall engagement predicted for: **{best_demo.capitalize()}**")
    
    # KPIs for best demographic
    best_scores = score_records[best_demo]
    cols = st.columns(6)
    for i, dim in enumerate(dims):
        cols[i].metric(label=dim.capitalize(), value=f"{best_scores[dim]:.3f}")

    st.markdown("<br>", unsafe_allow_html=True)

    # Polished Plotly Bar Chart
    x_labels = [d.capitalize() for d in dims]
    fig_bar = go.Figure()

    for i, (demo, lbl, col) in enumerate(zip(demos, demo_lbls, colors)):
        vals = [score_records[demo].get(d, 0) for d in dims]
        fig_bar.add_trace(go.Bar(
            name=lbl, x=x_labels, y=vals, marker_color=col,
            marker_line_color='rgba(255,255,255,0.2)', marker_line_width=1, opacity=0.9
        ))
    
    fig_bar.update_layout(
        barmode='group',
        title='Neural Engagement Score by Dimension & Demographic',
        yaxis_title='Mean Activation Score',
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(color='white'),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )
    fig_bar.update_yaxes(gridcolor='rgba(255, 255, 255, 0.1)')
    st.plotly_chart(fig_bar, use_container_width=True)

# -----------------------------------------------------------------------------
# TAB 2: Time-Series Dynamics
# -----------------------------------------------------------------------------
with tab2:
    st.subheader("ROI Time-Series Tracking")
    
    fig_ts = make_subplots(rows=3, cols=1, 
                           subplot_titles=('Reward System (Caudate + Accumbens + Amygdala)', 
                                           'Auditory Belt (LBelt + PBelt + A1)', 
                                           'Prefrontal / Attention (a24pr + p32pr)'),
                           vertical_spacing=0.08)

    # Panel 1: Reward
    reward_rois = ['Caudate', 'Accumbens', 'Amygdala']
    for demo, roi_mat in roi_matrices.items():
        idxs = [i for i, lbl in enumerate(roi_labels) if any(r in lbl for r in reward_rois)]
        if idxs:
            mean_vals = roi_mat[:, idxs].mean(axis=1)
            fig_ts.add_trace(go.Scatter(x=np.arange(len(mean_vals)), y=mean_vals, 
                                        mode='lines', name=demo.capitalize(),
                                        line=dict(color=DEMO_COLORS[demo], width=2.5),
                                        legendgroup=demo, showlegend=True), row=1, col=1)

    # Panel 2: Auditory
    audio_rois = ['LBelt', 'PBelt', 'A1']
    for demo, roi_mat in roi_matrices.items():
        idxs = [i for i, lbl in enumerate(roi_labels) if any(r in lbl for r in audio_rois)]
        if idxs:
            mean_vals = roi_mat[:, idxs].mean(axis=1)
            fig_ts.add_trace(go.Scatter(x=np.arange(len(mean_vals)), y=mean_vals, 
                                        mode='lines', name=demo.capitalize(),
                                        line=dict(color=DEMO_COLORS[demo], width=2.5),
                                        legendgroup=demo, showlegend=False), row=2, col=1)

    # Panel 3: Prefrontal / attention
    pfc_rois = ['a24pr', 'p32pr']
    for demo, roi_mat in roi_matrices.items():
        idxs = [i for i, lbl in enumerate(roi_labels) if any(r in lbl for r in pfc_rois)]
        if idxs:
            mean_vals = roi_mat[:, idxs].mean(axis=1)
            fig_ts.add_trace(go.Scatter(x=np.arange(len(mean_vals)), y=mean_vals, 
                                        mode='lines', name=demo.capitalize(),
                                        line=dict(color=DEMO_COLORS[demo], width=2.5),
                                        legendgroup=demo, showlegend=False), row=3, col=1)

    fig_ts.update_layout(height=800, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='white'), hovermode="x unified")
    fig_ts.update_xaxes(gridcolor='rgba(255, 255, 255, 0.05)')
    fig_ts.update_yaxes(gridcolor='rgba(255, 255, 255, 0.05)', title_text='Mean ROI')
    fig_ts.update_xaxes(title_text='Timestep (s)', row=3, col=1)
    
    st.plotly_chart(fig_ts, use_container_width=True)


# -----------------------------------------------------------------------------
# Global PlotBrain Initializer (used in Tab 3 & 4)
# -----------------------------------------------------------------------------
@st.cache_resource
def get_plotter():
    """Cache the heavy PlotBrain initializer"""
    return PlotBrain(mesh="fsaverage5")

# -----------------------------------------------------------------------------
# TAB 3: Multi-View Snapshot (Image 2 Replica)
# -----------------------------------------------------------------------------
with tab3:
    st.subheader("Multi-View Cortical Topography")
    st.markdown("Peak-timestep brain views rendered exactly like the native Rewire outputs (using `cmap='fire'`).")

    plotter = get_plotter()
    time_step = st.slider("Select Timestep Snapshot (s)", 0, n_timesteps - 1, int(n_timesteps/2), key="timestep_slider")

    for i in range(4):
        demo_key = demos[i]
        mean_brain_t = ensembles[demo_key].mean(axis=0)[time_step]
        
        # Exact setup from classic TRIBEv2 notebook
        fig, axes = plt.subplots(1, 4, figsize=(18, 5))
        
        with st.spinner(f"Rendering multi-view graph for {demo_key.capitalize()}..."):
            plotter.plot_surf(
                mean_brain_t,
                axes=axes,
                views=["left", "right", "dorsal", "ventral"],
                cmap="fire",
                norm_percentile=99,
                vmin=0.5,
                alpha_cmap=(0, 0.2)
            )
            fig.suptitle(f"{demo_lbls[i]} — Cortical Map (t={time_step}s)", fontsize=18)
            
            # Use matplotlib native st.pyplot
            st.pyplot(fig)


# -----------------------------------------------------------------------------
# TAB 4: Timeline Sequence (Image 1 Replica)
# -----------------------------------------------------------------------------
with tab4:
    st.subheader("Cortical Timeline Sequence")
    st.markdown("A sequential plot of brain responses over consecutive timesteps, simulating the video response line.")
    
    plotter = get_plotter()
    
    # We create a sequence using base predictions
    # Show up to 15 frames max so it fits gracefully on screen and doesn't take forever to render
    max_frames = min(15, n_timesteps)
    
    with st.spinner("Rendering timeline strip (this may take a moment)..."):
        fig_seq = plotter.plot_timesteps(
            preds[:max_frames], 
            cmap="fire", 
            norm_percentile=99, 
            vmin=0.5, 
            alpha_cmap=(0, 0.2), 
            show_stimuli=False  # No stimuli since we are mocking video text/segments
        )
        st.pyplot(fig_seq)
        

# -----------------------------------------------------------------------------
# TAB 5: Heatmap
# -----------------------------------------------------------------------------
with tab5:
    st.subheader("Demographic Reliability Heatmap")
    st.markdown("Identifies variations across synthetic cohorts within significant ROIs.")

    var_matrix = np.zeros((len(demos), len(roi_labels)))

    for d_idx, demo in enumerate(demos):
        subj_time_avg = ensembles[demo].mean(axis=1)  # (N, V)
        subj_roi = np.vstack([
            summarize_by_roi(subj_time_avg[s], hemi='both', mesh='fsaverage5')
            for s in range(subj_time_avg.shape[0])
        ])
        var_matrix[d_idx] = subj_roi.std(axis=0)

    TOP_K = 30
    mean_var_across_demos = var_matrix.mean(axis=0)
    top_k_idx = np.argsort(mean_var_across_demos)[::-1][:TOP_K]
    top_k_labels = [roi_labels[i] for i in top_k_idx]
    var_subset = var_matrix[:, top_k_idx]

    fig_heat = go.Figure(data=go.Heatmap(
                    z=var_subset,
                    x=top_k_labels,
                    y=[l.replace('\n', ' ') for l in demo_lbls],
                    colorscale='YlOrRd',
                    hoverongaps=False))
                    
    fig_heat.update_layout(
        title='Inter-subject Variance (Top Variable ROIs)',
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(color='white'),
        height=400,
        margin=dict(l=0, r=0, t=40, b=0)
    )
    st.plotly_chart(fig_heat, use_container_width=True)
