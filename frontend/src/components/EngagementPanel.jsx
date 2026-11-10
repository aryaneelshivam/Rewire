import React, { useState } from 'react';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { SlopeChart } from '@/components/arc/slope-chart/slope-chart';
import { signedZ } from '@/lib/chart-data';
import { Card } from './ui';
import { leadPct } from '@/lib/chart-data';

const COHORTS = [
  { id: 'kids', short: 'Kids', label: 'Kids (6 to 12)', note: 'Sensory & action primed' },
  { id: 'genz', short: 'Gen Z', label: 'Gen Z (13 to 24)', note: 'Social-emotional selective' },
  { id: 'adults', short: 'Adults', label: 'Adults (25 to 54)', note: 'Executive & reward balanced' },
  { id: 'older', short: 'Older', label: 'Older (55+)', note: 'Narrative & memory sustained' },
];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** Per-cohort engagement for each cognitive dimension, read as a slope from A to B. */
const EngagementPanel = ({ dataA, dataB }) => {
  const [cohortId, setCohortId] = useState('kids');
  if (!dataA?.scores || !dataB?.scores) return null;
  const dims = dataA.dimensions.filter(d => d !== 'overall');

  const cohorts = COHORTS.map(c => {
    const a = dataA.scores[c.id]?.overall || 0;
    const b = dataB.scores[c.id]?.overall || 0;
    const winner = a - b > 0.001 ? 'A' : b - a > 0.001 ? 'B' : 'TIE';
    const data = dims.map(dim => ({ key: dim, label: cap(dim), start: dataA.scores[c.id]?.[dim] || 0, end: dataB.scores[c.id]?.[dim] || 0 }));
    const swing = data.reduce((best, item) => !best || Math.abs(item.end - item.start) > Math.abs(best.end - best.start) ? item : best, null);
    return { ...c, a, b, winner, data, swing };
  });

  const current = cohorts.find(c => c.id === cohortId) ?? cohorts[0];
  const leadText = c => c.winner === 'TIE' ? 'tied' : `${c.winner} +${leadPct(c.a, c.b).toFixed(0)}%`;

  return (
    <Card
      title="Who responds to which variant"
      exportName="engagement-by-cohort"
      description="Lines run from Variant A (left) to B (right). Falling lines favour A. The highlighted line is the biggest swing."
      className="fill"
    >
      <SegmentedControl
        label="Cohort"
        className="seg-wrap"
        value={current.id}
        onValueChange={setCohortId}
        options={cohorts.map(c => ({ value: c.id, label: c.short, accessory: <span className={`seg-note ${c.winner === 'B' ? 'num-b' : c.winner === 'A' ? 'num-a' : ''}`}>{leadText(c)}</span> }))}
      />
      <p className="cohort-caption">{current.label}: {current.note.toLowerCase()}. Overall <span className={current.winner === 'B' ? 'num-b' : 'num-a'}>{leadText(current)}</span>.</p>
      {/* The highlighted swing takes the colour of the variant it favours. */}
      <div style={{ '--series-1': current.swing && current.swing.end > current.swing.start ? 'var(--chart-b)' : 'var(--chart-a)' }}>
      <SlopeChart
        data={current.data}
        label={`${current.label} engagement by cognitive dimension`}
        startLabel="Variant A"
        endLabel="Variant B"
        highlightKey={current.swing?.key ?? null}
        height={250}
        formatValue={v => v.toFixed(3)}
        formatChange={change => `B ${signedZ(change)} vs A`}
      />
      </div>
    </Card>
  );
};

export default EngagementPanel;
