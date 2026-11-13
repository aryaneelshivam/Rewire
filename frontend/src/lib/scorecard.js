/**
 * What a shareable scorecard says, derived from the loaded analysis. Kept apart from the card's markup so the card
 * stays a pure picture of this object.
 */

const DIMENSION_LABELS = {
  visual: 'Visual', auditory: 'Sound', reward: 'Reward', memory: 'Memory',
  attention: 'Attention', narrative: 'Story', personal: 'Self-relevance', action: 'Action',
};
const DIMENSIONS = Object.keys(DIMENSION_LABELS);
/** Card sizes in CSS pixels; the image is saved at twice this. */
export const CARD_FORMATS = [
  { value: 'portrait', label: 'Portrait', note: '1080 × 1350, for LinkedIn and Instagram posts', width: 540, height: 675 },
  { value: 'square', label: 'Square', note: '1080 × 1080, for feeds', width: 540, height: 540 },
  { value: 'story', label: 'Story', note: '1080 × 1920, for stories and reels', width: 540, height: 960 },
  { value: 'link', label: 'Wide', note: '1200 × 630, for X, Slack and link previews', width: 600, height: 315 },
];

export const MEASURES = [
  { key: 'hook', label: 'Hook', hint: 'First seconds' },
  { key: 'depth', label: 'Depth', hint: 'Average response' },
  { key: 'peak', label: 'Peak', hint: 'Strongest moment' },
  { key: 'hold', label: 'Hold', hint: 'Time above typical' },
];
/**
 * The mini visuals a card can carry. Each size has a number of tile slots; the person picks which tiles fill them.
 * `compareOnly` / `singleLabel` let one tile read differently for one video and for a face-off.
 */
export const TILES = [
  { key: 'curve', label: 'Response curve' },
  { key: 'brain', label: 'Cortex at peak' },
  { key: 'networks', label: 'Brain networks' },
  { key: 'map', label: 'Contest map', singleLabel: 'Audience map' },
  { key: 'audiences', label: 'Audiences' },
  { key: 'engaged', label: 'Cortex engaged' },
  { key: 'moment', label: 'Peak moment' },
];
export const TILE_SLOTS = { portrait: 4, square: 2, story: 6, link: 1 };
export const DEFAULT_TILES = {
  single: ['curve', 'brain', 'networks', 'audiences', 'moment', 'engaged'],
  compare: ['curve', 'map', 'brain', 'audiences', 'networks', 'moment'],
};

/** Which tiles can be drawn for this card, in the order picked, up to the slots this size has. */
export function tilesFor(card, picked, format, brains, limit = TILE_SLOTS[format] ?? 0) {
  const lead = card.variants.find(v => v.key === card.winner) ?? card.variants[0];
  const can = {
    curve: card.variants.every(v => v.curve.length > 1),
    brain: !!brains?.[lead.key],
    networks: !!lead.networks,
    map: card.compare ? !!card.map?.length : !!lead.grid.length,
    audiences: lead.cohorts.length > 0,
    engaged: lead.engaged != null,
    moment: !!lead.quote,
  };
  return picked.filter(k => can[k]).slice(0, limit);
}

const NETWORK_LABELS = {
  reward: 'Reward', auditory: 'Sound', prefrontal: 'Prefrontal', memory: 'Memory',
  narrative: 'Story', personal: 'Self', action: 'Action',
};
const COHORTS = ['kids', 'genz', 'adults', 'older'];

// The response builds for about two seconds after the picture, so a response peak at t shows content near t - 2.
const RESPONSE_LAG_S = 2;

export const clock = s => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
const stem = name => name?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
const cohortName = label => label?.replace(/\s*\(.*\)/, '') ?? '';

/** Counts cohort and dimension contests, the overall score left out. */
function contests(summary) {
  const out = { A: 0, B: 0, TIE: 0 };
  Object.values(summary?.dimension_winners || {}).forEach(dims => Object.entries(dims).forEach(([dim, d]) => {
    if (dim !== 'overall') out[d.winner === 'A' || d.winner === 'B' ? d.winner : 'TIE'] += 1;
  }));
  return { ...out, total: out.A + out.B + out.TIE };
}

export function buildCard({ overview, engagement, abSummary, score, runInfo, videos, timeSeries, viewers }) {
  const keys = Object.keys(overview || {});
  const compare = keys.length > 1;
  const variants = keys.map(v => {
    const eng = engagement?.[v];
    const best = eng?.best_demographic;
    const dims = eng?.scores?.[best] || {};
    const top = Math.max(...DIMENSIONS.map(d => dims[d] ?? 0), 1e-6);
    const rs = score?.[v];
    const curve = rs?.curve ?? [];
    const peakIndex = curve.reduce((bi, x, i) => (x > curve[bi] ? i : bi), 0);
    return {
      key: v,
      name: stem(runInfo?.names?.[v]) || (compare ? `Variant ${v}` : runInfo?.title || 'Your creative'),
      seconds: overview[v].n_timesteps,
      score: rs?.status === 'benchmarked' ? rs.score : null,
      bandLabel: rs?.band_label,
      measures: MEASURES.map(m => ({ ...m, percentile: rs?.measures?.[m.key]?.percentile ?? null })),
      curve,
      peakAt: Math.max(0, peakIndex - RESPONSE_LAG_S),
      audience: cohortName(eng?.demo_labels?.[best]),
      drivers: DIMENSIONS.map(d => ({ key: d, label: DIMENSION_LABELS[d], value: Math.max(0, dims[d] ?? 0) / top }))
        .sort((a, b) => b.value - a.value).slice(0, 3),
      videoUrl: videos?.[v] ?? null,
      peakIndex,
      cohorts: COHORTS.filter(c => eng?.scores?.[c]).map(c => ({ key: c, label: cohortName(eng.demo_labels?.[c]), value: eng.scores[c].overall ?? 0 })),
      grid: COHORTS.filter(c => eng?.scores?.[c]).map(c => DIMENSIONS.map(d => eng.scores[c][d] ?? 0)),
      networks: networkFlow(timeSeries?.[v], best),
      engaged: overview[v].timestep_metrics?.active_fraction?.[peakIndex] ?? null,
      quote: quoteAt(overview[v].transcript, Math.max(0, peakIndex - RESPONSE_LAG_S)),
    };
  });
  const tally = compare ? contests(abSummary) : null;
  // The winner is the higher overall score across the audiences, the same verdict as the dashboard and report.
  const winner = !compare ? 'A' : abSummary?.overall?.winner ?? (tally.A > tally.B ? 'A' : tally.B > tally.A ? 'B' : 'TIE');
  // The contest map: one cell per cohort and dimension, marked with the variant that took it.
  const map = compare ? COHORTS.filter(c => abSummary?.dimension_winners?.[c]).map(c => DIMENSIONS.map(d => {
    const w = abSummary.dimension_winners[c][d]?.winner;
    return w === 'A' || w === 'B' ? w : 'TIE';
  })) : null;
  return {
    compare,
    map,
    cohortLabels: variants[0]?.cohorts.map(c => c.label) ?? [],
    dimensionLabels: DIMENSIONS.map(d => DIMENSION_LABELS[d]),
    title: runInfo?.title || (compare ? `${variants[0].name} vs ${variants[1].name}` : variants[0]?.name),
    variants,
    winner,
    contests: tally,
    overall: abSummary?.overall ?? null,
    benchmarked: variants.every(v => v.score != null),
    viewers,
    date: new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
  };
}

/** The seven network curves of one cohort as streamgraph rows. Curves are shifted to start at zero, since a stack
 * cannot show negative values; the shape over time is what the tile is for. */
function networkFlow(series, cohort) {
  const curves = series?.timeseries?.[cohort];
  if (!curves) return null;
  const keys = Object.keys(NETWORK_LABELS).filter(k => curves[k]?.length);
  if (!keys.length) return null;
  const floor = Math.min(...keys.flatMap(k => curves[k]));
  const T = Math.max(...keys.map(k => curves[k].length));
  return {
    series: keys.map((k, i) => ({ key: k, label: NETWORK_LABELS[k], color: `var(--sc-n${i + 1})` })),
    data: Array.from({ length: T }, (_, t) => ({
      key: String(t), label: clock(t), axisLabel: t % 10 === 0 ? clock(t) : undefined,
      values: Object.fromEntries(keys.map(k => [k, (curves[k][t] ?? floor) - floor])),
    })),
  };
}

/** The line of dialogue on screen at a moment, or the nearest within three seconds. */
function quoteAt(transcript, t) {
  const lines = (transcript || []).filter(e => e?.type === 'Sentence' && e.text?.trim());
  if (!lines.length) return null;
  const dist = e => (t < e.start ? e.start - t : t > (e.stop ?? e.start) ? t - (e.stop ?? e.start) : 0);
  const best = lines.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  if (dist(best) > 3) return null;
  const text = best.text.trim().replace(/[.\s]+$/, '').replace(/\.\s*$/, '');
  return { text: text.length > 120 ? `${text.slice(0, 117)}…` : text, at: best.start };
}

/** Trims an image to its content: everything that differs from the corner pixel (or is not transparent), with a
 * little margin. The 3D viewer frames the brain with plenty of empty space, which would waste a small tile. */
export async function cropToContent(src, margin = 0.06) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const { naturalWidth: w, naturalHeight: h } = img;
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  const [r0, g0, b0, a0] = d;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const differs = a0 < 10 ? d[i + 3] > 24 : Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 30;
      if (differs) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * margin);
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
  const out = Object.assign(document.createElement('canvas'), { width: x1 - x0, height: y1 - y0 });
  out.getContext('2d').drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return { src: out.toDataURL('image/png'), transparent: a0 < 10 };
}

/** One frame of a video as a JPEG data URL, or null when the video cannot be read (no file, or blocked). A slow
 * first seek is retried once. */
export async function captureFrame(url, seconds) {
  return (await grabFrame(url, seconds)) ?? grabFrame(url, seconds);
}

/** One frame of a video as a JPEG data URL, or null when the video cannot be read (no file, or blocked). */
function grabFrame(url, seconds) {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const video = document.createElement('video');
    const done = value => { video.removeAttribute('src'); video.load(); resolve(value); };
    const timer = setTimeout(() => done(null), 15000);
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => { video.currentTime = Math.min(Math.max(0, seconds), Math.max(0, video.duration - 0.1)); };
    video.onseeked = () => {
      try {
        const w = 960, h = Math.round(w * (video.videoHeight / video.videoWidth || 9 / 16));
        const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        clearTimeout(timer);
        done(canvas.toDataURL('image/jpeg', 0.86));
      } catch {
        clearTimeout(timer);
        done(null);
      }
    };
    video.onerror = () => { clearTimeout(timer); done(null); };
    video.src = url;
  });
}
