import React from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';

const COLORS = {
  a: '#0066cc',
  b: '#7a7a7a',
  grid: '#e7ebf2',
  muted: '#98a2b3',
};

const CustomOverviewTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const mA = payload.find(p => p.dataKey === 'meanA')?.value;
    const mB = payload.find(p => p.dataKey === 'meanB')?.value;
    const diff = mA !== undefined && mB !== undefined ? mA - mB : null;
    const pct = mA && mB ? ((mA / mB - 1) * 100).toFixed(1) : null;

    return (
      <div style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.96)', 
        border: '1px solid #e5e5e5',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)' }}>
            TIMESTEP t = {label}s
          </span>
          {diff !== null && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: diff >= 0 ? COLORS.a : COLORS.b,
              backgroundColor: diff >= 0 ? '#eeefff' : '#e7f8f7',
              padding: '1px 6px',
              borderRadius: '3px'
            }}>
              {diff >= 0 ? `A +${pct}%` : `B +${Math.abs(pct)}%`}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
          <div>
            <span style={{ color: COLORS.a, fontWeight: 600, display: 'block' }}>Variant A</span>
            <span style={{ color: 'var(--charcoal)' }}>Peak: {payload.find(p => p.dataKey === 'maxA')?.value?.toFixed(3) ?? '—'}</span><br />
            <span style={{ color: 'var(--mute)' }}>Mean: {mA?.toFixed(3) ?? '—'}</span>
          </div>
          <div>
            <span style={{ color: COLORS.b, fontWeight: 600, display: 'block' }}>Variant B</span>
            <span style={{ color: 'var(--charcoal)' }}>Peak: {payload.find(p => p.dataKey === 'maxB')?.value?.toFixed(3) ?? '—'}</span><br />
            <span style={{ color: 'var(--mute)' }}>Mean: {mB?.toFixed(3) ?? '—'}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const OverviewPanel = ({ dataA, dataB, onSeekToTimestamp }) => {
  if (!dataA || !dataA.timestep_metrics || !dataB || !dataB.timestep_metrics) return null;

  const maxT = Math.max(dataA.timestep_metrics.timestep.length, dataB.timestep_metrics.timestep.length);
  const chartData = [];
  
  let aucA = 0;
  let aucB = 0;

  for (let i = 0; i < maxT; i++) {
    const mA = dataA.timestep_metrics.global_mean[i] ?? null;
    const mB = dataB.timestep_metrics.global_mean[i] ?? null;
    if (mA !== null) aucA += mA;
    if (mB !== null) aucB += mB;

    chartData.push({
      time: i,
      meanA: mA,
      maxA: dataA.timestep_metrics.global_max[i] ?? null,
      meanB: mB,
      maxB: dataB.timestep_metrics.global_max[i] ?? null,
    });
  }

  const peakA = dataA.peak_timestep ?? 0;
  const peakB = dataB.peak_timestep ?? 0;
  const peakValA = dataA.timestep_metrics.global_max[peakA] ?? 0;
  const peakValB = dataB.timestep_metrics.global_max[peakB] ?? 0;

  return (
    <div className="glass-card" style={{ marginTop: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="command-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
              fMRI CHRONOMETRY
            </span>
            <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
              BOLD Hemodynamic Response Progression
            </span>
          </div>
          <h2>Global Brain Activation — A vs B Trajectory</h2>
          <p style={{ color: 'var(--body)', fontSize: '13px', marginTop: '2px' }}>
            Continuous 1000ms whole-cortex activation trajectory comparing emotional stimulus ignition and neural decay.
          </p>
        </div>

        {/* Telemetry Stat Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="telemetry-strip">
            <span style={{ color: 'var(--mute)' }}>AUC RESONANCE:</span>
            <strong style={{ color: COLORS.a }}>A: {aucA.toFixed(1)}</strong>
            <span style={{ color: 'var(--mute)' }}>vs</span>
            <strong style={{ color: COLORS.b }}>B: {aucB.toFixed(1)}</strong>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <div className="command-tag">
              <span className="sci-dot variant-a" />
              <strong>Variant A</strong>
            </div>
            <div className="command-tag" style={{ color: 'var(--charcoal)' }}>
              <span className="sci-dot variant-b" />
              <strong>Variant B</strong> (Dashed)
            </div>
          </div>
        </div>
      </div>
      
      {/* Chart Viewport */}
      <div className="chart-container" style={{ height: '340px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
            onClick={(e) => {
              if (e && e.activeLabel !== undefined && onSeekToTimestamp) {
                onSeekToTimestamp(Number(e.activeLabel));
              }
            }}
          >
            <defs>
              <linearGradient id="overviewAreaA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.a} stopOpacity={0.24} />
                <stop offset="100%" stopColor={COLORS.a} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="overviewAreaB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.b} stopOpacity={0.18} />
                <stop offset="100%" stopColor={COLORS.b} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke={COLORS.muted}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              unit="s"
            />
            <YAxis 
              stroke={COLORS.muted}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              label={{ value: 'BOLD z-score', angle: -90, position: 'insideLeft', offset: 15, fontSize: 10, fill: COLORS.muted, fontFamily: 'var(--font-mono)' }}
            />
            <Tooltip content={<CustomOverviewTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'var(--font-mono)' }} />

            {/* Peak Annotations */}
            <ReferenceLine
              x={peakA}
              stroke={COLORS.a}
              strokeDasharray="2 2"
              strokeWidth={1}
              label={{
                value: `PEAK A (t=${peakA}s, z=${peakValA.toFixed(2)})`,
                position: 'top',
                fill: COLORS.a,
                fontSize: 9.5,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600
              }}
            />

            <ReferenceLine
              x={peakB}
              stroke={COLORS.b}
              strokeDasharray="2 2"
              strokeWidth={1}
              label={{
                value: `PEAK B (t=${peakB}s, z=${peakValB.toFixed(2)})`,
                position: 'insideTopRight',
                fill: COLORS.b,
                fontSize: 9.5,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600
              }}
            />

            {/* Significance Baseline (z = 1.65, p < 0.05) */}
            <ReferenceLine
              y={1.65}
              stroke="#cfd7e6"
              strokeDasharray="4 4"
              label={{
                value: 'p < 0.05 (z = 1.65)',
                position: 'insideBottomRight',
                fill: COLORS.muted,
                fontSize: 9,
                fontFamily: 'var(--font-mono)'
              }}
            />
            
            {/* Variant A (Pure Black Peak & Mean) */}
            <Area 
              type="monotone" 
              dataKey="maxA" 
              stroke={COLORS.a}
              fill="url(#overviewAreaA)"
              fillOpacity={1}
              strokeWidth={2.5}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: COLORS.a }}
              name="Variant A (Peak BOLD)" 
              connectNulls 
            />
            <Area 
              type="monotone" 
              dataKey="meanA" 
              stroke={COLORS.a}
              fill="none" 
              strokeWidth={1.5} 
              strokeDasharray="4 2" 
              name="Variant A (Global Mean)" 
              connectNulls 
            />

            {/* Variant B (Neutral Charcoal Peak & Mean) */}
            <Area 
              type="monotone" 
              dataKey="maxB" 
              stroke={COLORS.b}
              fill="url(#overviewAreaB)"
              fillOpacity={1}
              strokeWidth={2.5}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: COLORS.b }}
              name="Variant B (Peak BOLD)" 
              connectNulls 
            />
            <Area 
              type="monotone" 
              dataKey="meanB" 
              stroke={COLORS.b}
              fill="none" 
              strokeWidth={1.5} 
              strokeDasharray="3 3" 
              name="Variant B (Global Mean)" 
              connectNulls 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Hint */}
      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
        <span>Tip: Click on any timeline timestamp to synchronize 3D cortex mesh</span>
        <span>Sampling: 1 TR = 1.0s · AR(1) pink noise corrected</span>
      </div>
    </div>
  );
};

export default OverviewPanel;
