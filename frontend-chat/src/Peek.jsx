import React, { Component, useState } from 'react';
import { Mascot } from 'wobnimo/react';
import peek from '../mascots/peek';
import PeekIcon from './Mascot';

/**
 * Peek, Rewire's watcher: a little TV that watches your video with you, rendered live by Wobnimo. `state` is one of
 * Wobnimo's moods (idle, listening, thinking, speaking, working, error, surprised, celebrating, sad, sleeping).
 * Where WebGL2 isn't available, or the renderer fails, the flat icon stands in, so nothing breaks.
 */

let webgl2;
const canRender = () => {
  if (webgl2 === undefined) {
    try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch { webgl2 = false; }
  }
  return webgl2;
};

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const ICON_MOOD = { working: 'thinking', thinking: 'thinking', celebrating: 'happy', surprised: 'happy' };

export default function Peek({ state = 'idle', size = 96, palette, label, className = '', ...options }) {
  const [ready, setReady] = useState(false);
  const icon = <PeekIcon mood={ICON_MOOD[state] ?? 'idle'} size={Math.round(size * 0.72)} />;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span className={`peek ${className}`} data-ready={ready || undefined} style={{ width: size, height: size }} {...a11y}>
      {canRender() ? (
        <Guard fallback={icon}>
          <Mascot character={peek} state={state} palette={palette} onReady={() => setReady(true)}
            style={{ width: '100%', height: '100%' }} {...options} />
        </Guard>
      ) : icon}
    </span>
  );
}
