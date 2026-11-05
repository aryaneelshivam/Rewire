import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { fetchBrainMesh, fetchBrainActivation } from '../api';
import { Activity, Camera, RotateCw, Box } from 'lucide-react';

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
  variant = "A"
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
    if (meshData) {
      fetchBrainActivation(currentTime, demographic, variant).then(data => {
        setActivation(data.activation);
      });
    }
  }, [currentTime, demographic, meshData, variant]);

  // Compute live cortex metrics from activation array
  const liveStats = useMemo(() => {
    if (!activation || activation.length === 0) {
      return { peak: 0, mean: 0, activePct: 0, activeCount: 0 };
    }
    let maxVal = 0;
    let sum = 0;
    let active = 0;
    const len = activation.length;
    for (let i = 0; i < len; i++) {
      const v = activation[i] || 0;
      if (v > maxVal) maxVal = v;
      sum += v;
      if (v > 0.2) active++;
    }
    return {
      peak: maxVal,
      mean: sum / len,
      activePct: (active / len) * 100,
      activeCount: active,
      totalCount: len,
    };
  }, [activation]);

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

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Activity className="animate-pulse" color="#000000" size={26} />
          <p style={{ marginTop: '0.75rem', color: 'var(--body)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            Reconstructing fsaverage5 Cortical Mesh (20,484 Vertices)...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', cursor: 'grab' }}>
      {/* ===== SCIENTIFIC HUD OVERLAYS ===== */}
      
      {/* Top Left: Metadata HUD */}
      <div className="sci-hud-overlay sci-hud-top-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="sci-dot live" />
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>CORTICAL BOLD ENGINE</span>
          <span style={{ color: 'var(--mute)' }}>·</span>
          <span>TR: 1.0s</span>
        </div>
        <div style={{ color: 'var(--charcoal)', fontSize: '9.5px' }}>
          MNI-152 Stereotaxic Space · fsaverage5 ({meshData?.vertices?.length?.toLocaleString() || '20,484'} Vertices)
        </div>
        <div style={{ color: 'var(--mute)', fontSize: '9px' }}>
          COHORT: {demographic.toUpperCase()} · FILTER: z &gt; 1.65 (p &lt; 0.05)
        </div>
      </div>

      {/* Top Right: Real-time Activation Metrics */}
      <div className="sci-hud-overlay sci-hud-top-right">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <span className="sci-pill">
            <span style={{ color: 'var(--mute)' }}>PEAK BOLD:</span>
            <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
              z = +{liveStats.peak.toFixed(3)}
            </strong>
          </span>
          <span className="sci-pill">
            <span style={{ color: 'var(--mute)' }}>ACTIVE:</span>
            <strong style={{ color: 'var(--ink)' }}>{liveStats.activePct.toFixed(1)}%</strong>
          </span>
        </div>
        <div style={{ color: 'var(--mute)', fontSize: '9px', marginTop: '2px' }}>
          {liveStats.activeCount.toLocaleString()} / {liveStats.totalCount?.toLocaleString() || 20484} vertices active
        </div>
      </div>

      {/* Bottom Left: Colormap Calibration */}
      <div className="sci-hud-overlay sci-hud-bottom-left" style={{ pointerEvents: 'auto' }}>
        <div className="sci-colorbar">
          <span>Sub-threshold</span>
          <div className="sci-colorbar-gradient" />
          <span>Peak z</span>
        </div>
      </div>

      {/* Bottom Right: Quick Tool Actions */}
      <div className="sci-hud-overlay sci-hud-bottom-right" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={() => setIsRotating(!isRotating)}
          className={`sci-pill ${isRotating ? 'active' : ''}`}
          title="Toggle Auto Rotation"
          style={{ cursor: 'pointer' }}
        >
          <RotateCw size={11} className={isRotating ? 'animate-spin' : ''} />
          <span>{isRotating ? 'Rotate: ON' : 'Rotate: OFF'}</span>
        </button>

        <button
          onClick={() => setWireframe(!wireframe)}
          className={`sci-pill ${wireframe ? 'active' : ''}`}
          title="Toggle Cortical Wireframe Tessellation"
          style={{ cursor: 'pointer' }}
        >
          <Box size={11} />
          <span>{wireframe ? 'Mesh' : 'Solid'}</span>
        </button>

        <button
          onClick={handleDownloadSnapshot}
          className="sci-pill"
          title="Capture High-Res Image"
          style={{ cursor: 'pointer' }}
        >
          <Camera size={11} />
          <span>Capture</span>
        </button>
      </div>

      {/* View Presets Bar (Pill Group Center Bottom) */}
      <div className="brain-view-controls">
        <button
          className={`brain-view-btn ${currentView === 'left' ? 'active' : ''}`}
          onClick={() => handlePreset('left')}
          title="Left Lateral View"
        >
          L-LAT
        </button>
        <button
          className={`brain-view-btn ${currentView === 'right' ? 'active' : ''}`}
          onClick={() => handlePreset('right')}
          title="Right Lateral View"
        >
          R-LAT
        </button>
        <button
          className={`brain-view-btn ${currentView === 'dorsal' ? 'active' : ''}`}
          onClick={() => handlePreset('dorsal')}
          title="Dorsal (Superior) View"
        >
          DORSAL
        </button>
        <button
          className={`brain-view-btn ${currentView === 'anterior' ? 'active' : ''}`}
          onClick={() => handlePreset('anterior')}
          title="Anterior (Frontal) View"
        >
          FRONT
        </button>
        <button
          className={`brain-view-btn ${currentView === 'reset' ? 'active' : ''}`}
          onClick={() => handlePreset('reset')}
          title="Isometric Reset View"
        >
          OBLIQUE
        </button>
      </div>

      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
      >
        <PerspectiveCamera makeDefault position={[240, 140, 160]} fov={45} />

        {/* Studio lighting calibrated for high anatomical contrast */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[150, 150, 150]} intensity={1.1} />
        <directionalLight position={[-150, -100, -100]} intensity={0.5} />
        <directionalLight position={[0, 0, 180]} intensity={0.7} />
        <directionalLight position={[0, 180, 0]} intensity={0.4} />

        <Suspense fallback={null}>
          {meshData && activation && (
            <BrainMesh
              vertices={meshData.vertices}
              faces={meshData.faces}
              activation={activation}
              wireframe={wireframe}
            />
          )}
        </Suspense>

        <CameraController viewPreset={currentView} controlsRef={controlsRef} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          autoRotate={isRotating}
          autoRotateSpeed={0.8}
          minDistance={90}
          maxDistance={380}
        />
      </Canvas>
    </div>
  );
});

export default BrainViewer3D;
