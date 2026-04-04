import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine, Legend } from 'recharts';

export default function AsymmetryPanel({ dataA, dataB }) {
  if (!dataA || !dataA.timestep_metrics || !dataB || !dataB.timestep_metrics) return null;

  const yValsA = dataA.timestep_metrics.hemisphere_asymmetry || [];
  const yValsB = dataB.timestep_metrics.hemisphere_asymmetry || [];
  
  const maxT = Math.max(yValsA.length, yValsB.length);
  const chartData = [];
  for (let i = 0; i < maxT; i++) {
    chartData.push({
      time: i,
      A: yValsA[i] ?? null,
      B: yValsB[i] ?? null,
    });
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>t = {label}s</p>
          {payload.map((entry, i) => {
            if (entry.value == null) return null;
            const isApproach = entry.value >= 0;
            return (
              <p key={i} style={{ color: entry.color, fontWeight: 'bold', fontSize: '0.8rem' }}>
                {entry.name}: {isApproach ? 'APPROACH' : 'AVOIDANCE'} {Math.abs(entry.value).toFixed(3)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dark-card animate-fade-in" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <span>Approach vs. Avoidance — A/B</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PREFRONTAL ASYMMETRY</span>
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
        Tracking positive vs. negative reception across both variants.
        <strong style={{ color: '#E85D24', marginLeft: '0.5rem' }}>A (solid)</strong>{' '}
        <strong style={{ color: '#7F77DD', marginLeft: '0.5rem' }}>B (dashed)</strong>
      </p>

      <div style={{ height: 220, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="splitA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E85D24" stopOpacity={0.3}/>
                <stop offset="100%" stopColor="#E85D24" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="splitB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7F77DD" stopOpacity={0.3}/>
                <stop offset="100%" stopColor="#7F77DD" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={10} tickMargin={10} />
            <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} domain={[-0.1, 0.1]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.5)" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="A" name="Variant A" stroke="#E85D24" strokeWidth={2} fillOpacity={1} fill="url(#splitA)" connectNulls />
            <Area type="monotone" dataKey="B" name="Variant B" stroke="#7F77DD" strokeWidth={2} strokeDasharray="6 3" fillOpacity={1} fill="url(#splitB)" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
