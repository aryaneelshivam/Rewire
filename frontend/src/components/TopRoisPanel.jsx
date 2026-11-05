import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = { a: '#0066cc', b: '#7a7a7a', grid: '#e0e0e0', muted: '#7a7a7a' };

const REGION_DEFINITIONS = {
  'V4t': {
    fullName: 'Visual Area 4 (Transitional)',
    network: 'Visual Object Processing',
    lobe: 'Occipital',
    desc: 'Integrates complex object boundaries, color contrast, and early-stage motion. Direct driver of visual curiosity and gaze fixation.',
  },
  'MT': {
    fullName: 'Middle Temporal Area (V5)',
    network: 'Dynamic Motion Cortex',
    lobe: 'Temporal-Occipital',
    desc: 'Specialized for speed, motion parallax, and rapid visual cuts. Highly reactive to action scenes, cinematic camera pans, and kinetic transitions.',
  },
  'MST': {
    fullName: 'Medial Superior Temporal Area',
    network: 'Optic Flow & Immersion',
    lobe: 'Parieto-Temporal',
    desc: 'Decodes complex heading direction and 3D optic flow. Generates immersive viewer sensation of moving forward into the scene.',
  },
  'TPOJ3': {
    fullName: 'Temporo-Parieto-Occipital Junction 3',
    network: 'Multimodal Integration',
    lobe: 'Junctional Cortices',
    desc: 'Binds simultaneous visual, auditory, and narrative cues. Essential for brand storyline comprehension and high-level conceptual recall.',
  },
  'V8': {
    fullName: 'Visual Area 8 (Ventral Color Hub)',
    network: 'Ventral Stream',
    lobe: 'Occipital-Temporal',
    desc: 'Processes vivid color vibrancy and aesthetic appeal. Key predictor of packaging recognition and visual brand signature retention.',
  },
  'LO1': {
    fullName: 'Lateral Occipital 1',
    network: 'Object Recognition',
    lobe: 'Lateral Occipital',
    desc: 'Specialized in segmenting foreground products from background clutter, enabling instant brand recognition.',
  },
  '46': {
    fullName: 'Dorsolateral Prefrontal Cortex (Area 46)',
    network: 'Executive Valuation',
    lobe: 'Prefrontal',
    desc: 'Central node for working memory, value computation, and conscious consideration. Directly correlates with purchase intent.',
  },
  'p24': {
    fullName: 'Posterior Cingulate Cortex (Area 24)',
    network: 'Default Mode & Valuation',
    lobe: 'Medial Frontal',
    desc: 'Associated with personal relevance, emotional resonance, and deep storytelling connection.',
  }
};

const CustomRoiTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const vA = payload.find(p => p.dataKey === 'peakA')?.value ?? 0;
    const vB = payload.find(p => p.dataKey === 'peakB')?.value ?? 0;
    const lead = vA >= vB ? 'A' : 'B';
    const pct = Math.min(vA, vB) > 0 ? ((Math.abs(vA - vB) / Math.min(vA, vB)) * 100).toFixed(1) : 0;
    const info = REGION_DEFINITIONS[label] || {};

    return (
      <div style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.96)', 
        border: '1px solid #e5e5e5',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        fontSize: '11px',
        minWidth: '220px'
      }}>
        <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--mute)' }}>HCP PARCELLATION</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
            {label} {info.fullName ? `· ${info.fullName}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
          <span>Variant A Peak:</span>
          <strong>{vA.toFixed(4)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
          <span>Variant B Peak:</span>
          <strong>{vB.toFixed(4)}</strong>
        </div>
        <div style={{
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: 'var(--mute)' }}>Advantage:</span>
          <span style={{
            fontWeight: 700,
            color: '#ffffff',
            backgroundColor: lead === 'A' ? COLORS.a : COLORS.b,
            padding: '1px 6px',
            borderRadius: '3px'
          }}>
            Variant {lead} (+{pct}%)
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const TopRoisPanel = ({ dataA, dataB }) => {
  const [selectedRoi, setSelectedRoi] = useState(null);

  if (!dataA || !dataA.rois || !dataB || !dataB.rois) return null;

  // Merge ROI data: combine A and B rois by name
  const roiMap = {};
  dataA.rois.forEach(r => {
    roiMap[r.name] = { name: r.name, peakA: r.peak_activation, tsA: r.peak_timestep };
  });
  dataB.rois.forEach(r => {
    if (!roiMap[r.name]) roiMap[r.name] = { name: r.name };
    roiMap[r.name].peakB = r.peak_activation;
    roiMap[r.name].tsB = r.peak_timestep;
  });

  // Sort by max of A/B peak
  const mergedRois = Object.values(roiMap)
    .map(r => ({
      ...r,
      peakA: r.peakA || 0,
      peakB: r.peakB || 0,
      diff: (r.peakA || 0) - (r.peakB || 0),
      winner: (r.peakA || 0) >= (r.peakB || 0) ? 'A' : 'B'
    }))
    .sort((a, b) => Math.max(b.peakA, b.peakB) - Math.max(a.peakA, a.peakB))
    .slice(0, 8);

  return (
    <div className="glass-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="command-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
              HCP MULTIMODAL PARCELLATION
            </span>
            <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
              180 Cortical Areas per Hemisphere
            </span>
          </div>
          <h2>Top Cortical Regions of Interest (ROIs)</h2>
          <p style={{ color: 'var(--body)', fontSize: '13px', marginTop: '2px' }}>
            Maximum BOLD activation across specialized functional anatomical parcellations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="command-tag">
            <span className="sci-dot variant-a" />
            <span>Variant A</span>
          </div>
          <div className="command-tag" style={{ color: 'var(--charcoal)' }}>
            <span className="sci-dot variant-b" />
            <span>Variant B</span>
          </div>
        </div>
      </div>

      {/* Horizontal Bar Chart */}
      <div className="chart-container" style={{ height: '340px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mergedRois} layout="vertical" margin={{ top: 5, right: 30, left: 15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={true} horizontal={false} />
            <XAxis
              type="number"
              stroke={COLORS.muted}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              label={{ value: 'Peak BOLD z-score', position: 'insideBottom', offset: -4, fontSize: 10, fill: COLORS.muted, fontFamily: 'var(--font-mono)' }}
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fill: 'var(--ink)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              width={65}
              tickLine={false}
            />
            <Tooltip content={<CustomRoiTooltip />} cursor={{ fill: 'rgba(91, 92, 226, 0.05)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'var(--font-mono)' }} />
            <Bar dataKey="peakA" name="Variant A" fill={COLORS.a} radius={[0, 5, 5, 0]} />
            <Bar dataKey="peakB" name="Variant B" fill={COLORS.b} radius={[0, 5, 5, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Region Architecture Definitions Grid */}
      <div style={{ marginTop: '28px', borderTop: '1px solid var(--hairline)', paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '11px', color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Cortical Region Architecture & Neuromarketing Implications
          </span>
          <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
            Glasser et al. (Nature 2016) Parcellations
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {Object.entries(REGION_DEFINITIONS).map(([name, info]) => {
            const isWinnerA = mergedRois.find(r => r.name === name)?.winner === 'A';
            return (
              <div
                key={name}
                onClick={() => setSelectedRoi(selectedRoi === name ? null : name)}
                style={{ 
                  backgroundColor: selectedRoi === name ? 'var(--variant-a-soft)' : 'rgba(255, 255, 255, 0.55)', 
                  padding: '14px 16px', 
                  borderRadius: 'var(--rounded-md)',
                  border: '1px solid',
                  borderColor: selectedRoi === name ? 'var(--variant-a)' : 'transparent',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  color: 'var(--body)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedRoi === name ? 'inset 0 0 0 1px var(--variant-a)' : 'inset 0 0 0 1px var(--hairline)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{name}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>[{info.lobe}]</span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '2px',
                    backgroundColor: isWinnerA ? COLORS.a : COLORS.b,
                    color: '#ffffff'
                  }}>
                    {isWinnerA ? 'Variant A' : 'Variant B'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--charcoal)', fontWeight: 500, marginBottom: '4px' }}>
                  {info.fullName}
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--body)' }}>
                  {info.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TopRoisPanel;
