'use client';

import { useEffect, useState } from 'react';
import ParticleText from '@/registry/react-bits/ParticleText';

interface HomeGardenTitleProps {
  text: string;
}

export default function HomeGardenTitle({ text }: HomeGardenTitleProps) {
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
    <div className="w-full h-[280px] sm:h-[340px] md:h-[400px] flex items-center justify-center my-2 select-none">
      <ParticleText
        headingId="home-garden-title"
        text={text}
        particleSize={2.2}
        density={4}
        color={isDark ? '#f8fafc' : '#64748b'}
        highlightColor={isDark ? '#fbbf24' : '#38bdf8'}
        scatter={190}
        gatherDuration={1600}
        stagger={420}
        pointerRepel={42}
        repelRadius={120}
        idleDrift={0.8}
        trigger="mount"
        fontSize="clamp(3.5rem, 12vw, 8.5rem)"
        fontWeight={800}
        fontFamily="inherit"
        glow
      />
    </div>
  );
}
