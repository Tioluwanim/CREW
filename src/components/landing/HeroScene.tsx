import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { asoEbiProject } from '../../data/demoData';

// Beat ranges, matching the text beats in OpeningScene exactly (see the
// comment there) — this is the single source of truth both the text and
// this scene read their timing from indirectly, since both are driven by
// the same `progress` value from useScrollProgress.
const BEATS = {
  coinIn: [0, 0.2],
  costsWaveOne: [0.2, 0.45],
  costsWaveTwo: [0.45, 0.65],
  separate: [0.65, 0.8],
  gapWidens: [0.8, 1],
} as const;

function clampProgress(value: number, [start, end]: readonly [number, number]) {
  if (end === start) return value >= end ? 1 : 0;
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

interface HeroSceneProps {
  /** 0-1, driven by scroll — see useScrollProgress. Same driver as the beat text, never a second independent timer. */
  progress: number;
}

// Cost weights come from the canonical demo dataset, not hardcoded twice —
// the box sizes are proportional to Amara's actual materials/labour/
// transport/other costs.
const costWeights = asoEbiProject.costs.map((c) => c.amount);
const maxWeight = Math.max(...costWeights);
const MIN_SIZE = 0.32;
const MAX_SIZE = 0.95;

function sizeFor(amount: number) {
  return MIN_SIZE + (amount / maxWeight) * (MAX_SIZE - MIN_SIZE);
}

function RevenueCoin({ progress }: { progress: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const idleRotation = useRef(0);

  const inT = easeOutCubic(clampProgress(progress, BEATS.coinIn));
  const separateT = clampProgress(progress, BEATS.separate);
  const widenT = clampProgress(progress, BEATS.gapWidens);

  const scale = THREE.MathUtils.lerp(0, 1, inT);
  const x = THREE.MathUtils.lerp(0, -1.8, separateT) + THREE.MathUtils.lerp(0, -0.9, widenT);

  useFrame((_, delta) => {
    idleRotation.current += delta * 0.35;
    if (ref.current) ref.current.rotation.y = idleRotation.current;
  });

  return (
    <mesh ref={ref} position={[x, 0, 0]} scale={scale} rotation={[Math.PI / 2.4, 0, 0]}>
      <cylinderGeometry args={[1.05, 1.05, 0.22, 48]} />
      <meshPhysicalMaterial color="#b8944f" metalness={0.55} roughness={0.3} />
    </mesh>
  );
}

interface CostBlockProps {
  label: string;
  amount: number;
  index: number;
  progress: number;
}

function CostBlock({ amount, index, progress }: CostBlockProps) {
  const size = sizeFor(amount);
  const wave = index < 2 ? BEATS.costsWaveOne : BEATS.costsWaveTwo;
  // Stagger within the wave so blocks don't all pop at once.
  const staggerStart = wave[0] + (index % 2) * ((wave[1] - wave[0]) * 0.35);
  const inT = easeOutCubic(clampProgress(progress, [staggerStart, wave[1]] as const));

  const separateT = clampProgress(progress, BEATS.separate);
  const widenT = clampProgress(progress, BEATS.gapWidens);

  const baseAngle = (index / 4) * Math.PI * 2;
  const stackRadius = 0.75;
  const idleX = Math.cos(baseAngle) * stackRadius;
  const idleZ = Math.sin(baseAngle) * stackRadius;

  const groupX = THREE.MathUtils.lerp(1.6, 1.8, separateT) + THREE.MathUtils.lerp(0, 0.9, widenT);
  const scale = THREE.MathUtils.lerp(0, 1, inT);

  // Dim the cost side slightly as the gap widens — the "where did the
  // money go" emotional beat, per section 1's "dimming/highlight change."
  const dim = THREE.MathUtils.lerp(1, 0.55, widenT);

  return (
    <mesh position={[groupX + idleX * 0.4, index * 0.05, idleZ * 0.4]} scale={scale}>
      <boxGeometry args={[size, size * 0.55, size]} />
      <meshStandardMaterial color="#383f52" opacity={dim} transparent />
    </mesh>
  );
}

function Scene({ progress }: HeroSceneProps) {
  const costs = useMemo(() => asoEbiProject.costs, []);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} color="#faf8f4" />
      <pointLight position={[-3, -2, 3]} intensity={0.3} color="#8a2c2c" />
      <RevenueCoin progress={progress} />
      {costs.map((cost, i) => (
        <CostBlock key={cost.id} label={cost.label} amount={cost.amount} index={i} progress={progress} />
      ))}
    </>
  );
}

/**
 * Procedural, asset-free 3D backdrop for the landing page's opening scene.
 * Built entirely from primitive geometry (a cylinder "revenue coin" and
 * cost-weighted boxes) — no .glb/.splinecode file, so there's nothing to
 * author outside this codebase. Driven by the same scroll-progress value
 * as the beat text (see useScrollProgress), not a second independent timer.
 *
 * Sits behind the text layer (pointer-events disabled, z-index below).
 * Caller is responsible for the reduced-motion / capability fallback —
 * see OpeningScene, which only mounts this when motion is allowed.
 */
export function HeroScene({ progress }: HeroSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="always"
      camera={{ position: [0, 0.6, 6.5], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Scene progress={progress} />
    </Canvas>
  );
}
