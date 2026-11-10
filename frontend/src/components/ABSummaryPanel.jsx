import React from 'react';
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter';
import { leadPct } from '@/lib/chart-data';

/** The verdict in words on the left, the three deciding numbers in one divided strip on the right. */
const ABSummaryPanel = ({ data }) => {
  if (!data) return null;
  const { A_global_mean, B_global_mean, A_peak_activation, B_peak_activation, dimension_winners } = data;

  let aWins = 0, bWins = 0, total = 0;
  Object.values(dimension_winners || {}).forEach(dims => Object.entries(dims).forEach(([dim, d]) => {
    if (dim === 'overall') return;
    total++;
    if (d.winner === 'A') aWins++; else if (d.winner === 'B') bWins++;
  }));
  const winner = aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'TIE';
  const lead = (a, b) => <span className={a >= b ? 'num-a' : 'num-b'}>{`Variant ${a >= b ? 'A' : 'B'} +${leadPct(a, b).toFixed(0)}%`}</span>;

  return (
    <section className="verdict" aria-labelledby="verdict-title">
      <div className="verdict-copy">
        <h2 id="verdict-title">{winner === 'TIE' ? 'The variants are evenly matched' : <><span className={winner === 'A' ? 'num-a' : 'num-b'}>Variant {winner}</span> drives stronger engagement</>}</h2>
        <p>Predicted whole-brain response across 200 simulated viewers.</p>
      </div>
      <dl className="stat-strip">
        <div>
          <dt>Mean activation, A</dt>
          <dd className="stat-value-a"><AnimatedCounter value={A_global_mean} decimals={3} animateOnView /></dd>
          <dd className="stat-note">B <span className="num-b">{B_global_mean.toFixed(3)}</span> · {lead(A_global_mean, B_global_mean)}</dd>
        </div>
        <div>
          <dt>Peak activation, A</dt>
          <dd className="stat-value-a"><AnimatedCounter value={A_peak_activation} decimals={3} animateOnView /></dd>
          <dd className="stat-note">B <span className="num-b">{B_peak_activation.toFixed(3)}</span> · {lead(A_peak_activation, B_peak_activation)}</dd>
        </div>
        <div>
          <dt>Contests won, A</dt>
          <dd className="stat-value-a"><AnimatedCounter value={aWins} suffix={`\u00a0of ${total}`} animateOnView /></dd>
          <dd className="stat-note">B won <span className="num-b">{bWins}</span>{total - aWins - bWins ? `, ${total - aWins - bWins} tied` : ''}</dd>
        </div>
      </dl>
    </section>
  );
};

export default ABSummaryPanel;
