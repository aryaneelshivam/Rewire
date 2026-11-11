import React, { useMemo } from 'react';
import { LineChart } from '@/components/arc/line-chart/line-chart';
import { Gauge } from '@/components/arc/gauge/gauge';
import { timeSeriesData, VARIANT_A, VARIANT_B } from '@/lib/chart-data';
import { Card } from './ui';

const SERIES = [
  { key: 'A', label: 'Variant A', color: VARIANT_A, area: true },
  { key: 'B', label: 'Variant B', color: VARIANT_B, dashed: true, area: false },
];

// One tone for every band: which side leads is described, not judged as good or bad.
const THRESHOLDS = [
  { from: 0, tone: 'accent', label: 'Leans right' },
  { from: 40, tone: 'accent', label: 'Balanced' },
  { from: 60, tone: 'accent', label: 'Leans left' },
];

// The response takes about two seconds to build at the start of every video; those seconds are left out of the
// share, so a short video is not marked down for them.
const BUILD_UP_S = 2;

const side = v => `${v >= 0 ? 'Left' : 'Right'} +${Math.abs(v).toFixed(4)}`;

/** Per variant: the series, and the share of its own seconds (after the build-up) where the left side leads. */
function summarise(metrics) {
  const y = metrics.prefrontal_asymmetry ?? metrics.hemisphere_asymmetry ?? [];
  const counted = y.slice(BUILD_UP_S).filter(v => v != null);
  const left = counted.filter(v => v > 0).length;
  const mean = counted.length ? counted.reduce((s, v) => s + v, 0) / counted.length : 0;
  return { y, share: counted.length ? Math.round((left / counted.length) * 100) : 0, seconds: counted.length, mean };
}

/**
 * Left–right balance of the prefrontal response (dorsolateral cortex and frontal pole). In EEG research a left lean
 * is linked to approach motivation and a right lean to withdrawal; that link has not been established for this kind
 * of predicted response, so the panel reports the balance and only mentions the interpretation.
 */
export default function AsymmetryPanel({ dataA, dataB }) {
  const ready = dataA?.timestep_metrics && (!dataB || dataB.timestep_metrics);

  const { chartData, a, b } = useMemo(() => {
    if (!ready) return { chartData: [], a: null, b: null };
    const a = summarise(dataA.timestep_metrics);
    const b = dataB ? summarise(dataB.timestep_metrics) : null;
    const maxT = Math.max(a.y.length, b?.y.length ?? 0);
    return { chartData: timeSeriesData(maxT, i => (b ? { A: a.y[i], B: b.y[i] } : { A: a.y[i] })), a, b };
  }, [ready, dataA, dataB]);

  if (!ready) return null;

  return (
    <Card
      title="Prefrontal balance"
      exportName="prefrontal-balance"
      description="Left minus right response in the prefrontal cortex. In EEG research a left lean is linked to approach and a right lean to withdrawal; read it as a hint, not a verdict."
    >
      <div className="split split-4-8">
        <div className="split-aside">
          <p className="block-label"><strong>Time leaning left</strong><span>after the first {BUILD_UP_S}s</span></p>
          <div className="gauge-pair">
            <Gauge label={b ? 'Variant A' : 'Your creative'} value={a.share} detail={`${a.seconds}s, average ${side(a.mean)}`} thresholds={THRESHOLDS} />
            {b && <Gauge label="Variant B" value={b.share} detail={`${b.seconds}s, average ${side(b.mean)}`} thresholds={THRESHOLDS} />}
          </div>
        </div>
        <LineChart
          data={chartData}
          series={b ? SERIES : [{ ...SERIES[0], label: 'Your creative' }]}
          label="Prefrontal left–right balance over time"
          height={180}
          categoryLabel="Time"
          formatValue={side}
          formatTick={v => v.toFixed(2)}
        />
      </div>
    </Card>
  );
}
