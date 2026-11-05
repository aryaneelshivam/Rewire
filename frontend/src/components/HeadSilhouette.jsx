import React from 'react';

const HeadSilhouette = () => (
  <svg
    viewBox="0 0 500 620"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      position: 'absolute',
      width: '90%',
      height: '90%',
      top: '5%',
      left: '5%',
      zIndex: 1,
      pointerEvents: 'none',
      opacity: 0.16,
    }}
  >
    <defs>
      {/* Subtle coordinate dot pattern */}
      <pattern id="grid-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.8" fill="#000000" opacity="0.3" />
      </pattern>
    </defs>

    {/* Background Coordinate Grid Window */}
    <rect x="50" y="30" width="400" height="550" fill="url(#grid-dots)" opacity="0.5" />

    {/* Stereotaxic Coordinate Axes */}
    {/* Z=0 AC-PC Baseline (Standard Neuroimaging Coordinate Plane) */}
    <line x1="30" y1="285" x2="470" y2="285" stroke="#000000" strokeWidth="0.75" strokeDasharray="3 3" />
    <text x="35" y="280" fill="#000000" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="0.05em">AC-PC PLANE (Z=0)</text>

    {/* Vertical Anterior-Posterior Reference Axis */}
    <line x1="260" y1="20" x2="260" y2="580" stroke="#000000" strokeWidth="0.75" strokeDasharray="3 3" />
    <text x="264" y="30" fill="#000000" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="0.05em">CZ / VERTEX</text>

    {/* Stereotaxic Reticle Crosshairs */}
    <circle cx="260" cy="285" r="16" stroke="#000000" strokeWidth="0.75" strokeDasharray="2 2" fill="none" />
    <circle cx="260" cy="285" r="2" fill="#000000" />
    <text x="280" y="295" fill="#000000" fontSize="8" fontFamily="ui-monospace, monospace">ORIGIN [0, 0, 0]</text>

    {/* Head profile silhouette outline with hairline contour */}
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
      fill="#000000"
      fillOpacity="0.04"
      stroke="#000000"
      strokeWidth="1.2"
    />

    {/* Anatomical Fiducials: Nasion & Inion */}
    {/* Nasion marker (Anterior landmark at bridge of nose) */}
    <circle cx="156" cy="238" r="3" stroke="#000000" strokeWidth="1" fill="#ffffff" />
    <text x="96" y="242" fill="#000000" fontSize="8" fontFamily="ui-monospace, monospace">NASION (NZ)</text>
    <line x1="145" y1="238" x2="152" y2="238" stroke="#000000" strokeWidth="0.75" />

    {/* Inion marker (Posterior skull base landmark) */}
    <circle cx="403" cy="285" r="3" stroke="#000000" strokeWidth="1" fill="#ffffff" />
    <text x="415" y="289" fill="#000000" fontSize="8" fontFamily="ui-monospace, monospace">INION (IZ)</text>
    <line x1="407" y1="285" x2="413" y2="285" stroke="#000000" strokeWidth="0.75" />

    {/* 10-20 Standard Electrode Placement Arcs & Landmarks */}
    <path
      d="M 165 164 Q 210 90 260 40 Q 330 50 375 140 Q 400 210 403 285"
      stroke="#000000"
      strokeWidth="0.75"
      strokeDasharray="4 4"
      fill="none"
    />

    {/* Electrode Nodes (Frontal, Central, Parietal, Occipital) */}
    {/* Fp1 / Prefrontal */}
    <circle cx="185" cy="130" r="2.5" fill="#000000" />
    <text x="160" y="125" fill="#000000" fontSize="7.5" fontFamily="ui-monospace, monospace">Fp1</text>

    {/* F3 / Frontal */}
    <circle cx="218" cy="80" r="2.5" fill="#000000" />
    <text x="200" y="75" fill="#000000" fontSize="7.5" fontFamily="ui-monospace, monospace">F3</text>

    {/* Cz / Vertex */}
    <circle cx="260" cy="40" r="3" fill="#000000" />
    <text x="265" y="55" fill="#000000" fontSize="7.5" fontFamily="ui-monospace, monospace">Cz</text>

    {/* P3 / Parietal */}
    <circle cx="325" cy="72" r="2.5" fill="#000000" />
    <text x="335" y="70" fill="#000000" fontSize="7.5" fontFamily="ui-monospace, monospace">P3</text>

    {/* O1 / Occipital */}
    <circle cx="380" cy="155" r="2.5" fill="#000000" />
    <text x="390" y="155" fill="#000000" fontSize="7.5" fontFamily="ui-monospace, monospace">O1</text>

    {/* Auditory / Ear Canal landmark (Preauricular Point) */}
    <ellipse cx="330" cy="285" rx="14" ry="24" stroke="#000000" strokeWidth="0.8" fill="none" />
    <circle cx="330" cy="285" r="2" fill="#000000" />
    <text x="315" y="322" fill="#000000" fontSize="7.5" fontFamily="ui-monospace, monospace">A1 (AUDITORY)</text>

    {/* Technical Scale Graduations (Ticks on Y axis) */}
    {[100, 150, 200, 250, 300, 350, 400, 450, 500].map(y => (
      <g key={y}>
        <line x1="40" y1={y} x2="48" y2={y} stroke="#000000" strokeWidth="0.75" />
        <line x1="452" y1={y} x2="460" y2={y} stroke="#000000" strokeWidth="0.75" />
      </g>
    ))}

    {/* Corner Calibration Reticles */}
    <path d="M 40 50 L 55 50 M 40 50 L 40 65" stroke="#000000" strokeWidth="1" />
    <path d="M 460 50 L 445 50 M 460 50 L 460 65" stroke="#000000" strokeWidth="1" />
    <path d="M 40 550 L 55 550 M 40 550 L 40 535" stroke="#000000" strokeWidth="1" />
    <path d="M 460 550 L 445 550 M 460 550 L 460 535" stroke="#000000" strokeWidth="1" />
  </svg>
);

export default HeadSilhouette;
