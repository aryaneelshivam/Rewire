import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

const EngagementPanel = ({ dataA, dataB }) => {
  if (!dataA || !dataA.scores || !dataB || !dataB.scores) return null;

  const dims = dataA.dimensions.filter(d => d !== 'overall');
  const demos = ['kids', 'genz', 'adults', 'older'];
  const demoLabels = dataA.demo_labels;

  // Build chart data for each demographic — comparing A vs B
  const chartSections = demos.map(demo => {
    const chartData = dims.map(dim => ({
      name: dim.charAt(0).toUpperCase() + dim.slice(1),
      A: dataA.scores[demo]?.[dim] || 0,
      B: dataB.scores[demo]?.[dim] || 0,
    }));
    return { demo, label: demoLabels[demo], chartData };
  });

  // Overall winner per demo
  const demoWinners = demos.map(demo => {
    const aScore = dataA.scores[demo]?.overall || 0;
    const bScore = dataB.scores[demo]?.overall || 0;
    return { demo, label: demoLabels[demo], aScore, bScore, winner: aScore > bScore ? 'A' : bScore > aScore ? 'B' : 'TIE' };
  });

  return (
    <div className="glass-card h-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>A/B Engagement Comparison</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Neural response per dimension — Variant A vs B for each demographic.</p>
        </div>
      </div>

      {/* Quick winner badges per demographic */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {demoWinners.map(dw => (
          <div key={dw.demo} className={`demo-winner-chip ${dw.winner === 'A' ? 'chip-a' : dw.winner === 'B' ? 'chip-b' : 'chip-tie'}`}>
            <span className="chip-demo">{dw.label}</span>
            <span className="chip-winner">{dw.winner === 'TIE' ? '=' : dw.winner}</span>
            <span className="chip-score">{Math.max(dw.aScore, dw.bScore).toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* Grid of 4 charts — one per demographic */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {chartSections.map(({ demo, label, chartData }) => (
          <div key={demo} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: dataA.demo_colors[demo], marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {label}
            </p>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 9 }} />
                  <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 9 }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                    contentStyle={{ background: 'rgba(15, 15, 15, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}
                  />
                  <Bar dataKey="A" name="Variant A" fill="#E85D24" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                  <Bar dataKey="B" name="Variant B" fill="#7F77DD" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
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
