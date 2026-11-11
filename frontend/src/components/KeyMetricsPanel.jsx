import React from 'react';
import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table';
import { Card } from './ui';

const mean = (list = []) => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

/** The headline numbers in Arc's data table: side by side when comparing, one column for a single creative. */
const KeyMetricsPanel = ({ overview, engagement, demographics }) => {
  const variants = Object.keys(overview);
  const single = variants.length === 1;
  const s = variants.reduce((acc, v) => {
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
  const row = (id, metric, key, fmt, compare = true) => {
    const a = s.A[key], b = s.B?.[key];
    return { id, metric, a, b, fmt, win: compare && !single ? (a > b ? 'A' : b > a ? 'B' : null) : null };
  };
  const rows = [
    row('peak', 'Peak z', 'peak', v => v.toFixed(3)),
    row('mean', 'Mean z', 'mean', v => v.toFixed(3)),
    row('active', 'Active at peak', 'active', pct),
    row('peakAt', 'Peak moment', 'peakAt', v => `${v}s`, false),
    row('audience', 'Top audience', 'audience', v => v, false),
  ];
  // Each column wears its variant's colour; the higher value of a pair is set heavier and named for screen readers.
  const cell = side => (value, r) => (
    <span className={`num-${side.toLowerCase()} ${r.win === side ? 'won' : 'lost'}`}>{r.fmt(value)}{r.win === side && <span className="sr-only"> (higher)</span>}</span>
  );
  const columns = [
    { key: 'metric', label: 'Metric', sortable: false },
    { key: 'a', label: single ? 'Value' : 'Variant A', sortable: false, numeric: true, render: cell('A') },
    ...(single ? [] : [{ key: 'b', label: 'Variant B', sortable: false, numeric: true, render: cell('B') }]),
  ];

  return (
    <Card title="Key numbers" exportName="key-numbers" className="fill">
      <div className="flat-table">
        <SortableDataTable rows={rows} columns={columns} rowKey="id" caption={single ? 'Key numbers for this creative' : 'Key numbers for Variant A and Variant B. The higher value is marked.'} itemName={{ one: 'metric', other: 'metrics' }} />
      </div>
    </Card>
  );
};

export default KeyMetricsPanel;
