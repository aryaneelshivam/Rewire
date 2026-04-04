import React, { useState, useMemo } from 'react';
import { Flame, Snowflake } from 'lucide-react';

const VarianceHeatmap = ({ dataA, dataB }) => {
  if (!dataA || !dataA.values || !dataB || !dataB.values) return null;

  const [activeVariant, setActiveVariant] = useState('both');
  const [hoveredCell, setHoveredCell] = useState(null);

  const demoLabels = {
    kids: 'Kids (6–12)',
    genz: 'Gen Z (13–24)',
    adults: 'Adults (25–54)',
    older: 'Older (55+)',
  };

  const demoColors = {
    kids: '#E85D24',
    genz: '#7F77DD',
    adults: '#1D9E75',
    older: '#BA7517',
  };

  // Pick a shared set of ROI labels from whichever has them
  const roiLabels = dataA.roi_labels;

  // Compute values for comparison
  const maxValueA = Math.max(...dataA.values.flat());
  const maxValueB = Math.max(...dataB.values.flat());
  const globalMax = Math.max(maxValueA, maxValueB);

  // Compute A vs B diff per cell
  const diffMatrix = useMemo(() => {
    return dataA.demographics.map((_, dIdx) =>
      roiLabels.map((_, rIdx) => {
        const a = dataA.values[dIdx]?.[rIdx] || 0;
        const b = dataB.values[dIdx]?.[rIdx] || 0;
        return a - b; // positive = A more variable, negative = B more variable
      })
    );
  }, [dataA, dataB, roiLabels]);

  const maxDiff = Math.max(...diffMatrix.flat().map(Math.abs)) || 1;

  const getHeatColorA = (value) => {
    const ratio = value / globalMax;
    const r = Math.round(20 + ratio * 212);
    const g = Math.round(20 + ratio * 73);
    const b = Math.round(22 + ratio * 14);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getHeatColorB = (value) => {
    const ratio = value / globalMax;
    const r = Math.round(20 + ratio * 107);
    const g = Math.round(20 + ratio * 99);
    const b = Math.round(22 + ratio * 199);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getDiffColor = (diff) => {
    const ratio = Math.abs(diff) / maxDiff;
    const intensity = Math.round(ratio * 255);
    if (diff > 0) {
      // A more variable — orange
      return `rgba(232, 93, 36, ${0.15 + ratio * 0.85})`;
    } else {
      // B more variable — purple
      return `rgba(127, 119, 221, ${0.15 + ratio * 0.85})`;
    }
  };

  const modes = [
    { id: 'both', label: 'A vs B Diff' },
    { id: 'A', label: 'Variant A' },
    { id: 'B', label: 'Variant B' },
  ];

  const getCellColor = (dIdx, rIdx) => {
    if (activeVariant === 'A') return getHeatColorA(dataA.values[dIdx]?.[rIdx] || 0);
    if (activeVariant === 'B') return getHeatColorB(dataB.values[dIdx]?.[rIdx] || 0);
    return getDiffColor(diffMatrix[dIdx]?.[rIdx] || 0);
  };

  const getCellValue = (dIdx, rIdx) => {
    if (activeVariant === 'A') return dataA.values[dIdx]?.[rIdx] || 0;
    if (activeVariant === 'B') return dataB.values[dIdx]?.[rIdx] || 0;
    return diffMatrix[dIdx]?.[rIdx] || 0;
  };

  return (
    <div className="glass-card h-full">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.35rem' }}>Neural Variance Topology</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '460px', lineHeight: 1.6 }}>
            Inter-subject consistency across the top 30 most variable ROIs. 
            {activeVariant === 'both' 
              ? ' Showing which variant produces more variable responses.'
              : ` Showing Variant ${activeVariant} neural variance distribution.`}
          </p>
        </div>

        {/* Mode switcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-end' }}>
          <div className="variant-toggle" style={{ borderRadius: '8px' }}>
            {modes.map(m => (
              <button
                key={m.id}
                className={`vtog ${activeVariant === m.id ? (m.id === 'A' ? 'active-a' : m.id === 'B' ? 'active-b' : 'active-a') : ''}`}
                onClick={() => setActiveVariant(m.id)}
                style={m.id === 'both' && activeVariant === 'both' ? { 
                  background: 'linear-gradient(135deg, rgba(232, 93, 36, 0.2), rgba(127, 119, 221, 0.2))',
                  color: '#fff'
                } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
            {activeVariant === 'both' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#E85D24' }}></div>
                  <span>A more variable</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#7F77DD' }}></div>
                  <span>B more variable</span>
                </div>
              </>
            ) : (
              <>
                <Snowflake size={10} />
                <span>CONSISTENT</span>
                <div style={{ 
                  width: '80px', height: '8px', borderRadius: '4px',
                  background: activeVariant === 'A' 
                    ? 'linear-gradient(to right, #141416, #E85D24)' 
                    : 'linear-gradient(to right, #141416, #7F77DD)'
                }}></div>
                <span>VARIABLE</span>
                <Flame size={10} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: '20px' }} className="custom-scrollbar">
        <div style={{ minWidth: '800px', overflow: 'visible', paddingBottom: '15px' }}>
          {/* ROI column headers */}
          <div style={{ display: 'flex', marginLeft: '110px', marginBottom: '4px' }}>
            {roiLabels.map((roi, i) => (
              <div key={i} style={{ 
                width: '28px',
                flexShrink: 0,
                marginRight: '3px',
                display: 'flex',
                justifyContent: 'center',
              }}>
                <span style={{ 
                  fontSize: '0.55rem',
                  color: hoveredCell?.rIdx === i ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transform: 'rotate(-55deg)',
                  transformOrigin: 'center center',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  width: '70px',
                  textAlign: 'left',
                  transition: 'color 0.15s ease',
                  fontWeight: hoveredCell?.rIdx === i ? 600 : 400,
                }}>
                  {roi}
                </span>
              </div>
            ))}
          </div>

          {/* Spacer for rotated labels */}
          <div style={{ height: '40px' }}></div>

          {/* Rows */}
          {dataA.demographics.map((demo, dIdx) => (
            <div key={demo} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '3px',
              borderRadius: '6px',
              transition: 'background 0.15s ease',
              background: hoveredCell?.dIdx === dIdx ? 'rgba(255,255,255,0.02)' : 'transparent',
              padding: '2px 0',
            }}>
              {/* Demo label */}
              <div style={{ 
                width: '110px', 
                flexShrink: 0,
                paddingRight: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <div style={{ 
                  width: '3px', 
                  height: '20px', 
                  borderRadius: '2px', 
                  background: demoColors[demo],
                  opacity: hoveredCell?.dIdx === dIdx ? 1 : 0.4,
                  transition: 'opacity 0.15s ease',
                }}></div>
                <span style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 600, 
                  color: hoveredCell?.dIdx === dIdx ? demoColors[demo] : 'var(--text-secondary)',
                  transition: 'color 0.15s ease',
                  fontFamily: 'Outfit',
                  letterSpacing: '-0.01em',
                }}>
                  {demoLabels[demo] || demo}
                </span>
              </div>

              {/* Cells */}
              {roiLabels.map((roi, rIdx) => {
                const val = getCellValue(dIdx, rIdx);
                const isHovered = hoveredCell?.dIdx === dIdx && hoveredCell?.rIdx === rIdx;
                const isRowCol = hoveredCell?.dIdx === dIdx || hoveredCell?.rIdx === rIdx;
                
                return (
                  <div
                    key={rIdx}
                    onMouseEnter={() => setHoveredCell({ dIdx, rIdx })}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      flexShrink: 0,
                      marginRight: '3px',
                      backgroundColor: getCellColor(dIdx, rIdx),
                      borderRadius: isHovered ? '4px' : '3px',
                      transition: 'all 0.15s ease',
                      transform: isHovered ? 'scale(1.35)' : isRowCol ? 'scale(1.05)' : 'scale(1)',
                      cursor: 'crosshair',
                      position: 'relative',
                      zIndex: isHovered ? 10 : isRowCol ? 5 : 1,
                      boxShadow: isHovered 
                        ? '0 0 12px rgba(255,255,255,0.15), 0 4px 8px rgba(0,0,0,0.4)' 
                        : 'none',
                      border: isHovered ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                    }}
                  ></div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hover Detail Card */}
      {hoveredCell && (
        <div style={{
          marginTop: '1rem',
          padding: '0.85rem 1.1rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {demoLabels[dataA.demographics[hoveredCell.dIdx]] || dataA.demographics[hoveredCell.dIdx]}
            </span>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', marginTop: '0.15rem' }}>
              {roiLabels[hoveredCell.rIdx]}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.6rem', color: '#E85D24', fontWeight: 700 }}>VAR A</span>
              <p style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit' }}>
                {(dataA.values[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0).toFixed(4)}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.6rem', color: '#7F77DD', fontWeight: 700 }}>VAR B</span>
              <p style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit' }}>
                {(dataB.values[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0).toFixed(4)}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>DIFF</span>
              <p style={{ 
                fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit',
                color: (diffMatrix[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0) > 0 ? '#E85D24' : '#7F77DD'
              }}>
                {(diffMatrix[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0) > 0 ? '+' : ''}
                {(diffMatrix[hoveredCell.dIdx]?.[hoveredCell.rIdx] || 0).toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ 
        marginTop: '1.25rem', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '0.75rem' 
      }}>
        {dataA.demographics.map((demo, dIdx) => {
          const avgA = (dataA.values[dIdx].reduce((a, b) => a + b, 0) / dataA.values[dIdx].length);
          const avgB = (dataB.values[dIdx].reduce((a, b) => a + b, 0) / dataB.values[dIdx].length);
          const moreVariable = avgA > avgB ? 'A' : 'B';
          return (
            <div key={demo} style={{ 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px', 
              padding: '0.75rem',
              borderLeft: `2px solid ${demoColors[demo]}`,
            }}>
              <span style={{ fontSize: '0.62rem', color: demoColors[demo], fontWeight: 700, textTransform: 'uppercase' }}>
                {demo}
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                <div>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>A avg</span>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Outfit', color: '#E85D24' }}>{avgA.toFixed(3)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>B avg</span>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Outfit', color: '#7F77DD' }}>{avgB.toFixed(3)}</p>
                </div>
              </div>
              <div style={{ 
                marginTop: '0.35rem', 
                fontSize: '0.58rem', 
                color: moreVariable === 'A' ? '#E85D24' : '#7F77DD',
                fontWeight: 700,
              }}>
                {moreVariable} more variable
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VarianceHeatmap;
