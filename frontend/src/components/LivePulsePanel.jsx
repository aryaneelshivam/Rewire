import React, { useMemo } from 'react';
import { Activity, Brain, Zap, ArrowLeftRight } from 'lucide-react';

const LivePulsePanel = ({ currentTime, overviewA, overviewB }) => {
  if (!overviewA || !overviewA.timestep_metrics || !overviewB || !overviewB.timestep_metrics) return null;

  const mA = overviewA.timestep_metrics;
  const mB = overviewB.timestep_metrics;
  const tA = Math.min(currentTime, mA.global_mean.length - 1);
  const tB = Math.min(currentTime, mB.global_mean.length - 1);

  const intensityA = mA.global_mean[tA] || 0;
  const intensityB = mB.global_mean[tB] || 0;
  const densityA = mA.active_fraction[tA] || 0;
  const densityB = mB.active_fraction[tB] || 0;

  const maxIntA = Math.max(...mA.global_mean) || 1;
  const maxIntB = Math.max(...mB.global_mean) || 1;
  const maxInt = Math.max(maxIntA, maxIntB);

  // Sparkline data (last 15 seconds) for BOTH
  const sparkA = useMemo(() => {
    const start = Math.max(0, tA - 14);
    const slice = mA.global_mean.slice(start, tA + 1);
    return slice.length < 15 ? [...Array(15 - slice.length).fill(0), ...slice] : slice;
  }, [mA.global_mean, tA]);

  const sparkB = useMemo(() => {
    const start = Math.max(0, tB - 14);
    const slice = mB.global_mean.slice(start, tB + 1);
    return slice.length < 15 ? [...Array(15 - slice.length).fill(0), ...slice] : slice;
  }, [mB.global_mean, tB]);

  const leader = intensityA > intensityB ? 'A' : intensityB > intensityA ? 'B' : '=';

  return (
    <div className="live-metrics-panel glass-card">
      <div className="pulse-header">
        <Activity size={14} color="var(--accent-orange)" />
        <span>Live A/B Pulse</span>
        <span className={`pulse-leader ${leader === 'A' ? 'leader-a' : leader === 'B' ? 'leader-b' : ''}`}>
          {leader === '=' ? 'TIED' : `${leader} LEADS`}
        </span>
      </div>

      <div className="metrics-stack">
        {/* INTENSITY A vs B */}
        <div className="metric-row">
          <div className="metric-label">
            <Zap size={12} /> Intensity
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
            <span className="variant-tag-a" style={{ fontSize: '0.6rem' }}>A</span>
            <div className="progress-bg" style={{ flex: 1 }}>
              <div className="progress-fill intensity" style={{ width: `${(intensityA / maxInt) * 100}%` }} />
            </div>
            <span className="metric-value" style={{ minWidth: '36px' }}>{(intensityA * 100).toFixed(0)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
            <span className="variant-tag-b" style={{ fontSize: '0.6rem' }}>B</span>
            <div className="progress-bg" style={{ flex: 1 }}>
              <div className="progress-fill density" style={{ width: `${(intensityB / maxInt) * 100}%`, background: 'var(--accent-purple)' }} />
            </div>
            <span className="metric-value" style={{ minWidth: '36px' }}>{(intensityB * 100).toFixed(0)}</span>
          </div>
        </div>

        {/* DENSITY A vs B */}
        <div className="metric-row">
          <div className="metric-label">
            <Brain size={12} /> Density
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
            <span className="variant-tag-a" style={{ fontSize: '0.6rem' }}>A</span>
            <div className="progress-bg" style={{ flex: 1 }}>
              <div className="progress-fill intensity" style={{ width: `${densityA * 100}%` }} />
            </div>
            <span className="metric-value" style={{ minWidth: '36px' }}>{(densityA * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
            <span className="variant-tag-b" style={{ fontSize: '0.6rem' }}>B</span>
            <div className="progress-bg" style={{ flex: 1 }}>
              <div className="progress-fill density" style={{ width: `${densityB * 100}%`, background: 'var(--accent-purple)' }} />
            </div>
            <span className="metric-value" style={{ minWidth: '36px' }}>{(densityB * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* DUAL SPARKLINE */}
      <div className="sparkline-container">
        <svg viewBox="0 0 150 40" preserveAspectRatio="none" className="sparkline-svg">
          <path
            d={`M ${sparkA.map((val, i) => `${i * 10},${40 - (val / maxInt * 35)}`).join(' L ')}`}
            fill="none"
            stroke="#E85D24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M ${sparkB.map((val, i) => `${i * 10},${40 - (val / maxInt * 35)}`).join(' L ')}`}
            fill="none"
            stroke="#7F77DD"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 2"
          />
        </svg>
      </div>
    </div>
  );
};

export default LivePulsePanel;
