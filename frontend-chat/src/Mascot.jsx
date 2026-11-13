import React from 'react';

/**
 * Peek as a flat icon, for the small places (the brand, chat avatars) and as the fallback where the live 3D Peek can't
 * render. `mood` is idle (blinks now and then), thinking (eyes up, a gentle bob) or happy (eyes squeezed in a smile).
 */
export default function Mascot({ mood = 'idle', size = 32 }) {
  return (
    <svg className="mascot" data-mood={mood} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path className="mascot-antenna" d="M40 15 45 6" />
      <circle className="mascot-bulb" cx="45.5" cy="5.5" r="3.5" />
      <rect className="mascot-leg" x="17" y="49" width="7" height="11" rx="3.5" />
      <rect className="mascot-leg" x="40" y="49" width="7" height="11" rx="3.5" />
      <rect className="mascot-body" x="5" y="14" width="54" height="40" rx="13" />
      <rect className="mascot-screen" x="12" y="20" width="40" height="28" rx="8" />
      {mood === 'happy' ? (
        <g className="mascot-eyes happy">
          <path d="M20 37l4.5-5 4.5 5" /><path d="M35 37l4.5-5 4.5 5" />
        </g>
      ) : (
        <g className="mascot-eyes">
          <rect x="21" y="27" width="6" height="10" rx="2" /><rect x="37" y="27" width="6" height="10" rx="2" />
        </g>
      )}
    </svg>
  );
}
