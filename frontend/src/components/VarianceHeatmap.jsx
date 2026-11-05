import React, { useState } from 'react';
import { Search, CheckCircle2, TrendingUp } from 'lucide-react';

const ROI_ANATOMY = {
  'V1': { network: 'Visual', name: 'Primary Visual Cortex', desc: 'Low-level edge and luminance contrast' },
  'V2': { network: 'Visual', name: 'Secondary Visual Cortex', desc: 'Binocular disparity and surface texture' },
  'V3': { network: 'Visual', name: 'Visual Area 3', desc: 'Dynamic global form and shape synthesis' },
  'V4': { network: 'Visual', name: 'Visual Area 4', desc: 'Color perception, geometric curvature and object features' },
  'V4t': { network: 'Visual', name: 'Visual Area 4 Transitional', desc: 'Motion-form integration and object boundaries' },
  'V8': { network: 'Visual', name: 'Visual Area 8', desc: 'Specialized color constancy and chromatic memory' },
  'MT': { network: 'Motion', name: 'Middle Temporal Area (V5)', desc: 'Visual velocity, motion direction, and parallax' },
  'MST': { network: 'Motion', name: 'Medial Superior Temporal Area', desc: 'Complex optic flow and self-motion perception' },
  'FST': { network: 'Motion', name: 'Fundus of Superior Temporal Sulcus', desc: 'Smooth pursuit motion and tracking' },
  'TPOJ1': { network: 'Integration', name: 'Temporo-Parieto-Occipital Junction 1', desc: 'Multisensory integration and temporal binding' },
  'TPOJ2': { network: 'Integration', name: 'Temporo-Parieto-Occipital Junction 2', desc: 'Cross-modal narrative and audio-visual cues' },
  'TPOJ3': { network: 'Integration', name: 'Temporo-Parieto-Occipital Junction 3', desc: 'Spatial attention and social intent decoding' },
  'LO1': { network: 'Visual', name: 'Lateral Occipital 1', desc: 'Object recognition and contour orientation' },
  'LO2': { network: 'Visual', name: 'Lateral Occipital 2', desc: 'Shape selectivity and semantic category parsing' },
  'PIT': { network: 'Visual', name: 'Posterior Inferior Temporal', desc: 'High-level brand and product visual identification' },
  'A1': { network: 'Auditory', name: 'Primary Auditory Cortex', desc: 'Acoustic pitch, frequency, and spectral tone' },
  'MBelt': { network: 'Auditory', name: 'Medial Belt Auditory Area', desc: 'Harmonics and complex auditory object recognition' },
  'PBelt': { network: 'Auditory', name: 'Posterior Belt Auditory Area', desc: 'Spatial sound localization and audio transitions' },
  '46': { network: 'Executive', name: 'Dorsolateral Prefrontal Area 46', desc: 'Working memory, decision valuation, and focus' },
  '9p': { network: 'Executive', name: 'Dorsal Prefrontal Area 9p', desc: 'Strategic evaluation and cognitive synthesis' },
  '8C': { network: 'Attention', name: 'Frontal Eye Field Area 8C', desc: 'Saccadic guidance and selective focal attention' },
  'p24': { network: 'Limbic', name: 'Posterior Cingulate Area 24', desc: 'Emotional salience, personal relevance, and value' },
  'a24': { network: 'Limbic', name: 'Anterior Cingulate Area 24', desc: 'Conflict resolution and emotional arousal' },
  'VIP': { network: 'Parietal', name: 'Ventral Intraparietal Area', desc: 'Peripersonal space and tactile-visual immersion' },
  'LIP': { network: 'Parietal', name: 'Lateral Intraparietal Area', desc: 'Salience mapping and gaze priority' },
  '7m': { network: 'Parietal', name: 'Medial Parietal Area 7m', desc: 'Narrative imagery and mental self-projection' },
  'PCV': { network: 'Limbic', name: 'Precuneus Visual Area', desc: 'Episodic memory recall and autobiographical link' },
  'VMV1': { network: 'Visual', name: 'Ventro-Medial Visual Area 1', desc: 'Scene recognition and environmental landscape' },
  'VMV2': { network: 'Visual', name: 'Ventro-Medial Visual Area 2', desc: 'Spatial background and scene context' },
  'PHA3': { network: 'Memory', name: 'Parahippocampal Area 3', desc: 'Contextual memory encoding and brand imprint' },
};

const NETWORK_COLORS = {
  'Visual': '#0066cc',
  'Motion': '#1d1d1f',
  'Integration': '#333333',
  'Auditory': '#555555',
  'Executive': '#666666',
  'Attention': '#7a7a7a',
  'Limbic': '#555555',
  'Parietal': '#999999',
  'Memory': '#333333',
};

const DEMO_LABELS = {
  kids: 'Kids (6–12)',
  genz: 'Gen Z (13–24)',
  adults: 'Adults (25–54)',
  older: 'Older (55+)',
};

const VarianceHeatmap = ({ dataA, dataB }) => {
  const [activeVariant, setActiveVariant] = useState('both');
  const [hoveredCell, setHoveredCell] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default', 'variance', 'delta'

  if (!dataA?.values || !dataB?.values) return null;

  const rawRoiLabels = dataA.roi_labels || [];
  const demographics = dataA.demographics || [];
  const valuesA = dataA.values;
  const valuesB = dataB.values;

  const maxValueA = valuesA.length ? Math.max(...valuesA.flat()) : 1;
  const maxValueB = valuesB.length ? Math.max(...valuesB.flat()) : 1;
  const globalMax = Math.max(maxValueA, maxValueB, 0.0001);

  // Compute full difference matrix
  const diffMatrix = demographics.map((_, dIdx) =>
    rawRoiLabels.map((_, rIdx) => {
      const a = valuesA[dIdx]?.[rIdx] || 0;
      const b = valuesB[dIdx]?.[rIdx] || 0;
      return a - b;
    })
  );

  const maxDiff = diffMatrix.length
    ? Math.max(...diffMatrix.flat().map(Math.abs), 0.0001)
    : 1;

  // Filter & Sort ROI Indices
  let processedRois = rawRoiLabels.map((roi, idx) => ({ roi, idx }));

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    processedRois = processedRois.filter(item => {
      const info = ROI_ANATOMY[item.roi] || {};
      return (
        item.roi.toLowerCase().includes(q) ||
        (info.name && info.name.toLowerCase().includes(q)) ||
        (info.network && info.network.toLowerCase().includes(q))
      );
    });
  }

  if (sortBy === 'variance') {
    processedRois.sort((a, b) => {
      const totalA = demographics.reduce((s, _, d) => s + (valuesA[d]?.[b.idx] || 0) + (valuesB[d]?.[b.idx] || 0), 0);
      const totalB = demographics.reduce((s, _, d) => s + (valuesA[d]?.[a.idx] || 0) + (valuesB[d]?.[a.idx] || 0), 0);
      return totalA - totalB;
    });
  } else if (sortBy === 'delta') {
    processedRois.sort((a, b) => {
      const sumDiffA = demographics.reduce((s, _, d) => s + Math.abs(diffMatrix[d]?.[b.idx] || 0), 0);
      const sumDiffB = demographics.reduce((s, _, d) => s + Math.abs(diffMatrix[d]?.[a.idx] || 0), 0);
      return sumDiffA - sumDiffB;
    });
  }

  // Summary Metrics
  let minVar = Infinity, minRoi = '', maxVar = 0, maxRoi = '';
  rawRoiLabels.forEach((roi, r) => {
    let sumVar = 0;
    demographics.forEach((_, d) => {
      sumVar += (valuesA[d]?.[r] || 0) + (valuesB[d]?.[r] || 0);
    });
    if (sumVar < minVar) { minVar = sumVar; minRoi = roi; }
    if (sumVar > maxVar) { maxVar = sumVar; maxRoi = roi; }
  });
  const summaryInsights = { minRoi, maxRoi };

  // Scientific Colormaps
  const getHeatColor = (value) => {
    const ratio = Math.max(0, Math.min(1, value / (globalMax || 1)));
    if (ratio < 0.25) {
      const t = ratio / 0.25;
      return `rgba(241, 245, 249, ${0.4 + t * 0.4})`;
    } else if (ratio < 0.6) {
      const t = (ratio - 0.25) / 0.35;
      return `rgba(100, 116, 139, ${0.4 + t * 0.5})`;
    } else {
      const t = (ratio - 0.6) / 0.4;
      return `rgba(15, 23, 42, ${0.7 + t * 0.3})`;
    }
  };

  const getDiffColor = (diff) => {
    const ratio = Math.min(1, Math.abs(diff) / (maxDiff || 1));
    if (Math.abs(diff) < 0.0001) {
      return '#f8fafc';
    }
    if (diff > 0) {
      // Variant A higher variance (action blue)
      return `rgba(0, 102, 204, ${(0.15 + ratio * 0.85).toFixed(2)})`;
    } else {
      // Variant B higher variance (neutral graphite)
      return `rgba(122, 122, 122, ${(0.15 + ratio * 0.85).toFixed(2)})`;
    }
  };

  const getCellColor = (dIdx, rIdx) => {
    if (activeVariant === 'A') return getHeatColor(dataA.values[dIdx]?.[rIdx] || 0);
    if (activeVariant === 'B') return getHeatColor(dataB.values[dIdx]?.[rIdx] || 0);
    return getDiffColor(diffMatrix[dIdx]?.[rIdx] || 0);
  };

  const modes = [
    { id: 'both', label: 'A vs B Divergence' },
    { id: 'A', label: 'Variant A Variance' },
    { id: 'B', label: 'Variant B Variance' },
  ];

  return (
    <div className="glass-card">
      {/* Header with Title and Scientific Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="command-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
              fMRI TOPOLOGY
            </span>
            <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
              200 Synthetic Brains · AR(1) Pink Noise Calibrated
            </span>
          </div>
          <h2>Cortical Variance Topology Matrix</h2>
          <p style={{ color: 'var(--body)', fontSize: '13px', maxWidth: '540px', marginTop: '2px', lineHeight: 1.5 }}>
            Inter-subject neural consistency across 30 functional ROIs. Low variance indicates unanimous audience consensus; high variance indicates polarizing reception.
          </p>
        </div>

        {/* Mode Switcher & Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {modes.map(m => (
              <button
                key={m.id}
                className={`pill-btn ${activeVariant === m.id ? 'active' : ''}`}
                onClick={() => setActiveVariant(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Scientific Colorbar Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
            {activeVariant === 'both' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#0066cc' }} />
                  <span>Variant A Divergent</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#7a7a7a' }} />
                  <span>Variant B Divergent</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Consensus (Low σ²)</span>
                <div style={{ width: '80px', height: '6px', borderRadius: '3px', background: 'linear-gradient(to right, #f5f5f7, #7a7a7a, #1d1d1f)' }} />
                <span>Heterogeneous (High σ²)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '8px 12px',
        background: 'var(--surface-soft)',
        borderRadius: 'var(--rounded-md)',
        border: '1px solid var(--hairline)',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Search ROI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '220px' }}>
          <Search size={13} color="var(--mute)" />
          <input
            type="text"
            placeholder="Search ROI or Network (e.g. V4, Motion, 46)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              width: '100%',
              color: 'var(--ink)'
            }}
          />
        </div>

        {/* Sort Controls & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--mute)' }}>SORT:</span>
          <button
            onClick={() => setSortBy('default')}
            className={`pill-btn ${sortBy === 'default' ? 'active' : ''}`}
            style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
          >
            HCP Order
          </button>
          <button
            onClick={() => setSortBy('variance')}
            className={`pill-btn ${sortBy === 'variance' ? 'active' : ''}`}
            style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
          >
            Max Variance
          </button>
          <button
            onClick={() => setSortBy('delta')}
            className={`pill-btn ${sortBy === 'delta' ? 'active' : ''}`}
            style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
          >
            A vs B Delta
          </button>
        </div>
      </div>

      {/* Heatmap Matrix Display */}
      <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
        <div style={{ minWidth: '880px' }}>
          {/* Functional Network Strip Header */}
          <div style={{ display: 'flex', marginLeft: '130px', marginBottom: '4px' }}>
            {processedRois.map(({ roi }) => {
              const info = ROI_ANATOMY[roi] || { network: 'Visual' };
              const col = NETWORK_COLORS[info.network] || '#64748b';
              return (
                <div
                  key={roi}
                  style={{
                    width: '24px',
                    height: '3px',
                    marginRight: '3px',
                    backgroundColor: col,
                    borderRadius: '1px',
                  }}
                  title={`Network: ${info.network}`}
                />
              );
            })}
          </div>

          {/* ROI Column Labels */}
          <div style={{ display: 'flex', marginLeft: '130px', marginBottom: '6px' }}>
            {processedRois.map(({ roi, idx }) => (
              <div key={roi} style={{ width: '24px', flexShrink: 0, marginRight: '3px', display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  fontSize: '9.5px',
                  color: hoveredCell?.rIdx === idx ? '#000000' : 'var(--charcoal)',
                  transform: 'rotate(-55deg)',
                  transformOrigin: 'left bottom',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: hoveredCell?.rIdx === idx ? 700 : 500,
                  transition: 'color 0.15s ease'
                }}>
                  {roi}
                </span>
              </div>
            ))}
          </div>

          <div style={{ height: '34px' }} />

          {/* Demographic Rows */}
          {dataA.demographics.map((demo, dIdx) => (
            <div key={demo} style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '3px',
              backgroundColor: hoveredCell?.dIdx === dIdx ? 'var(--surface-soft)' : 'transparent',
              padding: '3px 0',
              borderRadius: '4px',
              transition: 'background-color 0.1s ease'
            }}>
              {/* Row Demographic Title */}
              <div style={{ width: '130px', flexShrink: 0, paddingRight: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: dIdx === 0 ? '#000000' : dIdx === 1 ? '#334155' : dIdx === 2 ? '#64748b' : '#94a3b8'
                }} />
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {DEMO_LABELS[demo] || demo}
                </span>
              </div>

              {/* Cells */}
              {processedRois.map(({ roi, idx: rIdx }) => {
                const isHovered = hoveredCell?.dIdx === dIdx && hoveredCell?.rIdx === rIdx;
                const cellColor = getCellColor(dIdx, rIdx);

                return (
                  <div
                    key={roi}
                    onMouseEnter={() => setHoveredCell({ dIdx, rIdx, roi })}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      width: '24px',
                      height: '24px',
                      flexShrink: 0,
                      marginRight: '3px',
                      backgroundColor: cellColor,
                      borderRadius: '2px',
                      border: isHovered ? '1.5px solid #000000' : '1px solid rgba(0, 0, 0, 0.05)',
                      transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                      zIndex: isHovered ? 10 : 1,
                      cursor: 'crosshair',
                      transition: 'transform 0.12s ease, border-color 0.12s ease',
                      boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Detail Inspector Card */}
      {hoveredCell ? (
        <div style={{
          marginTop: '16px',
          padding: '16px 20px',
          backgroundColor: 'var(--surface-soft)',
          borderRadius: 'var(--rounded-md)',
          border: '1px solid var(--hairline-strong)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          animation: 'fade-in-scale 0.15s ease'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: NETWORK_COLORS[ROI_ANATOMY[hoveredCell.roi]?.network] || '#000000',
                padding: '1px 6px',
                borderRadius: '3px',
                fontFamily: 'var(--font-mono)'
              }}>
                {ROI_ANATOMY[hoveredCell.roi]?.network || 'CORTEX'}
              </span>
              <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                {hoveredCell.roi} — {ROI_ANATOMY[hoveredCell.roi]?.name || 'Cortical Area'}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--mute)' }}>·</span>
              <span style={{ fontSize: '12px', color: 'var(--charcoal)', fontWeight: 500 }}>
                {DEMO_LABELS[dataA.demographics[hoveredCell.dIdx]]}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--body)', margin: 0 }}>
              {ROI_ANATOMY[hoveredCell.roi]?.desc || 'Human Connectome Project cortical parcellation.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--mute)', display: 'block', fontSize: '10px' }}>VARIANT A σ²</span>
              <span style={{ fontWeight: 600, color: '#000000' }}>
                {(dataA.values[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0).toFixed(4)}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--mute)', display: 'block', fontSize: '10px' }}>VARIANT B σ²</span>
              <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>
                {(dataB.values[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0).toFixed(4)}
              </span>
            </div>
            <div style={{
              padding: '6px 12px',
              borderRadius: 'var(--rounded-sm)',
              background: '#ffffff',
              border: '1px solid var(--hairline)'
            }}>
              <span style={{ color: 'var(--mute)', display: 'block', fontSize: '10px' }}>VARIANCE RATIO</span>
              <strong style={{ color: 'var(--ink)' }}>
                {((diffMatrix[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0) > 0 ? '+A' : '+B')} {(Math.abs(diffMatrix[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0)).toFixed(4)}
              </strong>
            </div>
          </div>
        </div>
      ) : (
        /* Default Summary Strip */
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: 'var(--surface-soft)',
          borderRadius: 'var(--rounded-md)',
          border: '1px solid var(--hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--charcoal)',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={13} color="#10b981" />
            <span>Highest Cross-Cohort Consensus: <strong>{summaryInsights.minRoi}</strong> ({ROI_ANATOMY[summaryInsights.minRoi]?.name || 'Early Sensory'})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={13} color="#f59e0b" />
            <span>Most Heterogeneous Divergence: <strong>{summaryInsights.maxRoi}</strong> ({ROI_ANATOMY[summaryInsights.maxRoi]?.name || 'Association Hub'})</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VarianceHeatmap;
