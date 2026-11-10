import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Resolves a CSS colour (tokens, oklch, anything the browser paints) to a three.js colour.
const probeCanvas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d', { willReadFrequently: true }) : null;
function cssToColor(value) {
  const el = document.createElement('span');
  el.style.color = value;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  el.remove();
  probeCanvas.clearRect(0, 0, 1, 1);
  probeCanvas.fillStyle = '#000';
  probeCanvas.fillStyle = resolved;
  probeCanvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = probeCanvas.getImageData(0, 0, 1, 1).data;
  return new THREE.Color(r / 255, g / 255, b / 255);
}

const dummy = new THREE.Object3D();
const tmp = new THREE.Color();

function Nodes({ targets, sizes, colors, dimmed, background, edges, highlightEdges, edgeColor, highlightColor, onHover, onPick, animate }) {
  const n = targets.length;
  const mesh = useRef();
  const lines = useRef();
  const hiLines = useRef();
  const current = useRef(null);

  const write = () => {
    const pos = current.current;
    if (!mesh.current || !pos) return;
    for (let i = 0; i < n; i++) {
      dummy.position.set(pos[i][0], pos[i][1], pos[i][2]);
      dummy.scale.setScalar(sizes[i]);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    const fill = (obj, list) => {
      if (!obj) return;
      const arr = new Float32Array(list.length * 6);
      list.forEach(([a, b], k) => { arr.set(pos[a], k * 6); arr.set(pos[b], k * 6 + 3); });
      obj.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      obj.geometry.computeBoundingSphere();
    };
    fill(lines.current, edges);
    fill(hiLines.current, highlightEdges);
  };

  // First paint and every change without motion jump straight to the targets.
  useLayoutEffect(() => {
    if (!current.current || current.current.length !== n || !animate) current.current = targets.map(p => [...p]);
    write();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, sizes, edges, highlightEdges, n, animate]);

  useFrame((_, delta) => {
    if (!animate || !current.current) return;
    const k = 1 - Math.exp(-delta * 6);
    let moving = false;
    current.current.forEach((p, i) => {
      for (let j = 0; j < 3; j++) { const d = targets[i][j] - p[j]; if (Math.abs(d) > 1e-3) { p[j] += d * k; moving = true; } }
    });
    if (moving) write();
  });

  useLayoutEffect(() => {
    if (!mesh.current) return;
    for (let i = 0; i < n; i++) {
      tmp.copy(colors[i]);
      if (dimmed[i]) tmp.lerp(background, 0.78);
      mesh.current.setColorAt(i, tmp);
    }
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [colors, dimmed, background, n]);

  return (
    <group>
      <lineSegments ref={lines}>
        <bufferGeometry />
        <lineBasicMaterial color={edgeColor} transparent opacity={0.28} />
      </lineSegments>
      <lineSegments ref={hiLines}>
        <bufferGeometry />
        <lineBasicMaterial color={highlightColor} transparent opacity={0.75} />
      </lineSegments>
      <instancedMesh
        ref={mesh}
        args={[null, null, n]}
        onPointerMove={e => { e.stopPropagation(); onHover(e.instanceId, e.nativeEvent); }}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onPick(e.instanceId); }}
      >
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshStandardMaterial roughness={0.45} metalness={0.05} />
      </instancedMesh>
    </group>
  );
}

/**
 * Every simulated viewer as a node, joined to the viewers it responds most like. Colour is the group a viewer
 * falls in; size carries the view's measure. Drag to orbit, scroll to zoom, select a node to pick its group.
 */
export default function EnsembleGraph3D({ positions, sizes, colorTokens, groups, selectedGroup, edges, theme, autoRotate, onHoverNode, onPickNode }) {
  const [palette, setPalette] = useState(null);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Colours come from the theme's chart tokens; re-read them when the theme flips.
  useEffect(() => {
    const read = () => setPalette({
      groups: colorTokens.map(cssToColor),
      background: cssToColor('var(--background)'),
      edge: cssToColor('var(--text-muted)'),
    });
    read();
    const id = setTimeout(read, 50);
    return () => clearTimeout(id);
  }, [colorTokens, theme]);

  const colors = useMemo(() => palette ? groups.map(g => palette.groups[g % palette.groups.length]) : [], [palette, groups]);
  const dimmed = useMemo(() => groups.map(g => selectedGroup != null && g !== selectedGroup), [groups, selectedGroup]);
  const shownSizes = useMemo(() => sizes.map((s, i) => (dimmed[i] ? s * 0.7 : s)), [sizes, dimmed]);
  const highlightEdges = useMemo(() => selectedGroup == null ? [] : edges.filter(([a, b]) => groups[a] === selectedGroup && groups[b] === selectedGroup), [edges, groups, selectedGroup]);
  const baseEdges = useMemo(() => selectedGroup == null ? edges : edges.filter(([a, b]) => !(groups[a] === selectedGroup && groups[b] === selectedGroup)), [edges, groups, selectedGroup]);

  return (
    <div className="ensemble-canvas" aria-hidden="true">
      {palette && (
        <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} onPointerMissed={() => onPickNode(null)}>
          <PerspectiveCamera makeDefault position={[0, 4, 26]} fov={45} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 14, 12]} intensity={1.1} />
          <directionalLight position={[-12, -6, -10]} intensity={0.35} />
          <Nodes
            targets={positions}
            sizes={shownSizes}
            colors={colors}
            dimmed={dimmed}
            background={palette.background}
            edges={baseEdges}
            highlightEdges={highlightEdges}
            edgeColor={palette.edge}
            highlightColor={selectedGroup != null ? palette.groups[selectedGroup % palette.groups.length] : palette.edge}
            onHover={onHoverNode}
            onPick={onPickNode}
            animate={!reduceMotion}
          />
          <OrbitControls enableDamping dampingFactor={0.08} autoRotate={autoRotate && !reduceMotion} autoRotateSpeed={0.5} minDistance={8} maxDistance={60} />
        </Canvas>
      )}
    </div>
  );
}
