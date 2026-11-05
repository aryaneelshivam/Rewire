import React from 'react';
import { Activity, Brain, Zap, Radio } from 'lucide-react';

const COLORS = { a: '#0066cc', b: '#7a7a7a' };

const LivePulsePanel = ({ currentTime, overviewA, overviewB }) => {
  if (!overviewA?.timestep_metrics || !overviewB?.timestep_metrics) return null;

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
  const maxInt = Math.max(maxIntA, maxIntB) || 1;

  // Sparkline data (last 16 seconds) for BOTH
  const startA = Math.max(0, tA - 15);
  const sliceA = mA.global_mean.slice(startA, tA + 1);
  const sparkA = sliceA.length < 16 ? [...Array(16 - sliceA.length).fill(sliceA[0] || 0), ...sliceA] : sliceA;

  const startB = Math.max(0, tB - 15);
  const sliceB = mB.global_mean.slice(startB, tB + 1);
  const sparkB = sliceB.length < 16 ? [...Array(16 - sliceB.length).fill(sliceB[0] || 0), ...sliceB] : sliceB;

  // HRF (Hemodynamic Response Function) Phase estimate
  let hrfPhase = 'Post-Stimulus Sustained Plateau';
  if (currentTime < 2) hrfPhase = 'Initial Baseline';
  else if (currentTime >= 2 && currentTime <= 6) hrfPhase = 'Ascending BOLD Onset';
  else if (intensityA > 0.7 * maxInt || intensityB > 0.7 * maxInt) hrfPhase = 'Peak Hemodynamic Resonance';

  const leader = intensityA > intensityB ? 'A' : intensityB > intensityA ? 'B' : '=';
  const diffPct = Math.min(intensityA, intensityB) > 0 
    ? ((Math.abs(intensityA - intensityB) / Math.min(intensityA, intensityB)) * 100).toFixed(1)
    : 0;

  return (
    <div className="live-metrics-panel" style={{
      backgroundColor: 'var(--canvas)',
      border: '1px solid var(--hairline)',
      boxShadow: 'var(--shadow-card)',
      borderRadius: 'var(--rounded-lg)',
      padding: '14px 16px'
    }}>
      {/* Header with live blinking dot and status */}
      <div className="pulse-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="sci-dot live" />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
            TELEMETRY PULSE
          </span>
          <span style={{ fontSize: '10px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
            t={currentTime}s
          </span>
        </div>
        <span className="pulse-leader" style={{
          backgroundColor: leader === 'A' ? COLORS.a : leader === 'B' ? COLORS.b : 'var(--surface-soft)',
          color: leader === '=' ? 'var(--charcoal)' : '#ffffff',
          border: '1px solid var(--hairline)',
          fontSize: '9.5px',
          fontWeight: 700,
          padding: '2px 8px'
        }}>
          {leader === '=' ? 'BALANCED' : `VAR ${leader} +${diffPct}%`}
        </span>
      </div>

      {/* HRF Status Banner */}
      <div style={{
        fontSize: '9.5px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--charcoal)',
        backgroundColor: 'var(--surface-soft)',
        padding: '3px 8px',
        borderRadius: '3px',
        border: '1px solid var(--hairline)',
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>HRF PHASE:</span>
        <strong style={{ color: 'var(--ink)' }}>{hrfPhase}</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* INTENSITY */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--charcoal)', marginBottom: '3px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={10} /> Cortical BOLD Intensity
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--mute)' }}>Mean z-score</span>
          </div>

          {/* Variant A Bar */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
            <span className="variant-tag-a" style={{ fontSize: '9px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A</span>
            <div className="progress-bg" style={{ flex: 1, height: '5px' }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, (intensityA / maxInt) * 100)}%`, backgroundColor: COLORS.a, borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '38px', textAlign: 'right', fontWeight: 600 }}>
              {intensityA.toFixed(3)}
            </span>
          </div>

          {/* Variant B Bar */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className="variant-tag-b" style={{ fontSize: '9px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>B</span>
            <div className="progress-bg" style={{ flex: 1, height: '5px' }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, (intensityB / maxInt) * 100)}%`, backgroundColor: COLORS.b, borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '38px', textAlign: 'right', fontWeight: 600, color: 'var(--charcoal)' }}>
              {intensityB.toFixed(3)}
            </span>
          </div>
        </div>

        {/* CORTICAL DENSITY */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--charcoal)', marginBottom: '3px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Brain size={10} /> Active Vertex Density
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--mute)' }}>Fraction &gt; 0.2z</span>
          </div>

          {/* Variant A Density */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
            <span className="variant-tag-a" style={{ fontSize: '9px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A</span>
            <div className="progress-bg" style={{ flex: 1, height: '5px' }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, densityA * 100)}%`, backgroundColor: COLORS.a, borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '38px', textAlign: 'right', fontWeight: 600 }}>
              {(densityA * 100).toFixed(1)}%
            </span>
          </div>

          {/* Variant B Density */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className="variant-tag-b" style={{ fontSize: '9px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>B</span>
            <div className="progress-bg" style={{ flex: 1, height: '5px' }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, densityB * 100)}%`, backgroundColor: COLORS.b, borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '38px', textAlign: 'right', fontWeight: 600, color: 'var(--charcoal)' }}>
              {(densityB * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* DUAL SPARKLINE WITH OSCILLOSCOPE READOUT */}
      <div style={{
        marginTop: '10px',
        paddingTop: '6px',
        borderTop: '1px solid var(--hairline)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--mute)' }}>
          <span>CHRONOSPARK (15s Window)</span>
          <span>● A / ··· B</span>
        </div>

        <div style={{ height: '36px', width: '100%', position: 'relative' }}>
          <svg viewBox="0 0 160 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="sparklineGradA" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={COLORS.a} stopOpacity="0.2" />
                <stop offset="100%" stopColor={COLORS.a} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Area Fill for A */}
            <polygon
              points={`0,40 ${sparkA.map((val, i) => `${i * 10.6},${Math.max(2, 38 - ((val / maxInt) * 34))}`).join(' ')} 160,40`}
              fill="url(#sparklineGradA)"
            />

            {/* Sparkline Line A (Solid Black) */}
            <path
              d={`M ${sparkA.map((val, i) => `${i * 10.6},${Math.max(2, 38 - ((val / maxInt) * 34))}`).join(' L ')}`}
              fill="none"
              stroke={COLORS.a}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Current point dot for A */}
            <circle
              cx={159}
              cy={Math.max(2, 38 - ((intensityA / maxInt) * 34))}
              r={2.5}
              fill={COLORS.a}
            />

            {/* Sparkline Line B (Dashed Gray) */}
            <path
              d={`M ${sparkB.map((val, i) => `${i * 10.6},${Math.max(2, 38 - ((val / maxInt) * 34))}`).join(' L ')}`}
              fill="none"
              stroke={COLORS.b}
              strokeWidth="1.5"
              strokeDasharray="3 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Current point dot for B */}
            <circle
              cx={159}
              cy={Math.max(2, 38 - ((intensityB / maxInt) * 34))}
              r={2}
              fill={COLORS.b}
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LivePulsePanel;
