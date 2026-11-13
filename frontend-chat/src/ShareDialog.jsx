import React, { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Download, Copy, Share2, X, Check, Loader2 } from 'lucide-react';
import { renderShareCard } from './shareCard';
import { analysisFacts, fileSafe } from './facts';

/**
 * The share card, previewed: share it (the phone's share sheet, where the browser can share files), download it as a
 * PNG, or copy it to paste into a chat or a doc. The card is drawn when the dialog opens.
 */
export default function ShareDialog({ open, onOpenChange, ins }) {
  const [card, setCard] = useState(null);   // { blob, url }
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !ins) return undefined;
    let url = null;
    let live = true;
    setCard(null); setError(null); setCopied(false);
    renderShareCard(ins)
      .then(blob => { if (!live) return; url = URL.createObjectURL(blob); setCard({ blob, url }); })
      .catch(e => live && setError(e.message));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [open, ins]);

  const name = `${fileSafe(ins ? analysisFacts(ins).title : 'Rewire')} · Rewire.png`;
  const file = card ? new File([card.blob], name, { type: 'image/png' }) : null;
  const canShare = !!(file && navigator.canShare?.({ files: [file] }));
  const canCopy = !!(card && window.ClipboardItem && navigator.clipboard?.write);

  const download = () => {
    const a = document.createElement('a');
    a.href = card.url; a.download = name;
    document.body.append(a); a.click(); a.remove();
  };
  const share = () => navigator.share({ files: [file], title: analysisFacts(ins).title, text: analysisFacts(ins).headline }).catch(() => {});
  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': card.blob })]);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { setError('Copying images isn’t allowed here. Download it instead.'); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="share-backdrop" />
        <Dialog.Popup className="share-dialog">
          <header className="share-head">
            <Dialog.Title className="share-title">Share the result</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Close"><X size={18} /></Dialog.Close>
          </header>
          <div className="share-preview">
            {card ? <img src={card.url} alt={`Share card: ${analysisFacts(ins).headline}`} /> : (
              <span className="share-wait">{error ?? <><Loader2 size={18} className="spin" aria-hidden="true" />Drawing your card…</>}</span>
            )}
          </div>
          {card && error && <p className="share-error">{error}</p>}
          <div className="share-actions">
            {canShare && <button type="button" className="share-btn primary" onClick={share}><Share2 size={16} aria-hidden="true" />Share</button>}
            <button type="button" className={`share-btn${canShare ? '' : ' primary'}`} onClick={download} disabled={!card}><Download size={16} aria-hidden="true" />Download</button>
            {canCopy && (
              <button type="button" className="share-btn" onClick={copy} disabled={!card}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? 'Copied' : 'Copy image'}
              </button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
