import React, { useMemo, useRef } from 'react';
import { LineChart } from '@/components/arc/line-chart/line-chart';
import { timeSeriesData, zFormat, VARIANT_A, VARIANT_B } from '@/lib/chart-data';
import { Card } from './ui';

const SERIES = [
  { key: 'maxA', label: 'A · peak', color: VARIANT_A, area: true },
  { key: 'meanA', label: 'A · mean', color: VARIANT_A, dashed: true, area: false },
  { key: 'maxB', label: 'B · peak', color: VARIANT_B, area: true },
  { key: 'meanB', label: 'B · mean', color: VARIANT_B, dashed: true, area: false },
];

/** Whole-brain activation over time for both variants. Clicking a point moves the playhead there. */
const OverviewPanel = ({ dataA, dataB, onSeekToTimestamp }) => {
  const activeIndex = useRef(null);
  const ready = dataA?.timestep_metrics && dataB?.timestep_metrics;

  const { chartData, aucA, aucB } = useMemo(() => {
    if (!ready) return { chartData: [], aucA: 0, aucB: 0 };
    const mA = dataA.timestep_metrics, mB = dataB.timestep_metrics;
    const maxT = Math.max(mA.timestep.length, mB.timestep.length);
    const sum = list => list.reduce((s, v) => s + (v ?? 0), 0);
    return {
      chartData: timeSeriesData(maxT, i => ({ maxA: mA.global_max[i], meanA: mA.global_mean[i], maxB: mB.global_max[i], meanB: mB.global_mean[i] })),
      aucA: sum(mA.global_mean),
      aucB: sum(mB.global_mean),
    };
  }, [ready, dataA, dataB]);

  if (!ready) return null;

  return (
    <Card
      title="Whole-brain response"
      exportName="whole-brain-response"
      description="Peak z-score per second. Turn on the means in the legend; click to move the playhead."
      actions={<span className="card-meta">Total A <span className="num-a">{aucA.toFixed(1)}</span>, B <span className="num-b">{aucB.toFixed(1)}</span></span>}
      className="fill"
    >
      <div className="chart-click" onClick={() => { if (activeIndex.current != null) onSeekToTimestamp?.(activeIndex.current); }}>
        <LineChart
          data={chartData}
          series={SERIES}
          label="Whole-brain activation, Variant A vs Variant B"
          unit="z"
          height={200}
          defaultHiddenSeries={['meanA', 'meanB']}
          categoryLabel="Time"
          formatValue={zFormat}
          formatTick={v => v.toFixed(1)}
          onActiveChange={index => { activeIndex.current = index; }}
        />
      </div>
    </Card>
  );
};

export default OverviewPanel;
