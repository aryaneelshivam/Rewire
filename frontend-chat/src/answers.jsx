import React from 'react';
import { AttentionChart, BarList, VersusBars } from './charts';
import { clock, COHORT_LABELS } from './insights';

/** The bot's replies about a finished analysis: the verdict, then one answer per follow-up topic. */

const LAG = 2;
const peakMark = v => ({ at: v.peakAt, value: v.curve[v.peakAt], label: `Best ${clock(v.peakContent)}`, series: v.key });
const series = ins => ins.videos.map(v => ({ key: v.key, name: v.name, curve: v.curve }));
const pct = (a, b) => Math.round((a / (b || 1e-9) - 1) * 100);
/** "40% harder", or "2.6× harder" once it's more than double. */
const harder = (a, b) => (a >= 2 * b && b > 0 ? `${(a / b).toFixed(1)}× harder` : `${pct(a, b)}% harder`);
const ORDER = ['kids', 'genz', 'adults', 'older'];
const span = d => `${clock(Math.max(0, d.from - LAG))}–${clock(Math.max(0, d.to - LAG))}`;

function Stat({ label, value, tone }) {
  return <div className="stat" data-tone={tone}><span className="stat-label">{label}</span><span className="stat-value">{value}</span></div>;
}

const OPENING = { strong: 'Strong', steady: 'Steady', slow: 'Slow' };
const holdText = h => (h == null ? '—' : `${Math.round(h * 100)}% of it`);

export function Verdict({ ins }) {
  const { verdict } = ins;
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    return (
      <div className="answer">
        <p className="verdict-kicker">Verdict · {ins.viewers.toLocaleString('en')} viewers</p>
        <h2 className="verdict-head">{verdict.headline}</h2>
        <p>{verdict.sub}</p>
        <AttentionChart series={series(ins)} marks={[peakMark(v)]} bands={v.dips} />
        <div className="stats">
          <Stat label="Opening" value={OPENING[v.hookTag]} />
          <Stat label="Best moment" value={clock(v.peakContent)} />
          <Stat label="Lands strongly" value={holdText(v.hold)} />
        </div>
      </div>
    );
  }
  const winner = ins.videos.find(v => v.key === verdict.winner);
  return (
    <div className="answer">
      <p className="verdict-kicker">Verdict · {ins.viewers.toLocaleString('en')} viewers each</p>
      <h2 className="verdict-head">
        {winner && <span className="winner-dot" style={{ background: `var(--c-series-${winner.key})` }} aria-hidden="true" />}
        {verdict.headline}
      </h2>
      {verdict.sub && <p>{verdict.sub}</p>}
      <AttentionChart series={series(ins)} marks={ins.videos.map(peakMark)} />
      <table className="versus-table">
        <thead>
          <tr><th scope="col"><span className="sr-only">Measure</span></th>{ins.videos.map(v => <th key={v.key} scope="col"><span className="stats-name"><i style={{ background: `var(--c-series-${v.key})` }} />{v.name}</span></th>)}</tr>
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

function Opening({ ins }) {
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    const diff = pct(v.hook, v.depth);
    const text = {
      strong: `Your first seconds land ${harder(v.hook, v.depth)} than the rest of the video. That’s the moment people decide to keep watching, so this is a good sign.`,
      steady: 'Your first seconds land about as well as the rest. It won’t lose people at the start, but it isn’t a scroll-stopper either.',
      slow: `Your first seconds land ${Math.abs(diff)}% softer than the rest. People decide fast, so it’s worth leading with something stronger${v.peakContent > 3 ? `, like what’s at ${clock(v.peakContent)}` : ''}.`,
    }[v.hookTag];
    return <div className="answer"><p>{text}</p><AttentionChart series={series(ins)} upTo={8} label="The first seconds" /></div>;
  }
  const [a, b] = ins.videos;
  const better = a.hook >= b.hook ? a : b;
  const worse = better === a ? b : a;
  const diff = pct(better.hook, worse.hook);
  return (
    <div className="answer">
      <p>{diff < 5 ? 'Both openings land about the same.' : `${better.name} has the stronger opening, landing ${harder(better.hook, worse.hook)} in the first seconds.`} {worse.hookTag === 'slow' ? `${worse.name} starts softer than its own average, so its start is the place to work on.` : ''}</p>
      <AttentionChart series={series(ins)} upTo={8} label="The first seconds" />
    </div>
  );
}

function Drift({ ins }) {
  return (
    <div className="answer">
      {ins.videos.map(v => (
        <div key={v.key} className="answer-block">
          {ins.mode === 'compare' && <p className="answer-name"><i style={{ background: `var(--c-series-${v.key})` }} />{v.name}</p>}
          {v.dips.length
            ? <p>Attention sags at {v.dips.map(span).join(' and ')}. Those are the stretches to tighten, cut or liven up.</p>
            : <p>No real dips. It holds steady all the way through.</p>}
          <AttentionChart series={[{ key: v.key, name: v.name, curve: v.curve }]} bands={v.dips} label={`Where attention sags in ${v.name}`} />
        </div>
      ))}
    </div>
  );
}

function Working({ ins }) {
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    const [first, second] = v.drivers;
    return (
      <div className="answer">
        <p>Most of the pull comes from <strong>{first.label.toLowerCase()}</strong> ({first.means}) and <strong>{second.label.toLowerCase()}</strong> ({second.means}).</p>
        <BarList rows={v.drivers.slice(0, 6).map(d => ({ key: d.key, label: d.label, value: d.value }))} />
      </div>
    );
  }
  const rows = [...ins.gaps].sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 6);
  const [a, b] = ins.videos;
  const aWins = rows.filter(r => r.gap > 0).map(r => r.label.toLowerCase());
  const bWins = rows.filter(r => r.gap < 0).map(r => r.label.toLowerCase());
  const list = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
  return (
    <div className="answer">
      <p>{aWins.length ? `${a.name} is ahead on ${list(aWins)}.` : ''} {bWins.length ? `${b.name} is ahead on ${list(bWins)}.` : ''}</p>
      <VersusBars rows={rows} names={ins.names} />
    </div>
  );
}

function Audience({ ins }) {
  if (ins.mode === 'single') {
    const v = ins.videos[0];
    return (
      <div className="answer">
        <p>{v.audienceClear ? `${v.cohorts[0].label} respond best, and ${v.cohorts.at(-1).label} least.` : 'It lands about equally with every age group; no one audience stands out.'}</p>
        <BarList rows={v.cohorts.map(c => ({ key: c.key, label: c.label, value: c.value }))} />
      </div>
    );
  }
  const [a, b] = ins.videos;
  const rows = ORDER.filter(k => a.cohorts.some(c => c.key === k)).map(k => {
    const va = a.cohorts.find(c => c.key === k)?.value ?? 0;
    const vb = b.cohorts.find(c => c.key === k)?.value ?? 0;
    return { key: k, va, vb };
  });
  const top = Math.max(...rows.flatMap(r => [r.va, r.vb]), 1e-9);
  const aLeads = rows.filter(r => r.va > r.vb).length;
  return (
    <div className="answer">
      <p>{aLeads === rows.length ? `${a.name} wins with every age group.` : aLeads === 0 ? `${b.name} wins with every age group.` : `It splits: ${a.name} wins with ${aLeads} of ${rows.length} age groups.`}</p>
      <ul className="pairs">
        {rows.map(r => (
          <li key={r.key}>
            <span className="bars-label">{COHORT_LABELS[r.key]}</span>
            <span className="pairs-bars">
              <span className="bars-track"><span className="bars-fill" style={{ width: `${Math.max(3, r.va / top * 100)}%`, background: 'var(--c-series-A)' }} /></span>
              <span className="bars-track"><span className="bars-fill" style={{ width: `${Math.max(3, r.vb / top * 100)}%`, background: 'var(--c-series-B)' }} /></span>
            </span>
          </li>
        ))}
      </ul>
      <p className="chart-legend"><span><i style={{ background: 'var(--c-series-A)' }} />{a.name}</span><span><i style={{ background: 'var(--c-series-B)' }} />{b.name}</span></p>
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
      <p>When you send a video, I show it to {ins ? ins.viewers.toLocaleString('en') : 'hundreds of'} simulated viewers across four age groups (kids, Gen Z, adults and 55+) and predict, second by second, how strongly each moment lands with them.</p>
      <p>The verdict comes from comparing those reactions: moment against moment, audience against audience, and one version against the other. It’s a prediction, so treat it as a sharp second opinion rather than a guarantee.</p>
    </div>
  );
}

export const ANSWERS = { opening: Opening, drift: Drift, working: Working, audience: Audience, fix: Fix, how: How };
