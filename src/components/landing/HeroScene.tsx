'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { kemiProject } from '../../data/demoData';
import { kemiPersona } from '../../data/demoPersona';
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
 * DM card and deal marker are faintly present from first paint, inviting
 * the scroll rather than greeting it with an empty desk.
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

/** Lerps between two hex colors — used to carry the decision marker and
 * agreement thread from tension-red to resolved-green as the `resolve`
 * beat plays. */
function lerpColor(hexA: string, hexB: string, t: number) {
  return new THREE.Color(hexA).lerp(new THREE.Color(hexB), THREE.MathUtils.clamp(t, 0, 1));
}

const THREAD_RED = '#8a2c2c';
const VERIFIED_GREEN = '#2f6b4f';
const GOLD = '#b8944f';

/**
 * Flattens the canonical scope (demoPersona.ts) into one tile per
 * deliverable — 3 TikTok + 2 Instagram — plus one extra, pending tile for
 * the change request. Reading straight from kemiPersona rather than
 * hardcoding "3 TikToks" a second time here, so the 3D scene can never
 * quietly drift from the numbers the rest of the page reads from.
 */
function useScopeTiles() {
  return useMemo(() => {
    const scope = kemiProject.scope ?? kemiPersona.scope;
    const tiles: { id: string; kind: 'tiktok' | 'instagram'; pending?: boolean }[] = [];
    for (const item of scope) {
      const kind: 'tiktok' | 'instagram' = item.unit.toLowerCase().includes('video') ? 'tiktok' : 'instagram';
      for (let i = 0; i < item.quantity; i++) tiles.push({ id: `${item.id}-${i}`, kind });
    }
    const changeRequest = kemiProject.changeRequests?.[0] ?? kemiPersona.changeRequest;
    if (changeRequest) tiles.push({ id: changeRequest.id, kind: 'tiktok', pending: true });
    return tiles;
  }, []);
}

function Desk() {
  return (
    <mesh position={[0, -0.18, -1.05]} receiveShadow>
      <boxGeometry args={[7.2, 4.2, 0.12]} />
      <meshStandardMaterial color="#f4f0e8" roughness={0.94} metalness={0.01} />
    </mesh>
  );
}

/**
 * The opening beat: a DM notification card. Same rounded-card + header-
 * rule + body-line construction the old "job sheet" used (proven to read
 * well at this scale), restyled as a phone notification: a small circular
 * avatar top-left, a red unread dot that fades once the scope is agreed
 * (the `materials` beat), and body lines that condense into a single
 * settled line once delivery is underway (`deliver`).
 */
function DMNotification({ progress }: HeroSceneProps) {
  const reveal = easeOutCubicFloored(clampProgress(progress, BEATS.job));
  const agreed = smoothStep(clampProgress(progress, BEATS.materials));
  const deliver = smoothStep(clampProgress(progress, BEATS.deliver));
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(performance.now() * 0.00035) * 0.012;
    ref.current.position.y = -0.82 + Math.sin(performance.now() * 0.00045) * 0.025;
    ref.current.rotation.y += delta * 0.02;
  });

  return (
    <group ref={ref} position={[-1.72, -0.82, -0.35]} scale={reveal * 0.82}>
      <mesh castShadow>
        <boxGeometry args={[2.1, 1.55, 0.12]} />
        <meshStandardMaterial color="#faf8f4" roughness={0.78} metalness={0.02} />
      </mesh>
      {/* Circular avatar, top-left — "a brand" rather than "a person" — with
          a small unread dot that fades out as the scope gets agreed. */}
      <mesh position={[-0.78, 0.5, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 24]} />
        <meshStandardMaterial color="#383f52" roughness={0.6} />
      </mesh>
      <mesh position={[-0.68, 0.62, 0.1]} scale={0.06 * Math.max(0, 1 - agreed)}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={THREAD_RED} transparent opacity={Math.max(0, 1 - agreed)} />
      </mesh>
      {/* Header rule — the "atelier ledger" gold accent, present from the
          first frame rather than only once a later beat introduces color. */}
      <mesh position={[0.15, 0.38, 0.081]}>
        <boxGeometry args={[1.35, 0.02, 0.01]} />
        <meshStandardMaterial color={GOLD} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Message lines: two lines at rest ("3 TikToks, 2 IG posts, then:
          can you add one more?"), condensing to one settled line once
          delivery is underway. */}
      <mesh position={[0.02, -0.02, 0.08]} scale={[1, 1 - deliver * 0.15, 1]}>
        <boxGeometry args={[0.95, 0.08, 0.025]} />
        <meshStandardMaterial color="#383f52" roughness={0.7} />
      </mesh>
      <mesh position={[0.42, -0.22, 0.08]} scale={[1, 1 - deliver * 0.15, 1]}>
        <boxGeometry args={[0.35, 0.08, 0.025]} />
        <meshStandardMaterial color="#a7acb9" roughness={0.7} />
      </mesh>
      <mesh position={[0.15, -0.42, 0.08]} scale={[1 + deliver * 0.15, 1, 1]}>
        <boxGeometry args={[1.55, 0.045, 0.025]} />
        <meshStandardMaterial color="#d9d0c2" roughness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * The deal total. Same rotating-coin mechanic as before — still the right
 * shape for "one number that matters" — but now visibly ticks up (a small
 * scale "pop") the moment the change request resolves, from ₦300,000 to
 * ₦330,000, rather than just sliding into a resting position.
 */
function DealMarker({ progress }: HeroSceneProps) {
  const reveal = easeOutCubicFloored(clampProgress(progress, BEATS.job));
  const separate = smoothStep(clampProgress(progress, BEATS.deliver));
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.28;
  });

  const x = -2.95 - separate * 0.22 - gap * 0.2 + resolve * 0.08;
  // A brief bump right as the total updates — the "it just ticked up" cue.
  const bump = 1 + Math.sin(resolve * Math.PI) * 0.1;

  return (
    <mesh ref={ref} position={[x, -0.74, 0.15]} scale={reveal * 0.48 * bump} rotation={[Math.PI / 2.15, 0, 0]} castShadow>
      <cylinderGeometry args={[0.7, 0.7, 0.15, 48]} />
      <meshPhysicalMaterial color={GOLD} metalness={0.55} roughness={0.28} clearcoat={0.55} clearcoatRoughness={0.2} />
    </mesh>
  );
}

/**
 * One deliverable tile — a locked TikTok/Instagram piece, or (the last
 * one) the pending "one more video" ask. Locked tiles are solid from the
 * moment they reveal. The pending tile starts as a red wireframe — visibly
 * still just a question — and MATERIALIZES into a solid, verified-green
 * tile as `resolve` plays, the same object throughout rather than a solid
 * tile swapped in for a wireframe one.
 */
function ScopeTile({
  tile,
  index,
  progress,
}: {
  tile: { id: string; kind: 'tiktok' | 'instagram'; pending?: boolean };
  index: number;
  progress: number;
}) {
  const wave = tile.pending ? BEATS.costs : BEATS.materials;
  const staggeredStart = wave[0] + (index % 3) * 0.035;
  const reveal = easeOutCubic(clampProgress(progress, [staggeredStart, wave[1]]));
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));

  const portrait = tile.kind === 'tiktok';
  const width = portrait ? 0.26 : 0.34;
  const height = portrait ? 0.4 : 0.34;
  const row = Math.floor(index / 3);
  const col = index % 3;
  const x = 1.62 + col * 0.36;
  const y = 0.22 - row * 0.46;
  const z = 0.1 + (tile.pending ? gap * 0.12 : 0);
  const bump = tile.pending ? 1 + Math.sin(resolve * Math.PI) * 0.08 : 1;

  return (
    <group position={[x, y, z]} scale={reveal * bump}>
      {tile.pending ? (
        <>
          {/* Still just an ask — red wireframe, nothing agreed yet. */}
          <mesh rotation={[0, 0, 0.03]}>
            <boxGeometry args={[width, height, 0.04]} />
            <meshBasicMaterial color={THREAD_RED} wireframe transparent opacity={Math.max(0, (1 - resolve) * 0.9)} />
          </mesh>
          {/* Solidifies into a real, agreed deliverable once both sides approve. */}
          <mesh rotation={[0, 0, 0.03]}>
            <boxGeometry args={[width, height, 0.04]} />
            <meshStandardMaterial color={VERIFIED_GREEN} roughness={0.5} transparent opacity={resolve} />
          </mesh>
        </>
      ) : (
        <mesh rotation={[0, 0, index % 2 === 0 ? -0.03 : 0.03]} castShadow>
          <boxGeometry args={[width, height, 0.05]} />
          <meshStandardMaterial color={sceneColor('#262b39', 1 - gap * 0.2)} roughness={0.65} />
        </mesh>
      )}
      {/* Kind mark: a play-triangle for a TikTok, a lens-ring for an
          Instagram post — small, abstract, not a literal logo. */}
      {portrait ? (
        <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
          <coneGeometry args={[0.045, 0.09, 3]} />
          <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.3} />
        </mesh>
      ) : (
        <mesh position={[0, 0, 0.045]}>
          <torusGeometry args={[0.07, 0.018, 12, 24]} />
          <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

/**
 * The thread connecting the DM to the settled deal. Same curve mechanic
 * as before (still the right shape for "a thing running through the
 * whole story"): gold at rest, tension-red while the ask is unresolved,
 * lerping to verified-green as `resolve` plays.
 */
function AgreementThread({ progress }: HeroSceneProps) {
  const gap = smoothStep(clampProgress(progress, BEATS.gap));
  const deliver = smoothStep(clampProgress(progress, BEATS.deliver));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));

  const points = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.52, -0.7, 0.25),
      new THREE.Vector3(-1.35, -0.7 + deliver * 0.08, 0.25),
      new THREE.Vector3(0.55, -0.7 - gap * 0.32 * (1 - resolve * 0.7), 0.25),
      new THREE.Vector3(1.85 + gap * 0.55, -0.7 - gap * 0.32 * (1 - resolve * 0.7), 0.25),
      // Only pulls up into view as `resolve` advances, so the line visibly
      // climbs back toward the baseline — the "settled" beat.
      new THREE.Vector3(2.9 + gap * 0.55, -0.7 - gap * 0.32 * (1 - resolve), 0.25),
    ]);
    return curve.getPoints(48);
  }, [deliver, gap, resolve]);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const color = useMemo(() => {
    if (resolve > 0.05) return lerpColor(THREAD_RED, VERIFIED_GREEN, resolve);
    return gap > 0.1 ? new THREE.Color(THREAD_RED) : new THREE.Color(GOLD);
  }, [gap, resolve]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.85} linewidth={2} />
    </lineSegments>
  );
}

/**
 * The tension/resolution beat — "was that included, or extra?" During
 * `gap` it grows into a red marker (the open question). During `resolve`
 * the SAME object eases down and shifts to verified-green (the
 * classification is settled), so the resolution reads as "this got
 * decided," not as a second, disconnected prop appearing from nowhere.
 */
function DecisionMarker({ progress }: HeroSceneProps) {
  const tension = smoothStep(clampProgress(progress, BEATS.gap));
  const resolve = smoothStep(clampProgress(progress, BEATS.resolve));
  const height = (0.12 + tension * 1.45) * (1 - resolve * 0.42);
  const color = useMemo(() => lerpColor(THREAD_RED, VERIFIED_GREEN, resolve), [resolve]);
  const opacity = Math.max(0.25 + tension * 0.7, resolve > 0 ? 0.55 : 0);

  return (
    <group position={[0.72 + tension * 0.35 - resolve * 0.1, -0.72, 0.18]}>
      <mesh scale={[1, height, 1]}>
        <boxGeometry args={[0.035, 1, 0.035]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.4} />
      </mesh>
      <mesh position={[0, height * 0.5, 0]} scale={0.07 + tension * 0.04 + resolve * 0.02}>
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
 * exhale). Unchanged from the pre-pivot version — a camera move like this
 * is about pacing a story, not about which story it is.
 */
function CameraRig({ progress, compact }: { progress: number; compact: boolean }) {
  const { camera } = useThree();
  const baseZ = compact ? 8.8 : 6.8;
  const baseY = compact ? 0.25 : 0.35;

  useFrame(() => {
    const pushIn = smoothStep(clampProgress(progress, [BEATS.materials[0], BEATS.gap[1]]));
    const resolve = smoothStep(clampProgress(progress, BEATS.resolve));
    const targetZ = baseZ - pushIn * (compact ? 0.5 : 0.75) + resolve * (compact ? 0.3 : 0.45);
    const targetY = baseY + resolve * 0.12;
    const targetX = pushIn * -0.12 + resolve * 0.08;
    // Mutating the Three.js camera object directly, inside useFrame, is the
    // standard r3f pattern (useFrame runs on the render loop, outside
    // React's own render cycle, specifically so this is safe) — not the
    // kind of hook-value mutation the generic react-compiler lint rule is
    // meant to catch.
    // eslint-disable-next-line react-hooks/immutability
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.2, 1 / 60);
    // eslint-disable-next-line react-hooks/immutability
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.2, 1 / 60);
    // eslint-disable-next-line react-hooks/immutability
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.2, 1 / 60);
    camera.lookAt(0, -0.35, 0);
  });

  return null;
}

function Scene({ progress, compact }: HeroSceneProps & { compact: boolean }) {
  const scopeTiles = useScopeTiles();

  return (
    <>
      {/* Lower ambient than a flat scene would use: high ambient light is a
          common reason a scene reads as "muted" or without real form — it
          washes out the shading that gives objects dimension. A single
          clear key light plus a soft cool fill plus a low warm rim gives
          the gold pieces something to actually catch. */}
      <ambientLight intensity={0.38} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} color="#fffaf0" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 1.5, 2]} intensity={0.3} color="#dfe6f0" />
      <pointLight position={[-2.4, 0.6, 2.6]} intensity={0.4} color={GOLD} />

      <CameraRig progress={progress} compact={compact} />

      <Desk />
      <DMNotification progress={progress} />
      <DealMarker progress={progress} />
      {scopeTiles.map((tile, index) => (
        <ScopeTile key={tile.id} tile={tile} index={index} progress={progress} />
      ))}
      <AgreementThread progress={progress} />
      <DecisionMarker progress={progress} />

      {/* Grounds the objects with soft contact shadows — a cheap, reliable
          depth cue that reads as "considered" without needing a full HDRI
          pass. Environment adds real reflections onto the gold clearcoat
          materials (the coin, the play-marks, the lens-rings) so they read
          as glossy/premium rather than flat-shaded; both degrade
          gracefully (Suspense) if their assets are slow to arrive. */}
      <ContactShadows position={[0, -0.95, 0]} opacity={0.35} scale={8} blur={2.4} far={2} />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.5} />
      </Suspense>
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
      shadows="soft"
      camera={{ position: [0, compact ? 0.25 : 0.35, compact ? 8.8 : 6.8], fov: compact ? 46 : 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
    >
      <Scene progress={progress} compact={compact} />
    </Canvas>
  );
}
