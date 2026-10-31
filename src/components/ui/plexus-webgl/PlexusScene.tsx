'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getHeroPatternAdapter, type HeroPatternId } from '../hero-pattern-adapters';
import { ConnectionLines } from './ConnectionLines';
import { ParticleField } from './ParticleField';
import { PostProcessing } from './PostProcessing';
import { type PlexusTheme, usePlexusTheme } from './usePlexusTheme';

// =============================================================================
// Types
// =============================================================================

export interface CursorState {
  x: number;
  y: number;
  active: boolean;
  mode: 1 | -1;
}

interface PlexusBackgroundProps {
  pattern?: HeroPatternId;
  className?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  onEntryChange?: (pattern: HeroPatternId, index: number) => void;
  onGroupAdvance?: () => void;
  isPaused?: boolean;
}

// =============================================================================
// Performance tier detection
// =============================================================================

function getPerformanceTier(): 'desktop' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// =============================================================================
// CursorTracker — converts pointer events to world-space coordinates
// =============================================================================

const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _intersection = new THREE.Vector3();

function CursorTracker({ cursorRef }: { cursorRef: React.MutableRefObject<CursorState> }) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    let cachedRect = canvas.getBoundingClientRect();
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    let hasPending = false;

    const updateRect = () => {
      cachedRect = canvas.getBoundingClientRect();
    };

    const processPosition = () => {
      hasPending = false;
      const rect = cachedRect;
      if (!rect.width || !rect.height) return;
      _pointer.x = ((pendingX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((pendingY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointer, camera);
      if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
        cursorRef.current.x = _intersection.x;
        cursorRef.current.y = _intersection.y;
        cursorRef.current.active = true;
      }
    };

    const schedulePosition = (clientX: number, clientY: number) => {
      pendingX = clientX;
      pendingY = clientY;
      if (!hasPending) {
        hasPending = true;
        rafId = requestAnimationFrame(processPosition);
      }
    };

    const onPointerMove = (e: PointerEvent) => schedulePosition(e.clientX, e.clientY);
    const onPointerLeave = () => {
      cursorRef.current.active = false;
      hasPending = false;
      cancelAnimationFrame(rafId);
    };
    const onClick = () => {
      cursorRef.current.mode = cursorRef.current.mode === -1 ? 1 : -1;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) schedulePosition(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) schedulePosition(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => {
      cursorRef.current.active = false;
      hasPending = false;
      cancelAnimationFrame(rafId);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('resize', updateRect, { passive: true });
    window.addEventListener('scroll', updateRect, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('click', onClick);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [camera, gl, cursorRef]);

  return null;
}

// =============================================================================
// Inner scene content
// =============================================================================

function SceneContent({
  pattern,
  theme,
  positionsBufferRef,
  cursorRef,
  reducedMotion,
  particleCount,
  onEntryChange,
  isPaused,
  onGroupAdvance,
}: {
  pattern: HeroPatternId;
  theme: PlexusTheme;
  positionsBufferRef: React.MutableRefObject<Float32Array | null>;
  cursorRef: React.MutableRefObject<CursorState>;
  reducedMotion: boolean;
  particleCount: number;
  onEntryChange?: (pattern: HeroPatternId, index: number) => void;
  onGroupAdvance?: () => void;
  isPaused?: boolean;
}) {
  const adapter = getHeroPatternAdapter(pattern);
  const initialDist =
    adapter.entries[0]?.connectionDistance?.(particleCount) ??
    adapter.connectionDistance?.(particleCount) ??
    3.0;
  const connectionDistanceRef = useRef(initialDist);

  return (
    <>
      <CursorTracker cursorRef={cursorRef} />

      <ParticleField
        adapter={adapter}
        count={particleCount}
        theme={theme}
        positionsBufferRef={positionsBufferRef}
        cursorRef={cursorRef}
        reducedMotion={reducedMotion}
        onEntryChange={onEntryChange}
        onGroupAdvance={onGroupAdvance}
        isPaused={isPaused}
        connectionDistanceRef={connectionDistanceRef}
      />
      <ConnectionLines
        particleCount={particleCount}
        positionsBufferRef={positionsBufferRef}
        theme={theme}
        connectionDistanceRef={connectionDistanceRef}
      />

      <PostProcessing theme={theme} />
    </>
  );
}

// =============================================================================
// Main exported component
// =============================================================================

export function PlexusBackground({
  pattern = 'codex',
  className = '',
  onEntryChange,
  onGroupAdvance,
  anchorRef,
  isPaused = false,
}: PlexusBackgroundProps) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(anchor);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [anchorRef]);
  const theme = usePlexusTheme();
  const reducedMotion = useReducedMotion();
  const positionsBufferRef = useRef<Float32Array | null>(null);
  const cursorRef = useRef<CursorState>({ x: 0, y: 0, active: false, mode: -1 });

  const [tier] = useState(getPerformanceTier);
  const particleCount = tier === 'mobile' ? 250 : 800;

  return (
    <div
      className={`${anchorRef ? 'absolute' : 'fixed'} inset-0 w-full h-full ${className}`}
      style={{ touchAction: 'manipulation' }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 15], fov: 60, near: 0.1, far: 100 }}
        style={{ background: 'transparent' }}
        frameloop={visible ? 'always' : 'never'}
      >
        <SceneContent
          pattern={pattern}
          theme={theme}
          positionsBufferRef={positionsBufferRef}
          cursorRef={cursorRef}
          reducedMotion={reducedMotion}
          particleCount={particleCount}
          onEntryChange={onEntryChange}
          onGroupAdvance={onGroupAdvance}
          isPaused={isPaused}
        />
      </Canvas>
    </div>
  );
}
