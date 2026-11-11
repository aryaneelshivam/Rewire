import React from 'react';
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter';
import { leadPct } from '@/lib/chart-data';

/** The verdict in words on the left, the three deciding numbers in one divided strip on the right. */
const COHORT_NAMES = { kids: 'kids (6 to 12)', genz: 'Gen Z (13 to 24)', adults: 'adults (25 to 54)', older: 'older viewers (55+)' };
const DIMENSION_NAMES = { visual: 'visual', auditory: 'auditory', reward: 'reward', memory: 'memory', attention: 'attention', narrative: 'narrative', personal: 'self-relevance', action: 'action' };

/** One creative: where it lands hardest, and its three headline numbers. */
function SingleSummary({ data }) {
  const best = data.best_demographic;
  const dims = Object.entries(data.scores[best] || {}).filter(([k]) => k !== 'overall').sort((a, b) => b[1] - a[1]);
  const [topDim, topScore] = dims[0] ?? ['', 0];
  return (
    <section className="verdict" aria-labelledby="verdict-title">
      <div className="verdict-copy">
        <h2 id="verdict-title">Strongest with <span className="num-a">{COHORT_NAMES[best] ?? best}</span></h2>
        <p>Predicted whole-brain response across 200 simulated viewers. It leads on {DIMENSION_NAMES[topDim] ?? topDim} for that cohort.</p>
      </div>
      <dl className="stat-strip">
        <div>
          <dt>Mean activation</dt>
          <dd className="stat-value-a"><AnimatedCounter value={data.global_mean} decimals={3} animateOnView /></dd>
          <dd className="stat-note">Across every second and vertex</dd>
        </div>
        <div>
          <dt>Peak activation</dt>
          <dd className="stat-value-a"><AnimatedCounter value={data.peak_activation} decimals={3} animateOnView /></dd>
          <dd className="stat-note">Highest single response</dd>
        </div>
        <div>
          <dt>Top dimension score</dt>
          <dd className="stat-value-a"><AnimatedCounter value={topScore} decimals={3} animateOnView /></dd>
          <dd className="stat-note">{DIMENSION_NAMES[topDim] ?? topDim}, {COHORT_NAMES[best] ?? best}</dd>
        </div>
      </dl>
    </section>
  );
}

const ABSummaryPanel = ({ data }) => {
  if (!data) return null;
  if (data.mode === 'single') return <SingleSummary data={data} />;
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
