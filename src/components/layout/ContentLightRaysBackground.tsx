'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LightRays } from '@/registry/magicui/light-rays';

interface ContentLightRaysBackgroundProps {
  className?: string;
}

export default function ContentLightRaysBackground({ className }: ContentLightRaysBackgroundProps) {
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
      {/* Subtle top-down gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-background via-background/95 to-background opacity-90" />

      {/* Subtle animated color blobs for both light and dark modes */}
      <div className="absolute inset-0 opacity-40 mix-blend-soft-light dark:opacity-30 dark:mix-blend-normal">
        <div className="animate-aurora absolute -inset-[20%] bg-[radial-gradient(circle_at_15%_15%,oklch(from_var(--brand)_l_c_h_/_25%)_0%,transparent_50%),radial-gradient(circle_at_85%_10%,oklch(from_var(--brand-secondary)_l_c_h_/_20%)_0%,transparent_50%),radial-gradient(circle_at_50%_80%,oklch(from_var(--brand)_l_c_h_/_15%)_0%,transparent_50%)] blur-3xl dark:bg-[radial-gradient(circle_at_15%_15%,rgba(251,191,36,0.15)_0%,transparent_50%),radial-gradient(circle_at_85%_10%,rgba(245,158,11,0.12)_0%,transparent_50%),radial-gradient(circle_at_50%_80%,rgba(217,119,6,0.1)_0%,transparent_50%)]" />
      </div>

      {/* Light Rays for a more dynamic "lit" feel */}
      <LightRays
        count={8}
        speed={12}
        color={isDark ? 'rgba(251,191,36,0.15)' : 'rgba(14,165,233,0.35)'}
        length="120vh"
        blur={40}
        className="opacity-100 dark:opacity-80"
      />
    </div>
  );
}
