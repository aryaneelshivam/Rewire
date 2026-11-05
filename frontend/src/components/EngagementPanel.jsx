import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Users } from 'lucide-react';

const COLORS = { a: '#0066cc', b: '#7a7a7a', grid: '#e0e0e0', muted: '#7a7a7a' };

const CustomEngagementTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const valA = payload.find(p => p.dataKey === 'A')?.value || 0;
    const valB = payload.find(p => p.dataKey === 'B')?.value || 0;
    const diff = valA - valB;
    const win = diff >= 0 ? 'A' : 'B';
    const pct = Math.min(valA, valB) > 0 ? ((Math.abs(diff) / Math.min(valA, valB)) * 100).toFixed(1) : 0;

    return (
      <div style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.96)', 
        border: '1px solid #e5e5e5', 
        borderRadius: '8px', 
        padding: '10px 14px',
        fontSize: '11px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
        fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', borderBottom: '1px solid #f0f0f0', paddingBottom: '3px' }}>
          COGNITIVE DIMENSION: {label}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', margin: '2px 0' }}>
          <span style={{ color: COLORS.a, fontWeight: 600 }}>Variant A:</span>
          <span>{valA.toFixed(4)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', margin: '2px 0' }}>
          <span style={{ color: COLORS.b, fontWeight: 600 }}>Variant B:</span>
          <span>{valB.toFixed(4)}</span>
        </div>
        <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--mute)' }}>Lead:</span>
          <strong style={{ color: win === 'A' ? COLORS.a : COLORS.b }}>
            Variant {win} (+{pct}%)
          </strong>
        </div>
      </div>
    );
  }
  return null;
};

const EngagementPanel = ({ dataA, dataB }) => {
  if (!dataA || !dataA.scores || !dataB || !dataB.scores) return null;

  const dims = dataA.dimensions.filter(d => d !== 'overall');
  const demos = ['kids', 'genz', 'adults', 'older'];
  const demoLabels = dataA.demo_labels;

  const demoSpecs = {
    kids: { label: 'Kids (6–12)', cohort: 'n=50 Synthetic Brains', latency: 'HRF Latency: +3.0s', bias: 'Sensory & Action Primed' },
    genz: { label: 'Gen Z (13–24)', cohort: 'n=50 Synthetic Brains', latency: 'HRF Latency: Normal', bias: 'Social-Emotional Selective' },
    adults: { label: 'Adults (25–54)', cohort: 'n=50 Synthetic Brains', latency: 'HRF Latency: Calibrated', bias: 'Executive & Reward Balanced' },
    older: { label: 'Older (55+)', cohort: 'n=50 Synthetic Brains', latency: 'HRF Latency: +5.0s', bias: 'Narrative & Memory Sustained' },
  };

  // Build chart data for each demographic — comparing A vs B
  const chartSections = demos.map(demo => {
    const chartData = dims.map(dim => {
      const valA = dataA.scores[demo]?.[dim] || 0;
      const valB = dataB.scores[demo]?.[dim] || 0;
      return {
        name: dim.charAt(0).toUpperCase() + dim.slice(1),
        rawDim: dim,
        A: valA,
        B: valB,
        diff: valA - valB,
        winner: valA >= valB ? 'A' : 'B'
      };
    });
    return { demo, spec: demoSpecs[demo], chartData };
  });

  // Overall winner per demo
  const demoWinners = demos.map(demo => {
    const aScore = dataA.scores[demo]?.overall || 0;
    const bScore = dataB.scores[demo]?.overall || 0;
    const diff = aScore - bScore;
    const winner = diff > 0.001 ? 'A' : diff < -0.001 ? 'B' : 'TIE';
    return {
      demo,
      label: demoLabels[demo] || demo,
      aScore,
      bScore,
      winner,
      leadPct: Math.min(aScore, bScore) > 0 ? ((Math.abs(diff) / Math.min(aScore, bScore)) * 100).toFixed(1) : 0
    };
  });

  return (
    <div className="glass-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="command-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
              COHORT DECOMPOSITION
            </span>
            <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
              8 Functional Neural Networks across 4 Demographic Ensembles
            </span>
          </div>
          <h2>A/B Engagement by Cognitive Dimension</h2>
          <p style={{ color: 'var(--body)', fontSize: '13px', marginTop: '2px', maxWidth: '580px' }}>
            Differential neural activation response comparing how demographic segments process sensory, emotional, memory, and executive story arcs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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

      {/* Demographic Summary Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {demoWinners.map(dw => (
          <div key={dw.demo} className="demo-winner-chip" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={12} color="var(--charcoal)" />
              <span className="chip-demo">{dw.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="chip-winner" style={{
                backgroundColor: dw.winner === 'A' ? COLORS.a : dw.winner === 'B' ? COLORS.b : '#e7ebf2',
                color: dw.winner === 'TIE' ? 'var(--charcoal)' : '#ffffff'
              }}>
                {dw.winner === 'TIE' ? 'TIE' : `Var ${dw.winner}`}
              </span>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--charcoal)' }}>
                +{dw.leadPct}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 2x2 Grid of Demographic Cohort Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {chartSections.map(({ demo, spec, chartData }) => (
          <div key={demo} className="cohort-chart">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  {spec.label}
                </span>
                <div style={{ fontSize: '10px', color: 'var(--mute)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {spec.cohort} · {spec.latency}
                </div>
              </div>
              <span className="command-tag" style={{ fontSize: '10px', padding: '1px 6px' }}>
                {spec.bias}
              </span>
            </div>
            
            <div style={{ height: '210px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" stroke={COLORS.muted} tick={{ fontSize: 9, fontFamily: 'var(--font-body)' }} />
                  <YAxis stroke={COLORS.muted} tick={{ fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                  <Tooltip content={<CustomEngagementTooltip />} cursor={{ fill: 'rgba(91, 92, 226, 0.05)' }} />
                  <Bar dataKey="A" name="Variant A" fill={COLORS.a} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="B" name="Variant B" fill={COLORS.b} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EngagementPanel;
