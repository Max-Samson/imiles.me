'use client';

import { useEffect, useState } from 'react';
import ParticleText from '@/registry/react-bits/ParticleText';

interface HomeGardenTitleProps {
  text: string;
}

function splitTitle(text: string): [string, string] | [string] {
  if (text.includes('\n')) {
    const parts = text.split('\n');
    return [parts[0].trim(), parts.slice(1).join('\n').trim()];
  }
  if (/[\u4e00-\u9fa5]/.test(text) && !text.includes(' ')) {
    const chars = Array.from(text.trim());
    const mid = Math.ceil(chars.length / 2);
    return [chars.slice(0, mid).join(''), chars.slice(mid).join('')];
  }
  if (text.includes(',')) {
    const commaIdx = text.indexOf(',');
    return [text.slice(0, commaIdx + 1).trim(), text.slice(commaIdx + 1).trim()];
  }
  const words = text.trim().split(/\s+/);
  if (words.length > 2) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  return [text];
}

export default function HomeGardenTitle({ text }: HomeGardenTitleProps) {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const lines = splitTitle(text);
  // 严格使用亮暗对应的原生设计色彩（暗色模式白金，亮色模式灰蓝与天蓝高光）
  const color = isDark ? '#f8fafc' : '#64748b';
  const highlightColor = isDark ? '#fbbf24' : '#38bdf8';

  // 移动端：双行独立居中自适应排版，避免单行 25 字符被 Canvas 强行缩成 18px 乱码点阵
  if (isMobile && lines.length === 2) {
    return (
      <div className="w-full flex flex-col items-center justify-center my-2 select-none">
        <h2 id="home-garden-title" className="sr-only">
          {text}
        </h2>
        <div className="w-full h-[96px] flex items-center justify-center overflow-hidden">
          <ParticleText
            text={lines[0]}
            particleSize={2.5}
            density={2}
            color={color}
            highlightColor={highlightColor}
            scatter={70}
            gatherDuration={1200}
            stagger={200}
            pointerRepel={20}
            repelRadius={50}
            idleDrift={0.35}
            trigger="mount"
            fontSize="clamp(2.2rem, 8.5vw, 3.2rem)"
            fontWeight={800}
            fontFamily="inherit"
            glow
            style={{ minHeight: '90px', height: '90px' }}
          />
        </div>
        <div className="w-full h-[96px] flex items-center justify-center overflow-hidden">
          <ParticleText
            text={lines[1]}
            particleSize={2.5}
            density={2}
            color={color}
            highlightColor={highlightColor}
            scatter={70}
            gatherDuration={1200}
            stagger={200}
            pointerRepel={20}
            repelRadius={50}
            idleDrift={0.35}
            trigger="mount"
            fontSize="clamp(2.2rem, 8.5vw, 3.2rem)"
            fontWeight={800}
            fontFamily="inherit"
            glow
            style={{ minHeight: '90px', height: '90px' }}
          />
        </div>
      </div>
    );
  }

  // 桌面端：单行全宽沉浸式展示
  return (
    <div className="w-full h-[280px] sm:h-[340px] md:h-[400px] flex items-center justify-center my-2 select-none">
      <ParticleText
        headingId="home-garden-title"
        text={text}
        particleSize={2.2}
        density={2}
        color={color}
        highlightColor={highlightColor}
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
