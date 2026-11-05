export const VARIANT_A = '#0066cc';
export const VARIANT_B = '#7a7a7a';

const ORIGIN = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

export function axisStride(length, maxTicks = 8) {
  return Math.max(1, Math.ceil(length / maxTicks));
}

export function lineSeriesFromArrays(rows, seriesKeys) {
  const stride = axisStride(rows.length);
  return rows.map((values, i) => ({
    key: `t-${i}`,
    label: `t = ${i}s`,
    axisLabel: i === 0 || i === rows.length - 1 || i % stride === 0 ? `${i}s` : undefined,
    values,
  }));
}

export function toBrushSeries(values) {
  return values.map((value, i) => ({
    date: ORIGIN + i * DAY,
    value: Number(value) || 0,
  }));
}

export function formatBrushTime(date) {
  const t = Math.round((date.getTime() - ORIGIN) / DAY);
  return `t = ${t}s`;
}

export function toHeatmapDays(values) {
  return values.map((value, i) => {
    const date = new Date(ORIGIN + i * DAY);
    const iso = date.toISOString().slice(0, 10);
    return { date: iso, count: Math.max(0, Number(value) || 0) };
  });
}

export const zFormat = (value) => Number(value).toFixed(3);
export const pctFormat = (value) => `${(Number(value) * 100).toFixed(1)}%`;
