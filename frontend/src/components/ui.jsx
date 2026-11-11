import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { inlineSvgPaint } from '@/lib/export-image';
import { Download } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import { Badge } from '@/components/arc/badge/badge';
import { Progress } from '@/components/arc/progress/progress';
import { leadPct } from '@/lib/chart-data';

/** Saves a node as a 2x PNG named after the chart. The button itself is left out of the image. */
export function ExportButton({ target, name }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    const node = target.current;
    if (!node || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const background = getComputedStyle(document.body).backgroundColor || '#fff';
      const restore = inlineSvgPaint(node);
      let url;
      try {
        url = await toPng(node, {
          pixelRatio: 2,
          backgroundColor: background,
          cacheBust: true,
          filter: el => !(el instanceof HTMLElement && el.dataset.exportIgnore !== undefined),
        });
      } finally {
        restore();
      }
      const link = document.createElement('a');
      link.download = `rewire-${name}.png`;
      link.href = url;
      link.click();
    } catch (error) {
      console.error('Chart export failed', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span data-export-ignore="">
      <Tooltip content={failed ? 'Download failed, try again' : 'Download as PNG'}>
        <Button variant="ghost" size="sm" className="export-btn" loading={busy} onClick={save} aria-label={`Download ${name.replace(/-/g, ' ')} as PNG`}>
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Tooltip>
    </span>
  );
}

/** The section surface: a heading, an optional line of context, actions, then the body. Pass exportName to offer a PNG download. */
export function Card({ title, description, actions, exportName, children, className = '', style }) {
  const ref = useRef(null);
  return (
    <section ref={ref} className={`card ${className}`} style={style}>
      {(title || actions || exportName) && (
        <header className="card-head">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {description && <p className="card-desc">{description}</p>}
          </div>
          {(actions || exportName) && (
            <div className="card-actions">
              {actions}
              {exportName && <ExportButton target={ref} name={exportName} />}
            </div>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Variant A carries the accent; Variant B stays neutral. */
export function VariantTag({ v, children }) {
  if (v === 'TIE' || v === '=') return <Badge size="sm">{children ?? 'Tie'}</Badge>;
  return <Badge size="sm" tone={v === 'A' ? 'info' : 'neutral'} className={v === 'B' ? 'badge-b' : undefined}>{children ?? v}</Badge>;
}

export function VariantLegend() {
  return (
    <span className="legend">
      <span><i className="vdot" />Variant A</span>
      <span><i className="vdot b" />Variant B</span>
    </span>
  );
}

/** One variant's score as an Arc progress bar, scaled to the larger of the pair, with the value beside it. */
export function BarRow({ variant, value, max, format = v => v.toFixed(3) }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar-row ${variant === 'B' ? 'is-b' : ''}`}>
      <span aria-hidden="true">{variant}</span>
      <Progress value={pct} label={`Variant ${variant}`} />
      <span className={`num ${variant === 'B' ? 'num-b' : 'num-a'}`}>{format(value)}</span>
    </div>
  );
}

/** Who leads and by how much: a relative lead, or the raw gap when a score is zero or negative. */
export function LeadPill({ a, b, digits = 1 }) {
  const winner = a > b ? 'A' : b > a ? 'B' : 'TIE';
  if (winner === 'TIE') return <Badge size="sm">Too close</Badge>;
  const gap = Math.min(a, b) > 0 ? `+${leadPct(a, b).toFixed(digits)}%` : `+${Math.abs(a - b).toFixed(3)}`;
  return <VariantTag v={winner}>{`${winner} ${gap}`}</VariantTag>;
}
