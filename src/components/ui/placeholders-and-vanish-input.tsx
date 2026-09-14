'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type PixelParticle = {
  x: number;
  y: number;
  originX: number;
  originY: number;
  r: number;
  color: string;
};

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
  ariaLabel,
  className,
}: {
  placeholders: string[];
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
    }, 3000);
  }, [placeholders.length]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState !== 'visible' && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (document.visibilityState === 'visible') {
      startAnimation();
    }
  }, [startAnimation]);

  useEffect(() => {
    startAnimation();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalRef.current as NodeJS.Timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startAnimation, handleVisibilityChange]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<PixelParticle[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [animating, setAnimating] = useState(false);
  const isAnimatingRef = useRef(false);

  // 1:1 像素映射绘制函数
  const draw = useCallback(() => {
    if (!inputRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = inputRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const computedStyles = getComputedStyle(inputRef.current);
    const fontSize = Number.parseFloat(computedStyles.getPropertyValue('font-size')) || 15;
    const paddingLeft = Number.parseFloat(computedStyles.getPropertyValue('padding-left')) || 24;

    ctx.font = `${computedStyles.fontWeight} ${fontSize}px ${computedStyles.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, paddingLeft, height / 2);

    const imageData = ctx.getImageData(0, 0, width * dpr, height * dpr);
    const pixelData = imageData.data;
    const particles: PixelParticle[] = [];

    // 以 2px 步长抽取粒子，保证 60fps 流畅度与粒子密度的最佳平衡
    const step = 2 * Math.round(dpr);
    const totalW = width * dpr;
    const totalH = height * dpr;

    for (let y = 0; y < totalH; y += step) {
      const rowOffset = y * totalW * 4;
      for (let x = 0; x < totalW; x += step) {
        const idx = rowOffset + x * 4;
        const alpha = pixelData[idx + 3];
        // 判定有效文字像素
        if (alpha > 40) {
          particles.push({
            x: x / dpr,
            y: y / dpr,
            originX: x / dpr,
            originY: y / dpr,
            r: 1.5,
            color: `rgba(${pixelData[idx]}, ${pixelData[idx + 1]}, ${pixelData[idx + 2]}, ${alpha / 255})`,
          });
        }
      }
    }

    particlesRef.current = particles;
  }, [value]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 粒子物理消散动画
  const runVanishAnimation = () => {
    if (isAnimatingRef.current || !value.trim()) return;
    isAnimatingRef.current = true;
    setAnimating(true);
    draw();

    if (particlesRef.current.length === 0) {
      setValue('');
      setAnimating(false);
      isAnimatingRef.current = false;
      return;
    }

    const maxX = particlesRef.current.reduce((max, p) => (p.originX > max ? p.originX : max), 0);

    const animateFrame = (wavePos: number) => {
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        let activeCount = 0;
        const nextParticles: PixelParticle[] = [];

        for (let i = 0; i < particlesRef.current.length; i++) {
          const p = particlesRef.current[i];
          if (p.originX < wavePos) {
            // 波前左侧未消散文字：在画布上保持原文字像素位置绘制
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.originX, p.originY, 1.2, 0, Math.PI * 2);
            ctx.fill();
            nextParticles.push(p);
            activeCount++;
          } else {
            // 波前右侧已被消散的粒子：物理漂移与缩减
            if (p.r > 0.08) {
              p.x += (Math.random() - 0.45) * 2.8;
              p.y += (Math.random() - 0.55) * 2.5 - 0.4; // 微弱上浮
              p.r -= 0.035 * Math.random() + 0.02;

              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, Math.max(0.2, p.r), 0, Math.PI * 2);
              ctx.fill();

              nextParticles.push(p);
              activeCount++;
            }
          }
        }

        particlesRef.current = nextParticles;

        if (wavePos > -20 || activeCount > 0) {
          animateFrame(wavePos - 12);
        } else {
          setValue('');
          setAnimating(false);
          isAnimatingRef.current = false;
        }
      });
    };

    animateFrame(maxX);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isAnimatingRef.current || !value.trim()) return;
    runVanishAnimation();
    onSubmit?.(e);
  };

  return (
    <form
      className={cn(
        // 核心尺寸与胶囊形态
        'relative w-full max-w-xl mx-auto h-12 rounded-full overflow-hidden isolate',
        // 结合 NavigationMenu.tsx 苹果液态玻璃核心滤镜
        'backdrop-blur-2xl saturate-180',
        // 渐变半透明液态质感底色
        'bg-gradient-to-b from-white/80 via-white/55 to-white/70',
        'dark:bg-gradient-to-b dark:from-neutral-800/80 dark:via-neutral-900/60 dark:to-neutral-900/75',
        // 细致半透明双层边缘折射
        'border border-white/70 dark:border-white/15',
        'shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_1px_0_rgba(0,0,0,0.03)]',
        'dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.22),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
        'transition-all duration-300',
        className,
      )}
      onSubmit={handleSubmit}
    >
      {/* 顶部 1px 凸面透镜倒角镜面高光反射线 (模拟苹果弧面玻璃倒角) */}
      <span
        className="pointer-events-none absolute inset-x-4 top-0 z-20 h-[1px] bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35"
        aria-hidden="true"
      />

      {/* 粒子物理消散画布 */}
      <canvas
        className={cn(
          'pointer-events-none absolute inset-0 z-40 h-full w-full filter invert dark:invert-0',
          !animating ? 'opacity-0' : 'opacity-100',
        )}
        ref={canvasRef}
      />

      {/* 原生输入框 */}
      <input
        onChange={(e) => {
          if (!animating) {
            setValue(e.target.value);
            onChange?.(e);
          }
        }}
        ref={inputRef}
        value={value}
        type="text"
        aria-label={ariaLabel}
        className={cn(
          'w-full relative z-30 h-full pl-6 pr-14 text-sm sm:text-base font-medium',
          'bg-transparent text-neutral-900 dark:text-neutral-100',
          'border-none focus:outline-none focus:ring-0',
          animating && 'text-transparent dark:text-transparent select-none',
        )}
      />

      {/* 液态玻璃提交发送按钮 */}
      <button
        disabled={!value.trim() || animating}
        type="submit"
        aria-label="Submit search"
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 z-40 size-8 rounded-full',
          'flex items-center justify-center transition-all duration-200',
          // 仿苹果微高光水银质感按钮
          value.trim() && !animating
            ? 'bg-neutral-900 text-white shadow-md dark:bg-white dark:text-neutral-950 scale-100 opacity-100 hover:scale-105 active:scale-95 cursor-pointer'
            : 'bg-black/5 dark:bg-white/10 text-neutral-400 dark:text-neutral-500 scale-95 opacity-50 cursor-not-allowed',
        )}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </motion.svg>
      </button>

      {/* 滚动轮播占位符 */}
      <div className="absolute inset-0 flex items-center rounded-full pointer-events-none z-20">
        <AnimatePresence mode="wait">
          {!value && (
            <motion.p
              initial={{ y: 8, opacity: 0 }}
              key={`current-placeholder-${currentPlaceholder}`}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="text-neutral-500/80 dark:text-neutral-400/80 text-sm sm:text-base font-normal pl-6 text-left w-[calc(100%-4rem)] truncate select-none"
            >
              {placeholders[currentPlaceholder]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
