import React from 'react';
import { WaffleChart } from '@/components/arc/waffle-chart/waffle-chart';
import { Card, BarRow, LeadPill } from './ui';

const DIMENSIONS = {
  overall: 'Overall', visual: 'Visual', auditory: 'Auditory', reward: 'Reward', memory: 'Memory',
  attention: 'Attention', narrative: 'Narrative', personal: 'Self-relevance', action: 'Action',
};

function tallyOf(winners) {
  let a = 0, b = 0, tie = 0;
  Object.values(winners || {}).forEach(dims => Object.entries(dims).forEach(([dim, cell]) => {
    if (dim === 'overall') return;
    if (cell.winner === 'A') a++; else if (cell.winner === 'B') b++; else tie++;
  }));
  return { a, b, tie };
}

/** Share of cohort × dimension contests each variant takes, as a compact waffle. */
export function ContestsPanel({ data }) {
  if (!data?.dimension_winners) return null;
  const { a, b, tie } = tallyOf(data.dimension_winners);
  const tally = [
    { key: 'A', label: 'Variant A leads', value: a, color: 'var(--chart-a)' },
    { key: 'B', label: 'Variant B leads', value: b, color: 'var(--chart-b)' },
    ...(tie ? [{ key: 'tie', label: 'Too close to call', value: tie, color: 'var(--chart-tie)' }] : []),
  ];
  return (
    <Card title="Contests won" exportName="contests-won" description={`${a + b + tie} cohort and dimension pairs.`} className="fill">
      <WaffleChart data={tally} label="Share of cohort and dimension contests won by each variant" unit="contests" accentKey="A" />
    </Card>
  );
}

/** Which variant leads each cognitive dimension, averaged over the four cohorts. */
const DimensionalLeadPanel = ({ data }) => {
  if (data?.mode === 'single') return <SingleDimensions data={data} />;
  const winners = data?.dimension_winners;
  if (!winners) return null;
  const demos = Object.keys(winners);

  const rows = Object.keys(DIMENSIONS).flatMap(dim => {
    const cells = demos.map(d => winners[d]?.[dim]).filter(Boolean);
    if (!cells.length) return [];
    return [{ dim, avgA: cells.reduce((s, c) => s + c.A, 0) / cells.length, avgB: cells.reduce((s, c) => s + c.B, 0) / cells.length }];
  });

  return (
    <Card title="Lead by dimension" exportName="lead-by-dimension" description="Average score across the four cohorts.">
      <div className="lead-list">
        {rows.map(r => (
          <div key={r.dim} className={`lead-row ${r.dim === 'overall' ? 'overall' : ''}`}>
            <span className="name">{DIMENSIONS[r.dim]}</span>
            <div className="bars">
              <BarRow variant="A" value={r.avgA} max={Math.max(r.avgA, r.avgB)} />
              <BarRow variant="B" value={r.avgB} max={Math.max(r.avgA, r.avgB)} />
            </div>
            <span className="verdict"><LeadPill a={r.avgA} b={r.avgB} /></span>
          </div>
        ))}
      </div>
    </Card>
  );
};

/** One creative: each dimension's score averaged over the four cohorts. */
function SingleDimensions({ data }) {
  const cohorts = Object.keys(data.scores || {});
  const rows = Object.keys(DIMENSIONS).flatMap(dim => {
    const vals = cohorts.map(c => data.scores[c]?.[dim]).filter(v => v != null);
    return vals.length ? [{ dim, avg: vals.reduce((s, v) => s + v, 0) / vals.length }] : [];
  });
  const max = Math.max(...rows.map(r => r.avg), 1e-6);
  return (
    <Card title="Score by dimension" exportName="score-by-dimension" description="Average score across the four cohorts.">
      <div className="lead-list">
        {rows.map(r => (
          <div key={r.dim} className={`lead-row single ${r.dim === 'overall' ? 'overall' : ''}`}>
            <span className="name">{DIMENSIONS[r.dim]}</span>
            <div className="bars"><BarRow variant="A" value={r.avg} max={max} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default DimensionalLeadPanel;
