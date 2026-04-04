import React from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const OverviewPanel = ({ dataA, dataB }) => {
  if (!dataA || !dataA.timestep_metrics || !dataB || !dataB.timestep_metrics) return null;

  // Build unified chart data — use the longer timeline
  const maxT = Math.max(dataA.timestep_metrics.timestep.length, dataB.timestep_metrics.timestep.length);
  const chartData = [];
  for (let i = 0; i < maxT; i++) {
    chartData.push({
      time: i,
      meanA: dataA.timestep_metrics.global_mean[i] ?? null,
      maxA: dataA.timestep_metrics.global_max[i] ?? null,
      meanB: dataB.timestep_metrics.global_mean[i] ?? null,
      maxB: dataB.timestep_metrics.global_max[i] ?? null,
    });
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          background: 'rgba(15, 15, 15, 0.92)', 
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0.75rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>TIME: {label}s</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ fontSize: '0.82rem', color: entry.color, fontWeight: 500 }}>
              {entry.name}: {entry.value?.toFixed(4) ?? '—'}
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
        <h2>Global Brain Activation — A vs B</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="badge" style={{ background: 'rgba(232, 93, 36, 0.15)', color: '#E85D24' }}>Variant A</div>
          <div className="badge" style={{ background: 'rgba(127, 119, 221, 0.15)', color: '#7F77DD' }}>Variant B</div>
        </div>
      </div>
      
      <div className="chart-container" style={{ height: '350px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMaxA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E85D24" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#E85D24" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMeanA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E85D24" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#E85D24" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMaxB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7F77DD" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#7F77DD" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMeanB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7F77DD" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#7F77DD" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis 
              dataKey="time" 
              label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)', fontSize: 12 }}
              stroke="var(--text-secondary)"
              tick={{ fontSize: 10 }}
            />
            <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area type="monotone" dataKey="maxA" stroke="#E85D24" fillOpacity={1} fill="url(#colorMaxA)" strokeWidth={2} name="A Peak" connectNulls />
            <Area type="monotone" dataKey="meanA" stroke="#E85D24" fillOpacity={1} fill="url(#colorMeanA)" strokeWidth={1.5} strokeDasharray="4 2" name="A Mean" connectNulls />
            <Area type="monotone" dataKey="maxB" stroke="#7F77DD" fillOpacity={1} fill="url(#colorMaxB)" strokeWidth={2} name="B Peak" connectNulls />
            <Area type="monotone" dataKey="meanB" stroke="#7F77DD" fillOpacity={1} fill="url(#colorMeanB)" strokeWidth={1.5} strokeDasharray="4 2" name="B Mean" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>A ASYMMETRY</span>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#E85D24' }}>{dataA.timestep_metrics.hemisphere_asymmetry[dataA.peak_timestep].toFixed(4)}</p>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>A ACTIVE %</span>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#E85D24' }}>{(dataA.timestep_metrics.active_fraction[dataA.peak_timestep] * 100).toFixed(1)}%</p>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>B ASYMMETRY</span>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#7F77DD' }}>{dataB.timestep_metrics.hemisphere_asymmetry[dataB.peak_timestep].toFixed(4)}</p>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>B ACTIVE %</span>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#7F77DD' }}>{(dataB.timestep_metrics.active_fraction[dataB.peak_timestep] * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
};

export default OverviewPanel;
