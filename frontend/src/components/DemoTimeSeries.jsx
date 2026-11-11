import React, { useState, useMemo } from 'react';
import { LineChart } from '@/components/arc/line-chart/line-chart';
import { Streamgraph } from '@/components/arc/streamgraph/streamgraph';
import { timeSeriesData, z4Format, VARIANT_A, VARIANT_B, CHART_COLORS } from '@/lib/chart-data';
import { Card } from './ui';
import { VARIANT_OPTIONS } from '@/lib/chart-data';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Select } from '@/components/arc/select/select';
import { Accordion } from '@/components/arc/accordion/accordion';

const GROUPS = [
  { id: 'reward', label: 'Reward & Valence', desc: 'Orbitofrontal & striatal dopamine response' },
  { id: 'auditory', label: 'Audio Frequency', desc: 'Primary auditory and tonal processing' },
  { id: 'narrative', label: 'Story Arc', desc: 'Temporal pole and TPJ narrative comprehension' },
  { id: 'personal', label: 'Personal Relevance', desc: 'Medial prefrontal self-referential encoding' },
  { id: 'action', label: 'Action Priming', desc: 'Premotor and supplemental motor activation' },
  { id: 'memory', label: 'Memory Imprint', desc: 'Hippocampal episodic memory encoding' },
  { id: 'prefrontal', label: 'Executive Attention', desc: 'DLPFC focus and cognitive prioritization' }
];

const DemoTimeSeries = ({ dataA, dataB, labels = {}, transcriptA = [], transcriptB = [] }) => {
  const [activeGroup, setActiveGroup] = useState('auditory');
  const [activeDemographic, setActiveDemographic] = useState('kids');
  const [streamVariant, setStreamVariant] = useState('A');
  const [view, setView] = useState('network');
  const single = !dataB;

  // For the selected demographic + group, build A vs B comparison
  const seriesA = useMemo(() => dataA?.[activeDemographic]?.[activeGroup] || [], [dataA, activeDemographic, activeGroup]);
  const seriesB = useMemo(() => dataB?.[activeDemographic]?.[activeGroup] || [], [dataB, activeDemographic, activeGroup]);
  const maxLen = Math.max(seriesA.length, seriesB.length);

  const chartData = useMemo(
    () => timeSeriesData(maxLen, i => (single ? { A: seriesA[i] } : { A: seriesA[i], B: seriesB[i] })),
    [seriesA, seriesB, maxLen, single]
  );


  // Every network for the selected cohort and variant, stacked as one stream.
  const streamData = useMemo(() => {
    const source = (streamVariant === 'A' || !dataB ? dataA : dataB)?.[activeDemographic] || {};
    const length = Math.max(0, ...GROUPS.map(g => source[g.id]?.length || 0));
    const stride = Math.max(1, Math.ceil(length / 8));
    return Array.from({ length }, (_, i) => ({
      key: `t-${i}`,
      label: `t = ${i}s`,
      axisLabel: i === 0 || i === length - 1 || i % stride === 0 ? `${i}s` : undefined,
      values: Object.fromEntries(GROUPS.map(g => [g.id, Math.max(0, Number(source[g.id]?.[i]) || 0)])),
    }));
  }, [dataA, dataB, activeDemographic, streamVariant]);
  const streamSeries = useMemo(() => GROUPS.map((g, i) => ({ key: g.id, label: g.label, color: CHART_COLORS[i % CHART_COLORS.length] })), []);

  const demos = [
    { id: 'kids', label: 'Kids (6 to 12)' },
    { id: 'genz', label: 'Gen Z (13 to 24)' },
    { id: 'adults', label: 'Adults (25 to 54)' },
    { id: 'older', label: 'Older (55+)' },
  ];

  // Pearson correlation r between A and B
  const correlationR = useMemo(() => {
    let count = 0, sumA = 0, sumB = 0;
    for (let i = 0; i < maxLen; i++) {
      if (seriesA[i] != null && seriesB[i] != null) {
        sumA += seriesA[i];
        sumB += seriesB[i];
        count++;
      }
    }
    if (count < 2) return null;
    const meanA = sumA / count;
    const meanB = sumB / count;
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < maxLen; i++) {
      if (seriesA[i] != null && seriesB[i] != null) {
        const da = seriesA[i] - meanA;
        const db = seriesB[i] - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
    }
    const den = Math.sqrt(denA * denB);
    return den > 0 ? (num / den).toFixed(3) : null;
  }, [seriesA, seriesB, maxLen]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const transcript = (transcriptA.length > 0 ? transcriptA : transcriptB).filter(evt => evt && typeof evt.text === 'string');
  const groupLabel = GROUPS.find(g => g.id === activeGroup)?.label;
  const cohortLabel = labels[activeDemographic] || demos.find(d => d.id === activeDemographic)?.label;

  const views = [{ value: 'network', label: 'One network' }, { value: 'mix', label: 'All networks' }];

  return (
    <Card
      title="Response over time"
      exportName="response-over-time"
description={single ? 'The response second by second for one cohort.' : 'Compare the variants second by second for one cohort.'}
      actions={!single && correlationR !== null && <span className="card-meta">A and B correlation <span className="num-key">r = {correlationR}</span></span>}
    >
      <div className="split split-3-9">
        <div className="split-aside filters">
          <SegmentedControl label="Chart" options={views} value={view} onValueChange={setView} />
          <Select label="Cohort" options={demos.map(d => ({ value: d.id, label: d.label }))} value={activeDemographic} onValueChange={setActiveDemographic} />
          {view === 'network'
            ? <Select label="Brain network" options={GROUPS.map(g => ({ value: g.id, label: g.label }))} value={activeGroup} onValueChange={setActiveGroup} description={GROUPS.find(g => g.id === activeGroup)?.desc} />
            : !single && <SegmentedControl label="Variant" options={VARIANT_OPTIONS} value={streamVariant} onValueChange={setStreamVariant} />}
        </div>

        <div className="split-main">
          <p className="block-label">
            <span><strong>{view === 'network' ? groupLabel : single ? 'All networks' : `All networks, Variant ${streamVariant}`}</strong> · {cohortLabel}</span>
            <span>BOLD z-score</span>
          </p>
          {view === 'network' ? (
            <LineChart
              data={chartData}
              series={single ? [{ key: 'A', label: 'Response', color: VARIANT_A, area: true }] : [
                { key: 'A', label: 'Variant A', color: VARIANT_A, area: true },
                { key: 'B', label: 'Variant B', color: VARIANT_B, dashed: true, area: false },
              ]}
              label={single ? `${groupLabel} response` : `${groupLabel} response, Variant A vs B`}
              height={200}
              categoryLabel="Time"
              formatValue={z4Format}
              formatTick={v => v.toFixed(2)}
            />
          ) : (
            <Streamgraph
              data={streamData}
              series={streamSeries}
              label={single ? 'Network activation mix' : `Network activation mix, Variant ${streamVariant}`}
              unit="z"
              height={200}
              categoryLabel="Time"
              formatValue={v => v.toFixed(3)}
            />
          )}
        </div>
      </div>

      {transcript.length > 0 && (
        <div className="block">
          <Accordion
            defaultOpen={-1}
            items={[{
              title: `Script events (${transcript.length} lines)`,
              content: (
                <ol className="event-list">
                  {transcript.map((evt, i) => (
                    <li key={i}>
                      <time>{formatTime(evt.start)}</time>
                      <span>{evt.text}</span>
                    </li>
                  ))}
                </ol>
              ),
            }]}
          />
        </div>
      )}
    </Card>
  );
};

export default DemoTimeSeries;
