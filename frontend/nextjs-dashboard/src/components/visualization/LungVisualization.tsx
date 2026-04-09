"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useLoader, type RootState } from "@react-three/fiber";
import { OrbitControls, Html, Text, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface FocusRegion {
  x: number;
  y: number;
  intensity: number;
}

interface LungVisualizationProps {
  focusRegion?: FocusRegion;
  diseaseLabel?: string;
  animate?: boolean;
}

/* ── Glowing volumetric infection marker ── */
function InfectionMarker({
  position,
  intensity,
  label,
}: {
  position: [number, number, number];
  intensity: number;
  label?: string;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const [hovered, setHovered] = useState(false);

  // Generate particle positions around the infection site
  const particleData = useMemo(() => {
    const count = 30;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 0.15 + Math.random() * 0.25;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = Math.random() * 0.03 + 0.01;
    }
    return { positions, sizes };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 2) * 0.2;
    if (coreRef.current) coreRef.current.scale.setScalar(pulse);
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 1.3);
      (glowRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.25 + Math.sin(t * 3) * 0.1;
    }
    if (outerRef.current) {
      outerRef.current.scale.setScalar(pulse * 1.8);
      (outerRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.08 + Math.sin(t * 2.5) * 0.04;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.3;
      particlesRef.current.rotation.x = Math.sin(t * 0.5) * 0.1;
    }
  });

  const radius = 0.12 + intensity * 0.2;

  return (
    <group>
      {/* Inner hot core */}
      <mesh
        ref={coreRef}
        position={position}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color="#ff2200"
          emissive="#ff0000"
          emissiveIntensity={4}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Mid glow layer */}
      <mesh ref={glowRef} position={position}>
        <sphereGeometry args={[radius * 1.6, 12, 12]} />
        <meshStandardMaterial
          color="#ff4400"
          emissive="#ff2200"
          emissiveIntensity={2}
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Outer ambient glow */}
      <mesh ref={outerRef} position={position}>
        <sphereGeometry args={[radius * 2.5, 10, 10]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff3300"
          emissiveIntensity={0.8}
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Floating infection particles */}
      <points ref={particlesRef} position={position}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleData.positions.length / 3}
            array={particleData.positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ff4444"
          size={0.02}
          transparent
          opacity={0.6}
          sizeAttenuation
        />
      </points>

      {/* Hover tooltip */}
      {hovered && label && (
        <Html position={[position[0], position[1] + radius + 0.45, position[2]]}>
          <div className="rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap backdrop-blur-sm border border-red-400/30">
            ⚠ {label} — {Math.round(intensity * 100)}% intensity
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Anatomical lung lobe (tapered ellipsoid) ── */
function LungLobe({
  position,
  scale,
  color,
  lobeRef,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  lobeRef?: React.RefObject<THREE.Mesh>;
}) {
  return (
    <mesh ref={lobeRef as React.RefObject<THREE.Mesh>} position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshPhysicalMaterial
        color={color}
        transmission={0.85}
        roughness={0.15}
        thickness={0.6}
        transparent
        opacity={0.35}
        ior={1.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Bronchial tube segment ── */
function BronchialTube({
  start,
  end,
  radiusTop,
  radiusBottom,
}: {
  start: [number, number, number];
  end: [number, number, number];
  radiusTop: number;
  radiusBottom: number;
}) {
  const { position, rotation, length } = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const mid = s.clone().add(e).multiplyScalar(0.5);
    const dir = e.clone().sub(s);
    const len = dir.length();
    const axis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir.normalize());
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      rotation: euler,
      length: len,
    };
  }, [start, end]);

  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[radiusTop, radiusBottom, length, 16]} />
      <meshPhysicalMaterial
        color="#e8b4b8"
        roughness={0.4}
        metalness={0.05}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

/* ── Alveoli cluster at bronchiole terminals ── */
function AlveoliCluster({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const offsets = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 0.04 + Math.random() * 0.05;
      pts.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ]);
    }
    return pts;
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      const s = 1 + Math.sin(t * 1.5) * 0.08;
      groupRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {offsets.map((off, i) => (
        <mesh key={i} position={off}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshPhysicalMaterial
            color="#f0a0a8"
            transparent
            opacity={0.4}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Blood vessel network ── */
function VesselNetwork() {
  const vessels = useMemo(() => [
    { start: [0, 0.85, 0.05] as [number, number, number], end: [-0.6, 0.15, 0.15] as [number, number, number], r: 0.02 },
    { start: [0, 0.85, 0.05] as [number, number, number], end: [0.6, 0.2, 0.15] as [number, number, number], r: 0.02 },
    { start: [-0.6, 0.15, 0.15] as [number, number, number], end: [-0.85, -0.25, 0.1] as [number, number, number], r: 0.015 },
    { start: [0.6, 0.2, 0.15] as [number, number, number], end: [0.85, -0.2, 0.1] as [number, number, number], r: 0.015 },
    { start: [-0.6, 0.15, 0.15] as [number, number, number], end: [-0.7, 0.5, 0.1] as [number, number, number], r: 0.012 },
    { start: [0.6, 0.2, 0.15] as [number, number, number], end: [0.7, 0.55, 0.1] as [number, number, number], r: 0.012 },
  ], []);

  return (
    <group>
      {vessels.map((v, i) => {
        const s = new THREE.Vector3(...v.start);
        const e = new THREE.Vector3(...v.end);
        const mid = s.clone().add(e).multiplyScalar(0.5);
        const dir = e.clone().sub(s);
        const len = dir.length();
        const axis = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir.normalize());
        const euler = new THREE.Euler().setFromQuaternion(quat);
        return (
          <mesh key={i} position={[mid.x, mid.y, mid.z]} rotation={euler}>
            <cylinderGeometry args={[v.r, v.r, len, 8]} />
            <meshStandardMaterial
              color="#c44040"
              transparent
              opacity={0.35}
              emissive="#880000"
              emissiveIntensity={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── GLTF Lung Model loader with fallback ── */
function GLTFLungModel({
  focusRegion,
  diseaseLabel,
  animate,
}: LungVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [gltfLoaded, setGltfLoaded] = useState(false);
  const [gltfScene, setGltfScene] = useState<THREE.Group | null>(null);

  // Try loading GLTF model
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      "/models/lungs.glb",
      (gltf) => {
        // Apply semi-transparent medical material to all meshes
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshPhysicalMaterial({
              color: "#bde0fe",
              transmission: 0.8,
              roughness: 0.2,
              thickness: 0.5,
              transparent: true,
              opacity: 0.4,
              ior: 1.2,
              side: THREE.DoubleSide,
              emissive: "#4488cc",
              emissiveIntensity: 0.05,
            });
          }
        });
        setGltfScene(gltf.scene);
        setGltfLoaded(true);
      },
      undefined,
      () => {
        // GLTF not found — use procedural fallback
        setGltfLoaded(false);
      }
    );
  }, []);

  useFrame(({ clock }) => {
    if (!animate || !groupRef.current) return;
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 1.2) * 0.025;
    groupRef.current.scale.setScalar(breathe);
  });

  const fr = focusRegion || { x: 0.5, y: 0.5, intensity: 0.5 };
  const markerX = (fr.x - 0.5) * 2.4;
  const markerY = (0.5 - fr.y) * 2.0;

  if (gltfLoaded && gltfScene) {
    return (
      <group ref={groupRef}>
        <primitive object={gltfScene} scale={1.5} position={[0, 0, 0]} />
        <InfectionMarker
          position={[markerX, markerY, 0.15]}
          intensity={fr.intensity}
          label={diseaseLabel}
        />
      </group>
    );
  }

  // Fallback: enhanced procedural model
  return null;
}

/* ── Full lung model with anatomical structure (fallback + enhanced) ── */
function LungModel({
  focusRegion,
  diseaseLabel,
  animate,
}: LungVisualizationProps) {
  const leftUpperRef = useRef<THREE.Mesh>(null);
  const leftLowerRef = useRef<THREE.Mesh>(null);
  const rightUpperRef = useRef<THREE.Mesh>(null);
  const rightMiddleRef = useRef<THREE.Mesh>(null);
  const rightLowerRef = useRef<THREE.Mesh>(null);

  useFrame((state: RootState) => {
    if (!animate) return;
    const t = state.clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 1.2) * 0.025;
    const exhale = 1 + Math.sin(t * 1.2 + 0.15) * 0.02;
    [leftUpperRef, leftLowerRef].forEach((r) => {
      if (r.current) r.current.scale.set(breathe, breathe, breathe);
    });
    [rightUpperRef, rightMiddleRef, rightLowerRef].forEach((r) => {
      if (r.current) r.current.scale.set(exhale, exhale, exhale);
    });
  });

  const fr = focusRegion || { x: 0.5, y: 0.5, intensity: 0.5 };
  const markerX = (fr.x - 0.5) * 2.4;
  const markerY = (0.5 - fr.y) * 2.0;

  const lobeColor = "#bde0fe";

  return (
    <group>
      {/* ─── Left Lung (2 lobes) ─── */}
      <LungLobe
        position={[-0.85, 0.3, 0]}
        scale={[0.55, 0.7, 0.45]}
        color={lobeColor}
        lobeRef={leftUpperRef}
      />
      <LungLobe
        position={[-0.8, -0.45, 0]}
        scale={[0.6, 0.6, 0.45]}
        color={lobeColor}
        lobeRef={leftLowerRef}
      />

      {/* ─── Right Lung (3 lobes) ─── */}
      <LungLobe
        position={[0.85, 0.4, 0]}
        scale={[0.55, 0.55, 0.45]}
        color={lobeColor}
        lobeRef={rightUpperRef}
      />
      <LungLobe
        position={[0.85, -0.05, 0]}
        scale={[0.58, 0.4, 0.45]}
        color={lobeColor}
        lobeRef={rightMiddleRef}
      />
      <LungLobe
        position={[0.8, -0.5, 0]}
        scale={[0.6, 0.5, 0.45]}
        color={lobeColor}
        lobeRef={rightLowerRef}
      />

      {/* ─── Trachea ─── */}
      <BronchialTube
        start={[0, 1.7, 0]}
        end={[0, 0.9, 0]}
        radiusTop={0.1}
        radiusBottom={0.12}
      />

      {/* Cartilage rings on trachea */}
      {[1.6, 1.45, 1.3, 1.15, 1.0].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[0.11, 0.015, 8, 24]} />
          <meshStandardMaterial color="#d4a0a4" opacity={0.5} transparent />
        </mesh>
      ))}

      {/* ─── Main Bronchi ─── */}
      <BronchialTube
        start={[0, 0.9, 0]}
        end={[-0.5, 0.45, 0]}
        radiusTop={0.09}
        radiusBottom={0.07}
      />
      <BronchialTube
        start={[0, 0.9, 0]}
        end={[0.5, 0.5, 0]}
        radiusTop={0.09}
        radiusBottom={0.07}
      />

      {/* ─── Secondary Bronchioles ─── */}
      <BronchialTube
        start={[-0.5, 0.45, 0]}
        end={[-0.75, 0.1, 0]}
        radiusTop={0.05}
        radiusBottom={0.04}
      />
      <BronchialTube
        start={[-0.5, 0.45, 0]}
        end={[-0.9, -0.15, 0.05]}
        radiusTop={0.04}
        radiusBottom={0.03}
      />
      <BronchialTube
        start={[0.5, 0.5, 0]}
        end={[0.75, 0.2, 0]}
        radiusTop={0.05}
        radiusBottom={0.04}
      />
      <BronchialTube
        start={[0.5, 0.5, 0]}
        end={[0.85, -0.1, 0.05]}
        radiusTop={0.04}
        radiusBottom={0.03}
      />

      {/* ─── Tertiary Bronchioles (deeper detail) ─── */}
      <BronchialTube
        start={[-0.75, 0.1, 0]}
        end={[-0.95, -0.05, 0.1]}
        radiusTop={0.03}
        radiusBottom={0.02}
      />
      <BronchialTube
        start={[-0.75, 0.1, 0]}
        end={[-0.65, -0.15, -0.1]}
        radiusTop={0.03}
        radiusBottom={0.02}
      />
      <BronchialTube
        start={[0.75, 0.2, 0]}
        end={[0.95, 0.05, 0.1]}
        radiusTop={0.03}
        radiusBottom={0.02}
      />
      <BronchialTube
        start={[0.75, 0.2, 0]}
        end={[0.65, -0.05, -0.1]}
        radiusTop={0.03}
        radiusBottom={0.02}
      />

      {/* ─── Alveoli at bronchiole endpoints ─── */}
      <AlveoliCluster position={[-0.95, -0.05, 0.1]} />
      <AlveoliCluster position={[-0.65, -0.15, -0.1]} />
      <AlveoliCluster position={[0.95, 0.05, 0.1]} />
      <AlveoliCluster position={[0.65, -0.05, -0.1]} />
      <AlveoliCluster position={[-0.9, -0.15, 0.05]} />
      <AlveoliCluster position={[0.85, -0.1, 0.05]} />

      {/* ─── Blood Vessel Network ─── */}
      <VesselNetwork />

      {/* ─── Anatomical Labels ─── */}
      <Text
        position={[-0.85, 1.15, 0]}
        fontSize={0.12}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter.woff"
      >
        Left Lung
      </Text>
      <Text
        position={[0.85, 1.15, 0]}
        fontSize={0.12}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter.woff"
      >
        Right Lung
      </Text>
      <Text
        position={[0.3, 1.7, 0]}
        fontSize={0.1}
        color="#94a3b8"
        anchorX="left"
        anchorY="middle"
        font="/fonts/inter.woff"
      >
        Trachea
      </Text>

      {/* ─── Infection Marker ─── */}
      <InfectionMarker
        position={[markerX, markerY, 0.15]}
        intensity={fr.intensity}
        label={diseaseLabel}
      />
    </group>
  );
}

/* ── Scene wrapper: tries GLTF first, falls back to procedural ── */
function LungScene({
  focusRegion,
  diseaseLabel,
  animate,
}: LungVisualizationProps) {
  const [useGLTF, setUseGLTF] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Check if GLTF model exists
    fetch("/models/lungs.glb", { method: "HEAD" })
      .then((res) => {
        setUseGLTF(res.ok);
        setChecked(true);
      })
      .catch(() => {
        setUseGLTF(false);
        setChecked(true);
      });
  }, []);

  if (!checked) {
    return (
      <LungModel
        focusRegion={focusRegion}
        diseaseLabel={diseaseLabel}
        animate={animate}
      />
    );
  }

  return useGLTF ? (
    <GLTFLungModel
      focusRegion={focusRegion}
      diseaseLabel={diseaseLabel}
      animate={animate}
    />
  ) : (
    <LungModel
      focusRegion={focusRegion}
      diseaseLabel={diseaseLabel}
      animate={animate}
    />
  );
}

export default function LungVisualization({
  focusRegion,
  diseaseLabel = "Affected Region",
  animate = true,
}: LungVisualizationProps) {
  // WebGL detection
  const [webglSupported, setWebglSupported] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const supported = !!(
        canvas.getContext("webgl") || canvas.getContext("webgl2") || canvas.getContext("experimental-webgl")
      );
      setWebglSupported(supported);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  if (!webglSupported) {
    return (
      <div className="h-full w-full min-h-[400px] rounded-xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden flex items-center justify-center">
        <div className="text-center px-6">
          <div className="mx-auto mb-4 rounded-full bg-slate-700 p-4 w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-300">3D visualization unavailable</p>
          <p className="mt-1 text-xs text-slate-500">WebGL is not supported by your browser. The AI analysis results above remain fully valid.</p>
          {diseaseLabel && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-400">{diseaseLabel}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-[400px] rounded-xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden">
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* CT scan style scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,200,255,0.1) 2px, transparent 4px)",
        }}
      />

      <Canvas camera={{ position: [0, 0, 4.5], fov: 42 }}>
        {/* Lighting rig for translucent medical look */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-4, -3, -4]} intensity={0.3} color="#8ecae6" />
        <pointLight position={[0, 2, 3]} intensity={0.6} color="#90cdf4" />
        <pointLight position={[-2, -1, 2]} intensity={0.3} color="#bee3f8" />

        {/* Rim light for CT-scan edge glow */}
        <pointLight position={[0, 0, -3]} intensity={0.4} color="#00ccff" />
        <spotLight
          position={[0, 3, 2]}
          angle={0.5}
          penumbra={0.8}
          intensity={0.3}
          color="#66bbff"
        />

        {/* Soft environment fill */}
        <hemisphereLight args={["#bde0fe", "#2b3a4e", 0.4]} />

        <LungScene
          focusRegion={focusRegion}
          diseaseLabel={diseaseLabel}
          animate={animate}
        />

        <OrbitControls
          enablePan={false}
          minDistance={2.5}
          maxDistance={7}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Top-left CT scan badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className="rounded-md bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1">
          <span className="text-[10px] font-mono font-semibold text-cyan-400 tracking-wider">
            CT RENDER
          </span>
        </div>
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
          <span className="text-[10px] font-mono font-semibold text-emerald-400 tracking-wider">
            3D VOLUMETRIC
          </span>
        </div>
      </div>

      {/* Bottom overlay legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
          <span className="text-[10px] font-medium text-slate-400">
            Infection Focus
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-sky-300/50" />
          <span className="text-[10px] font-medium text-slate-400">
            Lung Tissue
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-800/50" />
          <span className="text-[10px] font-medium text-slate-400">
            Vasculature
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-pink-300/50" />
          <span className="text-[10px] font-medium text-slate-400">
            Alveoli
          </span>
        </div>
      </div>
    </div>
  );
}
