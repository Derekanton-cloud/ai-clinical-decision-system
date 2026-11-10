"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
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

type RenderMode = "standard" | "ct" | "qa";
type LobeName =
  | "left_upper_lobe"
  | "left_lower_lobe"
  | "right_upper_lobe"
  | "right_middle_lobe"
  | "right_lower_lobe";

type LobeMeshMap = Partial<Record<LobeName, THREE.Mesh>>;

const LOBE_NAMES: LobeName[] = [
  "left_upper_lobe",
  "left_lower_lobe",
  "right_upper_lobe",
  "right_middle_lobe",
  "right_lower_lobe",
];

const LOBE_NEIGHBORS: Record<LobeName, LobeName[]> = {
  left_upper_lobe: ["left_lower_lobe"],
  left_lower_lobe: ["left_upper_lobe"],
  right_upper_lobe: ["right_middle_lobe"],
  right_middle_lobe: ["right_upper_lobe", "right_lower_lobe"],
  right_lower_lobe: ["right_middle_lobe"],
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function getFocusLobe(fr: FocusRegion): LobeName {
  const left = fr.x < 0.5;
  if (left) {
    return fr.y < 0.52 ? "left_upper_lobe" : "left_lower_lobe";
  }
  if (fr.y < 0.34) return "right_upper_lobe";
  if (fr.y < 0.62) return "right_middle_lobe";
  return "right_lower_lobe";
}

function computeLobeSeverities(
  stage: 0 | 1 | 2 | 3,
  focusLobe: LobeName,
  intensity: number,
): Record<LobeName, number> {
  const out = Object.fromEntries(LOBE_NAMES.map((n) => [n, 0])) as Record<LobeName, number>;
  const i = clamp01(intensity);

  if (stage === 0) {
    out[focusLobe] = 0.35 * i;
    return out;
  }

  if (stage === 1) {
    out[focusLobe] = 0.62 * i;
    for (const n of LOBE_NEIGHBORS[focusLobe]) out[n] = 0.24 * i;
    return out;
  }

  if (stage === 2) {
    out[focusLobe] = 0.88 * i;
    for (const n of LOBE_NEIGHBORS[focusLobe]) out[n] = 0.5 * i;
    for (const n of LOBE_NAMES) {
      if (out[n] === 0) {
        const sameSide = focusLobe.startsWith("left") === n.startsWith("left");
        out[n] = sameSide ? 0.26 * i : 0.18 * i;
      }
    }
    return out;
  }

  for (const n of LOBE_NAMES) out[n] = 0.5 * i;
  out[focusLobe] = Math.min(1, 0.95 * i + 0.12);
  return out;
}

function severityColor(severity: number) {
  const s = clamp01(severity);
  const green = new THREE.Color("#3fcd6f");
  const yellow = new THREE.Color("#efbf3f");
  const red = new THREE.Color("#e24a3f");
  if (s < 0.5) {
    return green.clone().lerp(yellow, s / 0.5);
  }
  return yellow.clone().lerp(red, (s - 0.5) / 0.5);
}

function findNamedLobeMeshes(root: THREE.Object3D): LobeMeshMap {
  const out: LobeMeshMap = {};
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const name = (mesh.name || "").toLowerCase();
    for (const lobe of LOBE_NAMES) {
      if (name.includes(lobe)) out[lobe] = mesh;
    }
  });
  return out;
}

function fitRootToCenteredSpan(root: THREE.Object3D, targetSpan = 2.2) {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  root.position.sub(center);
  const scale = targetSpan / maxDim;
  root.scale.setScalar(scale);
}

function mapFocusToLobeVolume(mesh: THREE.Mesh | undefined, fr: FocusRegion): [number, number, number] {
  if (!mesh) {
    const left = fr.x < 0.5;
    const localX = left ? fr.x / 0.5 : (fr.x - 0.5) / 0.5;
    return [
      (left ? -0.7 : 0.7) + (localX - 0.5) * 0.32,
      0.6 - fr.y * 1.16,
      0.06,
    ];
  }

  mesh.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const left = fr.x < 0.5;
  const localX = left ? fr.x / 0.5 : (fr.x - 0.5) / 0.5;

  const padX = size.x * 0.2;
  const padY = size.y * 0.18;
  const padZ = size.z * 0.26;

  const x = THREE.MathUtils.lerp(box.min.x + padX, box.max.x - padX, clamp01(localX));
  const y = THREE.MathUtils.lerp(box.max.y - padY, box.min.y + padY, clamp01(fr.y));
  const z = THREE.MathUtils.lerp(box.min.z + padZ, box.max.z - padZ, 0.56);

  return [x, y, z];
}

function InfectionMarker({
  position,
  intensity,
  stage,
  label,
  renderMode,
}: {
  position: [number, number, number];
  intensity: number;
  stage: 0 | 1 | 2 | 3;
  label?: string;
  renderMode: RenderMode;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const edemaRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const [hovered, setHovered] = useState(false);

  const stageBoost = [0.0, 0.16, 0.34, 0.52][stage];
  const baseRadius = 0.05 + clamp01(intensity) * 0.05 + stageBoost * 0.045;

  const lesionGeometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(baseRadius, 3);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = Math.sin(x * 17.1) * Math.cos(y * 11.8) * Math.sin(z * 9.7);
      const r = 1 + n * 0.16;
      pos.setXYZ(i, x * r, y * r * 1.05, z * r * 0.93);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [baseRadius]);

  const particleData = useMemo(() => {
    const count = 90;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = THREE.MathUtils.randFloatSpread(1) * baseRadius * 1.5;
      arr[i * 3 + 1] = THREE.MathUtils.randFloatSpread(1) * baseRadius * 1.1;
      arr[i * 3 + 2] = THREE.MathUtils.randFloatSpread(1) * baseRadius * 1.3;
    }
    return arr;
  }, [baseRadius]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = 1 + Math.sin(t * 2.2) * 0.08;
    if (coreRef.current) {
      coreRef.current.scale.set(1 + Math.sin(t * 1.7) * 0.05, p, 1 + Math.sin(t * 1.3) * 0.04);
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 + Math.sin(t * 3.2) * 0.35;
    }
    if (edemaRef.current) edemaRef.current.scale.setScalar(1.2 + Math.sin(t * 1.5) * 0.05);
    if (haloRef.current) {
      haloRef.current.scale.setScalar(1.45 + Math.sin(t * 1.1) * 0.04);
      (haloRef.current.material as THREE.MeshStandardMaterial).opacity = 0.11 + Math.sin(t * 2.1) * 0.02;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.18;
      particlesRef.current.rotation.x = Math.sin(t * 0.4) * 0.05;
    }
  });

  return (
    <group>
      <mesh
        ref={coreRef}
        position={position}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <primitive object={lesionGeometry} attach="geometry" />
        <meshStandardMaterial
          color={renderMode === "qa" ? "#6b7280" : "#ca3f2b"}
          emissive={renderMode === "qa" ? "#000000" : "#ff4b32"}
          emissiveIntensity={renderMode === "qa" ? 0 : 2.2}
          transparent
          opacity={renderMode === "qa" ? 0.18 : 0.88}
          roughness={renderMode === "qa" ? 0.95 : 0.36}
        />
      </mesh>

      <mesh ref={edemaRef} position={position}>
        <primitive object={lesionGeometry} attach="geometry" />
        <meshStandardMaterial
          color={renderMode === "qa" ? "#9ca3af" : "#ff7559"}
          emissive={renderMode === "qa" ? "#000000" : "#ff5a3d"}
          emissiveIntensity={renderMode === "qa" ? 0 : 1.1}
          transparent
          opacity={renderMode === "qa" ? 0.08 : 0.2}
        />
      </mesh>

      <mesh ref={haloRef} position={position}>
        <sphereGeometry args={[baseRadius * 2.0, 12, 12]} />
        <meshStandardMaterial
          color={renderMode === "qa" ? "#d1d5db" : "#ff6e4f"}
          emissive={renderMode === "qa" ? "#000000" : "#ff5136"}
          emissiveIntensity={renderMode === "qa" ? 0 : 0.95}
          transparent
          opacity={renderMode === "qa" ? 0.05 : 0.11}
        />
      </mesh>

      <points ref={particlesRef} position={position}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={particleData.length / 3} array={particleData} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color={renderMode === "qa" ? "#e5e7eb" : "#ff9e84"} size={0.01} transparent opacity={renderMode === "qa" ? 0.18 : 0.4} sizeAttenuation />
      </points>

      <pointLight
        position={position}
        color={renderMode === "qa" ? "#f8fafc" : "#ff4d33"}
        intensity={renderMode === "qa" ? 0.12 : 0.9 + clamp01(intensity) * 1.5 + stage * 0.25}
        distance={1.3}
        decay={2.1}
      />

      {hovered && label && (
        <Html position={[position[0], position[1] + baseRadius + 0.35, position[2]]}>
          <div className="rounded-lg border border-red-300/40 bg-red-700/90 px-3 py-1.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap">
            {label} • Stage {stage}
          </div>
        </Html>
      )}
    </group>
  );
}

function GLTFLungSystem({
  focusRegion,
  diseaseLabel,
  animate,
  renderMode,
  progressionStage,
  onLoadFailed,
}: {
  focusRegion: FocusRegion;
  diseaseLabel: string;
  animate: boolean;
  renderMode: RenderMode;
  progressionStage: 0 | 1 | 2 | 3;
  onLoadFailed: () => void;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const [root, setRoot] = useState<THREE.Group | null>(null);
  const [lobeMeshes, setLobeMeshes] = useState<LobeMeshMap>({});

  const focusLobe = useMemo(() => getFocusLobe(focusRegion), [focusRegion]);
  const severityMap = useMemo(
    () => computeLobeSeverities(progressionStage, focusLobe, focusRegion.intensity),
    [progressionStage, focusLobe, focusRegion.intensity],
  );

  useEffect(() => {
    let disposed = false;
    const timeout = window.setTimeout(() => {
      if (!disposed && !root) onLoadFailed();
    }, 2200);

    const loader = new GLTFLoader();
    loader.load(
      "/models/medical_lungs.glb",
      (gltf) => {
        if (disposed) return;
        const loaded = gltf.scene;
        fitRootToCenteredSpan(loaded, 2.15);
        setLobeMeshes(findNamedLobeMeshes(loaded));
        setRoot(loaded);
        window.clearTimeout(timeout);
      },
      undefined,
      () => {
        if (disposed) return;
        window.clearTimeout(timeout);
        onLoadFailed();
      },
    );

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
    };
  }, [onLoadFailed, root]);

  useEffect(() => {
    if (!root) return;

    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const lowerName = (mesh.name || "").toLowerCase();
      const lobe = LOBE_NAMES.find((n) => lowerName.includes(n));
      const severity = lobe ? severityMap[lobe] : 0;
      const overlay = severityColor(severity);
      const base = renderMode === "qa" ? new THREE.Color("#b9bec6") : new THREE.Color("#e9a7aa");
      const color = renderMode === "qa" ? base : base.clone().lerp(overlay, 0.64 * severity);

      mesh.material = new THREE.MeshPhysicalMaterial({
        color,
        roughness: renderMode === "qa" ? 0.95 : renderMode === "ct" ? 0.88 : 0.92,
        metalness: 0,
        clearcoat: renderMode === "qa" ? 0.02 : renderMode === "ct" ? 0.08 : 0.14,
        clearcoatRoughness: 0.9,
        transparent: renderMode === "ct",
        opacity: renderMode === "ct" ? 0.44 : 1,
        transmission: renderMode === "ct" ? 0.08 : 0,
        side: THREE.DoubleSide,
        emissive: renderMode === "qa" ? new THREE.Color("#000000") : overlay.clone().multiplyScalar(0.2 + severity * 0.18),
        emissiveIntensity: renderMode === "qa" ? 0 : renderMode === "ct" ? 0.24 : 0.16,
      });

      mesh.visible = true;
      mesh.frustumCulled = false;
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
    });
  }, [root, renderMode, severityMap]);

  useFrame(({ clock }) => {
    if (!animate || !rootRef.current) return;
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 1.14) * 0.016;
    rootRef.current.scale.set(1 + Math.sin(t * 1.01) * 0.01, breathe, 1 + Math.sin(t * 1.2 + 0.18) * 0.008);
  });

  const focusMesh = lobeMeshes[focusLobe];
  const lesionPos = mapFocusToLobeVolume(focusMesh, focusRegion);

  if (!root) return null;

  return (
    <group ref={rootRef}>
      <primitive object={root} />
      <InfectionMarker
        position={lesionPos}
        intensity={focusRegion.intensity}
        stage={progressionStage}
        label={`${diseaseLabel} (${focusLobe.replace(/_/g, " ")})`}
        renderMode={renderMode}
      />
    </group>
  );
}

function ProceduralFallback({
  focusRegion,
  diseaseLabel,
  progressionStage,
  renderMode,
}: {
  focusRegion: FocusRegion;
  diseaseLabel: string;
  progressionStage: 0 | 1 | 2 | 3;
  renderMode: RenderMode;
}) {
  const leftGeo = useMemo(() => new THREE.SphereGeometry(0.56, 48, 48), []);
  const rightGeo = useMemo(() => new THREE.SphereGeometry(0.58, 48, 48), []);
  const lobe = getFocusLobe(focusRegion);
  const pos = mapFocusToLobeVolume(undefined, focusRegion);

  return (
    <group>
      <mesh geometry={leftGeo} position={[-0.63, 0.03, 0]} scale={[0.78, 1.16, 0.7]}>
        <meshPhysicalMaterial color={renderMode === "qa" ? "#bfc4cc" : "#e3a6aa"} roughness={0.9} metalness={0} />
      </mesh>
      <mesh geometry={rightGeo} position={[0.63, 0.03, 0]} scale={[0.82, 1.18, 0.73]}>
        <meshPhysicalMaterial color={renderMode === "qa" ? "#c9ced5" : "#e7adb0"} roughness={0.9} metalness={0} />
      </mesh>
      <InfectionMarker
        position={pos}
        intensity={focusRegion.intensity}
        stage={progressionStage}
        label={`${diseaseLabel} (${lobe.replace(/_/g, " ")})`}
        renderMode={renderMode}
      />
    </group>
  );
}

export default function LungVisualization({
  focusRegion,
  diseaseLabel = "Affected Region",
  animate = true,
}: LungVisualizationProps) {
  const [renderMode, setRenderMode] = useState<RenderMode>("standard");
  const [progressionStage, setProgressionStage] = useState<0 | 1 | 2 | 3>(1);
  const [webglSupported, setWebglSupported] = useState(true);
  const [glbFailed, setGlbFailed] = useState(false);

  const fr = focusRegion || { x: 0.5, y: 0.5, intensity: 0.5 };

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const supported = !!(
        canvas.getContext("webgl") ||
        canvas.getContext("webgl2") ||
        canvas.getContext("experimental-webgl")
      );
      setWebglSupported(supported);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  if (!webglSupported) {
    return (
      <div className="h-full min-h-[420px] w-full rounded-xl bg-slate-900 p-6 text-center text-slate-300">
        WebGL is unavailable. 3D visualization cannot be rendered in this browser.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <Canvas
        camera={{ position: [0, 0, 3.1], fov: 38, near: 0.01, far: 100 }}
        dpr={[1, 1.7]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          const renderer = gl as THREE.WebGLRenderer & {
            physicallyCorrectLights?: boolean;
            useLegacyLights?: boolean;
          };
          if ("physicallyCorrectLights" in renderer) renderer.physicallyCorrectLights = true;
          if ("useLegacyLights" in renderer) renderer.useLegacyLights = false;
        }}
      >
        {renderMode === "qa" ? (
          <>
            <fog attach="fog" args={["#111827", 3.8, 8.2]} />
            <ambientLight intensity={0.09} />
            <directionalLight position={[4.2, 5.2, 2.8]} intensity={1.7} color="#ffffff" />
          </>
        ) : (
          <>
            <fog attach="fog" args={["#0a0f1f", 2, 6]} />
            <ambientLight intensity={0.52} />
            <hemisphereLight args={["#d6edff", "#1c2433", 0.58]} />
            <directionalLight position={[4, 5, 3]} intensity={1.5} color="#ffffff" />
            <directionalLight position={[-3.6, 1.4, -3.2]} intensity={0.45} color="#8bc0e9" />
            <pointLight position={[0, 0.4, -2.4]} intensity={0.32} color="#66b8ff" />
            <spotLight position={[0, 2.8, 2.5]} angle={0.44} penumbra={0.7} intensity={0.32} color="#9ed8ff" />
          </>
        )}

        {glbFailed ? (
          <ProceduralFallback
            focusRegion={fr}
            diseaseLabel={diseaseLabel}
            progressionStage={progressionStage}
            renderMode={renderMode}
          />
        ) : (
          <GLTFLungSystem
            focusRegion={fr}
            diseaseLabel={diseaseLabel}
            animate={animate}
            renderMode={renderMode}
            progressionStage={progressionStage}
            onLoadFailed={() => setGlbFailed(true)}
          />
        )}

        <OrbitControls
          enablePan
          enableDamping
          dampingFactor={0.07}
          minDistance={0.68}
          maxDistance={7.4}
          minPolarAngle={0.01}
          maxPolarAngle={Math.PI - 0.01}
          rotateSpeed={0.85}
          zoomSpeed={1.2}
          panSpeed={0.55}
          autoRotate={false}
        />
      </Canvas>

      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRenderMode("standard")}
          className={`rounded-md border px-3 py-1.5 text-[10px] font-mono font-semibold tracking-wider ${
            renderMode === "standard"
              ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100"
              : "border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
          }`}
        >
          STANDARD
        </button>
        <button
          type="button"
          onClick={() => setRenderMode("ct")}
          className={`rounded-md border px-3 py-1.5 text-[10px] font-mono font-semibold tracking-wider ${
            renderMode === "ct"
              ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-100"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          }`}
        >
          CT MODE
        </button>
        <button
          type="button"
          onClick={() => setRenderMode("qa")}
          className={`rounded-md border px-3 py-1.5 text-[10px] font-mono font-semibold tracking-wider ${
            renderMode === "qa"
              ? "border-slate-100/60 bg-slate-500/25 text-slate-50"
              : "border-slate-400/30 bg-slate-500/10 text-slate-300"
          }`}
        >
          SILHOUETTE QA
        </button>
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-slate-500/20 bg-slate-900/55 px-2 py-1 backdrop-blur-sm">
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setProgressionStage(s as 0 | 1 | 2 | 3)}
            className={`rounded px-2 py-1 text-[10px] font-semibold ${
              progressionStage === s
                ? "bg-red-500/75 text-white"
                : "bg-slate-700/60 text-slate-200 hover:bg-slate-600/70"
            }`}
          >
            S{s}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="text-[10px] font-medium text-slate-300">Low AI Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="text-[10px] font-medium text-slate-300">Moderate Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-[10px] font-medium text-slate-300">High Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-orange-300 shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
          <span className="text-[10px] font-medium text-slate-300">Active Lesion</span>
        </div>
      </div>
    </div>
  );
}
