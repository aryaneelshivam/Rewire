import React from 'react';
import { Card } from './ui';

const mean = (list = []) => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

/** A narrow side table: the higher value in each row is set in the accent and named for screen readers. */
const KeyMetricsPanel = ({ overview, engagement, demographics }) => {
  const s = ['A', 'B'].reduce((acc, v) => {
    const o = overview[v], m = o.timestep_metrics;
    acc[v] = {
      peak: m.global_max[o.peak_timestep] ?? 0,
      peakAt: o.peak_timestep ?? 0,
      mean: mean(m.global_mean),
      active: m.active_fraction[o.peak_timestep] ?? 0,
      audience: demographics?.[v]?.labels?.[engagement?.[v]?.best_demographic] ?? 'Not available',
    };
    return acc;
  }, {});

  const pct = v => `${(v * 100).toFixed(1)}%`;
  const row = (id, metric, a, b, fmt, compare = true) => ({ id, metric, a: fmt(a), b: fmt(b), win: compare ? (a > b ? 'a' : b > a ? 'b' : null) : null });
  const rows = [
    row('peak', 'Peak z', s.A.peak, s.B.peak, v => v.toFixed(3)),
    row('mean', 'Mean z', s.A.mean, s.B.mean, v => v.toFixed(3)),
    row('active', 'Active at peak', s.A.active, s.B.active, pct),
    row('peakAt', 'Peak moment', s.A.peakAt, s.B.peakAt, v => `${v}s`, false),
    row('audience', 'Top audience', s.A.audience, s.B.audience, v => v, false),
  ];
  // Each column wears its variant's colour; the higher value of a pair is set heavier and named for screen readers.
  const cell = (value, won, side) => (
    <td className={`num num-${side} ${won ? 'won' : 'lost'}`}>{value}{won && <span className="sr-only"> (higher)</span>}</td>
  );

  return (
    <Card title="Key numbers" className="fill">
      <table className="readout-table">
        <caption className="sr-only">Key numbers for Variant A and Variant B. The higher value is marked.</caption>
        <thead>
          <tr><th scope="col">Metric</th><th scope="col">A</th><th scope="col">B</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <th scope="row">{r.metric}</th>
              {cell(r.a, r.win === 'a', 'a')}
              {cell(r.b, r.win === 'b', 'b')}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

export default KeyMetricsPanel;
