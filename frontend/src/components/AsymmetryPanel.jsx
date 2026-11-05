import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine, Legend } from 'recharts';

const COLORS = { a: '#0066cc', b: '#7a7a7a', positive: '#0066cc', caution: '#7a7a7a', grid: '#e0e0e0', muted: '#7a7a7a' };

const CustomAsymmetryTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid #e5e5e5',
        padding: '12px 14px',
        borderRadius: '8px',
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
        fontSize: '11px',
      }}>
        <p style={{ color: 'var(--mute)', fontSize: '10px', marginBottom: '6px', borderBottom: '1px solid #f0f0f0', paddingBottom: '3px' }}>
          TIMESTAMP t = {label}s
        </p>
        {payload.map((entry, i) => {
          if (entry.value == null) return null;
          const isApproach = entry.value >= 0;
          return (
            <div key={i} style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}:</span>
              <span style={{ fontWeight: 500, color: isApproach ? COLORS.positive : COLORS.caution }}>
                {isApproach ? 'APPROACH (+)' : 'AVOIDANCE (-)'} {Math.abs(entry.value).toFixed(4)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function AsymmetryPanel({ dataA, dataB }) {
  if (!dataA || !dataA.timestep_metrics || !dataB || !dataB.timestep_metrics) return null;

  const yValsA = dataA.timestep_metrics.hemisphere_asymmetry || [];
  const yValsB = dataB.timestep_metrics.hemisphere_asymmetry || [];
  
  const maxT = Math.max(yValsA.length, yValsB.length);
  const chartData = [];
  
  let approachCountA = 0;
  let approachCountB = 0;

  for (let i = 0; i < maxT; i++) {
    const valA = yValsA[i] ?? null;
    const valB = yValsB[i] ?? null;

    if (valA !== null && valA > 0) approachCountA++;
    if (valB !== null && valB > 0) approachCountB++;

    chartData.push({
      time: i,
      A: valA,
      B: valB,
    });
  }

  const approachPctA = maxT > 0 ? ((approachCountA / maxT) * 100).toFixed(0) : 0;
  const approachPctB = maxT > 0 ? ((approachCountB / maxT) * 100).toFixed(0) : 0;

  return (
    <div className="glass-card" style={{ marginTop: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="command-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
              FRONTAL LATERALIZATION
            </span>
            <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
              Davidson Frontal EEG / BOLD Alpha Asymmetry Model
            </span>
          </div>
          <h2>Prefrontal Hemisphere Asymmetry (Approach vs. Avoidance)</h2>
        </div>

        {/* Approach State Summary Badges */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="telemetry-strip">
            <span style={{ color: 'var(--mute)' }}>APPROACH DOMINANCE:</span>
            <strong style={{ color: COLORS.a }}>Variant A: {approachPctA}%</strong>
            <span style={{ color: 'var(--mute)' }}>·</span>
            <strong style={{ color: COLORS.b }}>Variant B: {approachPctB}%</strong>
          </div>
        </div>
      </div>

      <p style={{ color: 'var(--body)', fontSize: '13px', marginBottom: '18px', lineHeight: 1.5, maxWidth: '680px' }}>
        Tracks emotional valence (approach vs. withdrawal tendency). Positive values reflect Left Prefrontal dominance (desire, attraction, purchase intent), whereas negative values reflect Right Prefrontal dominance (cognitive resistance, avoidance).
      </p>

      {/* Valence Zone Indicator Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--mute)', marginBottom: '4px', padding: '0 4px' }}>
        <span style={{ color: COLORS.positive }}>▲ APPROACH / MOTIVATIONAL PULL (LEFT CORTEX)</span>
        <span style={{ color: COLORS.caution }}>▼ AVOIDANCE / RESISTANCE (RIGHT CORTEX)</span>
      </div>

      <div style={{ height: 230, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="time" stroke={COLORS.muted} fontSize={10} tickMargin={8} tickLine={false} fontFamily="var(--font-mono)" unit="s" />
            <YAxis stroke={COLORS.muted} fontSize={10} domain={[-0.1, 0.1]} tickLine={false} fontFamily="var(--font-mono)" />
            <Tooltip content={<CustomAsymmetryTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', fontFamily: 'var(--font-mono)' }} />
            <ReferenceLine y={0} stroke="#cfd7e6" strokeWidth={1} />
            <Area 
              type="monotone" 
              dataKey="A" 
              name="Variant A" 
              stroke={COLORS.a}
              strokeWidth={2} 
              fill={COLORS.a}
              fillOpacity={0.09}
              connectNulls 
            />
            <Area 
              type="monotone" 
              dataKey="B" 
              name="Variant B" 
              stroke={COLORS.b}
              strokeWidth={2} 
              strokeDasharray="5 3" 
              fill={COLORS.b}
              fillOpacity={0.07}
              connectNulls 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
