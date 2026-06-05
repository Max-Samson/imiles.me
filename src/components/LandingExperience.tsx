'use client';

import { MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import SocialDock from '@/components/SocialDock';
import { PlexusBackground } from '@/components/ui/plexus-background';
import { CODEX, CODEX_CN } from '@/components/ui/plexus-shapes';
import { useTextScramble } from '@/hooks/useTextScramble';
import { useTranslations } from '@/lib/i18n';
import { LightRays } from '@/registry/magicui/light-rays';

const NAME_CHARS = 'Shenshuai Ming'.split('');

export default function LandingExperience() {
  const { t } = useTranslations();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [nameWidth, setNameWidth] = useState<number | undefined>(undefined);
  const [codexIndex, setCodexIndex] = useState(0);
  const [isZh, setIsZh] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsZh(window.location.pathname.startsWith('/zh'));
  }, []);

  const codex = isZh ? CODEX_CN : CODEX;
  const entry = codex[codexIndex % codex.length];
  const quoteText = useTextScramble(entry.quote);
  const authorText = useTextScramble(entry.author ?? '');
  const intro = isZh
    ? 'Miles技术博客，记录前端工程、AI时代感受、全栈实践、项目复盘与长期思考。'
    : 'A tech blog on frontend engineering, AI, full-stack building, project breakdowns, and long-form thinking.';

  const handleCodexChange = useCallback((index: number) => {
    setCodexIndex(index);
  }, []);

  // Track name element width via ResizeObserver
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setNameWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-root">
        <PlexusBackground className="pointer-events-auto z-0" onCodexChange={handleCodexChange} />
        <LightRays
          count={8}
          speed={12}
          color="var(--ray-c)"
          length="120vh"
          blur={40}
          className="z-[1] opacity-100 dark:opacity-80"
        />

        <motion.div
          className="final-card-container pointer-events-none z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="relative flex flex-col items-center">
            <div className="px-4 sm:px-0">
              <div className="landing-hero pointer-events-auto">
                <p className="sr-only">{t('PageHomeDescription')}</p>
                <h1
                  ref={nameRef}
                  className="landing-hero-name"
                  aria-label="Shenshuai Ming"
                  style={{ fontFamily: 'Rock Salt, cursive' }}
                >
                  {NAME_CHARS.map((char, i) => {
                    const baseDelay = 0.6 + i * 0.04;
                    return char === ' ' ? (
                      <motion.span
                        key={`space-${i}`}
                        className="w-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: baseDelay }}
                      />
                    ) : (
                      <motion.span
                        key={`char-${i}`}
                        className="landing-hero-char md:mt-10 mt-5"
                        initial={{
                          opacity: 0,
                          y: 20,
                          color: 'var(--brand)',
                          textShadow:
                            '0 0 20px oklch(from var(--brand) l c h / 70%), 0 0 40px oklch(from var(--brand) l c h / 35%)',
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          color: 'var(--foreground)',
                          textShadow: '0 0 0px transparent',
                        }}
                        transition={{
                          opacity: { duration: 0.3, delay: baseDelay },
                          y: {
                            duration: 0.4,
                            delay: baseDelay,
                            ease: [0.25, 0.46, 0.45, 0.94],
                          },
                          color: { duration: 1.0, delay: baseDelay + 0.3 },
                          textShadow: { duration: 1.2, delay: baseDelay + 0.2 },
                        }}
                      >
                        {char}
                      </motion.span>
                    );
                  })}
                </h1>

                <motion.div
                  className="landing-hero-sub"
                  style={nameWidth ? { maxWidth: nameWidth } : undefined}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.4 }}
                >
                  <p className="landing-hero-intro">{intro}</p>
                  <span className="landing-hero-quote">{quoteText}</span>
                  {authorText && <span className="landing-hero-author">{authorText}</span>}
                </motion.div>
              </div>
            </div>

            <motion.div
              className="pointer-events-auto flex flex-col items-center gap-3 mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.6 }}
            >
              <SocialDock
                mobileClassName="z-40"
                desktopClassName="fixed bottom-16 left-1/2 -translate-x-1/2 z-40"
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
