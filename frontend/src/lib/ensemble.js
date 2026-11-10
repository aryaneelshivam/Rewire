// Similarity, clustering and layout for the ensemble of simulated viewers. Everything is small
// (200 profiles, at most a few hundred features), so it runs in the browser and recomputes instantly.

/** Deterministic random numbers, so the same data always gives the same clusters and layout. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = xs => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
const sd = (xs, m = mean(xs)) => Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, xs.length - 1));

/** Columns rescaled to mean 0 and spread 1; flat columns are dropped. */
export function standardize(rows) {
  if (!rows.length) return [];
  const d = rows[0].length;
  const keep = [];
  const stats = [];
  for (let j = 0; j < d; j++) {
    const col = rows.map(r => r[j]);
    const m = mean(col), s = sd(col, m);
    if (s > 1e-9) { keep.push(j); stats.push([m, s]); }
  }
  return rows.map(r => keep.map((j, k) => (r[j] - stats[k][0]) / stats[k][1]));
}

/** The first k principal components of already-centred rows, by power iteration on the covariance. */
export function pca(rows, k = 3, seed = 7) {
  const n = rows.length, d = rows[0]?.length ?? 0;
  if (!n || !d) return rows.map(() => Array(k).fill(0));
  const cov = Array.from({ length: d }, () => new Float64Array(d));
  for (const r of rows) for (let i = 0; i < d; i++) { const ri = r[i]; if (!ri) continue; const ci = cov[i]; for (let j = 0; j < d; j++) ci[j] += ri * r[j]; }
  const rand = mulberry32(seed);
  const comps = [];
  for (let c = 0; c < Math.min(k, d); c++) {
    let v = Array.from({ length: d }, () => rand() - 0.5);
    for (let it = 0; it < 60; it++) {
      const w = new Float64Array(d);
      for (let i = 0; i < d; i++) { let s = 0; const ci = cov[i]; for (let j = 0; j < d; j++) s += ci[j] * v[j]; w[i] = s; }
      for (const p of comps) { const dot = p.reduce((s, x, i) => s + x * w[i], 0); for (let i = 0; i < d; i++) w[i] -= dot * p[i]; }
      const norm = Math.hypot(...w) || 1;
      v = Array.from(w, x => x / norm);
    }
    comps.push(v);
  }
  return rows.map(r => Array.from({ length: k }, (_, c) => (comps[c] ? comps[c].reduce((s, x, i) => s + x * r[i], 0) : 0)));
}

const dist2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s; };

/** k-means with k-means++ seeding, best of several restarts. Returns a cluster index per row. */
export function kmeans(rows, k, seed = 11, restarts = 6) {
  const rand = mulberry32(seed);
  let best = null;
  for (let r = 0; r < restarts; r++) {
    const centres = [rows[Math.floor(rand() * rows.length)]];
    while (centres.length < k) {
      const d = rows.map(p => Math.min(...centres.map(c => dist2(p, c))));
      let pick = rand() * d.reduce((s, v) => s + v, 0);
      let i = 0;
      while (i < d.length - 1 && (pick -= d[i]) > 0) i++;
      centres.push(rows[i]);
    }
    let labels = new Array(rows.length).fill(0);
    for (let it = 0; it < 50; it++) {
      const next = rows.map(p => { let bi = 0, bd = Infinity; centres.forEach((c, ci) => { const dd = dist2(p, c); if (dd < bd) { bd = dd; bi = ci; } }); return bi; });
      const moved = next.some((l, i) => l !== labels[i]);
      labels = next;
      for (let c = 0; c < k; c++) {
        const members = rows.filter((_, i) => labels[i] === c);
        if (members.length) centres[c] = members[0].map((_, j) => mean(members.map(m => m[j])));
      }
      if (!moved && it) break;
    }
    const inertia = rows.reduce((s, p, i) => s + dist2(p, centres[labels[i]]), 0);
    if (!best || inertia < best.inertia) best = { labels, inertia };
  }
  return best.labels;
}

/** Mean silhouette: how much closer each row sits to its own cluster than to the next nearest. */
export function silhouette(rows, labels) {
  const k = Math.max(...labels) + 1;
  const scores = rows.map((p, i) => {
    const sums = new Array(k).fill(0), counts = new Array(k).fill(0);
    rows.forEach((q, j) => { if (i !== j) { sums[labels[j]] += Math.sqrt(dist2(p, q)); counts[labels[j]]++; } });
    const own = labels[i];
    if (!counts[own]) return 0;
    const a = sums[own] / counts[own];
    const b = Math.min(...sums.map((s, c) => (c === own || !counts[c] ? Infinity : s / counts[c])));
    return b === Infinity ? 0 : (b - a) / Math.max(a, b);
  });
  return mean(scores);
}

/** Clusters the rows into fixedK groups, or picks the number (2 to 6) with the best silhouette. */
export function clusterRows(rows, fixedK = null) {
  let best = { k: 1, labels: rows.map(() => 0), score: -Infinity };
  for (let k = fixedK ?? 2; k <= (fixedK ?? 6); k++) {
    const labels = kmeans(rows, k);
    const sizes = new Array(k).fill(0); labels.forEach(l => sizes[l]++);
    if (!fixedK && Math.min(...sizes) < 3) continue;   // a cluster of one or two viewers is noise, not a group
    const score = silhouette(rows, labels);
    if (score > best.score) best = { k, labels, score };
  }
  // Number clusters by size, largest first, so "Cluster 1" is always the biggest group.
  const sizes = new Array(best.k).fill(0); best.labels.forEach(l => sizes[l]++);
  const order = sizes.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  const rank = new Map(order.map((old, i) => [old, i]));
  return { k: best.k, labels: best.labels.map(l => rank.get(l)), score: best.score };
}

/** Each row joined to its nearest neighbours: the graph's edges, without duplicates. */
export function nearestEdges(rows, k = 4) {
  const seen = new Set();
  const edges = [];
  rows.forEach((p, i) => {
    rows.map((q, j) => [j, i === j ? Infinity : dist2(p, q)]).sort((a, b) => a[1] - b[1]).slice(0, k).forEach(([j]) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) { seen.add(key); edges.push([Math.min(i, j), Math.max(i, j)]); }
    });
  });
  return edges;
}

export const BASES = [
  { value: 'trajectory', label: 'Response over time' },
  { value: 'regions', label: 'Regional pattern' },
  { value: 'segment', label: 'A segment of the creative' },
  { value: 'dimensions', label: 'Analytical dimensions' },
];

const DIMENSION_KEYS = data => Object.keys(data.dimensions).filter(k => k !== 'overall');

/** The feature rows profiles are compared on, for each basis of similarity. */
export function featureRows(data, basis, segment) {
  const n = data.n_profiles;
  const rows = [];
  for (let i = 0; i < n; i++) {
    if (basis === 'regions') rows.push(data.regions[i]);
    else if (basis === 'dimensions') rows.push(DIMENSION_KEYS(data).map(k => data.dimensions[k][i]));
    else if (basis === 'segment') {
      const [s, e] = segment;
      const take = series => series.slice(s, Math.max(s + 1, e + 1));
      rows.push([...take(data.trajectory[i]), ...Object.values(data.networks).flatMap(net => take(net[i]))]);
    } else rows.push(data.trajectory[i]);
  }
  return rows;
}

/** Rescales projected points so the cloud fills a sphere of the given radius. */
function fit(points, radius = 9) {
  const dims = points[0]?.length ?? 0;
  const out = points.map(p => [...p]);
  for (let j = 0; j < dims; j++) {
    const col = out.map(p => p[j]);
    const m = mean(col), s = sd(col, m) || 1;
    out.forEach(p => { p[j] = ((p[j] - m) / s) * (radius / 2.4); });
  }
  return out;
}

const argmax = xs => xs.reduce((bi, v, i) => (v > xs[bi] ? i : bi), 0);

/**
 * Node positions for each view.
 * Similarity: the three main axes of variation in the chosen basis.
 * Temporal: across, when each viewer peaks; up, how strongly they respond overall; depth, the shape of their curve.
 * Regional: up, response in the chosen region; across and depth, the two main axes of the regional pattern.
 */
export function layoutFor(view, data, reduced, { region = 0 } = {}) {
  const n = data.n_profiles;
  if (view === 'temporal') {
    const T = data.n_timesteps;
    const shape = pca(standardize(data.trajectory.map(r => { const m = mean(r), s = sd(r, m) || 1; return r.map(v => (v - m) / s); })), 1);
    const level = data.trajectory.map(mean);
    const lm = mean(level), ls = sd(level, lm) || 1;
    const depth = fit(shape, 9);
    return data.trajectory.map((r, i) => [((argmax(r) / Math.max(1, T - 1)) - 0.5) * 20, ((level[i] - lm) / ls) * 3.2, depth[i][0]]);
  }
  if (view === 'regional') {
    const flat = pca(standardize(data.regions), 2);
    const plane = fit(flat, 9);
    const col = data.regions.map(r => r[region]);
    const m = mean(col), s = sd(col, m) || 1;
    return Array.from({ length: n }, (_, i) => [plane[i][0], ((col[i] - m) / s) * 3.2, plane[i][1]]);
  }
  return fit(reduced.map(r => [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0]), 9);
}

/** Effect size between two groups: the difference in means over the pooled spread. */
export function cohensD(a, b) {
  const ma = mean(a), mb = mean(b);
  const va = sd(a, ma) ** 2, vb = sd(b, mb) ** 2;
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / Math.max(1, a.length + b.length - 2)) || 1;
  return (ma - mb) / pooled;
}

const DIMENSION_LABELS = { visual: 'Visual', auditory: 'Auditory', reward: 'Reward', memory: 'Memory', attention: 'Attention', narrative: 'Narrative', personal: 'Self-relevance', action: 'Action', overall: 'Overall engagement' };
export const dimensionLabel = key => DIMENSION_LABELS[key] ?? key;

/** How a group differs from everyone else: per dimension and per region, ranked by effect size. */
export function contrast(data, members) {
  const inside = new Set(members);
  const split = values => [values.filter((_, i) => inside.has(i)), values.filter((_, i) => !inside.has(i))];
  const rows = [];
  Object.entries(data.dimensions).forEach(([key, values]) => {
    const [a, b] = split(values);
    rows.push({ id: `dim-${key}`, feature: dimensionLabel(key), kind: 'Dimension', group: mean(a), rest: mean(b), d: cohensD(a, b) });
  });
  data.roi_labels.forEach((label, r) => {
    const [a, b] = split(data.regions.map(row => row[r]));
    rows.push({ id: `roi-${label}`, feature: label, kind: 'Region', group: mean(a), rest: mean(b), d: cohensD(a, b) });
  });
  return rows.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
}

/** Per-second mean response of a set of profiles. */
export function meanTrajectory(data, members) {
  const T = data.n_timesteps;
  return Array.from({ length: T }, (_, t) => mean(members.map(i => data.trajectory[i][t])));
}

export function cohortMix(data, members) {
  const counts = Object.fromEntries(data.cohort_order.map(c => [c, 0]));
  members.forEach(i => { counts[data.cohorts[i]]++; });
  return counts;
}

/** A short description of a cluster: its dominant cohort (when one holds half) and its most distinctive trait. */
export function describe(data, members, contrastRows) {
  const mix = cohortMix(data, members);
  const [topCohort, topCount] = Object.entries(mix).sort((a, b) => b[1] - a[1])[0];
  const label = (data.cohort_labels[topCohort] || topCohort).replace(/\s*\(.*\)/, '');
  const parts = [];
  if (topCount / members.length >= 0.5) parts.push(`mostly ${label}`);
  const trait = contrastRows.find(r => r.kind === 'Dimension' && r.feature !== 'Overall engagement') ?? contrastRows[0];
  if (trait) parts.push(`${trait.d > 0 ? 'higher' : 'lower'} ${trait.feature.toLowerCase()}`);
  return parts.join(', ');
}

export { mean, mulberry32 };
