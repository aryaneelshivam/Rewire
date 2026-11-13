import React, { useId, useState } from 'react';
import { clock } from './insights';

/**
 * Minimal charts for the chat: an attention line, plain bars and A-versus-B bars. No axes or numbers that only make
 * sense to an analyst; the time along the bottom and words do the explaining.
 */

const W = 560;
const H = 150;
const PAD = { l: 6, r: 6, t: 26, b: 22 };

/**
 * Attention over the video, second by second: one line, or two for a comparison. `marks` adds labelled points
 * ({ at, label }), `bands` shades stretches ({ from, to }), `upTo` crops to the first seconds.
 */
export function AttentionChart({ series, marks = [], bands = [], upTo, label = 'Attention over time' }) {
  const id = useId();
  const [hover, setHover] = useState(null);
  const lengths = series.map(s => (upTo ? Math.min(upTo, s.curve.length) : s.curve.length));
  const n = Math.max(2, ...lengths);
  const all = series.flatMap((s, i) => s.curve.slice(0, lengths[i]));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const x = t => PAD.l + (t / (n - 1)) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const path = (curve, len) => curve.slice(0, len).map((v, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');

  const onMove = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = Math.round(((e.clientX - box.left) / box.width * W - PAD.l) / (W - PAD.l - PAD.r) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, t)));
  };

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`${id}-g${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={`var(--series-${s.key})`} stopOpacity={series.length > 1 ? 0.14 : 0.24} />
              <stop offset="1" stopColor={`var(--series-${s.key})`} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {bands.map((b, i) => (
          <rect key={i} className="chart-band" x={x(b.from)} y={PAD.t - 6} width={Math.max(4, x(b.to) - x(b.from))} height={H - PAD.t - PAD.b + 6} rx="6" />
        ))}
        <line className="chart-base" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        {series.map((s, i) => (
          <g key={s.key}>
            <path d={`${path(s.curve, lengths[i])}L${x(lengths[i] - 1)},${H - PAD.b}L${x(0)},${H - PAD.b}Z`} fill={`url(#${id}-g${i})`} />
            <path d={path(s.curve, lengths[i])} className="chart-line" stroke={`var(--series-${s.key})`} />
          </g>
        ))}
        {marks.map((m, i) => (
          <g key={i} className="chart-mark">
            <circle cx={x(m.at)} cy={y(m.value)} r="5" fill={`var(--series-${m.series ?? 'A'})`} />
            <text x={Math.min(W - 40, Math.max(30, x(m.at)))} y={Math.max(12, y(m.value) - 11)} textAnchor="middle">{m.label}</text>
          </g>
        ))}
        {hover != null && <line className="chart-hover" x1={x(hover)} x2={x(hover)} y1={PAD.t - 6} y2={H - PAD.b} />}
        <text className="chart-tick" x={PAD.l} y={H - 5}>0:00</text>
        <text className="chart-tick" x={W - PAD.r} y={H - 5} textAnchor="end">{hover != null ? clock(hover) : clock(n - 1)}</text>
      </svg>
      {series.length > 1 && (
        <figcaption className="chart-legend">
          {series.map(s => <span key={s.key}><i style={{ background: `var(--series-${s.key})` }} />{s.name}</span>)}
        </figcaption>
      )}
    </figure>
  );
}

/** Labelled bars, longest first, scaled to the largest. `note` shows on the right of a row. */
export function BarList({ rows, tone = 'A' }) {
  const top = Math.max(...rows.map(r => Math.max(0, r.value)), 1e-9);
  return (
    <ul className="bars">
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className="bars-label">{r.label}</span>
          <span className="bars-track"><span className="bars-fill" style={{ width: `${Math.max(3, Math.max(0, r.value) / top * 100)}%`, background: `var(--series-${r.tone ?? tone})`, animationDelay: `${i * 60}ms` }} /></span>
          {r.note && <span className="bars-note">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** A against B per driver: bars grow left for B and right for A from a shared middle. */
export function VersusBars({ rows, names }) {
  const top = Math.max(...rows.map(r => Math.abs(r.gap)), 1e-9);
  return (
    <div className="versus">
      <div className="versus-head"><span>{names.B} ahead</span><span>{names.A} ahead</span></div>
      <ul>
        {rows.map((r, i) => {
          const w = Math.abs(r.gap) / top * 50;
          return (
            <li key={r.key}>
              <span className="versus-label">{r.label}</span>
              <span className="versus-track">
                <span className="versus-mid" />
                <span className="versus-fill" style={{ width: `${w}%`, [r.gap >= 0 ? 'left' : 'right']: '50%', background: `var(--series-${r.gap >= 0 ? 'A' : 'B'})`, animationDelay: `${i * 60}ms` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
