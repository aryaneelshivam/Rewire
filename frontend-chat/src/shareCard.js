/**
 * The share card: one analysis as a 1080×1350 PNG (4:5, the size feeds show whole), drawn on a canvas so it needs
 * no library and nothing from another site (which would block exporting it). Aura gradient, Peek, the verdict, three
 * numbers and the attention curve.
 */
import { analysisFacts, scaledCurves, TONE } from './facts';

const W = 1080;
const H = 1350;
const PAD = 72;
const INK = '#151412';
const INK2 = '#4d4943';
const INK3 = '#8a847b';
const DISPLAY = '"Inter Tight", Inter, system-ui, sans-serif';
const BODY = 'Inter, system-ui, sans-serif';

const PEEK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M40 15 45 6" stroke="#2a2633" stroke-width="3.5" stroke-linecap="round"/><circle cx="45.5" cy="5.5" r="3.5" fill="#e8642c"/><rect x="17" y="49" width="7" height="11" rx="3.5" fill="#2a2633"/><rect x="40" y="49" width="7" height="11" rx="3.5" fill="#2a2633"/><rect x="5" y="14" width="54" height="40" rx="13" fill="#e9946b"/><rect x="12" y="20" width="40" height="28" rx="8" fill="#182326"/><rect x="21" y="27" width="6" height="10" rx="2" fill="#bff3e0"/><rect x="37" y="27" width="6" height="10" rx="2" fill="#bff3e0"/></svg>`;

const loadImage = src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });

/** Breaks text into lines that fit `width`, at most `max` lines (the last one ellipsed if it had to be cut). */
function wrap(ctx, text, width, max) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    let last = kept[max - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.replace(/\s*\S+$/, '');
    kept[max - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function stat(ctx, x, y, w, label, value, note) {
  ctx.fillStyle = '#f6f3ee';
  roundRect(ctx, x, y, w, 150, 26); ctx.fill();
  ctx.fillStyle = INK3; ctx.font = `500 24px ${BODY}`;
  ctx.fillText(label, x + 26, y + 46);
  ctx.fillStyle = INK; ctx.font = `700 52px ${DISPLAY}`;
  let v = value;
  while (ctx.measureText(v).width > w - 52 && v.length > 2) v = `${v.slice(0, -2)}…`;
  ctx.fillText(v, x + 26, y + 104);
  if (note) { ctx.fillStyle = INK3; ctx.font = `400 21px ${BODY}`; ctx.fillText(note, x + 26, y + 134); }
}

function chart(ctx, ins, x, y, w, h) {
  const curves = scaledCurves(ins);
  const n = Math.max(...curves.map(c => c.values.length));
  const px = i => x + (i / Math.max(1, n - 1)) * w;
  const py = v => y + h - (v / 100) * h;
  // Light guides at 0, 50 and 100.
  ctx.strokeStyle = 'rgba(19,19,18,.08)'; ctx.lineWidth = 2;
  for (const g of [0, 50, 100]) { ctx.beginPath(); ctx.moveTo(x, py(g)); ctx.lineTo(x + w, py(g)); ctx.stroke(); }
  for (const c of curves) {
    const tone = TONE[c.key] ?? TONE.A;
    ctx.beginPath();
    c.values.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    if (curves.length === 1) {
      ctx.save();
      ctx.lineTo(px(c.values.length - 1), y + h); ctx.lineTo(px(0), y + h); ctx.closePath();
      const fill = ctx.createLinearGradient(0, y, 0, y + h);
      fill.addColorStop(0, `${tone}55`); fill.addColorStop(1, `${tone}05`);
      ctx.fillStyle = fill; ctx.fill(); ctx.restore();
      ctx.beginPath();
      c.values.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    }
    ctx.strokeStyle = tone; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    // The best moment.
    const pv = c.values[c.peakAt] ?? 0;
    ctx.beginPath(); ctx.arc(px(c.peakAt), py(pv), 11, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = tone; ctx.stroke();
  }
}

/** Draws the card for an analysis and returns it as a PNG blob. */
export async function renderShareCard(ins) {
  const f = analysisFacts(ins);
  await Promise.all([`700 76px ${DISPLAY}`, `500 24px ${BODY}`, `600 30px ${BODY}`].map(font => document.fonts?.load(font).catch(() => {})));
  const peek = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(PEEK_SVG)}`);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // The Aura gradient.
  const bg = ctx.createLinearGradient(0, 0, W * 0.035, H);
  [['#b4ddd2', 0], ['#d5dcc3', 0.28], ['#efd3a2', 0.58], ['#ebbf9a', 0.78], ['#d8b3b5', 1]].forEach(([c, s]) => bg.addColorStop(s, c));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Brand.
  ctx.drawImage(peek, PAD, PAD - 6, 76, 76);
  ctx.fillStyle = INK; ctx.font = `700 38px ${DISPLAY}`;
  ctx.fillText('rewire', PAD + 92, PAD + 46);
  ctx.textAlign = 'right'; ctx.fillStyle = INK2; ctx.font = `500 24px ${BODY}`;
  ctx.fillText(`${f.viewers.toLocaleString('en')} simulated viewers`, W - PAD, PAD + 44);
  ctx.textAlign = 'left';

  // The title and the verdict.
  let y = 236;
  ctx.fillStyle = INK2; ctx.font = `600 30px ${BODY}`;
  ctx.fillText(wrap(ctx, f.title, W - PAD * 2, 1)[0], PAD, y);
  y += 30;
  ctx.fillStyle = INK; ctx.font = `700 76px ${DISPLAY}`;
  const lines = wrap(ctx, f.headline, W - PAD * 2, 4);
  for (const line of lines) { y += 82; ctx.fillText(line, PAD, y); }

  // The panel: three numbers and the curve.
  const top = Math.max(y + 56, 640);
  const panelH = H - top - 150;
  ctx.save();
  ctx.shadowColor = 'rgba(80,50,20,.18)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#ffffff'; roundRect(ctx, PAD - 16, top, W - (PAD - 16) * 2, panelH, 44); ctx.fill();
  ctx.restore();

  const inner = PAD + 14;
  const tileW = (W - inner * 2 - 2 * 18) / 3;
  const ty = top + 34;
  if (f.mode === 'compare') {
    stat(ctx, inner, ty, tileW, 'Winner', f.winner?.name ?? 'Too close', f.winner ? null : 'to call');
    stat(ctx, inner + tileW + 18, ty, tileW, 'Lead', f.winner ? `${f.lead}%` : '—', f.winner ? 'stronger overall' : null);
    stat(ctx, inner + (tileW + 18) * 2, ty, tileW, 'Audiences won', f.winner ? `${f.audiencesWon}/4` : '—', f.winner ? 'age groups' : null);
  } else {
    const v = f.videos[0];
    stat(ctx, inner, ty, tileW, 'Lands strongly', v.hold != null ? `${v.hold}%` : '—', 'of the video');
    stat(ctx, inner + tileW + 18, ty, tileW, 'Best moment', v.best, 'into the video');
    stat(ctx, inner + (tileW + 18) * 2, ty, tileW, 'Opening', v.opening, `${v.openingVs >= 0 ? '+' : ''}${v.openingVs}% vs the rest`);
  }

  const cy = ty + 150 + 46;
  ctx.fillStyle = INK3; ctx.font = `500 24px ${BODY}`;
  ctx.fillText('Attention, second by second', inner, cy);
  if (f.mode === 'compare') {
    ctx.textAlign = 'right';
    let lx = W - inner;
    for (const v of [...f.videos].reverse()) {
      const label = v.name.length > 14 ? `${v.name.slice(0, 13)}…` : v.name;
      ctx.fillStyle = INK2; ctx.fillText(label, lx, cy);
      lx -= ctx.measureText(label).width + 12;
      ctx.fillStyle = TONE[v.key]; ctx.fillRect(lx - 22, cy - 11, 22, 6);
      lx -= 44;
    }
    ctx.textAlign = 'left';
  }
  const chartTop = cy + 30;
  chart(ctx, ins, inner, chartTop, W - inner * 2, top + panelH - chartTop - 40);

  // Footer.
  ctx.fillStyle = INK2; ctx.font = `500 24px ${BODY}`;
  ctx.fillText('Tested on a simulated audience with Rewire', PAD, H - 64);
  ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `600 24px ${BODY}`;
  ctx.fillText(window.location.host || 'rewire', W - PAD, H - 64);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the card'))), 'image/png'));
}
