import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { X } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { ActionButton } from '@/components/arc/action-button/action-button';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { Alert } from '@/components/arc/alert/alert';
import ScoreCard from './ScoreCard';
import { buildCard, captureFrame, CARD_FORMATS } from '@/lib/scorecard';
import { inlineSvgPaint } from '@/lib/export-image';
import { fetchScore } from '../api';

const THEMES = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }];
const DRAW_MS = 1800;   // the response curve draws itself in; the image waits for it

const slug = text => (text || 'creative').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const canShareFiles = () => {
  try { return !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; }
};

/**
 * Builds a shareable image of the open analysis: pick a size and a theme, then download, copy or share it.
 * The preview is the image itself, scaled to fit.
 */
export default function ShareDialog({ onClose, overview, engagement, abSummary, runInfo, videos }) {
  const [score, setScore] = useState(undefined);
  const [frames, setFrames] = useState(null);
  const [format, setFormat] = useState('portrait');
  const [theme, setTheme] = useState('dark');
  const [notice, setNotice] = useState(null);
  const [scale, setScale] = useState(1);
  const cardRef = useRef(null);
  const stageRef = useRef(null);
  const drawnAt = useRef(0);
  const closeRef = useRef(null);

  useEffect(() => { fetchScore().then(setScore).catch(() => setScore(null)); }, []);
  const card = useMemo(() => (score === undefined ? null : buildCard({ overview, engagement, abSummary, score, runInfo, videos })),
    [score, overview, engagement, abSummary, runInfo, videos]);

  // A frame from each video, at the moment its response peaks.
  useEffect(() => {
    if (!card) return;
    let live = true;
    Promise.all(card.variants.map(v => captureFrame(v.videoUrl, v.peakAt).then(f => [v.key, f])))
      .then(pairs => { if (live) setFrames(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [card]);

  const f = CARD_FORMATS.find(x => x.value === format);
  const ready = card && frames;
  useEffect(() => { if (ready) drawnAt.current = performance.now(); }, [ready, format, theme]);

  // Fit the card into the preview area.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => setScale(Math.min(1, (stage.clientWidth - 32) / f.width, (stage.clientHeight - 32) / f.height));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [f]);

  // Escape closes; focus starts on the close button and returns to the page afterwards.
  useEffect(() => {
    const before = document.activeElement;
    closeRef.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [onClose]);

  const render = async () => {
    const wait = DRAW_MS - (performance.now() - drawnAt.current);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const node = cardRef.current;
    const restore = inlineSvgPaint(node);
    try {
      return await toPng(node, { pixelRatio: 2, cacheBust: true, width: f.width, height: f.height });
    } finally {
      restore();
    }
  };
  const fileName = `rewire-scorecard-${slug(card?.title)}-${format}.png`;
  const failed = () => setNotice({ tone: 'danger', text: 'The image could not be made. Try again.' });

  const download = async () => {
    const url = await render();
    Object.assign(document.createElement('a'), { href: url, download: fileName }).click();
  };
  const copy = async () => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Copying images is not supported here');
    // Safari needs the clipboard write to start inside the click, so the image is passed as a promise.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': render().then(u => fetch(u)).then(r => r.blob()) })]);
    setNotice({ tone: 'success', text: 'Copied. Paste it into a post or a message.' });
  };
  const share = async () => {
    const blob = await (await fetch(await render())).blob();
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: 'image/png' })], title: card.title });
    } catch (e) {
      if (e?.name !== 'AbortError') throw e;
    }
  };

  return (
    <div className="share-overlay" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="share-panel">
        <div className="share-stage" ref={stageRef}>
          {ready ? (
            <div className="share-fit" style={{ width: f.width * scale, height: f.height * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <ScoreCard ref={cardRef} card={card} format={format} theme={theme} frames={frames} />
              </div>
            </div>
          ) : (
            <Skeleton lines={4} label="Preparing the scorecard" className="share-skeleton" />
          )}
        </div>

        <aside className="share-side">
          <div className="share-side-head">
            <h2 id="share-title">Share scorecard</h2>
            <Button ref={closeRef} variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
          </div>
          <p className="share-lede">An image of this analysis, ready to post. It shows the verdict, the response curve and who it lands with.</p>

          <div className="share-field">
            <SegmentedControl label="Size" options={CARD_FORMATS.map(({ value, label }) => ({ value, label }))} value={format} onValueChange={setFormat} />
            <p className="share-note">{f.note}</p>
          </div>
          <div className="share-field">
            <SegmentedControl label="Theme" options={THEMES} value={theme} onValueChange={setTheme} />
          </div>

          {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

          <div className="share-actions">
            <ActionButton label="Download image" pendingLabel="Making image" successLabel="Downloaded" onAction={download} onActionError={failed} />
            <ActionButton label="Copy image" pendingLabel="Copying" successLabel="Copied" onAction={copy} onActionError={() => setNotice({ tone: 'danger', text: 'This browser cannot copy images. Download it instead.' })} />
            {canShareFiles() && <ActionButton label="Share" pendingLabel="Opening" successLabel="Shared" onAction={share} onActionError={failed} />}
          </div>
          {card && !card.benchmarked && (
            <p className="share-note">The 0 to 100 Rewire Score appears on the card once it can be ranked against enough comparable ads.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
