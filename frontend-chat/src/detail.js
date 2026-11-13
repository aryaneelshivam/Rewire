/**
 * Second-by-second detail for the results view and the richer answers, from the API's per-second series
 * (/timeseries: each audience's response per driver, per second). Worded for creators: drivers and audiences,
 * never the systems underneath.
 */
import { COHORT_LABELS } from './insights';

export const COHORTS = ['kids', 'genz', 'adults', 'older'];
// The per-second drivers the API reports, in creator words.
export const MIX = {
  reward: 'Payoff', auditory: 'Sound', prefrontal: 'Focus', memory: 'Memorability',
  narrative: 'Story', personal: 'Relatability', action: 'Urge to act',
};
export const MIX_KEYS = Object.keys(MIX);

const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = xs => { const m = avg(xs); return Math.sqrt(avg(xs.map(x => (x - m) ** 2))) || 1; };

/** One video's per-second detail: drivers (averaged over audiences), audiences (averaged over drivers), and which
 * driver is rising most each second, measured against its own usual level so no driver wins by default. */
export function detailFor(series) {
  const ts = series?.timeseries;
  if (!ts) return null;
  const cohorts = COHORTS.filter(c => ts[c]);
  const n = Math.max(...cohorts.flatMap(c => MIX_KEYS.map(d => ts[c][d]?.length ?? 0)));
  const mix = Object.fromEntries(MIX_KEYS.map(d => [d, Array.from({ length: n }, (_, t) => avg(cohorts.map(c => ts[c][d]?.[t] ?? 0)))]));
  const audiences = Object.fromEntries(cohorts.map(c => [c, Array.from({ length: n }, (_, t) => avg(MIX_KEYS.map(d => ts[c][d]?.[t] ?? 0)))]));
  const z = Object.fromEntries(MIX_KEYS.map(d => { const m = avg(mix[d]); const s = sd(mix[d]); return [d, mix[d].map(v => (v - m) / s)]; }));
  const rising = Array.from({ length: n }, (_, t) => MIX_KEYS.reduce((best, d) => (z[d][t] > z[best][t] ? d : best), MIX_KEYS[0]));
  return { n, mix, audiences, rising, z, cohorts };
}

/** Runs of the same value, for drawing lanes as segments: [{ value, from, to }] with `to` exclusive. */
export function runs(values) {
  const out = [];
  values.forEach((v, t) => {
    const last = out.at(-1);
    if (last && last.value === v) last.to = t + 1;
    else out.push({ value: v, from: t, to: t + 1 });
  });
  return out;
}

/** Where `t` sits among a series' values, 0 to 100 (100: the strongest second). */
export function percentileAt(values, t) {
  if (!values?.length) return 0;
  const v = values[Math.max(0, Math.min(values.length - 1, Math.round(t)))];
  return Math.round(values.filter(x => x <= v).length / values.length * 100);
}

export const cohortLabel = c => COHORT_LABELS[c] ?? c;
