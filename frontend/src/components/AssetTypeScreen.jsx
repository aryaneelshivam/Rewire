import React from 'react';
import { Clapperboard, AudioLines, FileText, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Tooltip } from '@/components/arc/tooltip/tooltip';

/** What Rewire can analyse. Only video is open; audio and text are shown, locked, so people know they're coming. */
const TYPES = [
  {
    id: 'video',
    icon: Clapperboard,
    title: 'Video',
    description: 'Ads, films and social clips. Compare two cuts or analyse one.',
    detail: 'MP4, MOV or WebM, up to 3 minutes',
  },
  {
    id: 'audio',
    icon: AudioLines,
    title: 'Audio',
    description: 'Radio spots, podcast ads, jingles and voiceovers.',
    detail: 'MP3, WAV or M4A',
    locked: true,
  },
  {
    id: 'text',
    icon: FileText,
    title: 'Text',
    description: 'Headlines, scripts, captions and ad copy.',
    detail: 'Paste text or upload a document',
    locked: true,
  },
];

function TypeCard({ type, onChoose }) {
  const Icon = type.icon;
  const card = (
    <button
      type="button"
      className={`asset-type ${type.locked ? 'is-locked' : ''}`}
      aria-disabled={type.locked || undefined}
      aria-label={type.locked ? `${type.title}: coming soon` : `Analyse ${type.title.toLowerCase()}`}
      onClick={() => { if (!type.locked) onChoose(type.id); }}
    >
      <span className="asset-type-top">
        <span className="asset-type-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.75} /></span>
        {type.locked
          ? <span className="asset-type-lock" aria-hidden="true"><Lock size={15} strokeWidth={2} /></span>
          : <ArrowRight className="asset-type-go" size={18} strokeWidth={1.75} aria-hidden="true" />}
      </span>
      <span className="asset-type-title">{type.title}</span>
      <span className="asset-type-desc">{type.description}</span>
      <span className="asset-type-detail">{type.locked ? 'Coming soon' : type.detail}</span>
    </button>
  );
  // Locked cards stay focusable, so keyboard users get the "Coming soon" tooltip too.
  return type.locked ? <Tooltip content="Coming soon">{card}</Tooltip> : card;
}

/**
 * The first step of a new analysis: what kind of creative it is. Video goes on to the upload screen; audio and text
 * are locked for now (greyscale, a padlock, "Coming soon").
 */
export default function AssetTypeScreen({ onChoose, onCancel, onOpenWorkspace }) {
  return (
    <main className="onboard">
      <div className="onboard-inner">
        <p className="onboard-brand">Rewire</p>
        <header className="onboard-head">
          <h1>What do you want to analyse?</h1>
          <p className="onboard-lede">Choose the kind of creative. Rewire predicts how 200 simulated viewers respond to it, moment by moment.</p>
        </header>

        <div className="asset-types" role="group" aria-label="Kind of creative">
          {TYPES.map(type => <TypeCard key={type.id} type={type} onChoose={onChoose} />)}
        </div>

        <div className="onboard-actions">
          <div className="onboard-actions-end">
            {onOpenWorkspace && <Button variant="ghost" onClick={onOpenWorkspace}>Open workspace</Button>}
          </div>
          <div className="onboard-actions-end">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Back to results</Button>}
          </div>
        </div>
      </div>
    </main>
  );
}
