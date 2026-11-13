/**
 * The report: one analysis as a standalone page (HTML with inline SVG charts and its own styles), opened in a new
 * tab with Print / Save as PDF and Download. Laid out for A4, so printing gives a clean PDF. Worded like the chat:
 * a simulated audience, attention and drivers, nothing about the systems underneath.
 */
import { analysisFacts, fileSafe, scaledCurves, TONE } from './facts';
import { clock, contentTime } from './insights';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PEEK = `<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><path d="M40 15 45 6" stroke="#2a2633" stroke-width="3.5" stroke-linecap="round"/><circle cx="45.5" cy="5.5" r="3.5" fill="#e8642c"/><rect x="17" y="49" width="7" height="11" rx="3.5" fill="#2a2633"/><rect x="40" y="49" width="7" height="11" rx="3.5" fill="#2a2633"/><rect x="5" y="14" width="54" height="40" rx="13" fill="#e9946b"/><rect x="12" y="20" width="40" height="28" rx="8" fill="#182326"/><rect x="21" y="27" width="6" height="10" rx="2" fill="#bff3e0"/><rect x="37" y="27" width="6" height="10" rx="2" fill="#bff3e0"/></svg>`;

/** Attention over time: each video's curve on one scale, dips shaded, the best moment marked, a time axis. */
function attentionSvg(ins) {
  const curves = scaledCurves(ins);
  const n = Math.max(...curves.map(c => c.values.length));
  const W = 680; const H = 220; const L = 34; const R = 10; const T = 12; const B = 28;
  const x = i => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const y = v => T + (1 - v / 100) * (H - T - B);
  const parts = [];
  for (const g of [0, 25, 50, 75, 100]) {
    parts.push(`<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" stroke="#e7e2da"/><text x="${L - 6}" y="${y(g) + 4}" text-anchor="end" class="ax">${g}</text>`);
  }
  const ticks = 5;
  for (let k = 0; k <= ticks; k++) {
    const i = Math.round((k / ticks) * (n - 1));
    parts.push(`<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ax">${clock(contentTime(i))}</text>`);
  }
  if (curves.length === 1) {
    for (const d of curves[0].dips) parts.push(`<rect x="${x(d.from)}" y="${T}" width="${Math.max(4, x(d.to) - x(d.from))}" height="${H - T - B}" fill="#8a847b" opacity=".12" rx="4"/>`);
  }
  for (const c of curves) {
    const tone = TONE[c.key] ?? TONE.A;
    const pts = c.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    if (curves.length === 1) parts.push(`<polygon points="${x(0)},${y(0)} ${pts} ${x(c.values.length - 1)},${y(0)}" fill="${tone}" opacity=".12"/>`);
    parts.push(`<polyline points="${pts}" fill="none" stroke="${tone}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
    parts.push(`<circle cx="${x(c.peakAt)}" cy="${y(c.values[c.peakAt] ?? 0)}" r="5" fill="#fff" stroke="${tone}" stroke-width="2.5"/>`);
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Attention over time">${parts.join('')}</svg>`;
}

/** Horizontal bars, scaled to the largest value; one colour per series. */
function bars(rows, series) {
  const max = Math.max(...rows.flatMap(r => series.map(s => Math.abs(r.values[s.key] ?? 0))), 1e-9);
  return `<div class="bars">${rows.map(r => `
    <div class="bar-row"><span class="bar-label">${esc(r.label)}</span><span class="bar-tracks">${series.map(s => `
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, (Math.max(0, r.values[s.key] ?? 0) / max) * 100).toFixed(1)}%;background:${s.color}"></span></span>`).join('')}
    </span></div>`).join('')}</div>`;
}

export function buildReport(ins) {
  const f = analysisFacts(ins);
  const compare = f.mode === 'compare';
  const series = ins.videos.map(v => ({ key: v.key, name: v.name, color: TONE[v.key] ?? TONE.A }));
  const date = new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
  const legend = compare ? `<p class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</p>` : '';

  const driverRows = ins.videos[0].drivers.map(d => ({
    label: d.label,
    values: Object.fromEntries(ins.videos.map(v => [v.key, v.drivers.find(x => x.key === d.key)?.value ?? 0])),
  }));
  const cohortRows = ins.videos[0].cohorts.map(c => ({
    label: c.label,
    values: Object.fromEntries(ins.videos.map(v => [v.key, v.cohorts.find(x => x.key === c.key)?.value ?? 0])),
  }));

  const numbers = compare
    ? [['Winner', f.winner?.name ?? 'Too close to call'], ['Lead', f.winner ? `${f.lead}% stronger` : '—'], ['Audiences won', f.winner ? `${f.audiencesWon} of 4` : '—']]
    : [['Lands strongly', f.videos[0].hold != null ? `${f.videos[0].hold}% of the video` : '—'], ['Best moment', f.videos[0].best], ['Opening', `${f.videos[0].opening} (${f.videos[0].openingVs >= 0 ? '+' : ''}${f.videos[0].openingVs}% vs the rest)`]];

  const perVideo = f.videos.map(v => `
    <section class="video">
      <h3>${compare ? `<i style="background:${TONE[v.key]}"></i>` : ''}${esc(v.name)}</h3>
      <dl>
        <dt>Length</dt><dd>${clock(v.seconds)}</dd>
        <dt>Opening</dt><dd>${esc(v.opening)}, ${v.openingVs >= 0 ? '+' : ''}${v.openingVs}% against the rest</dd>
        <dt>Best moment</dt><dd>${v.best}</dd>
        ${v.hold != null ? `<dt>Lands strongly</dt><dd>${v.hold}% of the video</dd>` : ''}
        <dt>Biggest strengths</dt><dd>${esc(v.strengths.join(' and '))}</dd>
        <dt>Responds best</dt><dd>${esc(v.topAudience ?? 'About equal across ages')}</dd>
        <dt>Where attention sags</dt><dd>${v.dips.length ? esc(v.dips.join(', ')) : 'No real dips'}</dd>
      </dl>
    </section>`).join('');

  const title = `${f.title} · Rewire report`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root { --ink:#151412; --ink2:#4d4943; --ink3:#8a847b; --line:#e7e2da; --soft:#f6f3ee; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ece7df; color: var(--ink); font: 14px/1.5 Inter, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; justify-content: center; padding: 10px; background: rgb(236 231 223 / .9); backdrop-filter: blur(8px); }
  .bar button, .bar a { font: 600 13px Inter, sans-serif; padding: 9px 16px; border-radius: 99px; border: 1px solid rgb(19 19 18 / .14); background: #fff; color: var(--ink); text-decoration: none; cursor: pointer; }
  .bar button.primary { background: var(--ink); color: #fff; border-color: transparent; }
  .page { width: min(210mm, 100%); margin: 16px auto 40px; padding: 18mm 16mm; background: #fff; box-shadow: 0 10px 40px -20px rgb(0 0 0 / .3); }
  header.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
  .brand { display: flex; align-items: center; gap: 8px; font: 700 20px 'Inter Tight', Inter, sans-serif; }
  .meta { text-align: right; font-size: 12px; color: var(--ink3); }
  .hero { margin: 22px 0 6px; padding: 20px 22px; border-radius: 16px; background: linear-gradient(178deg, #b4ddd2, #d5dcc3 30%, #efd3a2 62%, #ebbf9a 82%, #d8b3b5); }
  .kicker { margin: 0; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); }
  h1 { margin: 6px 0 4px; font: 700 30px/1.08 'Inter Tight', Inter, sans-serif; letter-spacing: -.03em; }
  .hero p.sub { margin: 6px 0 0; color: var(--ink2); font-size: 14.5px; }
  h2 { margin: 26px 0 10px; font: 700 17px 'Inter Tight', Inter, sans-serif; letter-spacing: -.01em; }
  .numbers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
  .num { padding: 12px 14px; border-radius: 12px; background: var(--soft); }
  .num span { display: block; font-size: 11.5px; color: var(--ink3); }
  .num strong { display: block; margin-top: 2px; font: 700 18px/1.2 'Inter Tight', Inter, sans-serif; }
  .chart { width: 100%; height: auto; display: block; }
  .chart .ax { font: 10px Inter, sans-serif; fill: var(--ink3); }
  .legend { display: flex; gap: 16px; margin: 0 0 6px; font-size: 12px; color: var(--ink2); }
  .legend i, .video h3 i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  .note { margin: 6px 0 0; font-size: 12px; color: var(--ink3); }
  .videos { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .video { padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; break-inside: avoid; }
  .video h3 { margin: 0 0 8px; font: 700 15px 'Inter Tight', Inter, sans-serif; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 5px 14px; margin: 0; font-size: 13px; }
  dt { color: var(--ink3); } dd { margin: 0; }
  .bars { display: grid; gap: 7px; }
  .bar-row { display: grid; grid-template-columns: 110px 1fr; gap: 10px; align-items: center; font-size: 13px; }
  .bar-label { color: var(--ink2); }
  .bar-tracks { display: grid; gap: 3px; }
  .bar-track { height: 9px; border-radius: 99px; background: var(--soft); overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 99px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  ol.fixes { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
  footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--ink3); }
  section, .cols > div { break-inside: avoid; }
  @page { size: A4; margin: 12mm; }
  @media print { body { background: #fff; } .bar { display: none; } .page { width: auto; margin: 0; padding: 0; box-shadow: none; } }
  @media (max-width: 640px) { .page { padding: 20px 16px; margin: 0; } .numbers, .cols { grid-template-columns: 1fr; } }
</style></head>
<body>
<div class="bar"><button class="primary" onclick="window.print()">Print or save as PDF</button><a id="dl" download="${esc(fileSafe(title))}.html">Download</a></div>
<main class="page">
  <header class="top">
    <span class="brand">${PEEK}rewire</span>
    <span class="meta">${esc(f.title)}<br>${date}</span>
  </header>

  <div class="hero">
    <p class="kicker">Verdict · ${f.viewers.toLocaleString('en')} simulated viewers${compare ? ' each' : ''}</p>
    <h1>${esc(f.headline)}</h1>
    ${f.sub ? `<p class="sub">${esc(f.sub)}</p>` : ''}
  </div>
  <div class="numbers">${numbers.map(([k, v]) => `<div class="num"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>

  <h2>Attention, second by second</h2>
  ${legend}
  ${attentionSvg(ins)}
  <p class="note">0 is the weakest second${compare ? ' of either video' : ''} and 100 the strongest; the dot marks the best moment${compare ? '' : ', grey bands are dips'}.</p>
  ${ins.lengthNote ? `<p class="note">${esc(ins.lengthNote)}</p>` : ''}

  <h2>${compare ? 'Each video' : 'The video'}</h2>
  <div class="videos">${perVideo}</div>

  <div class="cols">
    <div><h2>What drives it</h2>${legend}${bars(driverRows, series)}</div>
    <div><h2>Who responds</h2>${legend}${bars(cohortRows, series)}</div>
  </div>

  ${f.fixes.length ? `<h2>What to change${f.fixesFor ? ` in ${esc(f.fixesFor)}` : ''}</h2><ol class="fixes">${f.fixes.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}

  <footer>
    Rewire showed ${compare ? 'each video' : 'this video'} to ${f.viewers.toLocaleString('en')} simulated viewers across four age groups (Kids, Gen Z, Adults and 55+) and measured their response second by second.
    The numbers are relative: ${compare ? 'one video against the other' : 'each moment against the rest of the video'}. Use them to compare cuts and find what to change, not as a forecast of views.
  </footer>
</main>
<script>document.getElementById('dl').href = location.href;</script>
</body></html>`;
}

/** Opens the report in a new tab. Call it straight from a click, so the browser allows the new tab. */
export function openReport(ins) {
  const blob = new Blob([buildReport(ins)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  if (!tab) {
    // A blocked pop-up: download it instead.
    const a = document.createElement('a');
    a.href = url; a.download = `${fileSafe(`${analysisFacts(ins).title} · Rewire report`)}.html`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  // In a new tab the link stays alive: the tab's own Download button points at it.
}
