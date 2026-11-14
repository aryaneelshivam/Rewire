import { detailFor } from './detail';
/**
 * Turns an analysis into plain language: a verdict, what's working, where attention drifts and what to change.
 * Everything here reads the API's numbers (score, engagement, A/B summary) and says what they mean for a creator,
 * in creator words. The rules are deliberately simple and relative (this video against itself, or A against B),
 * because the scores have no benchmark yet to say "good" or "bad" in absolute terms.
 */

// The response builds for about two seconds after what's on screen, so a reaction at t points at content near t - 2.
const LAG_S = 2;
// The response takes a few seconds to build from nothing, so the first seconds are never counted as a dip.
const WARMUP_S = 4;
// Under 5% apart counts as a tie, the same margin the dashboard uses.
const TIE_PCT = 5;

export const DRIVERS = {
  visual: { label: 'Visuals', means: 'what’s on screen grabs the eye', tip: 'Add more visual change early: a cut, a close-up or movement in the first seconds.' },
  auditory: { label: 'Sound', means: 'the voice and music carry it', tip: 'Lift the sound: a clearer voiceover or a track with more energy.' },
  reward: { label: 'Payoff', means: 'it feels satisfying to watch', tip: 'Build to a payoff: a reveal, a result or a before-and-after.' },
  memory: { label: 'Memorability', means: 'it’s likely to stick', tip: 'Repeat the one line or image you want remembered, and end on it.' },
  attention: { label: 'Focus', means: 'it holds concentrated attention', tip: 'Cut what competes for attention: one idea per shot.' },
  narrative: { label: 'Story', means: 'people follow where it’s going', tip: 'Give it a clearer setup and payoff, so people know where it’s heading.' },
  personal: { label: 'Relatability', means: 'it feels like it’s about the viewer', tip: 'Speak to the viewer directly: “you”, their problem, their moment.' },
  action: { label: 'Urge to act', means: 'it nudges people to do something', tip: 'Make the ask concrete and show the action happening on screen.' },
};
// For audio the same measures, said for listeners. "Visuals" becomes Imagery: with nothing on screen, it's what the
// sound makes people picture. The numbers behind each driver are the same as for video.
const AUDIO_DRIVERS = {
  visual: { label: 'Imagery', means: 'it makes people picture it', tip: 'Paint a picture early: concrete, vivid words and sound effects people can see in their mind.' },
  reward: { ...DRIVERS.reward, means: 'it feels satisfying to listen to' },
  memory: { ...DRIVERS.memory, tip: 'Repeat the one line you want remembered, and end on it.' },
  attention: { ...DRIVERS.attention, tip: 'Cut what competes for attention: one idea at a time, and keep the music under the voice.' },
  action: { ...DRIVERS.action, tip: 'Make the ask concrete: say exactly what to do, and say it twice.' },
};
/** The drivers as worded for a video or an audio file. */
export const driversFor = medium => (medium === 'audio' ? { ...DRIVERS, ...AUDIO_DRIVERS } : DRIVERS);
const DRIVER_KEYS = Object.keys(DRIVERS);
const COHORTS = ['kids', 'genz', 'adults', 'older'];
export const COHORT_LABELS = { kids: 'Kids', genz: 'Gen Z', adults: 'Adults', older: '55+' };

export const clock = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.round(Math.max(0, s)) % 60).padStart(2, '0')}`;
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const contentTime = t => Math.max(0, t - LAG_S);
const stem = name => name?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

function smooth(curve) {
  return curve.map((_, i) => avg(curve.slice(Math.max(0, i - 1), i + 2)));
}

/** Stretches where attention sags well below the video's own level, longest first (skipping the ramp-up). */
function findDips(curve) {
  if (curve.length < 6) return [];
  const s = smooth(curve);
  const body = s.slice(WARMUP_S);
  const mean = avg(body);
  const sd = Math.sqrt(avg(body.map(v => (v - mean) ** 2)));
  const floor = mean - 0.5 * sd;
  const dips = [];
  let start = null;
  for (let i = WARMUP_S; i <= s.length; i++) {
    const low = i < s.length && s[i] < floor;
    if (low && start == null) start = i;
    if (!low && start != null) {
      if (i - start >= 2) dips.push({ from: start, to: i - 1, depth: avg(s.slice(start, i)) });
      start = null;
    }
  }
  return dips.sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 2).sort((a, b) => a.from - b.from);
}

/** The read on one video, whatever it's compared with. */
function readVideo(key, score, engagement, name, seconds, compare, medium = 'video') {
  const words = driversFor(medium);
  const m = score?.measures ?? {};
  const curve = score?.curve ?? [];
  const peakAt = curve.length ? curve.indexOf(Math.max(...curve)) : 0;
  const hook = m.hook?.value ?? 0;
  const depth = m.depth?.value ?? 0;
  const ratio = depth > 0 ? hook / depth : 1;
  const hookTag = ratio >= 1.1 ? 'strong' : ratio >= 0.8 ? 'steady' : 'slow';
  const scores = engagement?.scores ?? {};
  const drivers = DRIVER_KEYS.map(d => ({ key: d, ...words[d], value: avg(COHORTS.map(c => scores[c]?.[d]).filter(v => v != null)) }))
    .sort((a, b) => b.value - a.value);
  const cohorts = COHORTS.filter(c => scores[c]).map(c => ({ key: c, label: COHORT_LABELS[c], value: scores[c].overall }))
    .sort((a, b) => b.value - a.value);
  const spread = cohorts.length > 1 ? (cohorts[0].value - cohorts.at(-1).value) / Math.abs(cohorts[0].value || 1) : 0;
  return {
    key, name: stem(name) || (medium === 'audio' ? (compare ? `Audio ${key}` : 'Your audio') : (compare ? `Video ${key}` : 'Your video')),
    seconds: seconds || curve.length,
    curve, peakAt, peakContent: contentTime(peakAt), hook, depth, hookTag,
    hold: m.hold?.value ?? null, dips: findDips(curve), drivers, cohorts, audienceClear: spread >= TIE_PCT / 100,
  };
}

function suggestions(v, other) {
  const out = [];
  if (v.hookTag === 'slow') {
    out.push(`Open stronger. The first seconds land softer than the rest${v.peakContent > 3 ? `; try opening on what’s at ${clock(v.peakContent)}, your best moment` : ''}.`);
  }
  if (v.dips[0]) out.push(`Tighten ${clock(contentTime(v.dips[0].from))}–${clock(contentTime(v.dips[0].to))}. Attention sags there.`);
  if (v.seconds > 8 && v.peakAt > v.seconds * 0.6 && v.hookTag !== 'strong') out.push(`Your best moment comes late (${clock(v.peakContent)}). Move it up, or tease it at the start.`);
  if (other) {
    const borrow = DRIVER_KEYS.map(d => ({ d, gap: (other.drivers.find(x => x.key === d)?.value ?? 0) - (v.drivers.find(x => x.key === d)?.value ?? 0) }))
      .sort((a, b) => b.gap - a.gap)[0];
    const d = v.drivers.find(x => x.key === borrow?.d);
    if (borrow?.gap > 0 && d) out.push(`Borrow from ${other.name}: it does better on ${d.label.toLowerCase()}. ${d.tip}`);
  } else {
    // The weakest of the levers a creator can actually pull, said softly: there's no benchmark to call it weak.
    const lever = v.drivers.filter(d => ['narrative', 'personal', 'action', 'auditory'].includes(d.key)).at(-1);
    if (lever) out.push(`${lever.label} has the most room to grow. ${lever.tip}`);
  }
  return out.slice(0, 3);
}

/**
 * The whole conversation's material for one analysis: { mode, videos, verdict, viewers }.
 * verdict: { winner, headline, sub, lead, close } for a comparison, { headline, sub } for one video.
 */
export function buildInsights({ status, score, engagement, ab, timeseries }) {
  const run = status.run ?? {};
  const medium = run.medium === 'audio' ? 'audio' : 'video';
  const keys = status.variants;
  const videos = keys.map(k => ({ ...readVideo(k, score[k], engagement[k], run.names?.[k], run.durations?.[k], keys.length > 1, medium), detail: detailFor(timeseries?.[k]) }));
  const viewers = status.viewers ?? 200;
  const media = Object.fromEntries(keys.map(k => [k, status.media?.[k] ?? {}]));

  if (keys.length < 2) {
    const v = videos[0];
    const opening = { strong: 'Strong opening', steady: 'Steady opening', slow: 'Slow start' }[v.hookTag];
    const headline = v.hookTag === 'slow'
      ? `Slow start, but it picks up. Your best moment is at ${clock(v.peakContent)}.`
      : `${opening}, and it peaks at ${clock(v.peakContent)}.`;
    const lead = v.drivers[0];
    const sub = `Its biggest strength is ${lead.label.toLowerCase()}: ${lead.means}.${v.audienceClear ? ` ${v.cohorts[0].label} respond best.` : ' It lands about equally across ages.'}`;
    return { mode: 'single', medium, videos, viewers, media, title: run.title, verdict: { headline, sub }, fixes: suggestions(v), names: { A: v.name } };
  }

  const overall = ab?.overall ?? {};
  const close = !overall.winner || overall.winner === 'TIE' || (overall.lead_pct ?? 0) < TIE_PCT;
  const winner = close ? null : videos.find(v => v.key === overall.winner);
  const loser = winner ? videos.find(v => v.key !== winner.key) : null;
  // Why it won: the drivers where the winner leads most, averaged over the four audiences.
  const gaps = DRIVER_KEYS.map(d => {
    const per = COHORTS.map(c => ab?.dimension_winners?.[c]?.[d]).filter(Boolean);
    return { key: d, ...driversFor(medium)[d], gap: avg(per.map(x => (x.A ?? 0) - (x.B ?? 0))) };   // positive: A leads
  });
  const led = overall.cohorts_led ?? {};
  let headline; let sub;
  if (winner) {
    const sign = winner.key === 'A' ? 1 : -1;
    const why = gaps.filter(g => g.gap * sign > 0).sort((a, b) => b.gap * sign - a.gap * sign).slice(0, 2);
    const all = led[winner.key] === (overall.cohorts ?? 4);
    headline = `${winner.name} wins. It lands ${Math.round(overall.lead_pct)}% stronger${all ? ' with every audience' : ''}.`;
    sub = why.length ? `It wins on ${why.map(w => w.label.toLowerCase()).join(' and ')}: ${why[0].means}.` : '';
  } else {
    headline = 'Too close to call. Both land about the same.';
    sub = 'Pick on other grounds, or try a bolder change between the two.';
  }
  const lengths = videos.map(v => v.seconds);
  const lengthNote = Math.max(...lengths) > Math.min(...lengths) * 1.5
    ? 'They’re quite different lengths, so read this as “which holds up better”, not a like-for-like cut.' : null;
  return {
    mode: 'compare', medium, videos, viewers, media, title: run.title, gaps, lengthNote,
    verdict: { winner: winner?.key ?? null, headline, sub, lead: overall.lead_pct ?? 0, close },
    fixes: suggestions(loser ?? videos[1], winner ?? videos[0]),
    names: Object.fromEntries(videos.map(v => [v.key, v.name])),
  };
}

/** Follow-up questions, as chips, and the words that route a typed question to each. */
export const TOPICS = [
  { key: 'opening', label: 'How’s the opening?', words: ['hook', 'open', 'start', 'first', 'intro', 'beginning'] },
  { key: 'drift', label: 'Where do people drift?', words: ['drop', 'dip', 'drift', 'lose', 'bored', 'boring', 'sag', 'skip', 'middle'] },
  { key: 'working', label: 'What’s working?', words: ['work', 'why', 'good', 'strength', 'driv', 'carr', 'win'] },
  { key: 'audience', label: 'Who likes it most?', words: ['who', 'audience', 'age', 'kid', 'gen z', 'genz', 'adult', 'older', 'demo'] },
  { key: 'shift', label: 'How does it shift over time?', words: ['over time', 'shift', 'swell', 'flow', 'mix', 'through the video', 'evolve'] },
  { key: 'fix', label: 'What should I change?', words: ['fix', 'change', 'improve', 'better', 'edit', 'should', 'tip', 'advice'] },
  { key: 'how', label: 'How does this work?', words: ['how does', 'how do you', 'accurate', 'trust', 'simulat', 'method'] },
];

export function routeQuestion(text) {
  const t = text.toLowerCase();
  // "how does this work" before the others, since it shares words like "work".
  const how = TOPICS.find(x => x.key === 'how');
  if (how.words.some(w => t.includes(w))) return 'how';
  return TOPICS.find(x => x.key !== 'how' && x.words.some(w => t.includes(w)))?.key ?? null;
}
