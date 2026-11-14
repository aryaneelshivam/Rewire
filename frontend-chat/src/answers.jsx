import React, { useContext } from 'react';
import { LineChart } from '@/components/arc/line-chart/line-chart';
import { Sparkline } from '@/components/arc/sparkline/sparkline';
import { DonutChart } from '@/components/arc/donut-chart/donut-chart';
import { Streamgraph } from '@/components/arc/streamgraph/streamgraph';
import { Ridgeline } from '@/components/arc/ridgeline/ridgeline';
import { SlopeChart } from '@/components/arc/slope-chart/slope-chart';
import { MetricCard } from '@/components/arc/metric-card/metric-card';
import { AttentionChart, BarList, VersusBars } from './charts';
import { clock, COHORT_LABELS } from './insights';
import { COHORTS, MIX, MIX_KEYS } from './detail';
import { Compact } from './compact';

/** What the creative is called in a sentence: “the video” or “the audio”. */
const noun = ins => (ins?.medium === 'audio' ? 'audio' : 'video');

const useSize = (full, compact) => (useContext(Compact) ? compact : full);

/**
 * The bot's replies about a finished analysis: the verdict, then one answer per follow-up topic. Charts are Arc's
 * (interactive line, sparkline, donut, streamgraph, ridgeline, slope chart, metric cards); the attention chart with
 * shaded dips is the chat's own, since none of Arc's draws bands.
 */

const LAG = 2;
const ORDER = ['kids', 'genz', 'adults', 'older'];
const pct = (a, b) => Math.round((a / (b || 1e-9) - 1) * 100);
/** "40% harder", or "2.6× harder" once it's more than double. */
const harder = (a, b) => (a >= 2 * b && b > 0 ? `${(a / b).toFixed(1)}× harder` : `${pct(a, b)}% harder`);
const span = d => `${clock(Math.max(0, d.from - LAG))}–${clock(Math.max(0, d.to - LAG))}`;
const OPENING = { strong: 'Strong', steady: 'Steady', slow: 'Slow' };
const holdText = h => (h == null ? '—' : `${Math.round(h * 100)}% of it`);
const TONE = { A: 'var(--chart-a)', B: 'var(--chart-b)' };

/** Attention on a 0 to 100 index across the videos shown together, so they compare directly. */
function indexer(videos) {
  const all = videos.flatMap(v => v.curve);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return v => Math.round((v - lo) / (hi - lo || 1) * 100);
}

/** The attention curve(s) as Arc's interactive line chart: hover for each second, the legend toggles a video. */
function AttentionLine({ ins, upTo, height: full = 180 }) {
  const height = useSize(full, Math.round(full * 0.7));
  const idx = indexer(ins.videos);
  const n = Math.max(...ins.videos.map(v => v.curve.length));
  const len = upTo ? Math.min(upTo, n) : n;
  const data = Array.from({ length: len }, (_, t) => ({
    key: String(t),
    label: clock(Math.max(0, t - LAG)),
    axisLabel: t % Math.max(1, Math.round(len / 5)) === 0 ? clock(Math.max(0, t - LAG)) : undefined,
    values: Object.fromEntries(ins.videos.map(v => [v.key, t < v.curve.length ? idx(v.curve[t]) : undefined])),
  }));
  return (
    <LineChart
      data={data}
      series={ins.videos.map(v => ({ key: v.key, label: v.name, color: TONE[v.key], area: ins.videos.length === 1 }))}
      label="Attention, second by second (0 to 100)"
      categoryLabel="Moment"
      height={height}
      formatValue={value => `${Math.round(value)}`}
      formatTick={value => `${Math.round(value)}`}
      legend={ins.videos.length > 1}
    />
  );
}

export function Verdict({ ins }) {
  const { verdict } = ins;
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    return (
      <div className="answer">
        <p className="verdict-kicker">Verdict · {ins.viewers.toLocaleString('en')} viewers</p>
        <h2 className="verdict-head">{verdict.headline}</h2>
        <p>{verdict.sub}</p>
        <AttentionLine ins={ins} />
        <div className="metrics">
          <MetricCard label="Lands strongly" value={Math.round((v.hold ?? 0) * 100)} suffix="%" context={`of the ${noun(ins)}`} />
          <MetricCard label="Best moment" value={Math.round(v.peakContent)} suffix="s" context="in" />
          <MetricCard label="Opening" value={pct(v.hook, v.depth)} suffix="%" context="against the rest" change={OPENING[v.hookTag]} />
        </div>
      </div>
    );
  }
  const winner = ins.videos.find(v => v.key === verdict.winner);
  return (
    <div className="answer">
      <p className="verdict-kicker">Verdict · {ins.viewers.toLocaleString('en')} viewers each</p>
      <h2 className="verdict-head">
        {winner && <span className="winner-dot" style={{ background: TONE[winner.key] }} aria-hidden="true" />}
        {verdict.headline}
      </h2>
      {verdict.sub && <p>{verdict.sub}</p>}
      {winner && (
        <div className="metrics">
          <MetricCard label="Lead" value={Math.round(verdict.lead)} suffix="%" context="stronger overall" />
          <MetricCard label="Audiences won" value={winner.cohorts.filter(c => c.value > (ins.videos.find(x => x !== winner).cohorts.find(o => o.key === c.key)?.value ?? 0)).length} suffix="/4" context="age groups" />
        </div>
      )}
      <AttentionLine ins={ins} />
      <table className="versus-table">
        <thead>
          <tr><th scope="col"><span className="sr-only">Measure</span></th>{ins.videos.map(v => <th key={v.key} scope="col"><span className="stats-name"><i style={{ background: TONE[v.key] }} />{v.name}</span></th>)}</tr>
        </thead>
        <tbody>
          <tr><th scope="row">Opening</th>{ins.videos.map(v => <td key={v.key}>{OPENING[v.hookTag]}</td>)}</tr>
          <tr><th scope="row">Best moment</th>{ins.videos.map(v => <td key={v.key}>{clock(v.peakContent)}</td>)}</tr>
          <tr><th scope="row">Lands strongly</th>{ins.videos.map(v => <td key={v.key}>{holdText(v.hold)}</td>)}</tr>
        </tbody>
      </table>
      {ins.lengthNote && <p className="aside">{ins.lengthNote}</p>}
    </div>
  );
}

/** The first eight seconds of each video as Arc sparklines, with how the opening compares. */
function Opening({ ins }) {
  const sparkH = useSize(56, 40);
  const idx = indexer(ins.videos);
  const sparks = (
    <div className="sparks">
      {ins.videos.map(v => (
        <Sparkline key={v.key} data={v.curve.slice(0, 8).map(idx)} label={ins.mode === 'single' ? 'The first 8 seconds' : v.name}
          value={OPENING[v.hookTag]} change={`${pct(v.hook, v.depth) >= 0 ? '+' : ''}${pct(v.hook, v.depth)}% vs the rest`}
          tone={v.hookTag === 'strong' ? 'success' : v.hookTag === 'slow' ? 'warning' : 'accent'}
          labels={v.curve.slice(0, 8).map((_, t) => clock(Math.max(0, t - LAG)))} formatValue={x => `${Math.round(x)}`} width={260} height={sparkH} />
      ))}
    </div>
  );
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    const diff = pct(v.hook, v.depth);
    const text = {
      strong: `Your first seconds land ${harder(v.hook, v.depth)} than the rest of the ${noun(ins)}. That’s the moment people decide to keep ${ins.medium === 'audio' ? 'listening' : 'watching'}, so this is a good sign.`,
      steady: 'Your first seconds land about as well as the rest. It won’t lose people at the start, but it isn’t a scroll-stopper either.',
      slow: `Your first seconds land ${Math.abs(diff)}% softer than the rest. People decide fast, so it’s worth leading with something stronger${v.peakContent > 3 ? `, like what’s at ${clock(v.peakContent)}` : ''}.`,
    }[v.hookTag];
    return <div className="answer"><p>{text}</p>{sparks}</div>;
  }
  const [a, b] = ins.videos;
  const better = a.hook >= b.hook ? a : b;
  const worse = better === a ? b : a;
  const diff = pct(better.hook, worse.hook);
  return (
    <div className="answer">
      <p>{diff < 5 ? 'Both openings land about the same.' : `${better.name} has the stronger opening, landing ${harder(better.hook, worse.hook)} in the first seconds.`} {worse.hookTag === 'slow' ? `${worse.name} starts softer than its own average, so its start is the place to work on.` : ''}</p>
      {sparks}
      <AttentionLine ins={ins} upTo={10} height={150} />
    </div>
  );
}

function Drift({ ins }) {
  return (
    <div className="answer">
      {ins.videos.map(v => (
        <div key={v.key} className="answer-block">
          {ins.mode === 'compare' && <p className="answer-name"><i style={{ background: TONE[v.key] }} />{v.name}</p>}
          {v.dips.length
            ? <p>Attention sags at {v.dips.map(span).join(' and ')}. Those are the stretches to tighten, cut or liven up.</p>
            : <p>No real dips. It holds steady all the way through.</p>}
          <AttentionChart series={[{ key: v.key, name: v.name, curve: v.curve }]} bands={v.dips}
            marks={[{ at: v.peakAt, value: v.curve[v.peakAt], label: `Best ${clock(v.peakContent)}`, series: v.key }]} label={`Where attention sags in ${v.name}`} />
          {v.dips[0] && v.detail && (() => {
            // What fell away in the longest dip: the drivers most below their level just before it.
            const d = [...v.dips].sort((x, y) => (y.to - y.from) - (x.to - x.from))[0];
            const before = Math.max(0, d.from - 3);
            const drop = MIX_KEYS.map(k => ({ k, change: avg(v.detail.z[k].slice(d.from, d.to + 1)) - avg(v.detail.z[k].slice(before, d.from)) }))
              .sort((x, y) => x.change - y.change).slice(0, 2);
            return <p className="aside">In {span(d)}, {drop.map(x => MIX[x.k].toLowerCase()).join(' and ')} fall away most.</p>;
          })()}
        </div>
      ))}
    </div>
  );
}
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** What carries it: the share of each driver (donut), and for a comparison, A against B per driver. */
function Working({ ins }) {
  const donut = useSize({ size: 168, thickness: 20 }, { size: 128, thickness: 16 });
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    const [first, second] = v.drivers;
    const positive = v.drivers.filter(d => d.value > 0);
    return (
      <div className="answer">
        <p>Most of the pull comes from <strong>{first.label.toLowerCase()}</strong> ({first.means}) and <strong>{second.label.toLowerCase()}</strong> ({second.means}).</p>
        <div className="donut-wrap">
          <DonutChart data={positive.map(d => ({ key: d.key, label: d.label, value: Math.round(d.value * 1000) / 10 }))}
            label="What drives it" formatValue={x => x.toFixed(0)} totalLabel="Total pull" size={donut.size} thickness={donut.thickness} maxSegments={6} otherLabel="Other" />
        </div>
        <MixStream v={v} />
      </div>
    );
  }
  const rows = [...ins.gaps].sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 6);
  const [a, b] = ins.videos;
  const aWins = rows.filter(r => r.gap > 0).map(r => r.label.toLowerCase());
  const bWins = rows.filter(r => r.gap < 0).map(r => r.label.toLowerCase());
  const list = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
  const winner = ins.videos.find(v => v.key === ins.verdict.winner) ?? a;
  return (
    <div className="answer">
      <p>{aWins.length ? `${a.name} is ahead on ${list(aWins)}.` : ''} {bWins.length ? `${b.name} is ahead on ${list(bWins)}.` : ''}</p>
      <VersusBars rows={rows} names={ins.names} />
      <MixStream v={winner} title={`How ${winner.name}’s pull shifts`} />
    </div>
  );
}

/** The drivers over time as Arc's streamgraph: which ones swell and fade through the video. */
function MixStream({ v, title = 'How the pull shifts over time' }) {
  const streamH = useSize(200, 140);
  if (!v?.detail) return null;
  const { mix, n } = v.detail;
  const floor = Math.min(...MIX_KEYS.flatMap(k => mix[k]));
  const data = Array.from({ length: n }, (_, t) => ({
    key: String(t), label: clock(Math.max(0, t - LAG)),
    axisLabel: t % Math.max(1, Math.round(n / 5)) === 0 ? clock(Math.max(0, t - LAG)) : undefined,
    values: Object.fromEntries(MIX_KEYS.map(k => [k, Math.round((mix[k][t] - floor) * 1000) / 10])),
  }));
  return (
    <div className="answer-block">
      <p className="answer-sub">{title}</p>
      <Streamgraph data={data} series={MIX_KEYS.map(k => ({ key: k, label: MIX[k], color: `var(--drv-${k})` }))}
        label={title} height={streamH} offset="wiggle" categoryLabel="Moment" formatValue={x => x.toFixed(1)} legend directLabels={false} />
    </div>
  );
}

/** Who it lands with: each audience's spread over the video (ridgeline), or A against B per audience (slope). */
function Audience({ ins }) {
  const rowH = useSize(30, 22);
  const slopeH = useSize(220, 160);
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    const d = v.detail;
    const all = d ? COHORTS.flatMap(c => d.audiences[c] ?? []) : [];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    return (
      <div className="answer">
        <p>{v.audienceClear ? `${v.cohorts[0].label} respond best, and ${v.cohorts.at(-1).label} least.` : 'It lands about equally with every age group; no one audience stands out.'}</p>
        <BarList rows={v.cohorts.map(c => ({ key: c.key, label: c.label, value: c.value }))} />
        {d && (
          <div className="answer-block">
            <p className="answer-sub">How steady each audience is, second to second</p>
            <Ridgeline series={COHORTS.filter(c => d.audiences[c]).map(c => ({ id: c, label: COHORT_LABELS[c], values: d.audiences[c].map(x => Math.round((x - lo) / (hi - lo || 1) * 100)) }))}
              label={`Each audience's response across the ${noun(ins)}`} domain={[0, 100]} formatValue={x => `${Math.round(x)}`} rowHeight={rowH} />
          </div>
        )}
      </div>
    );
  }
  const [a, b] = ins.videos;
  const rows = ORDER.filter(k => a.cohorts.some(c => c.key === k)).map(k => ({
    key: k, label: COHORT_LABELS[k],
    start: a.cohorts.find(c => c.key === k)?.value ?? 0,
    end: b.cohorts.find(c => c.key === k)?.value ?? 0,
  }));
  const all = rows.flatMap(r => [r.start, r.end]);
  const lo = Math.min(...all) * 0.9;
  const hi = Math.max(...all);
  const scaled = rows.map(r => ({ ...r, start: Math.round((r.start - lo) / (hi - lo || 1) * 100), end: Math.round((r.end - lo) / (hi - lo || 1) * 100) }));
  const aLeads = rows.filter(r => r.start > r.end).length;
  return (
    <div className="answer">
      <p>{aLeads === rows.length ? `${a.name} wins with every age group.` : aLeads === 0 ? `${b.name} wins with every age group.` : `It splits: ${a.name} wins with ${aLeads} of ${rows.length} age groups.`}</p>
      <SlopeChart data={scaled} label="Each audience, from one version to the other" startLabel={a.name} endLabel={b.name}
        formatValue={x => `${Math.round(x)}`} formatChange={c => `${c > 0 ? '+' : ''}${Math.round(c)}`} height={slopeH} />
    </div>
  );
}

function Fix({ ins }) {
  if (!ins.fixes.length) return <div className="answer"><p>Honestly, not much. It opens well, holds steady and has no weak stretch. Ship it.</p></div>;
  const target = ins.mode === 'compare' ? ins.videos.find(v => v.key !== ins.verdict.winner) ?? ins.videos[1] : null;
  return (
    <div className="answer">
      <p>{target ? `To make ${target.name} stronger:` : 'If you edit it again, here’s where I’d start:'}</p>
      <ol className="fixes">{ins.fixes.map((f, i) => <li key={i}>{f}</li>)}</ol>
    </div>
  );
}

function How({ ins }) {
  return (
    <div className="answer">
      <p>When you send a video or audio file, I {ins?.medium === 'audio' ? 'play' : 'show'} it to {ins ? ins.viewers.toLocaleString('en') : 'hundreds of'} simulated viewers across four age groups (kids, Gen Z, adults and 55+) and predict, second by second, how strongly each moment lands with them.</p>
      <p>The verdict comes from comparing those reactions: moment against moment, audience against audience, and one version against the other. It’s a prediction, so treat it as a sharp second opinion rather than a guarantee.</p>
    </div>
  );
}

/** How the pull shifts over time, on its own: the streamgraph for each video. */
function Shift({ ins }) {
  return (
    <div className="answer">
      <p>Here’s which drivers swell and fade as the {noun(ins)} plays. Hover a band to see it at each moment.</p>
      {ins.videos.map(v => <MixStream key={v.key} v={v} title={ins.mode === 'compare' ? v.name : `Through the ${noun(ins)}`} />)}
    </div>
  );
}

export const ANSWERS = { opening: Opening, drift: Drift, working: Working, audience: Audience, shift: Shift, fix: Fix, how: How };
