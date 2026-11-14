/**
 * The headline facts of an analysis, for the share card and the report: the same numbers the chat shows, worded
 * the same way, so nothing says something the conversation doesn't.
 */
import { clock, contentTime } from './insights';

export const TONE = { A: '#e0743f', B: '#2f9584' };
const OPENING = { strong: 'Strong', steady: 'Steady', slow: 'Slow' };
const pct = (a, b) => Math.round((a / (b || 1e-9) - 1) * 100);

export function videoFacts(v) {
  return {
    key: v.key,
    name: v.name,
    seconds: v.seconds,
    hold: v.hold != null ? Math.round(v.hold * 100) : null,
    best: clock(v.peakContent),
    opening: OPENING[v.hookTag],
    openingVs: pct(v.hook, v.depth),
    strengths: v.drivers.slice(0, 2).map(d => d.label),
    topAudience: v.audienceClear ? v.cohorts[0]?.label : null,
    dips: v.dips.map(d => `${clock(contentTime(d.from))}–${clock(contentTime(d.to))}`),
  };
}

export function analysisFacts(ins) {
  const videos = ins.videos.map(videoFacts);
  const winner = ins.verdict.winner ? ins.videos.find(v => v.key === ins.verdict.winner) : null;
  const other = winner ? ins.videos.find(v => v !== winner) : null;
  const audiencesWon = winner
    ? winner.cohorts.filter(c => c.value > (other.cohorts.find(o => o.key === c.key)?.value ?? 0)).length
    : null;
  return {
    mode: ins.mode,
    noun: ins.medium === 'audio' ? 'audio' : 'video',   // how the creative is spoken of: "the video", "the audio"
    title: ins.title || (ins.mode === 'compare' ? ins.videos.map(v => v.name).join(' vs ') : ins.videos[0].name),
    viewers: ins.viewers,
    headline: ins.verdict.headline,
    sub: ins.verdict.sub,
    winner: winner ? { key: winner.key, name: winner.name } : null,
    lead: Math.round(ins.verdict.lead ?? 0),
    audiencesWon,
    videos,
    fixes: ins.fixes ?? [],
    // In a comparison the fixes are for the video that lost (or the second one, when it's too close to call).
    fixesFor: ins.mode === 'compare' ? (other ?? ins.videos[1]).name : null,
  };
}

/** Each video's attention curve on one 0–100 scale (shared, so a comparison is fair). */
export function scaledCurves(ins) {
  const all = ins.videos.flatMap(v => v.curve);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return ins.videos.map(v => ({ key: v.key, name: v.name, values: v.curve.map(x => ((x - lo) / (hi - lo || 1)) * 100), peakAt: v.peakAt, dips: v.dips }));
}

export const fileSafe = s => (s || 'Rewire').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
