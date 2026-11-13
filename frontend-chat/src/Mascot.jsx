import React from 'react';

/**
 * Rewire's placeholder character: a soft blob with eyes. `mood` is idle (blinks now and then), thinking (eyes up,
 * a gentle bob) or happy (eyes closed in a smile). A stand-in until the real mascot is designed.
 */
export default function Mascot({ mood = 'idle', size = 32 }) {
  return (
    <svg className="mascot" data-mood={mood} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path className="mascot-body" d="M32 5c15 0 27 10 27 26 0 17-11 28-27 28S5 48 5 31C5 15 17 5 32 5z" />
      {mood === 'happy' ? (
        <g className="mascot-eyes happy">
          <path d="M20 32q4-5 8 0" /><path d="M36 32q4-5 8 0" />
        </g>
      ) : (
        <g className="mascot-eyes">
          <ellipse cx="24" cy="31" rx="3.6" ry="5" /><ellipse cx="40" cy="31" rx="3.6" ry="5" />
        </g>
      )}
      <ellipse className="mascot-cheek" cx="17" cy="40" rx="4" ry="2.4" />
      <ellipse className="mascot-cheek" cx="47" cy="40" rx="4" ry="2.4" />
    </svg>
  );
}
