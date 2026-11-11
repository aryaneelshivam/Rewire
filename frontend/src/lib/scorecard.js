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

export function buildCard({ overview, engagement, abSummary, score, runInfo, videos }) {
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
    };
  });
  const tally = compare ? contests(abSummary) : null;
  const winner = tally ? (tally.A > tally.B ? 'A' : tally.B > tally.A ? 'B' : 'TIE') : 'A';
  return {
    compare,
    title: runInfo?.title || (compare ? `${variants[0].name} vs ${variants[1].name}` : variants[0]?.name),
    variants,
    winner,
    contests: tally,
    benchmarked: variants.every(v => v.score != null),
    date: new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
  };
}

/** One frame of a video as a JPEG data URL, or null when the video cannot be read (no file, or blocked). */
export function captureFrame(url, seconds) {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const video = document.createElement('video');
    const done = value => { video.removeAttribute('src'); video.load(); resolve(value); };
    const timer = setTimeout(() => done(null), 8000);
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
