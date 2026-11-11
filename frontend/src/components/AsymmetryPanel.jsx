import React, { useMemo } from 'react';
import { LineChart } from '@/components/arc/line-chart/line-chart';
import { Gauge } from '@/components/arc/gauge/gauge';
import { timeSeriesData, VARIANT_A, VARIANT_B } from '@/lib/chart-data';
import { Card } from './ui';

const SERIES = [
  { key: 'A', label: 'Variant A', color: VARIANT_A, area: true },
  { key: 'B', label: 'Variant B', color: VARIANT_B, dashed: true, area: false },
];

const THRESHOLDS = [
  { from: 0, tone: 'danger', label: 'Mostly avoidance' },
  { from: 40, tone: 'warning', label: 'Mixed' },
  { from: 60, tone: 'success', label: 'Mostly approach' },
];

const valence = (v) => `${v >= 0 ? 'Approach +' : 'Avoidance −'}${Math.abs(v).toFixed(4)}`;

/** Left vs right prefrontal balance: positive means approach (desire), negative means avoidance. */
export default function AsymmetryPanel({ dataA, dataB }) {
  const ready = dataA?.timestep_metrics && (!dataB || dataB.timestep_metrics);

  const { chartData, pctA, pctB } = useMemo(() => {
    if (!ready) return { chartData: [], pctA: 0, pctB: 0 };
    const yA = dataA.timestep_metrics.hemisphere_asymmetry || [];
    const yB = dataB?.timestep_metrics.hemisphere_asymmetry || [];
    const maxT = Math.max(yA.length, yB.length);
    const share = list => maxT ? Math.round((list.filter(v => v != null && v > 0).length / maxT) * 100) : 0;
    return { chartData: timeSeriesData(maxT, i => (dataB ? { A: yA[i], B: yB[i] } : { A: yA[i] })), pctA: share(yA), pctB: share(yB) };
  }, [ready, dataA, dataB]);

  if (!ready) return null;

  return (
    <Card
      title="Approach vs. avoidance"
      exportName="approach-vs-avoidance"
      description="Above zero the left prefrontal side leads (desire); below zero the right leads (resistance)."
    >
      <div className="split split-4-8">
        <div className="split-aside">
          <p className="block-label"><strong>Time in approach</strong></p>
          <div className="gauge-pair">
            <Gauge label={dataB ? 'Variant A' : 'Your creative'} value={pctA} thresholds={THRESHOLDS} />
            {dataB && <Gauge label="Variant B" value={pctB} thresholds={THRESHOLDS} />}
          </div>
        </div>
        <LineChart
          data={chartData}
          series={dataB ? SERIES : [{ ...SERIES[0], label: 'Your creative' }]}
          label="Prefrontal asymmetry over time"
          height={180}
          categoryLabel="Time"
          formatValue={valence}
          formatTick={v => v.toFixed(2)}
        />
      </div>
    </Card>
  );
}
