// Detects the moments the timeline marks, from data the app already has: the transcript, the
// per-second predicted response, and (when a video is loaded) its frames and soundtrack.
// Every detector is a heuristic; each marker says where it came from so nothing reads as ground truth.

export const EVENT_TYPES = {
  cut: { label: 'Scene cut', source: 'Detected from the video frames' },
  dialogue: { label: 'Dialogue', source: 'From the transcript' },
  sound: { label: 'Sound change', source: 'Detected from the soundtrack loudness' },
  brand: { label: 'Brand mention', source: 'A proper noun in the transcript' },
  cta: { label: 'Call to action', source: 'An imperative line near the end' },
  rise: { label: 'Response rises', source: 'A sharp rise in predicted whole-brain response' },
  fall: { label: 'Response drops', source: 'A sharp drop in predicted whole-brain response' },
  peak: { label: 'Peak response', source: 'The highest predicted response' },
};

const clampT = (t, duration) => Math.max(0, Math.min(duration, t));

/** Sentences with their start, end and text, merged from the transcript's sentence events. */
export function sentencesOf(transcript = []) {
  return transcript
    .filter(e => e.type === 'Sentence' && e.text)
    .map(e => ({ start: e.start, end: e.start + (e.duration || 0), text: String(e.text).trim() }))
    .sort((a, b) => a.start - b.start);
}

// Capitalised words that start sentences or are common English, so not brand names.
const COMMON = new Set(['i', 'i\'m', 'the', 'a', 'an', 'and', 'but', 'or', 'now', 'look', 'hello', 'that\'s', 'it\'s', 'this', 'we', 'you', 'he', 'she', 'they', 'my', 'your', 'our', 'sadly', 'yes', 'no', 'oh', 'what', 'where', 'who', 'why', 'how', 'making', 'anything', 'ladies', 'man']);

/** Proper nouns that are not sentence openers, joined when consecutive ("Old Spice"). */
export function brandMentions(transcript = []) {
  const words = transcript.filter(e => e.type === 'Word' && e.text).sort((a, b) => a.start - b.start);
  const found = [];
  let run = null;
  words.forEach((w, i) => {
    const raw = String(w.text).trim();
    const clean = raw.replace(/[^A-Za-z'’-]/g, '');
    const prev = words[i - 1];
    const opensSentence = !prev || /[.!?]$/.test(String(prev.text).trim()) || (w.sentence && String(w.sentence).trim().startsWith(raw));
    const proper = /^[A-Z]/.test(clean) && clean.length > 1 && !opensSentence && !COMMON.has(clean.toLowerCase());
    if (proper) {
      if (run && w.start - run.end < 0.6) { run.label += ` ${clean}`; run.end = w.start + (w.duration || 0); }
      else { run = { t: w.start, end: w.start + (w.duration || 0), label: clean }; found.push(run); }
    } else run = null;
    if (/[.!?,]$/.test(raw)) run = null;
  });
  return found.map(f => ({ type: 'brand', t: f.t, title: f.label }));
}

const IMPERATIVE = /\b(buy|shop|try|get|grab|order|visit|download|sign up|subscribe|call|switch|smell|discover|find|join|book|start|order now|learn more|see more|tap|click)\b/i;

/** Lines in the last third that ask the viewer to act. */
export function callsToAction(sentences, duration) {
  return sentences
    .filter(s => s.start >= duration * 0.6 && IMPERATIVE.test(s.text))
    .slice(-2)
    .map(s => ({ type: 'cta', t: s.start, end: s.end, title: s.text }));
}

/** The largest second-to-second moves in predicted response: the top tenth, at most four, two seconds apart. */
export function responseShifts(series = [], limit = 4) {
  if (series.length < 3) return [];
  const moves = series.slice(1).map((v, i) => ({ t: i + 1, d: v - series[i] }));
  const sizes = moves.map(m => Math.abs(m.d)).sort((a, b) => a - b);
  const threshold = sizes[Math.floor(sizes.length * 0.9)] ?? Infinity;
  const picked = [];
  [...moves].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).forEach(m => {
    if (picked.length >= limit || Math.abs(m.d) < threshold || Math.abs(m.d) < 1e-6) return;
    if (picked.some(p => Math.abs(p.t - m.t) < 2)) return;
    picked.push(m);
  });
  return picked.map(m => ({ type: m.d > 0 ? 'rise' : 'fall', t: m.t, title: `${m.d > 0 ? '+' : '−'}${Math.abs(m.d).toFixed(3)} z in one second` }));
}

/** Change points in a per-second signal: a step well above its typical movement, spaced out. */
export function changePoints(values = [], { minRatio = 0, sigmas = 1.5, gap = 2, limit = 8 } = {}) {
  if (values.length < 3) return [];
  const steps = values.slice(1).map((v, i) => ({ t: i + 1, d: Math.abs(v - values[i]) }));
  const mean = steps.reduce((s, x) => s + x.d, 0) / steps.length;
  const sd = Math.sqrt(steps.reduce((s, x) => s + (x.d - mean) ** 2, 0) / steps.length);
  const cut = Math.max(mean + sigmas * sd, minRatio);
  const picked = [];
  [...steps].sort((a, b) => b.d - a.d).forEach(s => {
    if (picked.length >= limit || s.d <= cut) return;
    if (picked.some(p => Math.abs(p - s.t) < gap)) return;
    picked.push(s.t);
  });
  return picked.sort((a, b) => a - b);
}

/** Scenes between cuts; without cuts the creative is one scene. */
export function scenesFrom(cuts, duration) {
  const edges = [0, ...cuts.filter(t => t > 0 && t < duration), duration];
  return edges.slice(0, -1).map((start, i) => ({ start, end: edges[i + 1], index: i }));
}

/**
 * Three narrative sections: the opening hook (up to the first cut after a second, three seconds at most),
 * the development, and the close (from the call to action, or the last scene, or the final fifth).
 */
export function sectionsOf(duration, scenes, ctas) {
  const firstCut = scenes.length > 1 ? scenes[1].start : null;
  const hookEnd = clampT(firstCut && firstCut >= 1 && firstCut <= 3 ? firstCut : Math.min(3, duration * 0.15), duration);
  const lastScene = scenes.length > 2 ? scenes[scenes.length - 1].start : null;
  const fallback = duration * 0.8;
  let closeStart = ctas.length ? Math.floor(ctas[0].t) : lastScene && lastScene >= duration * 0.6 ? lastScene : fallback;
  closeStart = Math.max(hookEnd + 1, Math.min(closeStart, duration - 1));
  return [
    { id: 'hook', label: 'Opening hook', start: 0, end: hookEnd },
    { id: 'development', label: 'Development', start: hookEnd, end: closeStart },
    { id: 'close', label: 'Close', start: closeStart, end: duration },
  ];
}

/** Everything one track shows, from the overview payload and the optional video analysis. */
export function buildTrack(overview, video, duration) {
  const transcript = overview?.transcript || [];
  const series = overview?.timestep_metrics?.global_mean || [];
  const sentences = sentencesOf(transcript);
  const cuts = video?.cuts ?? [];
  const scenes = scenesFrom(cuts, duration);
  const ctas = callsToAction(sentences, duration);
  const events = [
    ...cuts.map(t => ({ type: 'cut', t, title: `Scene ${scenes.findIndex(s => s.start === t) + 1} begins` })),
    ...sentences.map(s => ({ type: 'dialogue', t: s.start, end: s.end, title: s.text })),
    ...(video?.sound ?? []).map(t => ({ type: 'sound', t, title: 'Loudness changes sharply' })),
    ...brandMentions(transcript),
    ...ctas,
    ...responseShifts(series),
    ...(overview?.peak_timestep != null ? [{ type: 'peak', t: overview.peak_timestep, title: `${(overview.timestep_metrics?.global_max?.[overview.peak_timestep] ?? 0).toFixed(3)} z at the peak vertex` }] : []),
  ].map((e, i) => ({ ...e, id: `${e.type}-${i}-${e.t.toFixed(2)}`, t: clampT(e.t, duration) }));
  return { scenes, sections: sectionsOf(duration, scenes, ctas), events, series };
}

/** Mean of a per-second series over [start, end). */
export function meanOver(series = [], start, end) {
  const from = Math.max(0, Math.floor(start)), to = Math.min(series.length, Math.max(from + 1, Math.ceil(end)));
  const part = series.slice(from, to);
  return part.length ? part.reduce((s, v) => s + v, 0) / part.length : 0;
}

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
