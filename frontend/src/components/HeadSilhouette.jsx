import React from 'react';

const HeadSilhouette = () => (
  <svg
    viewBox="0 0 500 620"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      position: 'absolute',
      width: '88%',
      height: '88%',
      top: '6%',
      left: '6%',
      zIndex: 1,
      opacity: 0.22,
      pointerEvents: 'none',
    }}
  >
    {/* Head profile silhouette facing left */}
    <path
      d="
        M 260 40
        C 300 35, 340 55, 365 90
        C 390 125, 402 175, 404 230
        C 406 280, 396 325, 378 365
        C 365 395, 358 420, 355 450
        C 352 475, 348 500, 340 525
        C 334 545, 324 558, 308 568
        L 282 568
        C 277 553, 270 538, 262 525
        C 250 508, 238 493, 228 475
        C 218 458, 212 441, 208 423
        C 205 408, 208 395, 218 383
        C 225 373, 228 362, 224 352
        C 218 338, 205 325, 193 308
        C 178 285, 165 262, 158 238
        C 150 212, 153 186, 165 164
        C 178 140, 195 120, 218 103
        C 235 88, 248 65, 253 50
        C 255 42, 258 40, 260 40
        Z
      "
      fill="rgba(70, 70, 70, 0.4)"
    />
    {/* Ear hint */}
    <ellipse
      cx="400"
      cy="285"
      rx="15"
      ry="28"
      fill="rgba(70, 70, 70, 0.28)"
    />
  </svg>
);

export default HeadSilhouette;
