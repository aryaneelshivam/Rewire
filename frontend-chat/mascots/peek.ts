import type { CharacterSpec, PartSpec } from 'wobnimo';

/*
  Peek: Rewire's watcher. A chunky little portable TV in warm peach vinyl, standing on two
  stubby legs. Its screen is its face (an LED face in mint, so it reads on the Aura gradient),
  it has a springy antenna with a bulb that takes the colour of its mood, and two dials on
  its sides that spin while it works.

  Plan
  - Silhouette: a rounded box, a bit wider than tall, on two short legs, one antenna on top.
  - Body plan: an object with a face. The TV is the head (it tilts and nods); legs on the body.
  - Signature: the dark screen with a mint LED face, inside an ink bezel.
  - Secondary: the antenna and bulb, the side dials.
  - Palette: peach shell #e9946b, ink #2a2633, screen #182326, mint LEDs #bff3e0, orange dials #e8642c.

  World heights: legs 0 to 0.13; head pivot 0.13; TV case 0.13 to 0.73 (centre 0.43);
  screen centre 0.44; antenna root 0.73.
*/

/* a dial on each side of the case, on its own bone so it can spin */
function dial(side: -1 | 1): PartSpec[] {
  const s = side < 0 ? 'L' : 'R';
  return [
    { bone: `dial${s}`, shape: 'cylinder', rot: [0, 0, 1.5708], radius: 0.085, half: 0.025, round: 0.015, material: 'knob' },
    { bone: `dial${s}`, shape: 'capsule', from: [0.03 * side, -0.05, 0], to: [0.03 * side, 0.05, 0], radius: 0.016, material: 'ink' },
  ];
}

export const peek: CharacterSpec = {
  id: 'peek',
  name: 'Peek',
  tagline: 'A little TV that watches your video with you',
  accent: '#e8642c',
  frame: { target: 0.47, radius: 0.62 },
  bound: { y: 0.47, radius: 0.66 },
  motion: { hop: 0.14, squash: 0.95, snap: 1.05, look: 1, talkSquash: 0.6 },
  glowPool: 0.25,

  materials: {
    shell: { color: '#e9946b', f0: 0.04, spec: 0.8, shininess: 60, rim: 0.8, sss: 0.2, sssColor: '#f6cab4' },
    ink: { color: '#2a2633', f0: 0.04, spec: 0.6, shininess: 50, rim: 0.4, gloss: 0.4 },
    screen: { color: '#182326', f0: 0.045, spec: 1.6, shininess: 260, rim: 0.1, gloss: 1 },
    knob: { color: '#e8642c', f0: 0.06, spec: 1.6, shininess: 160, rim: 0.5, gloss: 0.8 },
    bulb: { color: '#ffffff', f0: 0.05, spec: 1, shininess: 120, rim: 0, glows: true, emitStrength: 1.3 },
  },

  bones: [
    { name: 'body', pivot: [0, 0, 0], drive: { ry: [['yaw', 0.25]], rz: [['roll', 0.3]] } },
    { name: 'head', parent: 'body', pivot: [0, 0.13, 0], drive: { rx: [['pitch', -0.7]], ry: [['yaw', 0.7]], rz: [['roll', 0.5]] } },
    { name: 'antenna', parent: 'head', pivot: [0.12, 0.6, 0], rest: { rz: -0.25 }, jiggle: { axis: [0, 1, 0], length: 0.18, freq: 2.6, damping: 0.12 } },
    { name: 'dialL', parent: 'head', pivot: [-0.4, 0.3, 0] },
    { name: 'dialR', parent: 'head', pivot: [0.4, 0.3, 0] },
  ],

  parts: [
    /* stubby legs and feet */
    { bone: 'body', shape: 'capsule', from: [-0.15, 0.04, 0], to: [-0.15, 0.16, 0], radius: 0.05, material: 'ink' },
    { bone: 'body', shape: 'capsule', from: [0.15, 0.04, 0], to: [0.15, 0.16, 0], radius: 0.05, material: 'ink' },
    { bone: 'body', shape: 'ellipsoid', at: [-0.15, 0.035, 0.04], radii: [0.075, 0.035, 0.09], material: 'ink', blend: 0.03 },
    { bone: 'body', shape: 'ellipsoid', at: [0.15, 0.035, 0.04], radii: [0.075, 0.035, 0.09], material: 'ink', blend: 0.03 },

    /* the TV case, the recess for the screen, and the glass */
    { bone: 'head', shape: 'roundBox', at: [0, 0.3, 0], half: [0.4, 0.3, 0.26], round: 0.16, material: 'shell' },
    { bone: 'head', shape: 'roundBox', op: 'sub', blend: 0.03, at: [0, 0.31, 0.32], half: [0.31, 0.21, 0.1], round: 0.1, material: 'shell' },
    { bone: 'head', shape: 'frame', at: [0, 0.31, 0.225], half: [0.315, 0.215], corner: 0.1, width: 0.03, depth: 0.02, material: 'ink' },
    { bone: 'head', shape: 'plate', at: [0, 0.31, 0.225], half: [0.3, 0.2], corner: 0.09, depth: 0.012, material: 'screen' },

    /* the side dials */
    ...dial(-1),
    ...dial(1),

    /* the antenna: a collar, a stem and a bulb */
    { bone: 'head', shape: 'cylinder', at: [0.12, 0.6, 0], radius: 0.05, half: 0.022, round: 0.012, material: 'ink' },
    { bone: 'antenna', shape: 'capsule', from: [0, 0, 0], to: [0, 0.15, 0], radius: 0.016, material: 'ink' },
    { bone: 'antenna', shape: 'sphere', at: [0, 0.19, 0], radius: 0.045, material: 'bulb' },
  ],

  face: {
    kind: 'screen',
    bone: 'head',
    material: 'screen',
    center: [0, 0.31],
    half: [0.29, 0.19],
    corner: 0.08,
    cell: 0.028,
    color: '#bff3e0',
  },

  anchors: {
    top: { bone: 'head', at: [-0.2, 0.66, 0.05] },
    mouth: { bone: 'head', at: [0, 0.2, 0.26] },
    ear: { bone: 'head', at: [-0.47, 0.3, 0] },
    feet: { bone: 'root', at: [0, 0.02, 0.1] },
    antenna: { bone: 'antenna', at: [0, 0.19, 0] },
  },

  acting: {
    idle: { antenna: { rz: [0, 0.06, 0.6, 0] } },
    /* head tilted, dials ticking over */
    thinking: { head: { rz: 0.14 }, dialL: { rx: [0, 0, 0, 0, 2] }, dialR: { rx: [0, 0, 0, 0, -2] } },
    /* leaning in toward what you dropped */
    listening: { head: { rx: 0.16 }, antenna: { rz: [0.1, 0.08, 1.2, 0] } },
    speaking: { antenna: { rz: [0, 0.12, 1.6, 0] } },
    /* busy: dials spinning, antenna buzzing */
    working: { dialL: { rx: [0, 0, 0, 0, 6] }, dialR: { rx: [0, 0, 0, 0, -6] }, antenna: { rz: [0, 0.08, 7, 0] } },
    error: { antenna: { rz: [0, 0.25, 11, 0] } },
    surprised: { head: { rx: -0.12 }, antenna: { rz: 0.25 } },
    celebrating: { antenna: { rz: [0, 0.4, 3, 0] }, dialL: { rx: [0, 0, 0, 0, 10] }, dialR: { rx: [0, 0, 0, 0, -10] } },
    /* a little bored: the TV droops forward */
    sad: { head: { rx: 0.22, rz: -0.06 }, antenna: { rz: 0.5 } },
    sleeping: { head: { rx: 0.25 }, antenna: { rz: 0.7 } },
    happy: { antenna: { rz: [0, 0.35, 3.5, 0] }, dialL: { rx: [0, 0, 0, 0, 8] }, dialR: { rx: [0, 0, 0, 0, -8] } },
  },

  fx: {
    /* signal rings off the bulb while it thinks */
    thinking: [{ glyph: 'ring', anchor: 'antenna', rate: 1.2, velocity: [0, 0.02, 0], life: [0.9, 1.1], size: [0.03, 0.15], color: '#e8642c', glow: true }],
  },
};

export default peek;
