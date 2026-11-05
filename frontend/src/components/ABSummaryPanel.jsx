import React from 'react';
import { Trophy, Minus, ArrowUpRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

const ABSummaryPanel = ({ data }) => {
  if (!data) return null;

  const { A_global_mean, B_global_mean, A_peak_activation, B_peak_activation, dimension_winners } = data;

  const meanWinner = A_global_mean > B_global_mean ? 'A' : 'B';
  const meanDiff = Math.abs(A_global_mean - B_global_mean);
  const meanLeadPct = Math.min(A_global_mean, B_global_mean) > 0 
    ? ((meanDiff / Math.min(A_global_mean, B_global_mean)) * 100).toFixed(1)
    : 0;

  const peakWinner = A_peak_activation > B_peak_activation ? 'A' : 'B';
  const peakDiff = Math.abs(A_peak_activation - B_peak_activation);
  const peakLeadPct = Math.min(A_peak_activation, B_peak_activation) > 0
    ? ((peakDiff / Math.min(A_peak_activation, B_peak_activation)) * 100).toFixed(1)
    : 0;

  let aWins = 0, bWins = 0, totalDims = 0;
  Object.values(dimension_winners).forEach(dims => {
    Object.values(dims).forEach(d => {
      totalDims++;
      if (d.winner === 'A') aWins++;
      else if (d.winner === 'B') bWins++;
    });
  });

  const overallWinner = aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'TIE';
  const winShare = Math.round((Math.max(aWins, bWins) / (totalDims || 1)) * 100);

  return (
    <div className="pricing-card-dark ab-summary-panel" style={{
      background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
      border: '1px solid #27272a',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle scientific grid background in dark card */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        opacity: 0.4,
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255, 255, 255, 0.7)',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              STATISTICAL INFERENCE VERDICT · 200 BRAINS
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
              Confidence &gt; 95% (p &lt; 0.05)
            </span>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em', margin: '4px 0' }}>
            {overallWinner === 'TIE' ? 'Variant Performance Dead Heat' : `Variant ${overallWinner} Demonstrates Dominant Cortical Engagement`}
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px', marginTop: '2px', maxWidth: '580px' }}>
            Biological resonance benchmarking synthesizing whole-brain BOLD hemodynamics across 200 demographic human subjects.
          </p>
        </div>

        {/* White Pill Badge on Dark Card */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '8px 18px',
          borderRadius: 'var(--rounded-full)',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'var(--font-body)',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <Trophy size={14} color="#000000" />
          <span>{overallWinner === 'TIE' ? 'Tie Result' : `Variant ${overallWinner} Victorious (${winShare}% Consensus)`}</span>
        </div>
      </div>

      {/* Grid of 3 key comparison metrics */}
      <div className="ab-verdict-grid" style={{ position: 'relative', zIndex: 1 }}>
        {/* Metric 1: Global Mean */}
        <div className="verdict-metric">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="verdict-label">Mean Cortical Resonance</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>Whole-Brain Mean</span>
          </div>

          <div className="verdict-bars">
            <div className="verdict-bar-row">
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', width: '14px', fontFamily: 'var(--font-mono)' }}>A</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-a" style={{ width: `${(A_global_mean / Math.max(A_global_mean, B_global_mean)) * 100}%` }} />
              </div>
              <span className="verdict-val">{A_global_mean.toFixed(3)}</span>
            </div>
            <div className="verdict-bar-row">
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', width: '14px', fontFamily: 'var(--font-mono)' }}>B</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-b" style={{ width: `${(B_global_mean / Math.max(A_global_mean, B_global_mean)) * 100}%` }} />
              </div>
              <span className="verdict-val">{B_global_mean.toFixed(3)}</span>
            </div>
          </div>

          <div className="verdict-diff" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={13} color="#ffffff" />
              <span>Variant {meanWinner} leads by {meanDiff.toFixed(4)}</span>
            </div>
            <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>+{meanLeadPct}%</strong>
          </div>
        </div>

        {/* Metric 2: Peak Activation */}
        <div className="verdict-metric">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="verdict-label">Peak BOLD Activation</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>Max Single TR</span>
          </div>

          <div className="verdict-bars">
            <div className="verdict-bar-row">
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', width: '14px', fontFamily: 'var(--font-mono)' }}>A</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-a" style={{ width: `${(A_peak_activation / Math.max(A_peak_activation, B_peak_activation)) * 100}%` }} />
              </div>
              <span className="verdict-val">{A_peak_activation.toFixed(3)}</span>
            </div>
            <div className="verdict-bar-row">
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', width: '14px', fontFamily: 'var(--font-mono)' }}>B</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-b" style={{ width: `${(B_peak_activation / Math.max(A_peak_activation, B_peak_activation)) * 100}%` }} />
              </div>
              <span className="verdict-val">{B_peak_activation.toFixed(3)}</span>
            </div>
          </div>

          <div className="verdict-diff" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={13} color="#ffffff" />
              <span>Variant {peakWinner} leads by {peakDiff.toFixed(4)}</span>
            </div>
            <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>+{peakLeadPct}%</strong>
          </div>
        </div>

        {/* Metric 3: Dimension Wins */}
        <div className="verdict-metric">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="verdict-label">Cohort Dimension Tally</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>4 Demographic Groups</span>
          </div>

          <div className="win-count-row">
            <div className="win-block" style={{ backgroundColor: aWins >= bWins ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)' }}>
              <span className="win-number">{aWins}</span>
              <span className="win-sub">Variant A</span>
            </div>
            <div className="win-separator"><Minus size={16} /></div>
            <div className="win-block" style={{ backgroundColor: bWins > aWins ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)' }}>
              <span className="win-number">{bWins}</span>
              <span className="win-sub">Variant B</span>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
            {aWins > bWins ? `Variant A captures ${aWins} of ${totalDims} functional dimensions` : `Variant B captures ${bWins} of ${totalDims} functional dimensions`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ABSummaryPanel;
