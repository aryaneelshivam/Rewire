import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

const TopRoisPanel = ({ dataA, dataB }) => {
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
    .map(r => ({ ...r, peakA: r.peakA || 0, peakB: r.peakB || 0 }))
    .sort((a, b) => Math.max(b.peakA, b.peakB) - Math.max(a.peakA, a.peakB))
    .slice(0, 7);

  const regionDefinitions = {
    'V4t': 'Visual Area 4 (Transitional) — Processes complex objects, color contrast, and early-stage motion integration.',
    'MT': 'Middle Temporal Area (V5) — Perceiving speed and direction of visual motion.',
    'MST': 'Medial Superior Temporal Area — Decodes complex optic flow.',
    'TPOJ3': 'Temporo-Parieto-Occipital Junction 3 — Integrates visual, auditory, and spatial signals.',
    'V8': 'Visual Area 8 — Specialized for advanced color processing.',
  };

  const COLORS_A = '#E85D24';
  const COLORS_B = '#7F77DD';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          background: 'rgba(15, 15, 15, 0.92)', 
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0.75rem',
          borderRadius: '8px',
        }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>ROI: {label}</p>
          {payload.map((entry, i) => (
            <p key={i} style={{ fontSize: '0.82rem', color: entry.color, fontWeight: 500 }}>
              {entry.name}: {entry.value.toFixed(4)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card h-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Top ROIs — A vs B</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="badge" style={{ background: 'rgba(232, 93, 36, 0.15)', color: '#E85D24' }}>A</div>
          <div className="badge" style={{ background: 'rgba(127, 119, 221, 0.15)', color: '#7F77DD' }}>B</div>
        </div>
      </div>
      <div className="chart-container" style={{ height: '350px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mergedRois} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={true} horizontal={false} />
            <XAxis type="number" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Legend />
            <Bar dataKey="peakA" name="Variant A" fill={COLORS_A} fillOpacity={0.85} radius={[0, 4, 4, 0]} />
            <Bar dataKey="peakB" name="Variant B" fill={COLORS_B} fillOpacity={0.85} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em', fontWeight: 600 }}>Region Architecture Insights</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {Object.entries(regionDefinitions).map(([name, desc], i) => (
            <div key={i} style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '0.85rem',
              borderRadius: '10px',
              transition: 'all 0.3s ease'
            }} className="hover-lift">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E85D24', fontFamily: 'Outfit' }}>{name}</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopRoisPanel;
