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
import {
  getHeroPatternAdapter,
  HERO_PATTERN_ADAPTERS,
  type HeroPatternId,
} from '@/components/ui/hero-pattern-adapters';
import { PlexusBackground } from '@/components/ui/plexus-background';
import { useTextScramble } from '@/hooks/useTextScramble';
import { type Locale, useTranslations } from '@/lib/i18n';

const NAME_CHARS = [
  { id: 'shenshuai-s', char: 'S' },
  { id: 'shenshuai-h', char: 'h' },
  { id: 'shenshuai-e', char: 'e' },
  { id: 'shenshuai-n', char: 'n' },
  { id: 'shenshuai-s-2', char: 's' },
  { id: 'shenshuai-h-2', char: 'h' },
  { id: 'shenshuai-u', char: 'u' },
  { id: 'shenshuai-a', char: 'a' },
  { id: 'shenshuai-i', char: 'i' },
  { id: 'space', char: ' ' },
  { id: 'ming-m', char: 'M' },
  { id: 'ming-i', char: 'i' },
  { id: 'ming-n', char: 'n' },
  { id: 'ming-g', char: 'g' },
];
const DOCK_PRELOAD_DELAY_MS = 1100;
const SocialDock = lazy(() => import('@/components/layout/SocialDock'));

export default function LandingExperience({ lang = 'en' }: { lang?: Locale }) {
  const { t } = useTranslations(lang);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroCardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [nameWidth, setNameWidth] = useState<number | undefined>(undefined);
  const [pattern, setPattern] = useState<HeroPatternId>('signature');
  const [entryIndex, setEntryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isZh = lang === 'zh';
  const [shouldMountDock, setShouldMountDock] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timeoutId = window.setTimeout(() => {
      setShouldMountDock(true);
    }, DOCK_PRELOAD_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const adapter = getHeroPatternAdapter(pattern);
  const activeEntries = isZh && adapter.entriesZh ? adapter.entriesZh : adapter.entries;
  const activeEntry = activeEntries[entryIndex % activeEntries.length];
  const quoteText = useTextScramble(activeEntry.quote);
  const authorText = useTextScramble(activeEntry.author ?? '');
  const intro = isZh
    ? 'Miles技术博客，记录前端工程、AI时代感受、全栈实践、项目复盘与长期思考。'
    : 'A tech blog on frontend engineering, AI, full-stack building, project breakdowns, and long-form thinking.';

  const currentShapeName =
    pattern === 'codex'
      ? isZh
        ? `经典 · ${activeEntry.name.zh}`
        : `Classic · ${activeEntry.name.en}`
      : isZh
        ? activeEntry.name.zh
        : activeEntry.name.en;

  const handleGroupAdvance = useCallback(() => {
    const ids = HERO_PATTERN_ADAPTERS.map((a) => a.id);
    const currIdx = ids.indexOf(pattern);
    const nextPattern = ids[(currIdx + 1) % ids.length];
    setPattern(nextPattern);
    setEntryIndex(0);
  }, [pattern]);

  const handleEntryChange = useCallback(
    (id: HeroPatternId, index: number) => {
      if (id === pattern) {
        setEntryIndex(index);
      }
    },
    [pattern],
  );

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

  // Pause auto-cycle when hovering over hero card
  useEffect(() => {
    const heroCard = heroCardRef.current;
    if (!heroCard) return;

    const onEnter = () => setIsPaused(true);
    const onLeave = () => setIsPaused(false);

    heroCard.addEventListener('pointerenter', onEnter);
    heroCard.addEventListener('pointerleave', onLeave);

    return () => {
      heroCard.removeEventListener('pointerenter', onEnter);
      heroCard.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-root" ref={heroRef}>
        <PlexusBackground
          pattern={pattern}
          anchorRef={heroRef}
          className="pointer-events-auto z-0"
          onEntryChange={handleEntryChange}
          onGroupAdvance={handleGroupAdvance}
          isPaused={isPaused}
        />

        <motion.div
          className="final-card-container pointer-events-none z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative flex flex-col items-center">
            <div className="px-4 sm:px-0">
              <div ref={heroCardRef} className="landing-hero pointer-events-auto">
                <p className="sr-only">{t('PageHomeDescription')}</p>
                <h1
                  ref={nameRef}
                  className="landing-hero-name"
                  aria-label="Shenshuai Ming"
                  style={{ fontFamily: 'Rock Salt, cursive' }}
                >
                  {NAME_CHARS.map(({ id, char }, index) => {
                    const baseDelay = index * 0.03;

                    return char === ' ' ? (
                      <span key={id} className="w-full" />
                    ) : (
                      <span
                        key={id}
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <p className="landing-hero-intro">{intro}</p>
                  <span className="landing-hero-quote" title={currentShapeName}>
                    {quoteText}
                  </span>
                  {authorText && <span className="landing-hero-author">{authorText}</span>}
                </motion.div>
              </div>
            </div>
            <motion.div
              className="pointer-events-auto flex flex-col items-center gap-3 mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              {shouldMountDock && (
                <Suspense fallback={null}>
                  <SocialDock
                    mobileClassName="absolute bottom-4 left-1/2 -translate-x-1/2 z-40"
                    desktopClassName="absolute bottom-16 left-1/2 -translate-x-1/2 z-40"
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
