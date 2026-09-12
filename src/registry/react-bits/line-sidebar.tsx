import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

type Falloff = 'linear' | 'smooth' | 'sharp';

export interface LineSidebarProps {
  items?: string[];
  activeIndex?: number | null;
  accentColor?: string;
  textColor?: string;
  markerColor?: string;
  showIndex?: boolean;
  showMarker?: boolean;
  proximityRadius?: number;
  maxShift?: number;
  falloff?: Falloff;
  markerLength?: number;
  markerGap?: number;
  tickScale?: number;
  scaleTick?: boolean;
  itemGap?: number;
  fontSize?: number;
  smoothing?: number;
  defaultActive?: number | null;
  onItemClick?: (index: number, label: string) => void;
  className?: string;
  ariaLabel?: string;
  hoverToRevealText?: boolean;
}

const FALLOFF_CURVES: Record<Falloff, (p: number) => number> = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p,
};

const DEFAULT_ITEMS = [
  'Overview',
  'Components',
  'Animations',
  'Backgrounds',
  'Showcase',
  'Playground',
  'Templates',
  'Changelog',
  'Community',
  'Resources',
  'Documentation',
  'Support',
];

const LineSidebar = ({
  items = DEFAULT_ITEMS,
  activeIndex,
  accentColor = '#A855F7',
  textColor = '#c4c4c4',
  markerColor = '#6c6c6c',
  showIndex = true,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 30,
  falloff = 'smooth',
  markerLength = 60,
  markerGap = 0,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 20,
  fontSize = 1.1,
  smoothing = 100,
  defaultActive = null,
  onItemClick,
  className = '',
  ariaLabel,
  hoverToRevealText = false,
}: LineSidebarProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const centersRef = useRef<number[]>([]);
  const targetsRef = useRef<number[]>([]);
  const currentRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const [internalActive, setInternalActive] = useState<number | null>(defaultActive);
  const currentActive = activeIndex !== undefined ? activeIndex : internalActive;

  const activeRef = useRef<number | null>(currentActive);
  const smoothingRef = useRef(smoothing);

  activeRef.current = currentActive;
  smoothingRef.current = smoothing;

  // 预先缓存各个项目的垂直中心点，彻底避免 pointermove 期间触发浏览器 Layout Thrashing（重排）
  const updateCenters = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    centersRef.current = itemRefs.current.map((el) => {
      if (!el) return 0;
      return el.offsetTop + el.offsetHeight / 2;
    });
  }, []);

  // Single rAF loop that eases every item's --effect toward its target using
  // frame-rate independent exponential smoothing, so color, shift and scale
  // all move together without staggering CSS transitions.
  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const tau = Math.max(smoothingRef.current, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let moving = false;
    const elements = itemRefs.current;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el) continue;
      const target = Math.max(targetsRef.current[i] || 0, activeRef.current === i ? 1 : 0);
      const cur = currentRef.current[i] || 0;
      const next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.0015;
      const value = settled ? target : next;
      currentRef.current[i] = value;
      el.style.setProperty('--effect', value.toFixed(4));
      if (!settled) moving = true;
    }

    rafRef.current = moving ? requestAnimationFrame(runFrame) : null;
  }, []);

  // 核心修复：如果 rAF 循环已经在运行中，绝不重复 cancelAnimationFrame 截断正在进行的物理帧！
  const startLoop = useCallback(() => {
    if (rafRef.current === null) {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(runFrame);
    }
  }, [runFrame]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const list = listRef.current;
      if (!list) return;
      const rect = list.getBoundingClientRect();
      const pointerY = e.clientY - rect.top;
      const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear;

      // 如果中心点未缓存，初次计算一次
      if (centersRef.current.length !== items.length) {
        updateCenters();
      }

      const centers = centersRef.current;
      for (let i = 0; i < items.length; i++) {
        const center = centers[i] ?? 0;
        const distance = Math.abs(pointerY - center);
        targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius));
      }
      startLoop();
    },
    [falloff, proximityRadius, items.length, startLoop, updateCenters],
  );

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0);
    startLoop();
  }, [startLoop]);

  const handleClick = useCallback(
    (index: number, label: string) => {
      if (activeIndex === undefined) {
        setInternalActive(index);
      }
      onItemClick?.(index, label);
    },
    [activeIndex, onItemClick],
  );

  useEffect(() => {
    updateCenters();
  }, [items, updateCenters]);

  useEffect(() => {
    startLoop();
  }, [currentActive, startLoop]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    },
    [],
  );

  const tickClass = showMarker
    ? `after:absolute after:left-[calc(-1*var(--marker-length)-var(--marker-gap))] after:top-[calc(100%+var(--item-gap)/2)] after:h-px after:opacity-50 after:content-[''] last:after:content-none after:[background-color:var(--marker-color)] after:[width:calc(var(--marker-length)*var(--tick-scale))] ${
        scaleTick
          ? 'after:origin-left after:[transform:translateY(-50%)_scaleX(calc(0.7+var(--effect,0)*0.6))]'
          : 'after:-translate-y-1/2'
      }`
    : '';

  return (
    <nav
      aria-label={ariaLabel}
      onPointerEnter={updateCenters}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`group relative flex justify-start select-none${showMarker ? ' [padding-left:calc(var(--marker-length)+var(--marker-gap))]' : ''}${className ? ` ${className}` : ''}`}
      style={
        {
          '--accent-color': accentColor,
          '--text-color': textColor,
          '--marker-color': markerColor,
          '--marker-length': `${markerLength}px`,
          '--marker-gap': `${markerGap}px`,
          '--tick-scale': tickScale,
          '--max-shift': `${maxShift}px`,
          '--item-gap': `${itemGap}px`,
          '--font-size': `${fontSize}rem`,
          '--smoothing': `${smoothing}ms`,
        } as CSSProperties
      }
    >
      <ul ref={listRef} className="m-0 flex list-none flex-col py-4 [gap:var(--item-gap)]">
        {items.map((label, index) => (
          <li
            key={`${label}-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            aria-current={currentActive === index ? 'true' : undefined}
            onClick={() => handleClick(index, label)}
            className={`relative cursor-pointer before:absolute before:-inset-x-16 before:-inset-y-[8px] before:content-[''] ${tickClass}`}
          >
            {showMarker && (
              <span
                aria-hidden="true"
                className="absolute left-[calc(-1*var(--marker-length)-var(--marker-gap))] top-1/2 h-px w-[length:var(--marker-length)] origin-left [background-color:color-mix(in_srgb,var(--accent-color)_calc(var(--effect,0)*100%),var(--marker-color))] [transform:translateY(-50%)_scaleX(calc(0.7+var(--effect,0)*0.5))]"
              />
            )}
            <span
              className={`relative inline-flex items-baseline leading-[1.2] whitespace-nowrap font-medium antialiased [color:color-mix(in_srgb,var(--accent-color)_calc(var(--effect,0)*100%),var(--text-color))] [font-size:var(--font-size)] [transform:translateX(calc(var(--effect,0)*var(--max-shift)))] ${
                hoverToRevealText
                  ? 'transition-opacity duration-200 ease-out opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
                  : ''
              }`}
            >
              {showIndex && (
                <span className="mr-[0.6rem] font-mono text-[0.85em] font-semibold opacity-85">
                  {String(index + 1).padStart(2, '0')}
                </span>
              )}
              <span className="font-medium tracking-tight">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default LineSidebar;
