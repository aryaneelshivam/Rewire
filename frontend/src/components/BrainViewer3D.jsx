import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { fetchBrainMesh, fetchBrainActivation } from '../api';
import { Activity } from 'lucide-react';

const BrainMesh = ({ vertices, faces, activation }) => {
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
    if (!activation) return;
    const colors = new Float32Array(vertices.length * 3);
    const lut = new THREE.Color();
    for (let i = 0; i < vertices.length; i++) {
      const val = Math.max(0, Math.min(1, (activation[i] - 0.1) / 0.8));
      if (val < 0.33) {
        const t = val * 3;
        const baseGrey = 0.55;
        // Interpolate from grey (0.55) to red (1, 0, 0)
        lut.setRGB(
          baseGrey + t * (1 - baseGrey),
          baseGrey * (1 - t),
          baseGrey * (1 - t)
        );
      } else if (val < 0.66) {
        lut.setRGB(1, (val - 0.33) * 3, 0);
      } else {
        lut.setRGB(1, 1, (val - 0.66) * 3);
      }
      colors[i * 3] = lut.r;
      colors[i * 3 + 1] = lut.g;
      colors[i * 3 + 2] = lut.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true;
  }, [activation, geometry, vertices.length]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        vertexColors
        roughness={0.4}
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const BrainViewer3D = React.forwardRef(({ nTimesteps, currentTime, setCurrentTime, peakTimestep, demographic = "baseline", autoRotate = true, variant = "A" }, ref) => {
  const [meshData, setMeshData] = useState(null);
  const [activation, setActivation] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef();

  React.useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      if (canvasRef.current) {
        return canvasRef.current.toDataURL('image/png');
      }
      return null;
    }
  }));

  useEffect(() => {
    fetchBrainMesh().then(data => { setMeshData(data); setLoading(false); });
  }, []);

  useEffect(() => {
    if (meshData) {
      fetchBrainActivation(currentTime, demographic, variant).then(data => setActivation(data.activation));
    }
  }, [currentTime, demographic, meshData, variant]);

  const rimColor = variant === 'B' ? '#7F77DD' : '#E85D24';

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Activity className="animate-pulse" color="#E85D24" size={26} />
          <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Loading brain mesh...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', cursor: 'grab' }}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
      >
        <PerspectiveCamera makeDefault position={[300, 0, 0]} fov={45} />

        {/* Core lighting for 3D depth */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[0, 0, 100]} intensity={1.5} />
        <directionalLight position={[100, 100, 100]} intensity={0.8} />

        {/* Rim lighting for the Rewire aesthetic (orange/yellow highlights from below) */}
        <pointLight position={[-100, -50, -100]} intensity={3.0} color={rimColor} distance={500} />
        <pointLight position={[0, -100, 50]} intensity={2.0} color={variant === 'B' ? '#B0A0FF' : '#FFD700'} distance={500} />
        <Suspense fallback={null}>
          {meshData && activation && (
            <BrainMesh vertices={meshData.vertices} faces={meshData.faces} activation={activation} />
          )}
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={100}
          maxDistance={350}
        />
      </Canvas>
    </div>
  );
});

export default BrainViewer3D;
