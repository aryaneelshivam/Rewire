import React, { forwardRef } from 'react';
import { Sparkline } from '@/components/arc/sparkline/sparkline';
import { Progress } from '@/components/arc/progress/progress';
import { Badge } from '@/components/arc/badge/badge';
import { Streamgraph } from '@/components/arc/streamgraph/streamgraph';
import { WaffleChart } from '@/components/arc/waffle-chart/waffle-chart';
import { clock, CARD_FORMATS, TILES, tilesFor } from '@/lib/scorecard';

// Tile geometry per size, in CSS pixels: the grid's columns, and each tile's height.
const TILE_GRID = {
  portrait: { columns: 2, height: 132 },
  square: { columns: 2, height: 140 },
  story: { columns: 2, height: 158 },
  link: { columns: 1, height: 118 },
};
const LABEL_H = 16, TILE_PAD = 10;

function Thumb({ variant, frame, tag, winner }) {
  return (
    <figure className="sc-thumb">
      {frame ? <img src={frame} alt="" /> : <span className="sc-thumb-empty">{variant.name}</span>}
      {(tag || winner) && (
        <figcaption>
          {tag && <span className={`sc-tag sc-tag-${variant.key.toLowerCase()}`}>{tag}</span>}
          {winner && <Badge size="sm" tone="success">Winner</Badge>}
        </figcaption>
      )}
    </figure>
  );
}

function Bars({ items }) {
  return (
    <div className="sc-measures">
      {items.map(m => (
        <div key={m.key} className="sc-measure">
          <p className="sc-label"><span>{m.label}</span>{m.value != null && <strong>{m.value}</strong>}</p>
          <Progress value={m.percent} label={m.aria} />
        </div>
      ))}
    </div>
  );
}

/* ── Tiles: one mini visual each, sized to the slot they are given ─────────────────────────────────────── */

function CurveTile({ card, w, h }) {
  const shown = card.compare ? card.variants : card.variants.slice(0, 1);
  const each = card.compare ? Math.floor((h - 6) / 2) : h;
  return (
    <div className="sc-tile-stack">
      {shown.map(v => (
        <div key={v.key} className={`sc-spark ${card.compare ? `sc-curve-${v.key.toLowerCase()}` : ''}`}>
          {card.compare && <span className={`sc-mini-tag sc-tag-${v.key.toLowerCase()}`}>{v.key}</span>}
          <Sparkline data={v.curve} label={`Variant ${v.key} response over ${v.seconds} seconds`} width={card.compare ? w - 22 : w} height={each} interactive={false} area />
        </div>
      ))}
    </div>
  );
}

function BrainTile({ image, h }) {
  return image ? <img className="sc-brain" src={image} alt="" style={{ height: h }} /> : null;
}

function NetworksTile({ variant, h }) {
  const flow = variant.networks;
  return (
    <div className="sc-stream">
      <Streamgraph data={flow.data} series={flow.series} label="Brain networks over time" height={h - 28} legend={false} directLabels offset="silhouette" />
    </div>
  );
}

function MapTile({ card, w, h }) {
  const rows = card.compare ? card.map : card.variants[0].grid;
  const max = card.compare ? 1 : Math.max(...rows.flat(), 1e-6);
  const labelW = 46;
  const cell = Math.min((w - labelW) / 8, (h - 14) / rows.length) - 3;
  return (
    <div className="sc-map" style={{ '--cell': `${cell}px`, '--label-w': `${labelW}px` }}>
      {rows.map((row, r) => (
        <div key={r} className="sc-map-row">
          <span>{card.cohortLabels[r]}</span>
          {row.map((v, c) => card.compare
            ? <i key={c} className={`sc-cell sc-cell-${String(v).toLowerCase()}`} />
            : <i key={c} className="sc-cell sc-cell-a" style={{ opacity: 0.15 + 0.85 * Math.max(0, v) / max }} />)}
        </div>
      ))}
      <div className="sc-map-row sc-map-axis"><span />{card.dimensionLabels.map(d => <span key={d}>{d.slice(0, 3)}</span>)}</div>
    </div>
  );
}

function AudiencesTile({ card }) {
  const all = card.variants.flatMap(v => v.cohorts.map(c => c.value));
  const max = Math.max(...all, 1e-6);
  // A face-off draws from zero, so A and B compare honestly. One creative's cohorts sit close together, so its bars
  // span the range instead (the weakest at a third), and the tile says the scale is relative.
  const min = Math.min(...all);
  const scale = card.compare || max - min < 1e-6 ? v => Math.max(0, v) / max * 100 : v => 33 + 67 * (v - min) / (max - min);
  return (
    <div className="sc-aud">
      {card.variants[0].cohorts.map((c, i) => (
        <div key={c.key} className="sc-aud-row">
          <span>{c.label}</span>
          <div className="sc-aud-bars">
            {card.variants.map(v => (
              <div key={v.key} className={`sc-measure sc-curve-${v.key.toLowerCase()}`}>
                <Progress value={scale(v.cohorts[i].value)} label={`Variant ${v.key}, ${c.label}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EngagedTile({ variant, h }) {
  const share = Math.max(0, Math.min(1, variant.engaged));
  return (
    <div className="sc-engaged">
      <div style={{ width: h, height: h }}>
        <WaffleChart data={[{ key: 'on', label: 'Engaged', value: share, color: 'var(--sc-a)' }, { key: 'off', label: 'Quiet', value: 1 - share, color: 'var(--control-track)' }]} label="Share of the cortex engaged at the peak" accentKey="on" legend={false} />
      </div>
      <p><strong>{Math.round(share * 100)}%</strong><span>of the cortex above its usual level at {clock(variant.peakIndex)}</span></p>
    </div>
  );
}

function MomentTile({ variant }) {
  return (
    <blockquote className="sc-quote">
      <p>“{variant.quote.text}”</p>
      <footer>at {clock(variant.quote.at)}</footer>
    </blockquote>
  );
}

function Tile({ kind, card, brains, w, h }) {
  const lead = card.variants.find(v => v.key === card.winner) ?? card.variants[0];
  const meta = TILES.find(t => t.key === kind);
  const label = !card.compare && meta.singleLabel ? meta.singleLabel : meta.label;
  const of = card.compare && ['brain', 'networks', 'engaged', 'moment'].includes(kind) ? `Variant ${lead.key}` : null;
  const detail = {
    curve: card.compare ? null : `Peak at ${clock(lead.peakAt)}`,
    brain: `at ${clock(lead.peakIndex)}`,
    map: card.compare ? `A ${card.contests.A}  ·  B ${card.contests.B}` : null,
    audiences: card.compare ? 'A and B by cohort' : 'Relative, by cohort',
  }[kind];
  const vh = h - LABEL_H - TILE_PAD * 2 - 8;
  const vw = w - TILE_PAD * 2;
  return (
    <section className={`sc-tile sc-tile-${kind}`} style={{ height: h }}>
      <p className="sc-tile-label"><span>{label}</span><span>{[of, detail].filter(Boolean).join('  ·  ')}</span></p>
      <div className="sc-tile-viz">
        {kind === 'curve' && <CurveTile card={card} w={vw} h={vh} />}
        {kind === 'brain' && <BrainTile image={brains[lead.key]} h={vh} />}
        {kind === 'networks' && <NetworksTile variant={lead} h={vh} />}
        {kind === 'map' && <MapTile card={card} w={vw} h={vh} />}
        {kind === 'audiences' && <AudiencesTile card={card} />}
        {kind === 'engaged' && <EngagedTile variant={lead} h={vh} />}
        {kind === 'moment' && <MomentTile variant={lead} />}
      </div>
    </section>
  );
}

/**
 * The shareable scorecard: a fixed-size picture of one analysis. The top holds the video, the verdict and (once
 * benchmarked) the Rewire Score; below it, a grid of mini visuals the person picks. Until a benchmark can rank the
 * creative, the headline is the verdict and no number is shown.
 */
const ScoreCard = forwardRef(function ScoreCard({ card, format, theme, frames, brains, tiles }, ref) {
  const f = CARD_FORMATS.find(x => x.value === format) ?? CARD_FORMATS[0];
  const grid = TILE_GRID[f.value];
  const pad = f.value === 'story' ? 36 : f.value === 'link' ? 22 : 28;
  const gap = 10;
  const tileW = f.value === 'link' ? f.width - pad * 2 - 230 - 20 : (f.width - pad * 2 - gap * (grid.columns - 1)) / grid.columns;
  const shown = tilesFor(card, tiles, f.value, brains);
  const [a] = card.variants;
  const measures = card.benchmarked
    ? a.measures.map(m => ({ key: m.key, label: m.label, value: Math.round(m.percentile), percent: m.percentile, aria: `${m.label}, ${Math.round(m.percentile)} out of 100` }))
    : a.drivers.map(d => ({ key: d.key, label: d.label, percent: d.value * 100, aria: `${d.label} response, relative to this creative's strongest dimension` }));

  return (
    <div ref={ref} className="scorecard" data-format={f.value} data-card-theme={theme} data-mode={card.compare ? 'compare' : 'single'} style={{ width: f.width, height: f.height, '--sc-pad': `${pad}px` }}>
      <header className="sc-head">
        <span className="sc-brand">Rewire</span>
        <span className="sc-kicker">{card.compare ? 'Creative face-off' : 'Creative scorecard'}</span>
      </header>

      <div className="sc-top">
        <div className={`sc-media ${card.compare ? 'is-pair' : ''}`}>
          {card.variants.map(v => (
            <Thumb key={v.key} variant={v} frame={frames[v.key]} tag={card.compare ? v.key : null} winner={card.compare && card.winner === v.key} />
          ))}
        </div>

        <div className="sc-intro">
          <h2 className="sc-title">{card.title}</h2>
          {card.compare ? (
            <div className="sc-hero">
              {card.benchmarked ? (
                <div className="sc-pair-scores">
                  {card.variants.map(v => (
                    <p key={v.key} className={`sc-score sc-score-${v.key.toLowerCase()}`}><span className="sc-score-num">{v.score}</span><span className="sc-score-of">Variant {v.key}</span></p>
                  ))}
                </div>
              ) : card.winner === 'TIE' ? (
                <p className="sc-verdict">Too close to call</p>
              ) : (
                <p className="sc-verdict"><span className={`sc-ink-${card.winner.toLowerCase()}`}>Variant {card.winner}</span> wins {card.contests[card.winner]} of {card.contests.total}</p>
              )}
              <p className="sc-sub">
                {card.winner === 'TIE' ? `${card.contests.A} contests each, ${card.contests.TIE} too close` : 'audience and dimension contests'}
                {card.benchmarked && `, Rewire Score against ${a.bandLabel.toLowerCase()} ads`}
              </p>
            </div>
          ) : (
            <div className="sc-hero">
              {card.benchmarked ? (
                <>
                  <p className="sc-score"><span className="sc-score-num">{a.score}</span><span className="sc-score-of">/ 100</span></p>
                  <p className="sc-sub">Rewire Score, against {a.bandLabel.toLowerCase()} ads. Strongest with {a.audience}.</p>
                </>
              ) : (
                <>
                  <p className="sc-verdict">Lands hardest with <span className="sc-ink">{a.audience}</span></p>
                  <p className="sc-sub">{a.seconds} seconds, led by {a.drivers.map(d => d.label.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!card.compare && <Bars items={measures} />}

      {shown.length > 0 && (
        <div className="sc-tiles" style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`, gap }}>
          {shown.map(kind => <Tile key={kind} kind={kind} card={card} brains={brains} w={tileW} h={grid.height} />)}
        </div>
      )}

      <footer className="sc-foot">
        <span>Predicted brain response of 200 simulated viewers{card.benchmarked ? ', Rewire Score v1' : ''}</span>
        <span>{card.date}</span>
      </footer>
    </div>
  );
});

export default ScoreCard;
