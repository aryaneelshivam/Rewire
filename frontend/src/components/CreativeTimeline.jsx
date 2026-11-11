import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scissors, MessageSquare, Music, Tag, MousePointerClick, TrendingUp, TrendingDown, Star, Bookmark, Flag, Trash2, Repeat } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Badge } from '@/components/arc/badge/badge';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/arc/toggle-group/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/arc/popover/popover';
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu';
import { Accordion } from '@/components/arc/accordion/accordion';
import { Input } from '@/components/arc/input/input';
import { EVENT_TYPES, buildTrack, meanOver, fmtClock } from '@/lib/timeline-events';
import { useVideoAnalyses } from '@/lib/use-video-analysis';
import { ChipGroup } from '@/components/arc/chip-group/chip-group';

const ICONS = { cut: Scissors, dialogue: MessageSquare, sound: Music, brand: Tag, cta: MousePointerClick, rise: TrendingUp, fall: TrendingDown, peak: Star, bookmark: Bookmark, reveal: Flag };
const FILTERS = [
  { id: 'scenes', label: 'Scenes', types: ['cut'] },
  { id: 'dialogue', label: 'Dialogue', types: ['dialogue'] },
  { id: 'sound', label: 'Sound', types: ['sound'] },
  { id: 'brand', label: 'Brand and CTA', types: ['brand', 'cta'] },
  { id: 'response', label: 'Response', types: ['rise', 'fall', 'peak'] },
];
// Where each kind of moment is examined in depth.
const TABS = [
  { id: 'overview', label: 'Whole-brain response' },
  { id: 'audiences', label: 'Audience dynamics' },
  { id: 'scenes', label: 'Key moments' },
  { id: 'regions', label: 'Brain regions' },
  { id: 'ensemble', label: 'Neural ensemble' },
];

const icon = (type, size = 14) => { const I = ICONS[type]; return I ? <I size={size} strokeWidth={1.75} aria-hidden="true" /> : null; };
const loadBookmarks = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };

/** Gives each point marker a row so markers closer than `gap` percent stack instead of overlapping. */
function stack(events, duration, gap = 2.4, rows = 2) {
  const last = Array(rows).fill(-Infinity);
  return [...events].sort((a, b) => a.t - b.t).map(e => {
    const x = (e.t / duration) * 100;
    let row = last.findIndex(l => x - l >= gap);
    if (row < 0) row = last.indexOf(Math.min(...last));
    last[row] = x;
    return { ...e, row };
  });
}

/**
 * The creative on a time axis: a filmstrip per variant, cut into scenes and narrative sections, with markers for
 * what happens and where the predicted response moves. It navigates and annotates; the charts live in the tabs.
 */
export default function CreativeTimeline({ duration: fullDuration, currentTime, onSeek, tracks, onOpenTab, onPlayRange, loopRange, storageKey }) {
  const videoOf = useVideoAnalyses(tracks.map(t => t.videoUrl), fullDuration);
  const all = useMemo(() => tracks.map(track => {
    const video = videoOf(track.videoUrl);
    // Tracks share one time axis, as long as the longest video. Each is built to its own length, so a shorter
    // video's scenes and sections stop where it ends instead of stretching to the end of the axis.
    const end = Math.min(fullDuration, track.overview?.n_timesteps || fullDuration);
    return { ...track, video, end, ...buildTrack(track.overview, video, end) };
  }), [tracks, videoOf, fullDuration]);

  // Only the winner shows at first. Any set of variants can be shown; the set is never left empty.
  const winner = (tracks.find(t => t.isWinner) ?? tracks[0])?.variant;
  const [picked, setPicked] = useState(null);
  const shown = (picked ?? [winner]).filter(v => tracks.some(t => t.variant === v));
  const visible = shown.length ? shown : [winner];
  const built = all.filter(t => visible.includes(t.variant));
  // The axis fits the longest variant on show: one video fills the width; several share the longest one's length.
  const duration = Math.max(1, ...built.map(t => t.end));
  const variantOptions = tracks.map(t => ({ value: t.variant, label: `Variant ${t.variant}${t.isWinner ? ', winner' : ''}` }));

  const [filters, setFilters] = useState(FILTERS.map(f => f.id));
  const shownTypes = new Set(FILTERS.filter(f => filters.includes(f.id)).flatMap(f => f.types));
  const [range, setRange] = useState(null);        // { start, end, section? }
  const [hoverT, setHoverT] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks(storageKey));
  useEffect(() => { setBookmarks(loadBookmarks(storageKey)); }, [storageKey]);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(bookmarks)); } catch { /* storage blocked: notes last for this visit */ } }, [bookmarks, storageKey]);

  const pct = t => `${(Math.max(0, Math.min(duration, t)) / duration) * 100}%`;
  const surface = useRef(null);
  const drag = useRef(null);
  const timeAt = clientX => {
    const r = surface.current.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  };

  // Click to seek, drag to select a range. Markers and buttons handle their own clicks.
  const onPointerDown = e => {
    if (e.button !== 0 || e.target.closest('button, a, input, [role="menu"]')) return;
    if (e.clientX < surface.current.getBoundingClientRect().left) return;
    drag.current = { x: e.clientX, t: timeAt(e.clientX), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = e => {
    if (e.pointerType === 'mouse') setHoverT(e.clientX < surface.current.getBoundingClientRect().left ? null : timeAt(e.clientX));
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
    if (d.moved) { const t = timeAt(e.clientX); setRange({ start: Math.min(d.t, t), end: Math.max(d.t, t) }); }
  };
  const onPointerUp = e => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) onSeek(Math.round(timeAt(e.clientX)));
    else setRange(r => (r && r.end - r.start < 0.5 ? null : r && { start: Math.floor(r.start), end: Math.max(Math.floor(r.start) + 1, Math.ceil(r.end)) }));
  };

  const addBookmark = (kind, t = currentTime, end) => setBookmarks(list => [...list, { id: `${Date.now()}`, kind, t, end, note: '' }].sort((a, b) => a.t - b.t));
  const openIn = t => TABS.map(tab => ({ label: `Open in ${tab.label}`, onSelect: () => onOpenTab(tab.id, Math.floor(t)) }));

  const ticks = useMemo(() => {
    const step = duration <= 40 ? 5 : duration <= 120 ? 10 : 30;
    return Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);
  }, [duration]);

  // A range can be one shared window, or a narrative section, where each variant uses its own span of that section.
  const spanFor = track => {
    if (!range) return null;
    if (range.section) { const s = track.sections.find(x => x.id === range.section); return s && { start: s.start, end: s.end }; }
    return range;
  };
  const looping = loopRange && range && loopRange.start === spanFor(built[0])?.start && loopRange.end === spanFor(built[0])?.end;

  const marker = (track, e) => {
    const meta = EVENT_TYPES[e.type];
    return (
      <Popover key={e.id}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`tl-marker type-${e.type}`}
            style={{ left: pct(e.t), top: `${e.row * 22}px` }}
            aria-label={`${meta.label} at ${fmtClock(e.t)}, Variant ${track.variant}: ${e.title}`}
            onClick={() => onSeek(Math.floor(e.t))}
          >
            {icon(e.type)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="tl-pop">
          <p className="tl-pop-head"><span className="tl-pop-icon">{icon(e.type, 16)}</span><strong>{meta.label}</strong><span className="num-key">{fmtClock(e.t)}</span><Badge size="sm" tone={track.variant === 'A' ? 'info' : 'neutral'} className={track.variant === 'B' ? 'badge-b' : undefined}>{track.variant}</Badge></p>
          <p className="tl-pop-title">{e.title}</p>
          <p className="tl-pop-source">{meta.source}.</p>
          <div className="tl-pop-actions">
            <Button size="sm" variant="secondary" onClick={() => addBookmark('bookmark', Math.floor(e.t))}>Bookmark</Button>
            <DropdownMenu label="Open in" items={openIn(e.t)} />
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <section className="timeline" aria-labelledby="timeline-title">
      <header className="tl-head">
        <div className="tl-title">
          <div>
            <h2 id="timeline-title">Timeline</h2>
            <p className="tl-sub">Click to move the playhead, drag to select a range. Markers open their details.</p>
          </div>
          {tracks.length > 1 && (
            <ChipGroup
              label="Variants on the timeline"
              options={variantOptions}
              value={visible}
              onValueChange={next => setPicked(next.length ? tracks.map(t => t.variant).filter(v => next.includes(v)) : visible)}
              maxVisible={4}
            />
          )}
        </div>
        <div className="tl-tools">
          <ToggleGroup type="multiple" label="Markers shown" size="sm" value={filters} onValueChange={setFilters}>
            {FILTERS.map(f => <ToggleGroupItem key={f.id} value={f.id} label={`Show ${f.label.toLowerCase()} markers`}>{f.label}</ToggleGroupItem>)}
          </ToggleGroup>
          <Tooltip content={`Bookmark ${fmtClock(currentTime)}`}>
            <Button size="sm" variant="secondary" onClick={() => addBookmark('bookmark')}><Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />Bookmark</Button>
          </Tooltip>
          <Tooltip content={`Mark ${fmtClock(currentTime)} as the product reveal`}>
            <Button size="sm" variant="secondary" onClick={() => addBookmark('reveal')}><Flag size={16} strokeWidth={1.75} aria-hidden="true" />Product reveal</Button>
          </Tooltip>
        </div>
      </header>

      <div className="tl-scroll">
      <div className="tl-body" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setHoverT(null)}>
        {/* Ruler and bookmarks share the time axis with every track below. */}
        <div className="tl-row tl-ruler-row">
          <span className="tl-label" aria-hidden="true" />
          <div className="tl-lane tl-ruler">
            {ticks.map(t => <span key={t} className="tl-tick" style={{ left: pct(t) }}>{fmtClock(t)}</span>)}
            {bookmarks.map(b => (
              <button key={b.id} type="button" className={`tl-pin kind-${b.kind}`} style={{ left: pct(b.t) }} onClick={() => onSeek(Math.floor(b.t))} aria-label={`${b.kind === 'reveal' ? 'Product reveal' : 'Bookmark'} at ${fmtClock(b.t)}${b.note ? `: ${b.note}` : ''}`} title={b.note || undefined}>
                {icon(b.kind, 12)}
              </button>
            ))}
          </div>
        </div>

        {built.map(track => {
          const span = spanFor(track);
          const events = stack(track.events.filter(e => e.type !== 'dialogue' && shownTypes.has(e.type)), duration);
          const dialogue = shownTypes.has('dialogue') ? track.events.filter(e => e.type === 'dialogue') : [];
          return (
            <div key={track.variant} className={`tl-track ${track.variant === 'B' ? 'is-b' : ''}`}>
              <div className="tl-row">
                <span className="tl-label">
                  <strong className={track.variant === 'B' ? 'num-b' : 'num-a'}>{tracks.length === 1 ? 'Your creative' : `Variant ${track.variant}`}</strong>
                  {track.isWinner && <span className="tl-label-note">Winner</span>}
                </span>
                <div className="tl-lane tl-sections">
                  {track.sections.map(s => (
                    <button key={s.id} type="button" className={`tl-section ${range?.section === s.id ? 'is-on' : ''}`} style={{ left: pct(s.start), width: `calc(${pct(s.end - s.start)} - 2px)` }} aria-pressed={range?.section === s.id}
                      onClick={() => { setRange(range?.section === s.id ? null : { section: s.id, start: s.start, end: s.end }); onSeek(Math.floor(s.start)); }}
                      aria-label={`${s.label}, ${fmtClock(s.start)} to ${fmtClock(s.end)}. Select to compare this section across variants`}>
                      {s.label}
                    </button>
                  ))}
                  {track.end < duration - 0.5 && <span className="tl-ended" aria-hidden="true" style={{ left: pct(track.end), width: pct(duration - track.end) }} />}
                </div>
              </div>

              <div className="tl-row">
                <span className="tl-label tl-label-sub">{track.video.status === 'working' ? 'Reading video' : `${track.scenes.length} scene${track.scenes.length === 1 ? '' : 's'}`}</span>
                <div className="tl-lane tl-film" aria-hidden="true">
                  {track.video.frames.length
                    ? track.video.frames.map((f, i) => <span key={f.t} className="tl-frame" style={{ left: pct(f.t), width: pct(Math.max(0, (track.video.frames[i + 1]?.t ?? track.end) - f.t)), backgroundImage: `url(${f.src})` }} />)
                    : <span className="tl-film-empty">{track.videoUrl ? '' : 'Add this variant’s video to see its frames and scene cuts'}</span>}
                  {track.scenes.slice(1).map(s => <span key={s.start} className="tl-cut" style={{ left: pct(s.start) }} />)}
                  {track.end < duration - 0.5 && <span className="tl-ended" style={{ left: pct(track.end), width: pct(duration - track.end) }}>Ends at {fmtClock(track.end)}</span>}
                </div>
              </div>

              {dialogue.length > 0 && (
                <div className="tl-row">
                  <span className="tl-label tl-label-sub">Dialogue</span>
                  <div className="tl-lane tl-dialogue">
                    {dialogue.map(d => (
                      <Tooltip key={d.id} content={`${fmtClock(d.t)} ${d.title}`}>
                        <button type="button" className="tl-line" style={{ left: pct(d.t), width: `max(4px, ${pct(Math.max(0.3, d.end - d.t))})` }} onClick={() => onSeek(Math.floor(d.t))} aria-label={`Dialogue at ${fmtClock(d.t)}: ${d.title}`} />
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}

              <div className="tl-row">
                <span className="tl-label tl-label-sub">Markers</span>
                <div className="tl-lane tl-markers">{events.map(e => marker(track, e))}</div>
              </div>

              {span && <div className="tl-range-band" style={{ '--from': span.start / duration, '--to': span.end / duration }} aria-hidden="true" />}
            </div>
          );
        })}

        {/* Drawn over the time column of every row: the playhead, the hover guide and a dragged range. */}
        <div ref={surface} className="tl-surface" aria-hidden="true">
          {range && !range.section && <span className="tl-range" style={{ left: pct(range.start), width: pct(range.end - range.start) }} />}
          {hoverT !== null && <span className="tl-hover" style={{ left: pct(hoverT) }}><span>{fmtClock(hoverT)}</span></span>}
          <span className="tl-playhead" style={{ left: pct(currentTime) }} />
        </div>
      </div>
      </div>

      {range && (
        <div className="tl-rangebar" role="region" aria-label="Selected range">
          <div className="tl-range-copy">
            <strong>{range.section ? built[0].sections.find(s => s.id === range.section)?.label : `${fmtClock(range.start)} to ${fmtClock(range.end)}`}</strong>
            {built.map(track => {
              const s = spanFor(track);
              if (!s) return null;
              return (
                <span key={track.variant}>
                  {track.variant} {range.section && <>{fmtClock(s.start)} to {fmtClock(s.end)}, </>}mean z <span className={track.variant === 'B' ? 'num-b' : 'num-a'}>{meanOver(track.series, s.start, s.end).toFixed(3)}</span>
                </span>
              );
            })}
          </div>
          <div className="tl-range-actions">
            <Button size="sm" variant="secondary" aria-pressed={!!looping} onClick={() => { const s = spanFor(built.find(t => t.isWinner) ?? built[0]); onPlayRange(looping ? null : s); }}>
              <Repeat size={16} strokeWidth={1.75} aria-hidden="true" />{looping ? 'Stop loop' : 'Loop range'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addBookmark('bookmark', Math.floor(range.start), Math.ceil(range.end))}>Bookmark range</Button>
            <DropdownMenu label="Open in" items={openIn(range.start)} />
            <Button size="sm" variant="ghost" onClick={() => { setRange(null); if (looping) onPlayRange(null); }}>Clear</Button>
          </div>
        </div>
      )}

      {bookmarks.length > 0 && (
        <Accordion
          defaultOpen={-1}
          items={[{
            title: `Bookmarks and notes (${bookmarks.length})`,
            content: (
              <ul className="tl-notes">
                {bookmarks.map(b => (
                  <li key={b.id}>
                    <Button size="sm" variant="ghost" className="tl-note-time" onClick={() => onSeek(Math.floor(b.t))} aria-label={`Go to ${fmtClock(b.t)}`}>
                      {icon(b.kind, 14)}{fmtClock(b.t)}{b.end != null && `–${fmtClock(b.end)}`}
                    </Button>
                    <Input label={b.kind === 'reveal' ? 'Product reveal note' : 'Note'} value={b.note} placeholder="What happens here" onChange={e => setBookmarks(list => list.map(x => x.id === b.id ? { ...x, note: e.target.value } : x))} />
                    <DropdownMenu label="Open in" items={openIn(b.t)} />
                    <Tooltip content="Remove">
                      <Button size="sm" variant="ghost" className="icon-only" aria-label={`Remove the note at ${fmtClock(b.t)}`} onClick={() => setBookmarks(list => list.filter(x => x.id !== b.id))}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            ),
          }]}
        />
      )}
    </section>
  );
}
