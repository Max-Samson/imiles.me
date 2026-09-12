'use client';

import { useEffect, useState } from 'react';
import { Floating3DParticles } from '@/registry/magicui/floating-3d-particles';

export default function HomeGardenParticles() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden"
      aria-hidden="true"
    >
      {/* 贯通全屏宽高的完整 3D 粒子流体空间，顶部零黑边，无缝对接上一屏 */}
      <Floating3DParticles
        quantity={500}
        size={4.5}
        opacity={isDark ? 0.38 : 0.26}
        color={isDark ? '#fbbf24' : '#0ea5e9'}
        drift={0.7}
        depth={0.65}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
