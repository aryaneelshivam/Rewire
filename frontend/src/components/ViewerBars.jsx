import React from 'react';

/**
 * A small bar for each audience size the slider offers, sitting on its track: bars grow with the number of viewers,
 * and those up to the chosen size fill in the slider's colour. Each bar is centred on the slider's tick for that
 * step. Clicking a bar picks that size; the slider stays the control for keyboards and screen readers, so the bars
 * are hidden from assistive technology.
 */
export default function ViewerBars({ steps, value, onPick, disabled }) {
  const max = steps[steps.length - 1];
  const last = steps.length - 1;
  return (
    <div className="viewer-bars" aria-hidden="true" data-disabled={disabled || undefined}>
      {steps.map((n, i) => (
        <span
          key={n}
          className="viewer-bar"
          data-on={n <= value || undefined}
          data-current={n === value || undefined}
          style={{ left: `${(i / last) * 100}%`, height: `${(n / max) * 100}%`, animationDelay: `${i * 30}ms` }}
          onClick={() => { if (!disabled) onPick(n); }}
        />
      ))}
    </div>
  );
}
