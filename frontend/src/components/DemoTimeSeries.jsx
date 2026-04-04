import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const DemoTimeSeries = ({ dataA, dataB, colors, labels, transcriptA = [], transcriptB = [] }) => {
  const [activeGroup, setActiveGroup] = useState('auditory');
  const [activeDemographic, setActiveDemographic] = useState('kids');
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  // For the selected demographic + group, build A vs B comparison
  const seriesA = dataA?.[activeDemographic]?.[activeGroup] || [];
  const seriesB = dataB?.[activeDemographic]?.[activeGroup] || [];
  const maxLen = Math.max(seriesA.length, seriesB.length);

  const chartData = [];
  for (let i = 0; i < maxLen; i++) {
    chartData.push({
      time: i,
      A: seriesA[i] ?? null,
      B: seriesB[i] ?? null,
    });
  }

  const groups = [
    { id: 'reward', label: 'Reward', sub: 'OFC + Accumbens — Valuation & Desirability' },
    { id: 'auditory', label: 'Audio', sub: 'A1 + Belt — Auditory Attention & Saliency' },
    { id: 'narrative', label: 'Story', sub: 'TPOJ + STS — Narrative Clarity & Meaning' },
    { id: 'personal', label: 'Self', sub: 'PCC + PGi — Personal Relevance & Identity' },
    { id: 'action', label: 'Action', sub: 'Area 6 + FEF — Behavioral Intent & Priming' },
    { id: 'memory', label: 'Recall', sub: 'EC + PHA — Memory Encoding & Latency' },
    { id: 'prefrontal', label: 'Attention', sub: 'ACC + PFC — Cognitive Load & Focus' }
  ];

  const demos = [
    { id: 'kids', label: 'Kids' },
    { id: 'genz', label: 'GenZ' },
    { id: 'adults', label: 'Adults' },
    { id: 'older', label: 'Older' },
  ];

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine which transcript to show (A or combined)
  const transcript = transcriptA.length > 0 ? transcriptA : transcriptB;

  return (
    <div className="glass-card h-full" style={{ minWidth: 0, overflow: 'hidden', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>A/B Demographic Trajectories</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Comparing <strong style={{ color: '#E85D24' }}>A</strong> vs <strong style={{ color: '#7F77DD' }}>B</strong> response for a selected demographic & dimension.
          </p>
        </div>
      </div>

      {/* Demographic selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {demos.map(d => (
          <button
            key={d.id}
            onClick={() => setActiveDemographic(d.id)}
            className={`pill-btn ${activeDemographic === d.id ? 'active' : ''}`}
            style={{ fontSize: '0.72rem' }}
          >
            {d.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Group selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            className={`pill-btn ${activeGroup === g.id ? 'active' : ''}`}
            style={{ fontSize: '0.68rem', padding: '0.3rem 0.6rem' }}
          >
            {g.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="chart-container" style={{ height: '400px', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'rgba(15, 15, 15, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              />
              <Legend verticalAlign="top" iconType="circle" />
              {transcript && transcript.map((evt, i) => {
                if (!evt || typeof evt.text !== 'string') return null;
                const shortText = evt.text.length > 20 ? evt.text.substring(0, 18) + '...' : evt.text;
                return (
                  <ReferenceLine
                    key={i}
                    x={Math.floor(evt.start)}
                    stroke={hoveredEvent === i ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={hoveredEvent === i ? 2 : 1}
                    strokeDasharray="3 3"
                    label={{ 
                      position: 'insideBottomLeft', 
                      value: shortText, 
                      fill: hoveredEvent === i ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', 
                      fontSize: 9, 
                      angle: -90, 
                      offset: 15,
                      dy: -10 
                    }}
                  />
                );
              })}
              <Line type="monotone" dataKey="A" name={`Variant A — ${labels[activeDemographic]}`} stroke="#E85D24" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="B" name={`Variant B — ${labels[activeDemographic]}`} stroke="#7F77DD" strokeWidth={2.5} dot={false} strokeDasharray="6 3" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Neural Narrative Log */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease'
        }}>
          <div 
            onClick={() => setIsLogExpanded(!isLogExpanded)}
            style={{ 
              padding: '0.75rem 1rem', 
              borderBottom: isLogExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none', 
              background: 'rgba(255,255,255,0.02)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Neural Narrative Log</span>
              {!isLogExpanded && <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{transcript.length} Events</span>}
            </div>
            <button className="pill-btn" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem', opacity: 0.8 }}>
              {isLogExpanded ? 'COLLAPSE' : 'EXPAND'}
            </button>
          </div>
          
          {isLogExpanded && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', maxHeight: '400px' }} className="custom-scrollbar">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {transcript && transcript.map((evt, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredEvent(i)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: hoveredEvent === i ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                      border: hoveredEvent === i ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                      cursor: 'default',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{formatTime(evt.start || 0)}</span>
                      <span style={{ fontSize: '0.5rem', padding: '1px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>EVENT {i+1}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: hoveredEvent === i ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: '1.4' }}>{evt.text || 'No description available'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Insight box */}
      <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h4 style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{groups.find(g => g.id === activeGroup)?.label || 'Neural'} Insight</h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{groups.find(g => g.id === activeGroup)?.sub || 'Analyzing neuro-activation patterns...'}</p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.75rem' }}>
          Select a demographic above to compare how Variant A and Variant B perform for that specific audience segment across the stimulus timeline.
        </p>
      </div>
    </div>
  );
};

export default DemoTimeSeries;
