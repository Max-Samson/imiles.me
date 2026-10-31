import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HeroPatternId, ParticlePattern } from '../hero-pattern-adapters';
import type { Point3D, ShapeConfig } from '../plexus-shapes';
import type { CursorState } from './PlexusScene';
import { particleFragmentShader, particleVertexShader } from './shaders';
import type { PlexusTheme } from './usePlexusTheme';

// =============================================================================
// Constants
// =============================================================================

const FRACTAL_LERP_SPEED = 1.2;
const FRACTAL_SCALE = 0.35;
const MICRO_JITTER = 0.15;
const Z_MID = 0;
const Z_RANGE = 8;

const CURSOR_STRENGTH = 8.0;
const CURSOR_RADIUS = 4.0;
const CURSOR_SOFTENING = 0.5;
const CURSOR_MAX_FORCE = 2.0;

interface ParticleFieldProps {
  adapter: ParticlePattern;
  count: number;
  theme: PlexusTheme;
  positionsBufferRef: React.MutableRefObject<Float32Array | null>;
  cursorRef: React.MutableRefObject<CursorState>;
  reducedMotion: boolean;
  onEntryChange?: (pattern: HeroPatternId, index: number) => void;
  onGroupAdvance?: () => void;
  isPaused?: boolean;
  connectionDistanceRef?: React.MutableRefObject<number>;
}
export function ParticleField({
  adapter,
  count,
  theme,
  positionsBufferRef,
  cursorRef,
  reducedMotion,
  onEntryChange,
  onGroupAdvance,
  isPaused = false,
  connectionDistanceRef,
}: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { viewport } = useThree();

  // Per-particle velocity storage (CPU-side physics)
  const velocities = useMemo(() => {
    const v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      v[i * 3] = (Math.random() - 0.5) * 0.008;
      v[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
      v[i * 3 + 2] = (Math.random() - 0.5) * 0.008;
    }
    return v;
  }, [count]);

  // Shape state refs
  const shapeTargetsRef = useRef<Point3D[]>([]);
  const currentShapeRef = useRef<ShapeConfig>(adapter.entries[0].shape);
  const angleRef = useRef({ x: 0, y: 0, z: 0 });

  // Pattern entry cycling refs
  const entryIndexRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const onEntryChangeRef = useRef(onEntryChange);
  onEntryChangeRef.current = onEntryChange;
  const onGroupAdvanceRef = useRef(onGroupAdvance);
  onGroupAdvanceRef.current = onGroupAdvance;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setEntry = useCallback(
    (idx: number) => {
      const normalizedIdx = idx % adapter.entries.length;
      const entry = adapter.entries[normalizedIdx];
      currentShapeRef.current = entry.shape;
      shapeTargetsRef.current = entry.shape.generate(count);
      angleRef.current = { x: 0, y: 0, z: 0 };
      onEntryChangeRef.current?.(adapter.id, normalizedIdx);
      if (connectionDistanceRef) {
        connectionDistanceRef.current =
          entry.connectionDistance?.(count) ?? adapter.connectionDistance?.(count) ?? 3.0;
      }
    },
    [adapter, count, connectionDistanceRef],
  );

  // Cycles through entries inside the adapter (or advances group when complete)
  useEffect(() => {
    entryIndexRef.current = 0;
    setEntry(0);

    if (reducedMotion) return;

    const scheduleNext = () => {
      const idx = entryIndexRef.current;
      const holdTime = adapter.entries[idx]?.holdMs || 30_000;
      timerRef.current = window.setTimeout(() => {
        if (!isPausedRef.current && !document.hidden) {
          if (adapter.entries.length === 1) {
            onGroupAdvanceRef.current?.();
          } else {
            const nextIdx = entryIndexRef.current + 1;
            if (nextIdx >= adapter.entries.length) {
              onGroupAdvanceRef.current?.();
            } else {
              entryIndexRef.current = nextIdx;
              setEntry(nextIdx);
              scheduleNext();
            }
          }
        } else {
          timerRef.current = window.setTimeout(scheduleNext, 500);
        }
      }, holdTime);
    };

    scheduleNext();
    return () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    };
  }, [adapter, reducedMotion, setEntry]);
  // Build geometry buffers
  const { geometry, positions } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);
    const ct = new Float32Array(count);

    const spread = Math.max(viewport.width, viewport.height) * 0.8;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 2] = (Math.random() - 0.5) * Z_RANGE * 2;
      sz[i] = 1.5 + Math.random() * 3.5;
      ph[i] = Math.random() * Math.PI * 2;
      ct[i] = (i * 0.6180339887) % 1;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    geo.setAttribute('aColorT', new THREE.BufferAttribute(ct, 1));

    return { geometry: geo, positions: pos };
  }, [count, viewport.width, viewport.height]);

  // Expose positions buffer to ConnectionLines
  useEffect(() => {
    positionsBufferRef.current = positions;
  }, [positions, positionsBufferRef]);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1.5 },
      uColor0: { value: theme.color0.clone() },
      uColor1: { value: theme.color1.clone() },
      uHdrIntensity: { value: theme.hdrIntensity },
    }),
    [theme],
  );

  // Animation frame
  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const dt = Math.min(delta, 0.1);

    uniforms.uTime.value += dt;
    const targets = shapeTargetsRef.current;
    const shape = currentShapeRef.current;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    const isStaticShape = shape.spinX === 0 && shape.spinY === 0 && shape.spinZ === 0;

    // Cursor state (hoisted before rotation matrix)
    const cursor = cursorRef.current;
    const cursorActive = cursor.active;
    const cursorX = cursor.x;
    const cursorY = cursor.y;
    const cursorMode = cursor.mode;

    // Rotation matrix for shape targets
    const angles = angleRef.current;
    if (isStaticShape) {
      // 静态文字/签名图案：始终保持正向朝向视口，仅在光标激活时带微幅弹性视差，离开后立即自愈复原至 (0, 0, 0)
      const targetX =
        cursorActive && !reducedMotion ? Math.max(-0.06, Math.min(0.06, -cursorY * 0.012)) : 0;
      const targetY =
        cursorActive && !reducedMotion ? Math.max(-0.06, Math.min(0.06, cursorX * 0.012)) : 0;
      const returnFactor = 1 - Math.exp(-6.0 * dt);
      angles.x += (targetX - angles.x) * returnFactor;
      angles.y += (targetY - angles.y) * returnFactor;
      angles.z += (0 - angles.z) * returnFactor;
    } else if (!reducedMotion) {
      angles.x += shape.spinX * dt;
      angles.y += shape.spinY * dt;
      angles.z += shape.spinZ * dt;
    }

    const cx = Math.cos(angles.x),
      sx = Math.sin(angles.x);
    const cy = Math.cos(angles.y),
      sy = Math.sin(angles.y);
    const cz = Math.cos(angles.z),
      sz = Math.sin(angles.z);

    const m00 = cz * cy;
    const m01 = cz * sy * sx - sz * cx;
    const m02 = cz * sy * cx + sz * sx;
    const m10 = sz * cy;
    const m11 = sz * sy * sx + cz * cx;
    const m12 = sz * sy * cx - cz * sx;
    const m20 = -sy;
    const m21 = cy * sx;
    const m22 = cy * cx;

    const sc = Math.min(viewport.width, viewport.height) * FRACTAL_SCALE * (shape.spread ?? 1);
    const jit = MICRO_JITTER * (shape.jitter ?? 1);
    const lerpT = reducedMotion ? 1 : 1 - Math.exp(-FRACTAL_LERP_SPEED * (shape.lerpMul ?? 1) * dt);
    const damp = 0.98 ** (dt * 60);
    const shapeDamp = (isStaticShape ? 0.78 : 0.9) ** (dt * 60);
    const time = uniforms.uTime.value;

    const radiusSq = CURSOR_RADIUS * CURSOR_RADIUS;
    const softeningSq = CURSOR_SOFTENING * CURSOR_SOFTENING;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let px = posArray[i3];
      let py = posArray[i3 + 1];
      let pz = posArray[i3 + 2];
      let vx = velocities[i3];
      let vy = velocities[i3 + 1];
      let vz = velocities[i3 + 2];

      // Damping
      vx *= damp;
      vy *= damp;
      vz *= damp;

      px += vx;
      py += vy;
      pz += vz;

      // Shape formation with natural overlapping morph
      if (targets.length > 0) {
        const tgt = targets[i % targets.length];
        const tx = tgt.x,
          ty = tgt.y,
          tz = tgt.z;
        const rx = m00 * tx + m01 * ty + m02 * tz;
        const ry = m10 * tx + m11 * ty + m12 * tz;
        const rz = m20 * tx + m21 * ty + m22 * tz;

        const phase = i * 2.399 + time * 0.8;
        const jx = reducedMotion ? 0 : Math.sin(phase) * jit * 0.1;
        const jy = reducedMotion ? 0 : Math.cos(phase * 1.37) * jit * 0.1;

        px += (rx * sc + jx - px) * lerpT;
        py += (ry * sc + jy - py) * lerpT;
        pz += (Z_MID + rz * sc * 0.3 - pz) * (reducedMotion ? 1 : lerpT * 0.3);
        vx *= shapeDamp;
        vy *= shapeDamp;
        vz *= shapeDamp;
      }

      // Cursor gravitational force
      if (cursorActive && !reducedMotion) {
        const dx = cursorX - px;
        const dy = cursorY - py;
        const distSq = dx * dx + dy * dy;
        if (distSq < radiusSq) {
          const dist = Math.sqrt(distSq);
          const falloff = 1 - distSq / radiusSq;
          const force =
            Math.min(CURSOR_STRENGTH / (distSq + softeningSq), CURSOR_MAX_FORCE) *
            falloff *
            cursorMode *
            dt;
          const invDist = dist > 0.001 ? 1 / dist : 0;
          vx += dx * invDist * force;
          vy += dy * invDist * force;
        }
      }

      // Z boundary springs
      const zMax = Z_RANGE;
      if (pz < -zMax) {
        const pen = (-zMax - pz) / zMax;
        vz += pen * pen * 0.1;
      } else if (pz > zMax) {
        const pen = (pz - zMax) / zMax;
        vz -= pen * pen * 0.1;
      }
      pz = Math.max(-zMax, Math.min(zMax, pz));

      posArray[i3] = px;
      posArray[i3 + 1] = py;
      posArray[i3 + 2] = pz;
      velocities[i3] = vx;
      velocities[i3 + 1] = vy;
      velocities[i3 + 2] = vz;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={theme.blending}
      />
    </points>
  );
}
