export const VARIANT_A = 'var(--chart-a)';
export const VARIANT_B = 'var(--chart-b)';
/** Categorical chart colours, in order. */
export const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7].map(i => `var(--chart-${i})`);

export function axisStride(length, maxTicks = 8) {
  return Math.max(1, Math.ceil(length / maxTicks));
}

/**
 * Turns per-timestep rows ({ seriesKey: value }) into LineChart data, one point per second.
 * Missing values are carried forward so a shorter variant doesn't plunge to zero.
 */
export function timeSeriesData(length, valuesAt) {
  const stride = axisStride(length);
  const last = {};
  return Array.from({ length }, (_, i) => {
    const raw = valuesAt(i);
    const values = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value == null || Number.isNaN(value)) values[key] = last[key] ?? 0;
      else { values[key] = Number(value); last[key] = values[key]; }
    }
    return {
      key: `t-${i}`,
      label: `t = ${i}s`,
      axisLabel: i === 0 || i === length - 1 || i % stride === 0 ? `${i}s` : undefined,
      values,
    };
  });
}

export const zFormat = (value) => Number(value).toFixed(3);
export const z4Format = (value) => Number(value).toFixed(4);
export const pctFormat = (value) => `${(Number(value) * 100).toFixed(1)}%`;
export const signedZ = (change) => `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(3)}`;

/** Relative lead of the larger value over the smaller one, as a percentage. */
export function leadPct(a, b) {
  const lo = Math.min(a, b);
  return lo > 0 ? (Math.abs(a - b) / lo) * 100 : 0;
}

export const VARIANT_OPTIONS = [{ value: 'A', label: 'Variant A' }, { value: 'B', label: 'Variant B' }];
