import React, { useState } from 'react';
import { ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';

const COLORS = { a: '#0066cc', b: '#7a7a7a' };

const DimensionalLeadPanel = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!data || !data.dimension_winners) return null;

  const { dimension_winners } = data;

  const dimensionLabels = {
    visual: { label: 'Visual', desc: 'Visual cortex response' },
    auditory: { label: 'Auditory', desc: 'Audio processing engagement' },
    reward: { label: 'Reward', desc: 'Reward system activation' },
    memory: { label: 'Memory', desc: 'Memory encoding strength' },
    attention: { label: 'Attention', desc: 'Cognitive focus & load' },
    narrative: { label: 'Narrative', desc: 'Story comprehension' },
    personal: { label: 'Self', desc: 'Personal relevance' },
    action: { label: 'Action', desc: 'Behavioral intent priming' },
    overall: { label: 'Overall', desc: 'Weighted composite score' },
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
    <div className="glass-card" style={{ marginTop: '20px' }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '16px' : '0', cursor: 'pointer' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h2>Cognitive Dimension Lead Margins</h2>
          <p style={{ fontSize: '13px', color: 'var(--body)', marginTop: '2px' }}>
            Percentage advantage of the winning variant across all 4 demographic ensembles.
          </p>
        </div>
        <button 
          className="pill-btn" 
          style={{ height: '28px', padding: '0 10px' }}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
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
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--rounded-md)',
                backgroundColor: isOverall ? 'var(--surface-soft)' : 'transparent',
                border: '1px solid',
                borderColor: isOverall ? 'var(--variant-a)' : 'transparent',
                boxShadow: isOverall ? 'inset 0 0 0 1px var(--variant-a)' : 'inset 0 -1px 0 var(--hairline)',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Dimension Name */}
              <div style={{ width: '100px', flexShrink: 0 }}>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: isOverall ? 700 : 500, 
                  fontFamily: 'var(--font-body)',
                  color: 'var(--ink)',
                }}>
                  {info.label}
                </span>
              </div>

              {/* Dual Flat Progress Bars */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--ink)', fontWeight: 700, width: '12px', fontFamily: 'var(--font-mono)' }}>A</span>
                  <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--hairline)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: barMaxVal > 0 ? `${(d.avgA / barMaxVal) * 100}%` : '0%',
                      backgroundColor: COLORS.a,
                      borderRadius: '2px',
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 500, width: '38px', textAlign: 'right', color: 'var(--ink)' }}>
                    {d.avgA.toFixed(3)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--charcoal)', fontWeight: 700, width: '12px', fontFamily: 'var(--font-mono)' }}>B</span>
                  <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--hairline)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: barMaxVal > 0 ? `${(d.avgB / barMaxVal) * 100}%` : '0%',
                      backgroundColor: COLORS.b,
                      borderRadius: '2px',
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 500, width: '38px', textAlign: 'right', color: 'var(--charcoal)' }}>
                    {d.avgB.toFixed(3)}
                  </span>
                </div>
              </div>

              {/* Lead Pill */}
              <div style={{ width: '110px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                {d.leading === 'TIE' ? (
                  <span style={{ fontSize: '11px', color: 'var(--mute)', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 'var(--rounded-full)', border: '1px solid var(--hairline)' }}>
                    TIED
                  </span>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    padding: '2px 10px', 
                    borderRadius: 'var(--rounded-full)',
                    border: '0',
                    backgroundColor: d.leading === 'A' ? 'var(--variant-a-soft)' : 'var(--variant-b-soft)',
                  }}>
                    <ArrowUp size={10} color={d.leading === 'A' ? COLORS.a : COLORS.b} />
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: d.leading === 'A' ? COLORS.a : COLORS.b }}>
                      {d.leading}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--charcoal)' }}>
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
