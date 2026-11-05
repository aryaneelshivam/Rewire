import React, { useState, useMemo } from 'react';
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
import { MessageSquare } from 'lucide-react';

const COLORS = { a: '#0066cc', b: '#7a7a7a', grid: '#e0e0e0', muted: '#7a7a7a' };

const CustomDemoTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const vA = payload.find(p => p.dataKey === 'A')?.value;
    const vB = payload.find(p => p.dataKey === 'B')?.value;
    const diff = vA !== undefined && vB !== undefined ? vA - vB : null;
    const pct = vA && vB ? ((vA / vB - 1) * 100).toFixed(1) : null;

    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid #e5e5e5',
        borderRadius: '8px',
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
        fontSize: '11px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid #f0f0f0', paddingBottom: '3px' }}>
          <span style={{ color: 'var(--mute)' }}>t = {label}s</span>
          {diff !== null && (
            <span style={{ fontWeight: 700, color: diff >= 0 ? COLORS.a : COLORS.b }}>
              {diff >= 0 ? `A +${pct}%` : `B +${Math.abs(pct)}%`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', margin: '2px 0' }}>
          <span style={{ fontWeight: 600 }}>Variant A:</span>
          <span>{vA?.toFixed(4) ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', margin: '2px 0' }}>
          <span style={{ color: 'var(--charcoal)', fontWeight: 600 }}>Variant B:</span>
          <span>{vB?.toFixed(4) ?? '—'}</span>
        </div>
      </div>
    );
  }
  return null;
};

const DemoTimeSeries = ({ dataA, dataB, labels = {}, transcriptA = [], transcriptB = [] }) => {
  const [activeGroup, setActiveGroup] = useState('auditory');
  const [activeDemographic, setActiveDemographic] = useState('kids');
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  // For the selected demographic + group, build A vs B comparison
  const seriesA = useMemo(() => dataA?.[activeDemographic]?.[activeGroup] || [], [dataA, activeDemographic, activeGroup]);
  const seriesB = useMemo(() => dataB?.[activeDemographic]?.[activeGroup] || [], [dataB, activeDemographic, activeGroup]);
  const maxLen = Math.max(seriesA.length, seriesB.length);

  const chartData = useMemo(() => {
    const list = [];
    for (let i = 0; i < maxLen; i++) {
      list.push({
        time: i,
        A: seriesA[i] ?? null,
        B: seriesB[i] ?? null,
      });
    }
    return list;
  }, [seriesA, seriesB, maxLen]);

  const groups = [
    { id: 'reward', label: 'Reward & Valence', desc: 'Orbitofrontal & striatal dopamine response' },
    { id: 'auditory', label: 'Audio Frequency', desc: 'Primary auditory and tonal processing' },
    { id: 'narrative', label: 'Story Arc', desc: 'Temporal pole and TPJ narrative comprehension' },
    { id: 'personal', label: 'Personal Relevance', desc: 'Medial prefrontal self-referential encoding' },
    { id: 'action', label: 'Action Priming', desc: 'Premotor and supplemental motor activation' },
    { id: 'memory', label: 'Memory Imprint', desc: 'Hippocampal episodic memory encoding' },
    { id: 'prefrontal', label: 'Executive Attention', desc: 'DLPFC focus and cognitive prioritization' }
  ];

  const demos = [
    { id: 'kids', label: 'Kids (6–12)' },
    { id: 'genz', label: 'Gen Z (13–24)' },
    { id: 'adults', label: 'Adults (25–54)' },
    { id: 'older', label: 'Older (55+)' },
  ];

  // Pearson correlation r between A and B
  const correlationR = useMemo(() => {
    let count = 0, sumA = 0, sumB = 0;
    for (let i = 0; i < maxLen; i++) {
      if (seriesA[i] != null && seriesB[i] != null) {
        sumA += seriesA[i];
        sumB += seriesB[i];
        count++;
      }
    }
    if (count < 2) return null;
    const meanA = sumA / count;
    const meanB = sumB / count;
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < maxLen; i++) {
      if (seriesA[i] != null && seriesB[i] != null) {
        const da = seriesA[i] - meanA;
        const db = seriesB[i] - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
    }
    const den = Math.sqrt(denA * denB);
    return den > 0 ? (num / den).toFixed(3) : null;
  }, [seriesA, seriesB, maxLen]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const transcript = transcriptA.length > 0 ? transcriptA : transcriptB;

  return (
    <div className="glass-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="command-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
              NETWORK DYNAMICS
            </span>
            <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
              Temporal BOLD Synchronization
            </span>
          </div>
          <h2>Demographic Dynamic Trajectories</h2>
          <p style={{ color: 'var(--body)', fontSize: '13px', marginTop: '2px' }}>
            Head-to-head cortical trajectory for selected audience cohort & functional neural network.
          </p>
        </div>

        {/* Telemetry Strip with Pearson Correlation */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {correlationR !== null && (
            <div className="telemetry-strip">
              <span style={{ color: 'var(--mute)' }}>CROSS-VARIANT CORR (r):</span>
              <strong style={{ color: 'var(--ink)' }}>{correlationR}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px' }}>
            <span className="command-tag">
              <span className="sci-dot variant-a" />
              <span>Variant A</span>
            </span>
            <span className="command-tag" style={{ color: 'var(--charcoal)' }}>
              <span className="sci-dot variant-b" />
              <span>Variant B</span>
            </span>
          </div>
        </div>
      </div>

      {/* Cohort Selector Pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)', marginRight: '4px' }}>COHORT:</span>
        {demos.map(d => (
          <button
            key={d.id}
            onClick={() => setActiveDemographic(d.id)}
            className={`pill-btn ${activeDemographic === d.id ? 'active' : ''}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Dimension Selector Pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)', marginRight: '4px' }}>NETWORK:</span>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '4px 12px' }}
            title={g.desc}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Time-Series Chart */}
        <div className="chart-container" style={{ height: '360px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="time" stroke={COLORS.muted} tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} unit="s" />
              <YAxis stroke={COLORS.muted} tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} />
              <Tooltip content={<CustomDemoTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'var(--font-mono)' }} />
              
              {/* Content Narrative Reference Lines */}
              {transcript && transcript.map((evt, i) => {
                if (!evt || typeof evt.text !== 'string') return null;
                const shortText = evt.text.length > 20 ? evt.text.substring(0, 18) + '...' : evt.text;
                return (
                  <ReferenceLine
                    key={i}
                    x={Math.floor(evt.start)}
                    stroke={hoveredEvent === i ? COLORS.a : '#d7deea'}
                    strokeWidth={hoveredEvent === i ? 1.5 : 1}
                    strokeDasharray="3 3"
                    label={{
                      position: 'insideBottomLeft',
                      value: shortText,
                      fill: hoveredEvent === i ? COLORS.a : COLORS.muted,
                      fontSize: 9,
                      angle: -90,
                      offset: 15,
                      dy: -10,
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                );
              })}
              
              <Line 
                type="monotone" 
                dataKey="A" 
                name={`Variant A (${labels[activeDemographic] || activeDemographic})`} 
                stroke={COLORS.a}
                strokeWidth={2.5}
                dot={false} 
                connectNulls 
              />
              <Line 
                type="monotone" 
                dataKey="B" 
                name={`Variant B (${labels[activeDemographic] || activeDemographic})`} 
                stroke={COLORS.b}
                strokeWidth={2.5}
                dot={false} 
                strokeDasharray="5 3" 
                connectNulls 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Neural Narrative Log Accordion */}
        <div className="narrative-log">
          <div
            onClick={() => setIsLogExpanded(!isLogExpanded)}
            style={{
              padding: '12px 18px',
              borderBottom: isLogExpanded ? '1px solid var(--hairline)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={13} color="var(--charcoal)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Content Narrative Story Events
              </span>
              <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                {transcript.length} Events Synced
              </span>
            </div>
            <button className="pill-btn" style={{ height: '26px', fontSize: '11px', padding: '0 10px' }}>
              {isLogExpanded ? 'Hide Events' : 'Show Events'}
            </button>
          </div>

          {isLogExpanded && (
            <div style={{ padding: '16px', maxHeight: '360px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {transcript.map((evt, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredEvent(i)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--rounded-md)',
                      backgroundColor: hoveredEvent === i ? 'var(--variant-a-soft)' : 'transparent',
                      border: '1px solid',
                      borderColor: hoveredEvent === i ? 'var(--variant-a)' : 'transparent',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                        {formatTime(evt.start)} - {formatTime(evt.end)}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4, margin: 0 }}>
                      {evt.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoTimeSeries;
