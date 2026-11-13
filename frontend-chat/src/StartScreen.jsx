import React, { useState } from 'react';
import Peek from './Peek';
import { Clapperboard, AudioLines, FileText, Lock, ArrowRight, Menu, HelpCircle } from 'lucide-react';

/**
 * The first screen: what do you want to analyse? Three cards fanned on an arc, video in the middle. Audio and text
 * are shown locked ("Coming soon") so people know they're on the way; only video goes on, to the upload screen.
 */
const KINDS = [
  { id: 'audio', icon: AudioLines, title: 'Audio', sub: 'Music, podcasts, voiceovers', locked: true },
  { id: 'video', icon: Clapperboard, title: 'Video', sub: 'Ads, reels, shorts, films' },
  { id: 'text', icon: FileText, title: 'Text', sub: 'Scripts, captions, copy', locked: true },
];

export default function StartScreen({ onVideo, onMenu, onHelp }) {
  const [nudged, setNudged] = useState(null);   // a locked card that was just pressed, for its small shake
  const [eyeing, setEyeing] = useState(false);  // pointer over the video card: Peek leans in
  const press = kind => {
    if (!kind.locked) { onVideo(); return; }
    setNudged(kind.id);
    setTimeout(() => setNudged(n => (n === kind.id ? null : n)), 900);
  };

  return (
    <section className="start" aria-labelledby="start-title">
      <div className="start-top">
        <button type="button" className="orb" onClick={onMenu} aria-label="Your analyses"><Menu size={20} /></button>
        <button type="button" className="orb" onClick={onHelp} aria-label="How does Rewire work?"><HelpCircle size={20} /></button>
      </div>

      <h1 id="start-title" className="start-title">
        <span className="start-hi">
          <Peek className="start-peek" size={null} floor={0.5} state={nudged ? 'sad' : eyeing ? 'listening' : 'idle'} />
          Hi there,
        </span>
        <span>what do you want</span>
        <span>to analyse today?</span>
      </h1>

      <div className="fan" role="group" aria-label="Kind of creative">
        {KINDS.map((kind, i) => {
          const Icon = kind.icon;
          return (
            <button
              key={kind.id}
              type="button"
              className="fan-card"
              data-pos={i}
              data-locked={kind.locked || undefined}
              data-nudged={nudged === kind.id || undefined}
              aria-disabled={kind.locked || undefined}
              aria-label={kind.locked ? `${kind.title}: coming soon` : `Analyse a ${kind.title.toLowerCase()}`}
              onClick={() => press(kind)}
              onPointerEnter={kind.locked ? undefined : () => setEyeing(true)}
              onPointerLeave={kind.locked ? undefined : () => setEyeing(false)}
            >
              <span className="fan-icon" data-kind={kind.id}><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
              <span className="fan-title">{kind.title}</span>
              <span className="fan-sub">{kind.sub}</span>
              {kind.locked
                ? <span className="fan-soon"><Lock size={11} strokeWidth={2.25} aria-hidden="true" />Coming soon</span>
                : <span className="fan-go">Start<ArrowRight size={13} aria-hidden="true" /></span>}
            </button>
          );
        })}
        <button type="button" className="fan-orb" onClick={onVideo} aria-label="Start with a video">
          <ArrowRight size={26} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <p className="start-foot">Rewire shows it to hundreds of simulated viewers and tells you how it lands, second by second.</p>
    </section>
  );
}
