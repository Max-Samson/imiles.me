'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { FlickeringGrid } from '@/registry/magicui/flickering-grid';

interface ContentFlickeringBackgroundProps {
  className?: string;
}

export default function ContentFlickeringBackground({
  className,
}: ContentFlickeringBackgroundProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDark(root.classList.contains('dark'));

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 -z-10 h-dvh w-screen overflow-hidden bg-background',
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,var(--background),transparent_42%),linear-gradient(to_bottom,transparent,var(--background)_92%)]" />
      <FlickeringGrid
        className="absolute inset-0 z-0 [mask-image:radial-gradient(900px_circle_at_50%_36%,white,transparent_82%)]"
        squareSize={4}
        gridGap={6}
        color={isDark ? '#fbbf24' : '#0ea5e9'}
        maxOpacity={isDark ? 0.42 : 0.34}
        flickerChance={0.45}
      />
      <div className="absolute inset-0 bg-background/50 dark:bg-background/58" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
