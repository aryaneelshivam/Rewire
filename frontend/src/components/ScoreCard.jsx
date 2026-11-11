import React, { forwardRef } from 'react';
import { Sparkline } from '@/components/arc/sparkline/sparkline';
import { Progress } from '@/components/arc/progress/progress';
import { Badge } from '@/components/arc/badge/badge';
import { clock, CARD_FORMATS } from '@/lib/scorecard';

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

function Curve({ variant, width, height, tone, lead }) {
  if (variant.curve.length < 2) return null;
  return (
    <div className={`sc-curve ${tone ? `sc-curve-${tone}` : ''} ${lead ? 'is-lead' : ''}`}>
      <Sparkline
        data={variant.curve}
        label={tone ? `Variant ${variant.key} response` : 'Response, second by second'}
        change={`Peak at ${clock(variant.peakAt)}`}
        width={width}
        height={height}
        interactive={false}
        area
      />
    </div>
  );
}

function Measures({ variant }) {
  return (
    <div className="sc-measures">
      {variant.measures.map(m => (
        <div key={m.key} className="sc-measure">
          <p className="sc-label"><span>{m.label}</span><strong>{Math.round(m.percentile)}</strong></p>
          <Progress value={m.percentile} label={`${m.label}, ${Math.round(m.percentile)} out of 100`} />
        </div>
      ))}
    </div>
  );
}

function Drivers({ variant }) {
  return (
    <div className="sc-measures">
      {variant.drivers.map(d => (
        <div key={d.key} className="sc-measure">
          <p className="sc-label"><span>{d.label}</span></p>
          <Progress value={d.value * 100} label={`${d.label} response, relative to this creative's strongest dimension`} />
        </div>
      ))}
    </div>
  );
}

/**
 * The shareable scorecard: a fixed-size picture of one analysis. With a benchmark behind it, the headline is the
 * Rewire Score; until then it is the verdict (who wins, or where the creative lands hardest) and no number is shown.
 */
const ScoreCard = forwardRef(function ScoreCard({ card, format, theme, frames }, ref) {
  const f = CARD_FORMATS.find(x => x.value === format) ?? CARD_FORMATS[0];
  const curveWidth = format === 'link' ? 250 : f.width - 64;
  const curveHeight = format === 'link' ? 44 : format === 'square' ? 40 : format === 'story' ? 72 : 52;
  const [a] = card.variants;

  return (
    <div ref={ref} className="scorecard" data-format={f.value} data-card-theme={theme} data-mode={card.compare ? 'compare' : 'single'} style={{ width: f.width, height: f.height }}>
      <header className="sc-head">
        <span className="sc-brand">Rewire</span>
        <span className="sc-kicker">{card.compare ? 'Creative face-off' : 'Creative scorecard'}</span>
      </header>

      <div className={`sc-media ${card.compare ? 'is-pair' : ''}`}>
        {card.variants.map(v => (
          <Thumb key={v.key} variant={v} frame={frames[v.key]} tag={card.compare ? v.key : null} winner={card.compare && card.winner === v.key} />
        ))}
      </div>

      <div className="sc-body">
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
              {card.benchmarked && `, Rewire Score against ${a.bandLabel} ads`}
            </p>
          </div>
        ) : (
          <div className="sc-hero">
            {card.benchmarked ? (
              <>
                <p className="sc-score"><span className="sc-score-num">{a.score}</span><span className="sc-score-of">/ 100</span></p>
                <p className="sc-sub">Rewire Score, against {a.bandLabel.toLowerCase()} ads</p>
              </>
            ) : (
              <>
                <p className="sc-verdict">Lands hardest with <span className="sc-ink">{a.audience}</span></p>
                <p className="sc-sub">Led by {a.drivers.map(d => d.label.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}</p>
              </>
            )}
          </div>
        )}

        {!card.compare && (card.benchmarked ? <Measures variant={a} /> : <Drivers variant={a} />)}

        {card.compare
          ? <div className="sc-curves">{card.variants.map(v => <Curve key={v.key} variant={v} width={curveWidth} height={curveHeight} tone={v.key.toLowerCase()} lead={v.key === (card.winner === 'B' ? 'B' : 'A')} />)}</div>
          : <Curve variant={a} width={curveWidth} height={curveHeight} />}

        <p className="sc-facts">
          {card.compare
            ? card.variants.map(v => `${v.key}: ${v.seconds}s, strongest with ${v.audience}`).join('  ·  ')
            : [`${a.seconds} seconds`, card.benchmarked && `Strongest with ${a.audience}`, `Peak at ${clock(a.peakAt)}`].filter(Boolean).join('  ·  ')}
        </p>
      </div>

      <footer className="sc-foot">
        <span>Predicted brain response of 200 simulated viewers{card.benchmarked ? ', Rewire Score v1' : ''}</span>
        <span>{card.date}</span>
      </footer>
    </div>
  );
});

export default ScoreCard;
