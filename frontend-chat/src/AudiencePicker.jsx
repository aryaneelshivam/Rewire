import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { PreviewCard } from '@base-ui/react/preview-card';
import { Tooltip } from '@base-ui/react/tooltip';
import { Check, ChevronDown, Info, Search, Users } from 'lucide-react';
import { audienceOptions, creditCost, MEASURED, simSecondsFor, VIEWERS } from './audience';

/**
 * Choose how many viewers to simulate, in the composer's footer: a searchable list of audience sizes, each with a
 * preview of what it buys (precision, depth, speed, cost) on 10-segment bars whose tooltips give the measured values.
 *
 * With a mouse the preview opens beside the list on hover (Base UI Preview Card). On touch, where there's no hover
 * and no room beside the list, the highlighted size's preview shows inside the popup instead.
 *
 *   <AudiencePicker value={viewers} onChange={setViewers} lengths={[32]} credits={{ seconds_per_credit: 10, viewer_surcharge: 0.5 }} />
 */

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const seconds = s => (s < 1 ? '<1 s' : `${Math.round(s)} s`);

/** What one size adds: credits for these videos once their lengths are known, else the percentage. */
function extraFor(option, lengths, credits) {
  const pct = Math.round((option.multiplier - 1) * 100);
  if (!lengths.length) return { short: pct ? `+${pct}%` : 'Base', long: pct ? `${pct}% more credits than 200 viewers` : 'The base price' };
  const spc = credits?.seconds_per_credit ?? 10;
  const surcharge = credits?.viewer_surcharge ?? 0.5;
  const total = creditCost(lengths, spc, option.value, surcharge);
  const base = creditCost(lengths, spc, VIEWERS.min, surcharge);
  return {
    short: `${total} cr`,
    long: `${total} credit${total === 1 ? '' : 's'} for ${lengths.length === 2 ? 'these videos' : 'this video'}${total > base ? ` (${total - base} for the bigger audience)` : ''}`,
  };
}

function MetricBar({ label, value, info, invert }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span>{label}</span>
        <Tooltip.Root>
          <Tooltip.Trigger className="metric-info" aria-label={`${label}: ${info}`} delay={120}>
            <Info size={12} aria-hidden="true" />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={6} className="tip-positioner">
              <Tooltip.Popup className="tip">{info}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
      <div className="metric-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={value} aria-valuetext={info} data-invert={invert || undefined} data-metric={label.toLowerCase()}>
        {Array.from({ length: 10 }, (_, i) => <span key={i} data-on={i < value || undefined} style={{ transitionDelay: `${i * 18}ms` }} />)}
      </div>
    </div>
  );
}

function Preview({ option, lengths, credits, compact }) {
  const extra = extraFor(option, lengths, credits);
  const sim = simSecondsFor(option, lengths);
  return (
    <Tooltip.Provider>
      <div className="preview" data-compact={compact || undefined}>
        {!compact && (
          <div className="preview-top">
            <p className="preview-title">{option.label}</p>
            <p className="preview-sub"><Users size={12} aria-hidden="true" />{option.group}</p>
            <p className="preview-desc">{option.description}</p>
          </div>
        )}
        <div className="preview-metrics">
          <MetricBar label="Precision" value={option.metrics.precision}
            info={`Overall scores varied ±${option.sdPct.toFixed(2)}% between ${MEASURED.runs} runs with different audiences`} />
          <MetricBar label="Depth" value={option.metrics.depth}
            info={`${option.group}, across 4 age groups`} />
          <MetricBar label="Speed" value={option.metrics.speed}
            info={`About ${seconds(sim)} of simulation for ${lengths.length ? (lengths.length === 2 ? 'these videos' : 'this video') : 'a 30 s video'}, on top of watching it`} />
          <MetricBar label="Cost" value={option.metrics.cost} invert
            info={`${option.multiplier.toFixed(2)}× the base price. ${extra.long}`} />
        </div>
        {/* Touch has no hover for the tooltips, so the measured values that matter most are written out. */}
        {compact && (
          <p className="preview-facts">
            Scores vary ±{option.sdPct.toFixed(2)}% run to run · {extra.long.replace(/^The base price$/, 'base price')}
          </p>
        )}
      </div>
    </Tooltip.Provider>
  );
}

export default function AudiencePicker({ value, onChange, disabled, lengths = [], credits }) {
  const options = useMemo(() => audienceOptions(credits?.viewer_surcharge ?? 0.5), [credits?.viewer_surcharge]);
  const selected = options.find(o => o.value === value) ?? options[0];
  const previewHandle = useMemo(() => PreviewCard.createHandle(), []);
  const [hoverable, setHoverable] = useState(canHover);
  const [highlighted, setHighlighted] = useState(selected);
  const listRef = useRef(null);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setHoverable(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // A fade at the bottom of the list while there's more to scroll to.
  const watchList = el => {
    listRef.current = el;
    if (!el) return;
    const update = () => setFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    update();
    el.onscroll = update;
  };

  const closePreview = () => previewHandle.close();
  const badge = option => {
    const extra = extraFor(option, lengths, credits);
    return option.value === VIEWERS.min && !lengths.length ? null : extra.short;
  };

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={next => { if (next) onChange(next.value); }}
      isItemEqualToValue={(item, v) => item.value === v.value}
      itemToStringLabel={item => item.label}
      onInputValueChange={closePreview}
      onItemHighlighted={item => { if (item) setHighlighted(item); }}
      onOpenChange={open => { if (open) setHighlighted(selected); else closePreview(); }}
      autoHighlight
      disabled={disabled}
    >
      <Combobox.Trigger className="aud-trigger" aria-label={`Simulated viewers: ${selected.label}. Change`}>
        <Users size={15} aria-hidden="true" />
        <span className="aud-trigger-label">{selected.label}</span>
        {selected.value !== VIEWERS.min && <span className="aud-badge">{extraFor(selected, [], credits).short}</span>}
        <Combobox.Icon className="aud-caret"><ChevronDown size={14} aria-hidden="true" /></Combobox.Icon>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner side="top" align="start" sideOffset={8} collisionPadding={10} className="aud-positioner">
          <Combobox.Popup className="aud-popup" aria-label="Simulated viewers">
            <PreviewCard.Root handle={previewHandle}>
              {({ payload }) => (
                <>
                  <div className="aud-search">
                    <Search size={14} aria-hidden="true" />
                    <Combobox.Input className="aud-input" placeholder="Search sizes…" aria-label="Search audience sizes" onFocus={closePreview} />
                  </div>
                  <Combobox.Empty className="aud-empty">
                    No size matches. Try a number from 200 to 1,000.
                  </Combobox.Empty>
                  <div className="aud-list-wrap">
                    <Combobox.List className="aud-list" ref={watchList}>
                      {option => (
                        <Combobox.Item key={option.value} value={option} className="aud-item">
                          {hoverable ? (
                            <PreviewCard.Trigger handle={previewHandle} payload={option} delay={80} closeDelay={180} render={<div />} className="aud-row">
                              <Row option={option} badge={badge(option)} />
                            </PreviewCard.Trigger>
                          ) : (
                            <div className="aud-row"><Row option={option} badge={badge(option)} /></div>
                          )}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                    <div className="aud-fade" data-on={fade || undefined} aria-hidden="true" />
                  </div>
                  {!hoverable && highlighted && (
                    <div className="aud-inline">
                      <p className="aud-inline-title">{highlighted.label} · {highlighted.group}</p>
                      <Preview option={highlighted} lengths={lengths} credits={credits} compact />
                    </div>
                  )}
                  {hoverable && (
                    <PreviewCard.Portal keepMounted>
                      <PreviewCard.Positioner side="right" align="center" sideOffset={10} collisionPadding={10} className="aud-preview-positioner">
                        <PreviewCard.Popup className="aud-preview">
                          {payload ? <Preview option={payload} lengths={lengths} credits={credits} /> : null}
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  )}
                </>
              )}
            </PreviewCard.Root>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function Row({ option, badge }) {
  return (
    <>
      <Combobox.ItemIndicator className="aud-check"><Check size={14} aria-hidden="true" /></Combobox.ItemIndicator>
      <span className="aud-row-text">
        <span className="aud-row-label">{option.label}</span>
        <span className="aud-row-sub">{option.group}</span>
      </span>
      {badge && <span className="aud-badge">{badge}</span>}
    </>
  );
}
