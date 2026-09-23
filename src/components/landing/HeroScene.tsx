'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { asoEbiProject } from '../../data/demoData';

const BEATS = {
  project: [0, 0.2],
  materials: [0.2, 0.45],
  costs: [0.45, 0.65],
  deliver: [0.65, 0.8],
  gap: [0.8, 1],
} as const;

interface HeroSceneProps {
  progress: number;
}

function clampProgress(value: number, [start, end]: readonly [number, number]) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function sceneColor(hex: string, opacity: number) {
  const color = new THREE.Color(hex);
  color.multiplyScalar(0.82 + opacity * 0.18);
  return color;
}

function CuttingTable() {
  return (
    <mesh position={[0, -0.18, -1.05]}>
      <boxGeometry args={[7.2, 4.2, 0.12]} />
      <meshStandardMaterial color="#f4f0e8" roughness={0.94} metalness={0.01} />
    </mesh>
  );
}

function ProjectSheet({ progress }: HeroSceneProps) {
  const reveal = easeOutCubic(clampProgress(progress, BEATS.project));
  const deliver = smoothStep(clampProgress(progress, BEATS.deliver));
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(performance.now() * 0.00035) * 0.012;
    ref.current.position.y = Math.sin(performance.now() * 0.00045) * 0.025;
    ref.current.rotation.y += delta * 0.02;
  });

  return (
    <group ref={ref} position={[-1.72, -0.82, -0.35]} scale={reveal * 0.82}>
      <mesh>
        <boxGeometry args={[2.35, 1.45, 0.12]} />
        <meshStandardMaterial color="#faf8f4" roughness={0.82} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.38, 0.08]}>
        <boxGeometry args={[1.65, 0.08, 0.025]} />
        <meshStandardMaterial color="#b8944f" roughness={0.65} />
      </mesh>
      <mesh position={[-0.48, -0.02, 0.08]} scale={[1, 1 - deliver * 0.15, 1]}>
        <boxGeometry args={[0.75, 0.08, 0.025]} />
        <meshStandardMaterial color="#383f52" roughness={0.7} />
      </mesh>
      <mesh position={[0.42, -0.02, 0.08]} scale={[1, 1 - deliver * 0.15, 1]}>
        <boxGeometry args={[0.55, 0.08, 0.025]} />
        <meshStandardMaterial color="#a7acb9" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.38, 0.08]} scale={[1 + deliver * 0.15, 1, 1]}>
        <boxGeometry args={[1.8, 0.045, 0.025]} />
        <meshStandardMaterial color="#d9d0c2" roughness={0.8} />
      </mesh>
      <mesh position={[-0.82, 0.48, 0.1]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.055, 0.055, 0.08, 16]} />
        <meshPhysicalMaterial color="#b8944f" metalness={0.6} roughness={0.28} clearcoat={0.45} />
      </mesh>
    </group>
  );
}

function RevenueMarker({ progress }: HeroSceneProps) {
  const reveal = easeOutCubic(clampProgress(progress, BEATS.project));
  const separate = smoothStep(clampProgress(progress, BEATS.deliver));
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.28;
  });

  return (
    <mesh ref={ref} position={[-2.95 - separate * 0.22 - gap * 0.2, -0.74, 0.15]} scale={reveal * 0.48} rotation={[Math.PI / 2.15, 0, 0]}>
      <cylinderGeometry args={[0.7, 0.7, 0.15, 48]} />
      <meshPhysicalMaterial color="#b8944f" metalness={0.45} roughness={0.36} clearcoat={0.35} />
    </mesh>
  );
}

function CostPacket({ amount, index, progress }: { amount: number; index: number; progress: number }) {
  const wave = index < 2 ? BEATS.materials : BEATS.costs;
  const staggeredStart = wave[0] + (index % 2) * 0.06;
  const reveal = easeOutCubic(clampProgress(progress, [staggeredStart, wave[1]]));
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const maxAmount = Math.max(...asoEbiProject.costs.map((cost) => cost.amount));
  const size = 0.34 + (amount / maxAmount) * 0.32;
  const y = 0.25 - index * 0.42;
  const x = 2.08 + gap * 0.65;
  const color = index < 2 ? '#383f52' : '#6b7286';

  return (
    <group position={[x, y, 0.1]} scale={reveal}>
      <mesh rotation={[0, 0, index % 2 === 0 ? -0.06 : 0.06]}>
        <boxGeometry args={[size, 0.28, 0.18]} />
        <meshStandardMaterial color={sceneColor(color, 1 - gap * 0.35)} roughness={0.74} />
      </mesh>
      <mesh position={[-size * 0.2, 0, 0.1]}>
        <boxGeometry args={[size * 0.45, 0.035, 0.02]} />
        <meshStandardMaterial color="#d9d0c2" roughness={0.8} />
      </mesh>
      <mesh position={[size * 0.22, 0.11, 0.14]}>
        <cylinderGeometry args={[0.045, 0.045, 0.08, 14]} />
        <meshPhysicalMaterial color="#b8944f" metalness={0.58} roughness={0.3} clearcoat={0.4} />
      </mesh>
    </group>
  );
}

function CashThread({ progress }: HeroSceneProps) {
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const deliver = smoothStep(clampProgress(progress, BEATS.deliver));
  const points = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.52, -0.7, 0.25),
      new THREE.Vector3(-1.35, -0.7 + deliver * 0.08, 0.25),
      new THREE.Vector3(0.55, -0.7 - gap * 0.32, 0.25),
      new THREE.Vector3(1.85 + gap * 0.55, -0.7 - gap * 0.32, 0.25),
    ]);
    return curve.getPoints(32);
  }, [deliver, gap]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={gap > 0.1 ? '#8a2c2c' : '#b8944f'} transparent opacity={0.8} linewidth={2} />
    </lineSegments>
  );
}

function GapMarker({ progress }: HeroSceneProps) {
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const height = 0.12 + gap * 1.45;
  return (
    <group position={[0.72 + gap * 0.35, -0.72, 0.18]}>
      <mesh scale={[1, height, 1]}>
        <boxGeometry args={[0.035, 1, 0.035]} />
        <meshBasicMaterial color="#8a2c2c" transparent opacity={0.25 + gap * 0.7} />
      </mesh>
      <mesh position={[0, height * 0.5, 0]} scale={0.07 + gap * 0.04}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#8a2c2c" transparent opacity={gap} />
      </mesh>
    </group>
  );
}

function Scene({ progress }: HeroSceneProps) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#fffaf0" />
      <pointLight position={[-3, 1, 3]} intensity={0.35} color="#b8944f" />
      <CuttingTable />
      <ProjectSheet progress={progress} />
      <RevenueMarker progress={progress} />
      {asoEbiProject.costs.map((cost, index) => (
        <CostPacket key={cost.id} amount={cost.amount} index={index} progress={progress} />
      ))}
      <CashThread progress={progress} />
      <GapMarker progress={progress} />
    </>
  );
}

export function HeroScene({ progress }: HeroSceneProps) {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setCompact(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ position: [0, compact ? 0.25 : 0.35, compact ? 8.8 : 6.8], fov: compact ? 46 : 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
    >
      <Scene progress={progress} />
    </Canvas>
  );
}
