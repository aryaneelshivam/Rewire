import React from 'react';
import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table';
import { Card } from './ui';

const mean = (list = []) => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

/** The headline numbers side by side in Arc's data table. */
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
  // Raw values stay in the row so the columns sort as numbers; the cells render them formatted and coloured.
  const row = (id, metric, a, b, fmt, compare = true) => ({ id, metric, a, b, fmt, win: compare ? (a > b ? 'A' : b > a ? 'B' : null) : null });
  const rows = [
    row('peak', 'Peak z', s.A.peak, s.B.peak, v => v.toFixed(3)),
    row('mean', 'Mean z', s.A.mean, s.B.mean, v => v.toFixed(3)),
    row('active', 'Active at peak', s.A.active, s.B.active, pct),
    row('peakAt', 'Peak moment', s.A.peakAt, s.B.peakAt, v => `${v}s`, false),
    row('audience', 'Top audience', s.A.audience, s.B.audience, v => v, false),
  ];
  // Each column wears its variant's colour; the higher value of a pair is set heavier and named for screen readers.
  const cell = side => (value, r) => (
    <span className={`num-${side.toLowerCase()} ${r.win === side ? 'won' : 'lost'}`}>{r.fmt(value)}{r.win === side && <span className="sr-only"> (higher)</span>}</span>
  );
  const columns = [
    { key: 'metric', label: 'Metric', sortable: false },
    { key: 'a', label: 'Variant A', sortable: false, numeric: true, render: cell('A') },
    { key: 'b', label: 'Variant B', sortable: false, numeric: true, render: cell('B') },
  ];

  return (
    <Card title="Key numbers" exportName="key-numbers" className="fill">
      <div className="flat-table">
        <SortableDataTable rows={rows} columns={columns} rowKey="id" caption="Key numbers for Variant A and Variant B. The higher value is marked." itemName={{ one: 'metric', other: 'metrics' }} />
      </div>
    </Card>
  );
};

export default KeyMetricsPanel;
