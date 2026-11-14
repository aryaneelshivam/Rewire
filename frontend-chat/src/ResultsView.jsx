import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WinnerPlayer from '@/components/WinnerPlayer';
import CreativeTimeline from '@/components/CreativeTimeline';
import { Gauge } from '@/components/arc/gauge/gauge';
import { EVENT_TYPES, sentencesOf } from '@/lib/timeline-events';
import { mediaUrl } from './api';
import { COHORTS, MIX, MIX_KEYS, cohortLabel, percentileAt, runs } from './detail';
import Peek from './Peek';
import { Crown } from 'lucide-react';
import { clock } from './insights';

// The dashboard's markers, worded for creators: attention, not brain response.
const CHAT_EVENT_TYPES = {
  ...EVENT_TYPES,
  rise: { label: 'Attention rises', source: 'A sharp rise in predicted attention' },
  fall: { label: 'Attention drops', source: 'A sharp drop in predicted attention' },
  peak: { label: 'Peak attention', source: 'The strongest predicted moment' },
};
const HOOK_S = 3;
const LAG_S = 2;

/** The attention curve on the timeline's axis, with the hook window, the dips and the peak. */
function AttentionLane({ v, lo, hi, end, pct, tone }) {
  const n = v.curve.length;
  if (n < 2) return null;
  const y = val => 1 - (val - lo) / (hi - lo || 1);
  const pts = v.curve.map((val, t) => `${t},${(y(val) * 0.86 + 0.07).toFixed(3)}`);
  const peakT = v.peakAt;
  return (
    <>
      <span className="lane-hook" style={{ left: 0, width: pct(Math.min(HOOK_S, end)) }}><span>Hook</span></span>
      {v.dips.map((d, i) => <span key={i} className="lane-dip" style={{ left: pct(d.from), width: pct(d.to - d.from + 1) }} title={`Attention sags ${clock(d.from - LAG_S)}–${clock(d.to - LAG_S)}`} />)}
      <svg className="lane-svg" style={{ width: pct(n - 1) }} viewBox={`0 0 ${n - 1} 1`} preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`0,1 ${pts.join(' ')} ${n - 1},1`} className="lane-area" style={{ fill: `var(--chart-${tone})` }} />
        <polyline points={pts.join(' ')} className="lane-line" style={{ stroke: `var(--chart-${tone})` }} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="lane-peak" style={{ left: pct(peakT), top: `${(y(v.curve[peakT]) * 0.86 + 0.07) * 100}%`, background: `var(--chart-${tone})` }} title={`Best moment, ${clock(v.peakContent)}`} />
    </>
  );
}

/** One thin heat row per audience: darker where that audience responds more (on one scale for every row). */
/** Each audience's response as a waffle: one cell per second per audience, shaded in five steps so strong and weak
 * stretches read at a glance. Rows run Kids, Gen Z, Adults, 55+, labelled in the timeline's label column. */
const AUD_STEPS = ['Very weak', 'Weak', 'Middling', 'Strong', 'Very strong'];
function AudienceLane({ detail, lo, hi, pct, tone }) {
  return (
    <div className="lane-aud">
      {detail.cohorts.map(c => (
        <div key={c} className="lane-aud-row">
          {detail.audiences[c].map((val, t) => {
            const step = Math.min(4, Math.floor(5 * Math.max(0, (val - lo) / (hi - lo || 1))));
            return (
              <span key={t} data-step={step} data-tone={tone} style={{ left: pct(t), width: `max(1px, calc(${pct(1)} - 2px))` }}
                title={`${cohortLabel(c)} · ${clock(t)} · ${AUD_STEPS[step]}`} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AudienceLabels({ cohorts }) {
  return (
    <span className="lane-aud-labels">
      {cohorts.map(c => <span key={c}>{cohortLabel(c).replace(/\s*\(.*\)/, '')}</span>)}
    </span>
  );
}

/** Which driver is rising most, second by second, as coloured runs. */
function DriverLane({ detail, pct }) {
  return runs(detail.rising).map(r => (
    <span key={r.from} className="lane-drv" data-drv={r.value} style={{ left: pct(r.from), width: `calc(${pct(r.to - r.from)} - 1px)` }}
      title={`${clock(Math.max(0, r.from - LAG_S))}–${clock(Math.max(0, r.to - LAG_S))}: ${MIX[r.value]} rising`}>
      {r.to - r.from >= 3 && <span>{MIX[r.value]}</span>}
    </span>
  ));
}

/** What's happening at the playhead in the video in the player: attention, audiences, the rising driver, the line. */
/** How Peek watches along: hooked at the best moment and the strongest stretches, bored in the weakest, leaning in
 * while it plays, and resting when paused. */
function peekMood(v, at, pctile, playing) {
  if (Math.abs(at - v.peakContent) <= 1) return 'celebrating';
  if (pctile >= 85) return 'surprised';
  if (pctile <= 20) return 'sad';
  return playing ? 'listening' : 'idle';
}

function NowPanel({ v, t, sentences, tone, playing }) {
  if (!v) return null;
  const at = Math.max(0, Math.min(v.curve.length - 1, Math.round(t)));
  const pctile = percentileAt(v.curve, at);
  const aud = v.detail ? COHORTS.filter(c => v.detail.audiences[c]).map(c => ({ c, val: v.detail.audiences[c][at] ?? 0 })) : [];
  const lo = Math.min(...aud.map(a => a.val));
  const hi = Math.max(...aud.map(a => a.val));
  const rising = v.detail?.rising[at];
  const line = sentences.find(s => t >= s.start && t < s.end + 0.5);
  const top = aud.length ? aud.reduce((a, b) => (b.val > a.val ? b : a)) : null;
  return (
    <aside className="now" aria-label="At the playhead" data-tone={tone}>
      <div className="now-head">
        <p className="now-kicker">At {clock(at)}</p>
        <Peek state={peekMood(v, at, pctile, playing)} size={64} floor={0.4} />
      </div>
      <div className="now-gauge">
        <Gauge value={pctile} label="Attention here" detail={pctile >= 80 ? 'One of the strongest moments' : pctile <= 25 ? 'One of the weakest moments' : `Stronger than ${pctile}% of the video`}
          thresholds={[{ from: 0, tone: 'danger', label: 'Weak' }, { from: 34, tone: 'warning', label: 'Middling' }, { from: 67, tone: 'success', label: 'Strong' }]} />
      </div>
      {aud.length > 0 && (
        <div className="now-block now-aud-block">
          <p className="now-label">Audiences now{top ? <span> · {cohortLabel(top.c)} lead</span> : null}</p>
          <ul className="now-aud">
            {aud.map(a => (
              <li key={a.c}>
                <span>{cohortLabel(a.c)}</span>
                <span className="now-bar"><span style={{ width: `${12 + 88 * ((a.val - lo) / (hi - lo || 1))}%` }} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="now-pair">
        <div className="now-block">
          <p className="now-label">Rising now</p>
          {rising ? <p className="now-drv"><i data-drv={rising} />{MIX[rising]}</p> : <p className="now-drv now-quiet">—</p>}
        </div>
        <div className="now-block">
          <p className="now-label">Best moment</p>
          <p className="now-drv">{clock(v.peakContent)}</p>
        </div>
      </div>
      <div className="now-block now-line-block">
        <p className="now-label">Being said</p>
        <p className="now-line">{line ? `“${line.text}”` : <span className="now-quiet">No speech here</span>}</p>
      </div>
    </aside>
  );
}

/**
 * A finished analysis: the dashboard's player (compact, the winner first) beside a live readout of the playhead, and
 * under them the dashboard's detailed timeline with three extra lanes per video: the attention curve (hook, dips,
 * best moment), each audience's response, and the driver rising most each second. One playhead runs through all.
 */
export default function ResultsView({ overview, media, winner, runKey, onNewVideo, ins }) {
  const variants = Object.keys(overview);
  const single = variants.length === 1;
  const [focus, setFocus] = useState(single || winner !== 'B' ? 'A' : 'B');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopRange, setLoopRange] = useState(null);
  const playerRef = useRef(null);
  const resumeRef = useRef(null);

  const videoUrl = v => mediaUrl(media?.[v]?.video);
  const audio = ins?.medium === 'audio';
  const thumbUrl = v => mediaUrl(media?.[v]?.thumb);
  const focusVideo = videoUrl(focus);
  const maxTimesteps = Math.max(...variants.map(v => overview[v].n_timesteps));

  const seek = t => {
    const clamped = Math.max(0, Math.min(t, maxTimesteps - 1));
    if (playerRef.current) playerRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };
  const togglePlayback = () => {
    const video = playerRef.current;
    if (video) { if (video.paused) video.play(); else video.pause(); return; }
    setIsPlaying(p => !p);
  };
  const changeFocus = useCallback(next => {
    if (next === focus) return;
    const at = Math.max(0, Math.min(currentTime, (overview[next]?.n_timesteps ?? 1) - 1));
    resumeRef.current = videoUrl(next) ? { time: at, play: isPlaying } : null;
    setCurrentTime(at);
    setFocus(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, currentTime, isPlaying, overview, media]);

  useEffect(() => {
    if (loopRange && (currentTime >= loopRange.end || currentTime < loopRange.start)) seek(loopRange.start);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, loopRange]);
  const playRange = span => {
    setLoopRange(span);
    if (!span) return;
    seek(span.start);
    if (playerRef.current) playerRef.current.play(); else setIsPlaying(true);
  };
  useEffect(() => {
    if (!isPlaying || focusVideo) return;
    const n = overview[focus]?.n_timesteps ?? 1;
    const id = setInterval(() => setCurrentTime(t => (t + 1) % n), 1000);
    return () => clearInterval(id);
  }, [isPlaying, focusVideo, focus, overview]);

  const videoOf = v => ins?.videos.find(x => x.key === v);
  // Shared scales, so both videos' lanes compare directly.
  const scales = useMemo(() => {
    const curves = (ins?.videos ?? []).flatMap(v => v.curve);
    const auds = (ins?.videos ?? []).flatMap(v => (v.detail ? Object.values(v.detail.audiences).flat() : []));
    return { lo: Math.min(...curves), hi: Math.max(...curves), alo: Math.min(...auds), ahi: Math.max(...auds) };
  }, [ins]);

  const tracks = useMemo(() => variants.map(v => {
    const vid = videoOf(v);
    const tone = v === 'B' ? 'b' : 'a';
    const lanes = vid ? [
      { id: 'attention', label: 'Attention', hint: 'Predicted attention each second. The shaded start is the hook; grey bands are dips.', height: 46,
        render: ({ pct, end }) => <AttentionLane v={vid} lo={scales.lo} hi={scales.hi} end={end} pct={pct} tone={tone} /> },
      ...(vid.detail ? [
        { id: 'audiences', label: <AudienceLabels cohorts={vid.detail.cohorts} />, hint: 'How each audience responds, second by second. Darker is a stronger response.', height: 58,
          render: ({ pct }) => <AudienceLane detail={vid.detail} lo={scales.alo} hi={scales.ahi} pct={pct} tone={tone} /> },
        { id: 'drivers', label: 'Rising', hint: 'The driver rising most each second, against its own usual level.', height: 22,
          render: ({ pct }) => <DriverLane detail={vid.detail} pct={pct} /> },
      ] : []),
    ] : [];
    return { variant: v, overview: overview[v], videoUrl: videoUrl(v), audio, poster: audio ? thumbUrl(v) : undefined, isWinner: v === (winner === 'B' ? 'B' : 'A'), lanes };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [overview, media, winner, ins, scales]);

  const sentences = useMemo(() => sentencesOf(overview[focus]?.transcript), [overview, focus]);
  // Wide: the readout sits beside the player. Narrow (the chat open beside it, or a phone): it moves under the
  // timeline, so the video and the timeline come first and fit on screen together.
  const box = useRef(null);
  const [roomy, setRoomy] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRoomy(e.contentRect.width >= 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const now = <NowPanel v={videoOf(focus)} t={currentTime} sentences={sentences} tone={focus === 'B' ? 'b' : 'a'} playing={isPlaying} />;
  const seen = new Set((ins?.videos ?? []).flatMap(v => v.detail?.rising ?? []));

  return (
    <div className="results" ref={box}>
      <div className="results-top">
        <div className="player-wrap">
        {!single && (
          <div className="player-switch" role="tablist" aria-label={`Which ${audio ? 'audio' : 'video'} plays`}>
            {variants.map(v => {
              const thumb = mediaUrl(media?.[v]?.thumb);
              return (
                <button key={v} type="button" role="tab" aria-selected={focus === v} data-v={v} onClick={() => changeFocus(v)}
                  title={videoOf(v)?.name ?? `Video ${v}`}>
                  {thumb ? <img src={thumb} alt="" /> : <span className="player-switch-dot" />}
                  <span className="player-switch-key">{v}</span>
                  <span className="player-switch-name">{videoOf(v)?.name ?? `Video ${v}`}</span>
                  {winner === v && <Crown size={12} aria-label="Winner" />}
                </button>
              );
            })}
          </div>
        )}
        <WinnerPlayer
          winner={single ? 'SINGLE' : winner}
          focus={focus}
          videoUrl={focusVideo}
          audio={audio}
          poster={audio ? thumbUrl(focus) : undefined}
          videoRef={playerRef}
          resumeRef={resumeRef}
          currentTime={currentTime}
          duration={overview[focus].n_timesteps}
          peakTime={overview[focus].peak_timestep}
          isPlaying={isPlaying}
          onTogglePlay={togglePlayback}
          onSeek={seek}
          onTimeUpdate={e => setCurrentTime(Math.floor(e.target.currentTime))}
          onPlayingChange={setIsPlaying}
          onAddVideo={onNewVideo}
        />
        </div>
        {roomy && now}
      </div>
      <CreativeTimeline
        duration={maxTimesteps}
        currentTime={currentTime}
        onSeek={seek}
        tracks={tracks}
        focus={focus}
        onFocusChange={changeFocus}
        onPlayRange={playRange}
        loopRange={loopRange}
        storageKey={`rewire-chat-notes:${runKey}`}
        eventTypes={CHAT_EVENT_TYPES}
      />
      {seen.size > 0 && (
        <p className="drv-legend" aria-label="Driver colours">
          {MIX_KEYS.filter(d => seen.has(d)).map(d => <span key={d}><i data-drv={d} />{MIX[d]}</span>)}
          <span className="aud-key" aria-label="Audiences: lighter is weaker, darker is stronger">
            Audiences: weaker
            <span className="aud-key-steps" data-tone={focus === 'B' ? 'b' : 'a'}>{[0, 1, 2, 3, 4].map(i => <b key={i} data-step={i} />)}</span>
            stronger
          </span>
        </p>
      )}
      {!roomy && now}
    </div>
  );
}
