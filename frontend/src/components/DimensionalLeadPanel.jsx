import React, { useState } from 'react';
import { ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';

const DimensionalLeadPanel = ({ data }) => {
  if (!data || !data.dimension_winners) return null;

  const [isExpanded, setIsExpanded] = useState(false);

  const { dimension_winners } = data;

  const dimensionLabels = {
    visual: { label: 'Visual', icon: '👁️', desc: 'Visual cortex response' },
    auditory: { label: 'Auditory', icon: '🔊', desc: 'Audio processing engagement' },
    reward: { label: 'Reward', icon: '🎯', desc: 'Reward system activation' },
    memory: { label: 'Recall', icon: '🧠', desc: 'Memory encoding strength' },
    attention: { label: 'Attention', icon: '⚡', desc: 'Cognitive focus & load' },
    narrative: { label: 'Story', icon: '📖', desc: 'Narrative comprehension' },
    personal: { label: 'Self', icon: '🪞', desc: 'Personal relevance' },
    action: { label: 'Action', icon: '🏃', desc: 'Behavioral intent priming' },
    overall: { label: 'Overall', icon: '🏆', desc: 'Weighted composite score' },
  };

  const dims = Object.keys(dimensionLabels);
  const demos = Object.keys(dimension_winners);

  const dimensionAggregates = {};
  dims.forEach(dim => {
    let sumA = 0, sumB = 0, count = 0;
    demos.forEach(demo => {
      if (dimension_winners[demo]?.[dim]) {
        sumA += dimension_winners[demo][dim].A;
        sumB += dimension_winners[demo][dim].B;
        count++;
      }
    });
    if (count > 0) {
      const avgA = sumA / count;
      const avgB = sumB / count;
      const leading = avgA > avgB ? 'A' : avgB > avgA ? 'B' : 'TIE';
      const maxVal = Math.max(avgA, avgB);
      const minVal = Math.min(avgA, avgB);
      const pctLead = minVal > 0 ? ((maxVal - minVal) / minVal * 100) : (maxVal > 0 ? 100 : 0);
      dimensionAggregates[dim] = { avgA, avgB, leading, pctLead };
    }
  });

  return (
    <div className="glass-card" style={{ marginTop: '1.5rem' }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '1.25rem' : '0', cursor: 'pointer' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '0.15rem' }}>Dimensional Lead Analysis</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Percentage advantage of the leading variant per cognitive dimension (averaged across all demographics).
          </p>
        </div>
        <button 
          className="pill-btn" 
          style={{ padding: '0.35rem 0.6rem', border: 'none', background: 'rgba(255,255,255,0.05)' }}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        {dims.filter(d => dimensionAggregates[d]).map(dim => {
          const d = dimensionAggregates[dim];
          const info = dimensionLabels[dim];
          const isOverall = dim === 'overall';
          const barMaxVal = Math.max(d.avgA, d.avgB);

          return (
            <div 
              key={dim} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: isOverall ? '0.85rem 0.75rem' : '0.55rem 0.75rem',
                borderRadius: '10px',
                background: isOverall 
                  ? 'linear-gradient(135deg, rgba(232, 93, 36, 0.06), rgba(127, 119, 221, 0.06))' 
                  : 'rgba(255,255,255,0.015)',
                border: isOverall 
                  ? '1px solid rgba(255,255,255,0.1)' 
                  : '1px solid rgba(255,255,255,0.03)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isOverall 
                  ? 'linear-gradient(135deg, rgba(232, 93, 36, 0.06), rgba(127, 119, 221, 0.06))' 
                  : 'rgba(255,255,255,0.015)';
                e.currentTarget.style.borderColor = isOverall 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(255,255,255,0.03)';
              }}
            >
              {/* Icon + Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '110px', flexShrink: 0 }}>
                <span style={{ fontSize: '1rem' }}>{info.icon}</span>
                <span style={{ 
                  fontSize: isOverall ? '0.82rem' : '0.78rem', 
                  fontWeight: isOverall ? 800 : 600, 
                  fontFamily: 'Outfit',
                  color: isOverall ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {info.label}
                </span>
              </div>

              {/* Dual progress bars */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.55rem', color: '#E85D24', fontWeight: 700, width: '12px' }}>A</span>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: barMaxVal > 0 ? `${(d.avgA / barMaxVal) * 100}%` : '0%',
                      background: d.leading === 'A' ? 'linear-gradient(90deg, #E85D24, #FF8C5A)' : '#E85D2466',
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }}></div>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'Outfit', fontWeight: 600, width: '42px', textAlign: 'right', color: '#E85D24' }}>
                    {d.avgA.toFixed(3)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.55rem', color: '#7F77DD', fontWeight: 700, width: '12px' }}>B</span>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: barMaxVal > 0 ? `${(d.avgB / barMaxVal) * 100}%` : '0%',
                      background: d.leading === 'B' ? 'linear-gradient(90deg, #7F77DD, #A59EFF)' : '#7F77DD66',
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }}></div>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'Outfit', fontWeight: 600, width: '42px', textAlign: 'right', color: '#7F77DD' }}>
                    {d.avgB.toFixed(3)}
                  </span>
                </div>
              </div>

              {/* Winner + Percentage Lead */}
              <div style={{ width: '120px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                {d.leading === 'TIE' ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    TIED
                  </span>
                ) : (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    background: d.leading === 'A' ? 'rgba(232, 93, 36, 0.12)' : 'rgba(127, 119, 221, 0.12)',
                    padding: '0.25rem 0.6rem', borderRadius: '6px',
                    border: `1px solid ${d.leading === 'A' ? 'rgba(232, 93, 36, 0.2)' : 'rgba(127, 119, 221, 0.2)'}`,
                  }}>
                    <ArrowUp size={11} color={d.leading === 'A' ? '#E85D24' : '#7F77DD'} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'Outfit', color: d.leading === 'A' ? '#E85D24' : '#7F77DD' }}>
                      {d.leading}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, fontFamily: 'Outfit', color: d.leading === 'A' ? '#FF8C5A' : '#A59EFF' }}>
                      +{d.pctLead.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default DimensionalLeadPanel;
