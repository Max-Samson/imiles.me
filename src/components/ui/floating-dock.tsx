'use client';
import type { MotionValue } from 'motion/react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: {
    title: string;
    icon: React.ReactNode;
    href: string;
    target?: '_blank' | '_self' | '_parent' | '_top';
  }[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: {
    title: string;
    icon: React.ReactNode;
    href: string;
    target?: '_blank' | '_self' | '_parent' | '_top';
  }[];
  className?: string;
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Social links"
      className={cn(
        'mx-auto flex flex-nowrap items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2 md:hidden',
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.title}
          href={item.href}
          target={item.target}
          rel={item.target === '_blank' ? 'noreferrer noopener' : undefined}
          aria-label={item.title}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/60 backdrop-blur-sm transition-colors hover:bg-accent/50"
        >
          <div className="h-4 w-4">{item.icon}</div>
        </a>
      ))}
    </div>
  );
};

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: {
    title: string;
    icon: React.ReactNode;
    href: string;
    target?: '_blank' | '_self' | '_parent' | '_top';
  }[];
  className?: string;
}) => {
  const mouseX = useMotionValue(Infinity);
  const frameRef = useRef<number | null>(null);
  const latestMouseXRef = useRef(Infinity);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const scheduleMouseX = (value: number) => {
    latestMouseXRef.current = value;
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      mouseX.set(latestMouseXRef.current);
      frameRef.current = null;
    });
  };

  return (
    <motion.div
      role="toolbar"
      aria-label="Social links"
      onMouseMove={(e) => scheduleMouseX(e.pageX)}
      onMouseLeave={() => scheduleMouseX(Infinity)}
      className={cn('mx-auto hidden h-16 items-end gap-4 rounded-2xl px-4 pb-3 md:flex', className)}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  );
};

function IconContainer({
  mouseX,
  title,
  icon,
  href,
  target,
}: {
  mouseX: MotionValue;
  title: string;
  icon: React.ReactNode;
  href: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };

    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);

  const widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);
  const heightTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);

  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const widthIcon = useSpring(widthTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const heightIcon = useSpring(heightTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      target={target}
      rel={target === '_blank' ? 'noreferrer noopener' : undefined}
      aria-label={title}
    >
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="relative flex aspect-square items-center justify-center rounded-full bg-background/60 backdrop-blur-sm"
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 2, x: '-50%' }}
              className="absolute -top-8 left-1/2 w-fit rounded-md border border-border bg-background/60 backdrop-blur-sm px-2 py-0.5 text-xs whitespace-pre text-foreground"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </a>
  );
}
