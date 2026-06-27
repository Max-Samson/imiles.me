'use client';

import { MotionConfig, motion } from 'motion/react';
import {
  type CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { PlexusBackground } from '@/components/ui/plexus-background';
import { CODEX, CODEX_CN } from '@/components/ui/plexus-shapes';
import { useTextScramble } from '@/hooks/useTextScramble';
import { useTranslations } from '@/lib/i18n';
import { LightRays } from '@/registry/magicui/light-rays';

const NAME_CHARS = 'Shenshuai Ming'.split('');
const DOCK_PRELOAD_DELAY_MS = 1100;
const PLEXUS_IDLE_DELAY_MS = 2200;
const SocialDock = lazy(() => import('@/components/layout/SocialDock'));

export default function LandingExperience() {
  const { t } = useTranslations();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [nameWidth, setNameWidth] = useState<number | undefined>(undefined);
  const [codexIndex, setCodexIndex] = useState(0);
  const [isZh, setIsZh] = useState(false);
  const [shouldMountDock, setShouldMountDock] = useState(false);
  const [shouldMountPlexus, setShouldMountPlexus] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsZh(window.location.pathname.startsWith('/zh'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timeoutId = window.setTimeout(() => {
      setShouldMountDock(true);
    }, DOCK_PRELOAD_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let idleId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => setShouldMountPlexus(true));
      } else {
        setShouldMountPlexus(true);
      }
    }, PLEXUS_IDLE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
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
        {shouldMountPlexus && (
          <PlexusBackground className="pointer-events-auto z-0" onCodexChange={handleCodexChange} />
        )}
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
                  {NAME_CHARS.map((char, index) => {
                    const baseDelay = 0.6 + index * 0.04;

                    return char === ' ' ? (
                      <span key={`space-${index}`} className="w-full" />
                    ) : (
                      <span
                        key={`char-${index}`}
                        className="landing-hero-char md:mt-10 mt-5"
                        style={{ '--landing-char-delay': `${baseDelay}s` } as CSSProperties}
                      >
                        {char}
                      </span>
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
              {shouldMountDock && (
                <Suspense fallback={null}>
                  <SocialDock
                    mobileClassName="z-40"
                    desktopClassName="fixed bottom-16 left-1/2 -translate-x-1/2 z-40"
                  />
                </Suspense>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
