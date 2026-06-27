'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';

interface ShowcaseImage {
  src: string;
  alt: string;
  caption?: string;
}

interface ImageShowcaseProps {
  images: ShowcaseImage[];
  title?: string;
}

const stickyHeight = 'clamp(500px, calc(100vh - 10rem), 640px)';
const transitionDistance = 'clamp(160px, 24vh, 260px)';

export default function ImageShowcase({ images, title = 'Details' }: ImageShowcaseProps) {
  const isSingle = images.length === 1;
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const scrolly = sectionRef.current;
    const sticky = stickyRef.current;
    const frames = frameRefs.current;
    if (!scrolly || !sticky || frames.length === 0) return;

    const span = Math.max(1, images.length - 1);
    let currentActive = -1;
    let ticking = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const getStickyTop = () => Number.parseFloat(window.getComputedStyle(sticky).top) || 0;
    const range = () => Math.max(1, scrolly.offsetHeight - sticky.offsetHeight);
    const isStackedLayout = () => window.innerWidth < 1024 || reduceMotion.matches;

    const updateActive = (nextIndex: number) => {
      if (nextIndex === currentActive) return;
      currentActive = nextIndex;
      setActiveIndex(nextIndex);
    };

    const update = () => {
      ticking = false;

      if (isStackedLayout()) {
        frames.forEach((frame, index) => {
          if (!frame) return;
          frame.style.zIndex = String(index + 1);
          frame.style.opacity = index === currentActive ? '1' : '0';
          frame.style.transform =
            index === currentActive ? 'translate3d(0, 0%, 0)' : 'translate3d(0, 100%, 0)';
        });
        return;
      }

      const scrollRange = range();
      const scrolled = Math.min(
        Math.max(getStickyTop() - scrolly.getBoundingClientRect().top, 0),
        scrollRange,
      );
      const progress = (scrolled / scrollRange) * span;

      frames.forEach((frame, index) => {
        if (!frame) return;
        const translateY = Math.min(Math.max(index - progress, 0), 1) * 100;
        frame.style.zIndex = String(index + 1);
        frame.style.opacity = translateY >= 99 && index !== 0 ? '0.92' : '1';
        frame.style.transform = `translate3d(0, ${translateY}%, 0)`;
      });

      updateActive(Math.min(Math.max(Math.round(progress), 0), images.length - 1));
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    updateActive(0);
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    reduceMotion.addEventListener('change', requestUpdate);

    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      reduceMotion.removeEventListener('change', requestUpdate);
    };
  }, [images.length]);

  const scrollToImage = (index: number) => {
    const scrolly = sectionRef.current;
    const sticky = stickyRef.current;
    if (!scrolly || !sticky || images.length <= 1) {
      setActiveIndex(index);
      return;
    }

    if (window.innerWidth < 1024 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActiveIndex(index);
      return;
    }

    const span = Math.max(1, images.length - 1);
    const scrollRange = Math.max(1, scrolly.offsetHeight - sticky.offsetHeight);
    const stickyTop = Number.parseFloat(window.getComputedStyle(sticky).top) || 0;
    const targetY =
      window.scrollY +
      scrolly.getBoundingClientRect().top -
      stickyTop +
      (index / span) * scrollRange;

    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  if (isSingle) {
    const image = images[0];

    return (
      <section className="container mx-auto px-4 py-8">
        <h2 className="mb-6 text-2xl font-bold">{title}</h2>
        <div className="relative overflow-hidden rounded-xl">
          {image.caption && (
            <span className="absolute left-4 top-4 z-10 rounded-md border border-border bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
              {image.caption}
            </span>
          )}
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            className="w-full rounded-xl object-contain"
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        ref={sectionRef}
        className="container mx-auto hidden px-4 pt-6 pb-2 lg:block"
        style={
          {
            '--image-showcase-transitions': Math.max(images.length - 1, 1),
            '--image-showcase-sticky-height': stickyHeight,
            '--image-showcase-transition-distance': transitionDistance,
          } as CSSProperties
        }
      >
        <div
          className="relative"
          style={{
            height:
              'calc(var(--image-showcase-sticky-height) + var(--image-showcase-transitions) * var(--image-showcase-transition-distance))',
          }}
        >
          <div
            ref={stickyRef}
            className="sticky top-24"
            style={{ minHeight: 'var(--image-showcase-sticky-height)' }}
          >
            <h2 className="mb-6 text-2xl font-bold">{title}</h2>
            <div className="grid grid-cols-[minmax(11rem,0.24fr)_minmax(0,1fr)] items-start gap-8 xl:gap-12">
              <div>
                <ol className="flex flex-col gap-2">
                  {images.map((img, index) => (
                    <li key={img.src}>
                      <button
                        type="button"
                        onClick={() => scrollToImage(index)}
                        className={[
                          'block w-full rounded-full px-3.5 py-2.5 text-left text-sm font-medium leading-snug transition-all duration-300',
                          activeIndex === index
                            ? 'bg-foreground text-background shadow-lg shadow-foreground/10'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        ].join(' ')}
                        aria-current={activeIndex === index ? 'step' : undefined}
                      >
                        {img.caption ?? img.alt}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="relative aspect-[1920/1030] max-h-[calc(var(--image-showcase-sticky-height)-3.5rem)] overflow-hidden rounded-xl">
                {images.map((img, index) => (
                  <div
                    key={img.src}
                    ref={(node) => {
                      frameRefs.current[index] = node;
                    }}
                    className="absolute inset-0 will-change-transform"
                    style={{
                      zIndex: index + 1,
                      opacity: index === 0 ? 1 : 0.92,
                      transform: `translate3d(0, ${index === 0 ? 0 : 100}%, 0)`,
                      transition:
                        'transform 90ms cubic-bezier(0.23, 1, 0.32, 1), opacity 120ms ease-out',
                    }}
                  >
                    {img.caption && (
                      <span className="absolute left-4 top-4 z-10 rounded-md border border-border bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                        {img.caption}
                      </span>
                    )}
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="sr-only" aria-live="polite">
          {images[activeIndex]?.caption ?? images[activeIndex]?.alt}
        </div>
      </section>
      <ImageShowcaseMobileFallback images={images} title={title} />
    </>
  );
}

export function ImageShowcaseMobileFallback({ images, title = 'Details' }: ImageShowcaseProps) {
  return (
    <section className="container mx-auto px-4 py-8 lg:hidden">
      <h2 className="mb-6 text-2xl font-bold">{title}</h2>
      <div className="grid gap-4">
        {images.map((img, i) => (
          <div
            key={img.src}
            className="relative overflow-hidden rounded-xl"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {img.caption && (
              <span className="absolute left-4 top-4 z-10 rounded-md border border-border bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                {img.caption}
              </span>
            )}
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="w-full rounded-xl object-contain"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
