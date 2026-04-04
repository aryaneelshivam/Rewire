import React from 'react';
import { TrendingUp, Trophy, Minus } from 'lucide-react';

const ABSummaryPanel = ({ data }) => {
  if (!data) return null;

  const { A_global_mean, B_global_mean, A_peak_activation, B_peak_activation, dimension_winners } = data;

  const meanWinner = A_global_mean > B_global_mean ? 'A' : 'B';
  const meanDiff = Math.abs(A_global_mean - B_global_mean);
  const peakWinner = A_peak_activation > B_peak_activation ? 'A' : 'B';
  const peakDiff = Math.abs(A_peak_activation - B_peak_activation);

  let aWins = 0, bWins = 0;
  Object.values(dimension_winners).forEach(dims => {
    Object.values(dims).forEach(d => {
      if (d.winner === 'A') aWins++;
      else if (d.winner === 'B') bWins++;
    });
  });

  const overallWinner = aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'TIE';

  return (
    <div className="glass-card ab-summary-panel" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>A/B Test Verdict</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Quick comparison of neural engagement metrics.</p>
        </div>
        <div className={`verdict-badge ${overallWinner === 'A' ? 'winner-a' : overallWinner === 'B' ? 'winner-b' : 'winner-tie'}`}>
          <Trophy size={14} />
          <span>{overallWinner === 'TIE' ? 'Dead Heat' : `Variant ${overallWinner} Leads`}</span>
        </div>
      </div>

      <div className="ab-verdict-grid">
        {/* Global Mean */}
        <div className="verdict-metric">
          <span className="verdict-label">Global Mean Activation</span>
          <div className="verdict-bars">
            <div className="verdict-bar-row">
              <span className="variant-tag-a">A</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-a" style={{ width: `${(A_global_mean / Math.max(A_global_mean, B_global_mean)) * 100}%` }}></div>
              </div>
              <span className="verdict-val">{A_global_mean.toFixed(3)}</span>
            </div>
            <div className="verdict-bar-row">
              <span className="variant-tag-b">B</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-b" style={{ width: `${(B_global_mean / Math.max(A_global_mean, B_global_mean)) * 100}%` }}></div>
              </div>
              <span className="verdict-val">{B_global_mean.toFixed(3)}</span>
            </div>
          </div>
          <div className="verdict-diff">
            {meanWinner === 'A' ? <TrendingUp size={12} color="#E85D24" /> : <TrendingUp size={12} color="#7F77DD" />}
            <span>{meanWinner} wins by {meanDiff.toFixed(4)}</span>
          </div>
        </div>

        {/* Peak */}
        <div className="verdict-metric">
          <span className="verdict-label">Peak Activation</span>
          <div className="verdict-bars">
            <div className="verdict-bar-row">
              <span className="variant-tag-a">A</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-a" style={{ width: `${(A_peak_activation / Math.max(A_peak_activation, B_peak_activation)) * 100}%` }}></div>
              </div>
              <span className="verdict-val">{A_peak_activation.toFixed(3)}</span>
            </div>
            <div className="verdict-bar-row">
              <span className="variant-tag-b">B</span>
              <div className="verdict-bar-bg">
                <div className="verdict-bar-fill-b" style={{ width: `${(B_peak_activation / Math.max(A_peak_activation, B_peak_activation)) * 100}%` }}></div>
              </div>
              <span className="verdict-val">{B_peak_activation.toFixed(3)}</span>
            </div>
          </div>
          <div className="verdict-diff">
            {peakWinner === 'A' ? <TrendingUp size={12} color="#E85D24" /> : <TrendingUp size={12} color="#7F77DD" />}
            <span>{peakWinner} wins by {peakDiff.toFixed(4)}</span>
          </div>
        </div>

        {/* Win count */}
        <div className="verdict-metric">
          <span className="verdict-label">Dimension Wins (All Demos)</span>
          <div className="win-count-row">
            <div className="win-block win-a">
              <span className="win-number">{aWins}</span>
              <span className="win-sub">Variant A</span>
            </div>
            <div className="win-separator"><Minus size={16} /></div>
            <div className="win-block win-b">
              <span className="win-number">{bWins}</span>
              <span className="win-sub">Variant B</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ABSummaryPanel;
