'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { asoEbiProject } from '../../data/demoData';
import { HERO_BEAT_RANGES as BEATS } from '../../lib/heroBeats';

interface HeroSceneProps {
  progress: number;
}

function clampProgress(value: number, [start, end]: readonly [number, number]) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

/**
 * easeOutCubic(0) is exactly 0, so anything scaled by a raw `reveal` value
 * is invisible at rest (progress = 0) — before the visitor has scrolled at
 * all, which is the very first thing they see. Floors the low end so the
 * job sheet and revenue marker are faintly present from first paint,
 * inviting the scroll rather than greeting it with an empty table.
 */
function easeOutCubicFloored(value: number, floor = 0.22) {
  return floor + easeOutCubic(value) * (1 - floor);
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function sceneColor(hex: string, opacity: number) {
  const color = new THREE.Color(hex);
  color.multiplyScalar(0.82 + opacity * 0.18);
  return color;
}

/** Lerps between two hex colors — used to carry the gap marker and cash
 * thread from tension-red to resolved-green as the `resolve` beat plays. */
function lerpColor(hexA: string, hexB: string, t: number) {
  return new THREE.Color(hexA).lerp(
    new THREE.Color(hexB),
    THREE.MathUtils.clamp(t, 0, 1),
  );
}

const THREAD_RED = '#8a2c2c';
const VERIFIED_GREEN = '#2f6b4f';
const GOLD = '#b8944f';

function CuttingTable() {
  return (
    <mesh position={[0, -0.18, -1.05]} receiveShadow>
      <boxGeometry args={[7.2, 4.2, 0.12]} />
      <meshStandardMaterial
        color="#f4f0e8"
        roughness={0.94}
        metalness={0.01}
      />
    </mesh>
  );
}

function ProjectSheet({ progress }: HeroSceneProps) {
  const reveal = easeOutCubicFloored(clampProgress(progress, BEATS.job));
  const deliver = smoothStep(clampProgress(progress, BEATS.deliver));
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;

    ref.current.rotation.z =
      Math.sin(performance.now() * 0.00035) * 0.012;

    ref.current.position.y =
      -0.82 + Math.sin(performance.now() * 0.00045) * 0.025;

    ref.current.rotation.y += delta * 0.02;
  });

  return (
    <group
      ref={ref}
      position={[-1.72, -0.82, -0.35]}
      scale={reveal * 0.82}
    >
      <mesh castShadow>
        <boxGeometry args={[2.35, 1.45, 0.12]} />
        <meshStandardMaterial
          color="#faf8f4"
          roughness={0.78}
          metalness={0.02}
        />
      </mesh>

      {/* A thin thread-red rule under the header line — the "atelier ledger"
          accent color, present from the first frame rather than only once
          the gap beat introduces red. Small, but it's what keeps the scene
          from reading as entirely gold/beige/gray before anything happens. */}
      <mesh position={[0, 0.38, 0.081]}>
        <boxGeometry args={[1.65, 0.02, 0.01]} />
        <meshStandardMaterial
          color={THREAD_RED}
          roughness={0.6}
        />
      </mesh>

      <mesh position={[0, 0.32, 0.08]}>
        <boxGeometry args={[1.65, 0.08, 0.025]} />
        <meshStandardMaterial
          color={GOLD}
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>

      <mesh
        position={[-0.48, -0.02, 0.08]}
        scale={[1, 1 - deliver * 0.15, 1]}
      >
        <boxGeometry args={[0.75, 0.08, 0.025]} />
        <meshStandardMaterial
          color="#383f52"
          roughness={0.7}
        />
      </mesh>

      <mesh
        position={[0.42, -0.02, 0.08]}
        scale={[1, 1 - deliver * 0.15, 1]}
      >
        <boxGeometry args={[0.55, 0.08, 0.025]} />
        <meshStandardMaterial
          color="#a7acb9"
          roughness={0.7}
        />
      </mesh>

      <mesh
        position={[0, -0.38, 0.08]}
        scale={[1 + deliver * 0.15, 1, 1]}
      >
        <boxGeometry args={[1.8, 0.045, 0.025]} />
        <meshStandardMaterial
          color="#d9d0c2"
          roughness={0.8}
        />
      </mesh>

      <mesh
        position={[-0.82, 0.48, 0.1]}
        rotation={[0, 0, -0.2]}
        castShadow
      >
        <cylinderGeometry args={[0.055, 0.055, 0.08, 16]} />
        <meshPhysicalMaterial
          color={GOLD}
          metalness={0.7}
          roughness={0.22}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
        />
      </mesh>
    </group>
  );
}

function RevenueMarker({ progress }: HeroSceneProps) {
  const reveal = easeOutCubicFloored(clampProgress(progress, BEATS.job));
  const separate = smoothStep(clampProgress(progress, BEATS.deliver));
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.28;
    }
  });

  // Settles very slightly back toward center as the story resolves — a
  // small, legible "things came back into balance" cue rather than being
  // left stranded at its most-separated position forever.
  const x = -2.95 - separate * 0.22 - gap * 0.2 + resolve * 0.08;

  return (
    <mesh
      ref={ref}
      position={[x, -0.74, 0.15]}
      scale={reveal * 0.48}
      rotation={[Math.PI / 2.15, 0, 0]}
      castShadow
    >
      <cylinderGeometry args={[0.7, 0.7, 0.15, 48]} />
      <meshPhysicalMaterial
        color={GOLD}
        metalness={0.55}
        roughness={0.28}
        clearcoat={0.55}
        clearcoatRoughness={0.2}
      />
    </mesh>
  );
}

function CostPacket({
  amount,
  index,
  progress,
}: {
  amount: number;
  index: number;
  progress: number;
}) {
  const wave = index < 2 ? BEATS.materials : BEATS.costs;
  const staggeredStart = wave[0] + (index % 2) * 0.06;
  const reveal = easeOutCubic(
    clampProgress(progress, [staggeredStart, wave[1]]),
  );

  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));
  const maxAmount = Math.max(
    ...asoEbiProject.costs.map((cost) => cost.amount),
  );

  const size = 0.34 + (amount / maxAmount) * 0.32;
  const y = 0.25 - index * 0.42;
  const x = 2.08 + gap * 0.65 - resolve * 0.15;
  const color = index < 2 ? '#383f52' : '#6b7286';

  // Dims during the gap (money's tied up, uncertain), recovers full
  // presence once resolved (accounted for, not lost).
  const dim = gap * 0.35 * (1 - resolve);

  return (
    <group
      position={[x, y, 0.1]}
      scale={reveal}
    >
      <mesh
        rotation={[0, 0, index % 2 === 0 ? -0.06 : 0.06]}
        castShadow
      >
        <boxGeometry args={[size, 0.28, 0.18]} />
        <meshStandardMaterial
          color={sceneColor(color, 1 - dim)}
          roughness={0.72}
        />
      </mesh>

      <mesh position={[-size * 0.2, 0, 0.1]}>
        <boxGeometry args={[size * 0.45, 0.035, 0.02]} />
        <meshStandardMaterial
          color="#d9d0c2"
          roughness={0.8}
        />
      </mesh>

      <mesh position={[size * 0.22, 0.11, 0.14]}>
        <cylinderGeometry args={[0.045, 0.045, 0.08, 14]} />
        <meshPhysicalMaterial
          color={GOLD}
          metalness={0.6}
          roughness={0.28}
          clearcoat={0.5}
        />
      </mesh>
    </group>
  );
}

function CashThread({ progress }: HeroSceneProps) {
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const deliver = smoothStep(clampProgress(progress, BEATS.deliver));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));

  const points = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.52, -0.7, 0.25),
      new THREE.Vector3(
        -1.35,
        -0.7 + deliver * 0.08,
        0.25,
      ),
      new THREE.Vector3(
        0.55,
        -0.7 -
          gap * 0.32 *
            (1 - resolve * 0.7),
        0.25,
      ),
      new THREE.Vector3(
        1.85 + gap * 0.55,
        -0.7 -
          gap * 0.32 *
            (1 - resolve * 0.7),
        0.25,
      ),
      // Fifth point: only pulls up into view as `resolve` advances, so the
      // line visibly climbs back toward the baseline — the "recovery" beat.
      new THREE.Vector3(
        2.9 + gap * 0.55,
        -0.7 -
          gap * 0.32 *
            (1 - resolve),
        0.25,
      ),
    ]);

    return curve.getPoints(48);
  }, [deliver, gap, resolve]);

  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points],
  );

  const color = useMemo(() => {
    if (resolve > 0.05) {
      return lerpColor(
        THREAD_RED,
        VERIFIED_GREEN,
        resolve,
      );
    }

    return gap > 0.1
      ? new THREE.Color(THREAD_RED)
      : new THREE.Color(GOLD);
  }, [gap, resolve]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.85}
        linewidth={2}
      />
    </line>
  );
}

/**
 * The tension/resolution beat. During `gap` it grows into a red marker —
 * the cash-gap warning. During `resolve` the SAME object eases down and
 * shifts to verified-green, so the resolution reads as "this settled,"
 * not as a second, disconnected "good news" prop appearing from nowhere.
 */
function GapMarker({ progress }: HeroSceneProps) {
  const tension = smoothStep(clampProgress(progress, BEATS.gap));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));

  const height =
    (0.12 + tension * 1.45) *
    (1 - resolve * 0.42);

  const color = useMemo(
    () => lerpColor(
      THREAD_RED,
      VERIFIED_GREEN,
      resolve,
    ),
    [resolve],
  );

  const opacity = Math.max(
    0.25 + tension * 0.7,
    resolve > 0 ? 0.55 : 0,
  );

  return (
    <group
      position={[
        0.72 +
          tension * 0.35 -
          resolve * 0.1,
        -0.72,
        0.18,
      ]}
    >
      <mesh scale={[1, height, 1]}>
        <boxGeometry args={[0.035, 1, 0.035]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.4}
        />
      </mesh>

      <mesh
        position={[0, height * 0.5, 0]}
        scale={
          0.07 +
          tension * 0.04 +
          resolve * 0.02
        }
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          metalness={0.3}
          roughness={0.35}
          clearcoat={0.4}
          transparent
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}

/**
 * Scroll-tied camera dolly: a calm establishing distance at rest, a slow
 * push-in through the materials/costs/deliver beats (raises stakes), and
 * a gentle pull-back with a small upward drift during `resolve` (an
 * exhale). A camera that never moves across a five/six-part story is one
 * of the more common reasons a "cinematic" scroll piece still reads as
 * static — this is the one structural motion change in this pass.
 */
function CameraRig({
  progress,
  compact,
}: {
  progress: number;
  compact: boolean;
}) {
  const { camera } = useThree();
  const baseZ = compact ? 8.8 : 6.8;
  const baseY = compact ? 0.25 : 0.35;

  useFrame(() => {
    const pushIn = smoothStep(
      clampProgress(progress, [
        BEATS.materials[0],
        BEATS.gap[1],
      ]),
    );

    const resolve = smoothStep(
      clampProgress(progress, BEATS.resolve),
    );

    const targetZ =
      baseZ -
      pushIn * (compact ? 0.5 : 0.75) +
      resolve * (compact ? 0.3 : 0.45);

    const targetY =
      baseY + resolve * 0.12;

    const targetX =
      pushIn * -0.12 +
      resolve * 0.08;

    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetZ,
      3.2,
      1 / 60,
    );

    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      targetY,
      3.2,
      1 / 60,
    );

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      targetX,
      3.2,
      1 / 60,
    );

    camera.lookAt(0, -0.35, 0);
  });

  return null;
}

function Scene({
  progress,
  compact,
}: HeroSceneProps & {
  compact: boolean;
}) {
  return (
    <>
      {/* Lower ambient than before: flat, high ambient light is a common
          reason a scene reads as "muted" or without real form — it washes
          out the shading that gives objects dimension. A single clear key
          light plus a soft cool fill plus a low warm rim gives the gold
          pieces something to actually catch. */}
      <ambientLight intensity={0.38} />

      <directionalLight
        position={[3, 5, 4]}
        intensity={1.6}
        color="#fffaf0"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <directionalLight
        position={[-3, 1.5, 2]}
        intensity={0.3}
        color="#dfe6f0"
      />

      <pointLight
        position={[-2.4, 0.6, 2.6]}
        intensity={0.4}
        color={GOLD}
      />

      <CameraRig
        progress={progress}
        compact={compact}
      />

      <CuttingTable />
      <ProjectSheet progress={progress} />
      <RevenueMarker progress={progress} />

      {asoEbiProject.costs.map((cost, index) => (
        <CostPacket
          key={cost.id}
          amount={cost.amount}
          index={index}
          progress={progress}
        />
      ))}

      <CashThread progress={progress} />
      <GapMarker progress={progress} />

      {/* Grounds the objects with soft contact shadows — a cheap, reliable
          depth cue that reads as "considered" without needing a full HDRI
          pass. Environment adds real reflections onto the gold clearcoat
          materials (the coin, the seal, the packet clasps) so they read as
          glossy/premium rather than flat-shaded; both degrade gracefully
          (Suspense) if their assets are slow to arrive. */}
      <ContactShadows
        position={[0, -0.95, 0]}
        opacity={0.35}
        scale={8}
        blur={2.4}
        far={2}
      />

      <Suspense fallback={null}>
        <Environment
          preset="studio"
          environmentIntensity={0.5}
        />
      </Suspense>
    </>
  );
}

export function HeroScene({
  progress,
}: HeroSceneProps) {
  const [compact, setCompact] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth < 640,
  );

  useEffect(() => {
    const handleResize = () =>
      setCompact(window.innerWidth < 640);

    window.addEventListener(
      'resize',
      handleResize,
    );

    return () =>
      window.removeEventListener(
        'resize',
        handleResize,
      );
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      shadows="soft"
      camera={{
        position: [
          0,
          compact ? 0.25 : 0.35,
          compact ? 8.8 : 6.8,
        ],
        fov: compact ? 46 : 38,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{
        background: 'transparent',
      }}
    >
      <Scene
        progress={progress}
        compact={compact}
      />
    </Canvas>
  );
}
