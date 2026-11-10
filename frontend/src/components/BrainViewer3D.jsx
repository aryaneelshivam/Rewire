import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { fetchBrainMesh, fetchBrainActivation } from '../api';
import { Camera, RotateCw, Box } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/arc/toggle-group/toggle-group';
import { Tooltip } from '@/components/arc/tooltip/tooltip';

// Publication-grade neuroimaging colormap (Hot Iron / AFNI spec / Inferno inspired)
function getNeuroColor(val, baseShading = 0.5) {
  // val is normalized 0..1
  const r = { r: 0.35 * baseShading, g: 0.38 * baseShading, b: 0.44 * baseShading }; // Base anatomical slate cortex
  
  if (val <= 0.12) {
    // Subthreshold anatomical cortex with sulcal depth shading
    return r;
  }
  
  // Normalized active range (0 to 1)
  const t = (val - 0.12) / 0.88;
  
  if (t < 0.25) {
    // Deep Violet to Indigo
    const f = t / 0.25;
    return {
      r: THREE.MathUtils.lerp(0.25, 0.45, f),
      g: THREE.MathUtils.lerp(0.15, 0.22, f),
      b: THREE.MathUtils.lerp(0.55, 0.90, f),
    };
  } else if (t < 0.5) {
    // Indigo to Crimson Red
    const f = (t - 0.25) / 0.25;
    return {
      r: THREE.MathUtils.lerp(0.45, 0.92, f),
      g: THREE.MathUtils.lerp(0.22, 0.15, f),
      b: THREE.MathUtils.lerp(0.90, 0.20, f),
    };
  } else if (t < 0.75) {
    // Crimson Red to Radiant Amber Orange
    const f = (t - 0.5) / 0.25;
    return {
      r: THREE.MathUtils.lerp(0.92, 1.0, f),
      g: THREE.MathUtils.lerp(0.15, 0.60, f),
      b: THREE.MathUtils.lerp(0.20, 0.05, f),
    };
  } else {
    // Radiant Orange to Solar Gold / Supernova White
    const f = (t - 0.75) / 0.25;
    return {
      r: 1.0,
      g: THREE.MathUtils.lerp(0.60, 0.98, f),
      b: THREE.MathUtils.lerp(0.05, 0.92, f),
    };
  }
}

const BrainMesh = ({ vertices, faces, activation, wireframe = false }) => {
  const meshRef = useRef();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(vertices.flat());
    const indices = new Uint32Array(faces.flat());
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [vertices, faces]);

  useEffect(() => {
    if (!activation || !meshRef.current) return;
    const geo = meshRef.current.geometry;
    const colors = new Float32Array(vertices.length * 3);
    const normals = geo.attributes.normal?.array;

    for (let i = 0; i < vertices.length; i++) {
      const raw = activation[i] || 0;
      const normVal = Math.max(0, Math.min(1, (raw - 0.05) / 0.85));

      // Sulcal shading factor based on vertex normal Y (depth cue)
      let depthShade = 1.0;
      if (normals) {
        const ny = normals[i * 3 + 1];
        depthShade = 0.82 + 0.25 * Math.max(0, ny);
      }

      const col = getNeuroColor(normVal, depthShade);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.attributes.color.needsUpdate = true;
  }, [activation, vertices.length]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        vertexColors
        roughness={0.35}
        metalness={0.15}
        side={THREE.DoubleSide}
        wireframe={wireframe}
      />
    </mesh>
  );
};

// Camera Controller for smooth preset navigation
function CameraController({ viewPreset, controlsRef }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!viewPreset || !controlsRef.current) return;
    
    let targetPos = [300, 0, 0];
    if (viewPreset === 'left') targetPos = [-290, 0, 0];
    else if (viewPreset === 'right') targetPos = [290, 0, 0];
    else if (viewPreset === 'dorsal') targetPos = [0, 290, 10];
    else if (viewPreset === 'anterior') targetPos = [0, 0, 290];
    else if (viewPreset === 'reset') targetPos = [240, 140, 160];

    camera.position.set(...targetPos);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, [viewPreset, camera, controlsRef]);

  return null;
}

const BrainViewer3D = React.forwardRef(({
  currentTime,
  demographic = "baseline",
  autoRotate = true,
  variant = "A",
  onStats,
  // Another source of activation (an ensemble group, say): called with the second, resolves to one value per vertex.
  loadActivation,
  sourceKey,
  chipLabel,
}, ref) => {
  const [meshData, setMeshData] = useState(null);
  const [activation, setActivation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [isRotating, setIsRotating] = useState(autoRotate);
  const [currentView, setCurrentView] = useState('reset');
  const canvasRef = useRef();
  const controlsRef = useRef();

  React.useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      if (canvasRef.current) {
        return canvasRef.current.toDataURL('image/png');
      }
      return null;
    }
  }));

  useEffect(() => {
    fetchBrainMesh().then(data => {
      setMeshData(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!meshData) return;
    let live = true;
    const load = loadActivation ? loadActivation(currentTime) : fetchBrainActivation(currentTime, demographic, variant).then(data => data.activation);
    load.then(values => { if (live && values) setActivation(values); }).catch(() => {});
    return () => { live = false; };
  // loadActivation is identified by sourceKey, so a new function with the same source does not refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, demographic, meshData, variant, sourceKey]);

  // Compute live cortex metrics from activation array
  const liveStats = useMemo(() => {
    if (!activation || activation.length === 0) {
      return { peak: 0, mean: 0, activePct: 0, activeCount: 0, lr: 0 };
    }
    // The mesh lists the left hemisphere's vertices first, so the split gives the left minus right mean.
    const nLeft = meshData?.n_vertices_left ?? Math.floor(activation.length / 2);
    let maxVal = 0;
    let sum = 0;
    let sumLeft = 0;
    let active = 0;
    const len = activation.length;
    for (let i = 0; i < len; i++) {
      const v = activation[i] || 0;
      if (v > maxVal) maxVal = v;
      sum += v;
      if (i < nLeft) sumLeft += v;
      if (v > 0.2) active++;
    }
    const sumRight = sum - sumLeft;
    return {
      peak: maxVal,
      mean: sum / len,
      activePct: (active / len) * 100,
      activeCount: active,
      totalCount: len,
      lr: (nLeft ? sumLeft / nLeft : 0) - (len - nLeft ? sumRight / (len - nLeft) : 0),
    };
  }, [activation, meshData]);

  useEffect(() => { onStats?.(liveStats); }, [liveStats, onStats]);

  const handleDownloadSnapshot = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `rewire-cortex-variant-${variant}-t${currentTime}s.png`;
    a.click();
  };

  const handlePreset = (preset) => {
    setCurrentView(preset);
  };

  const views = [
    { id: 'left', label: 'L', title: 'Left lateral' },
    { id: 'right', label: 'R', title: 'Right lateral' },
    { id: 'dorsal', label: 'Top', title: 'Dorsal' },
    { id: 'anterior', label: 'Front', title: 'Anterior' },
    { id: 'reset', label: '3D', title: 'Oblique' },
  ];

  return (
    <div className="viewport">
      {loading ? (
        <div className="vp-loading">
          <span className="animate-pulse">Loading cortical mesh</span>
        </div>
      ) : (
        <>
          <div className="vp-overlay vp-top">
            <span className="vp-chip" title={`Peak ${liveStats.peak.toFixed(2)}, ${liveStats.activePct.toFixed(1)}% active`}>
              <i className={`vdot ${variant === 'B' ? 'b' : ''}`} />{chipLabel ?? `Variant ${variant}`}
            </span>
            <div className="vp-tools">
              <ToggleGroup
                type="multiple"
                label="Display"
                size="sm"
                value={[isRotating && 'rotate', wireframe && 'wireframe'].filter(Boolean)}
                onValueChange={list => { setIsRotating(list.includes('rotate')); setWireframe(list.includes('wireframe')); }}
              >
                <ToggleGroupItem value="rotate" label="Auto-rotate"><RotateCw /></ToggleGroupItem>
                <ToggleGroupItem value="wireframe" label="Wireframe"><Box /></ToggleGroupItem>
              </ToggleGroup>
              <Tooltip content="Download as PNG">
                <button type="button" className="vp-btn" onClick={handleDownloadSnapshot} aria-label="Download brain view as PNG"><Camera size={14} strokeWidth={1.75} aria-hidden="true" /></button>
              </Tooltip>
            </div>
          </div>

          <div className="vp-overlay vp-bottom">
            <div className="vp-views">
              <ToggleGroup label="Camera view" size="sm" value={currentView} onValueChange={v => v && handlePreset(v)}>
                {views.map(v => <ToggleGroupItem key={v.id} value={v.id} label={v.title}>{v.label}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
          </div>

          <Canvas
            gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
            style={{ background: 'transparent' }}
            onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
          >
            <PerspectiveCamera makeDefault position={[240, 140, 160]} fov={45} />
            <ambientLight intensity={0.65} />
            <directionalLight position={[150, 150, 150]} intensity={1.1} />
            <directionalLight position={[-150, -100, -100]} intensity={0.5} />
            <directionalLight position={[0, 0, 180]} intensity={0.7} />
            <directionalLight position={[0, 180, 0]} intensity={0.4} />
            <Suspense fallback={null}>
              {meshData && activation && (
                <BrainMesh vertices={meshData.vertices} faces={meshData.faces} activation={activation} wireframe={wireframe} />
              )}
            </Suspense>
            <CameraController viewPreset={currentView} controlsRef={controlsRef} />
            <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.06} autoRotate={isRotating} autoRotateSpeed={0.8} minDistance={90} maxDistance={380} />
          </Canvas>
        </>
      )}
    </div>
  );
});

export default BrainViewer3D;
