'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import './expanding-carousel.css';

export interface ExpandingCarouselItem {
  id: string;
  title: string;
  description: string;
  eyebrow?: string;
  image?: { src: string; alt: string; previewSrc?: string; fit?: 'cover' | 'contain' };
  badges?: string[];
  links?: { label: string; href: string; external?: boolean }[];
  terminal?: { title?: string; lines: { type: 'command' | 'output'; text: string }[] };
}

export interface ExpandingCarouselProps {
  items: ExpandingCarouselItem[];
  label: string;
  labels: { previous: string; next: string; pause: string; play: string; slide: string };
  className?: string;
  /** Optional section heading; omit when the surrounding page already provides one. */
  heading?: string;
  headingId?: string;
  eyebrow?: string;
  description?: string;
  style?: CSSProperties & { [key: `--carousel-${string}`]: string | number };
  /** React callers may replace the default project/testimonial content. */
  renderContent?: (item: ExpandingCarouselItem, active: boolean) => ReactNode;
  renderPreview?: (item: ExpandingCarouselItem) => ReactNode;
  initialIndex?: number;
  /** Set to 0 to disable automatic rotation. Pauses on hover, focus, or leaving the viewport. */
  interval?: number;
}

/** A connected, expanding card carousel. Content is independent of projects or testimonials. */
export default function ExpandingCarousel({
  items,
  label,
  labels,
  className,
  heading,
  headingId,
  eyebrow,
  description,
  style,
  renderContent,
  renderPreview,
  initialIndex = 0,
  // 元素自动切换轮播时间为7s
  interval = 7000,
}: ExpandingCarouselProps) {
  const count = items.length;
  const [selected, setSelected] = useState(Math.max(0, Math.min(initialIndex, count - 1)));
  const [previous, setPrevious] = useState(selected);
  const active = Math.min(selected, Math.max(0, count - 1));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const connectors = useRef<(HTMLSpanElement | null)[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const id = useId();
  const canRotate = count > 1 && interval > 0 && !reducedMotion;
  const playing = canRotate && visible && pageVisible && !hovered && !focused && !paused;

  useEffect(() => {
    const element = root.current;
    if (!element || count === 0) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    observer.observe(element);
    preference.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [count]);

  // Bridges belong to the stage, not the active/preview state of either card.
  // Measure the animated edges so interrupted transitions and recycled cards do
  // not detach a bridge or briefly stretch it across the entire carousel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Redraw after slot or motion changes, including when CSS transitions are disabled.
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element || count < 2) return;
    const cards = Array.from(element.querySelectorAll<HTMLElement>('.expanding-carousel-card'));
    let frame = 0;
    const draw = () => {
      frame = 0;
      const bounds = element.getBoundingClientRect();
      const scale = bounds.width / (element.offsetWidth || 1);
      // Batch layout/style reads before writing connector geometry.
      const measured = cards
        .map((card) => {
          const rect = card.getBoundingClientRect();
          const style = getComputedStyle(card);
          return { rect, opacity: Number(style.opacity) };
        })
        .filter((card) => card.opacity > 0.001)
        .sort((a, b) => a.rect.left - b.rect.left || b.rect.right - a.rect.right);
      // A fading/recycled card can sit entirely inside another moving card.
      // Only exposed right edges may own a bridge to the next card.
      let rightmost = -Infinity;
      const edges = measured.filter((card) => {
        if (card.rect.right <= rightmost) return false;
        rightmost = card.rect.right;
        return true;
      });
      const animating = cards.some((card) =>
        card.getAnimations().some((animation) => animation.playState === 'running'),
      );
      // Extend the masked ends beneath the shells to cover fractional pixels.
      const overlap = 1.5;
      connectors.current.forEach((bridge, index) => {
        if (!bridge) return;
        const left = edges[index];
        const right = edges[index + 1];
        const gap = left && right ? (right.rect.left - left.rect.right) / scale : 0;
        if (!left || !right || gap <= 0 || gap >= 64) {
          bridge.style.opacity = '0';
          return;
        }
        const height = Math.min(left.rect.height, right.rect.height) / scale;
        bridge.style.left = `${(left.rect.right - bounds.left) / scale - overlap}px`;
        bridge.style.top = `${(left.rect.top + left.rect.height / 2 - bounds.top) / scale}px`;
        bridge.style.width = `${gap + overlap * 2}px`;
        bridge.style.height = `${Math.min(42, Math.max(28, height * 0.122))}px`;
        bridge.style.opacity = String(
          Math.min(left.opacity, right.opacity) * Math.min(1, (64 - gap) / 32),
        );
      });
      if (animating) {
        frame = requestAnimationFrame(draw);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    element.addEventListener('transitionrun', schedule);
    element.addEventListener('transitionend', schedule);
    element.addEventListener('transitioncancel', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener('transitionrun', schedule);
      element.removeEventListener('transitionend', schedule);
      element.removeEventListener('transitioncancel', schedule);
    };
  }, [active, count, items, reducedMotion]);

  // Decode the selected image and its neighbors before their crossfade starts.
  useEffect(() => {
    if (!visible || count === 0) return;
    for (const offset of [-1, 0, 1]) {
      const index = (active + offset + count) % count;
      const image = root.current?.querySelector<HTMLImageElement>(
        `[data-slide-index="${index}"] .expanding-carousel-media > img`,
      );
      if (!image) continue;
      image.loading = 'eager';
      void image.decode().catch(() => {
        // Keep the native image/alt fallback if an asset cannot be decoded.
      });
    }
  }, [active, count, visible]);

  const select = (index: number, focusTab = false) => {
    if (count < 2) return;
    const next = ((index % count) + count) % count;
    if (next === active) {
      if (focusTab) tabs.current[next]?.focus();
      return;
    }
    setPrevious(active);
    setSelected(next);
    if (focusTab) tabs.current[next]?.focus();
  };

  if (count === 0) return null;

  return (
    <section
      ref={root}
      className={cn('expanding-carousel', className)}
      style={style}
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {heading && (
        <header className="expanding-carousel-section-heading">
          {eyebrow && <p className="expanding-carousel-section-eyebrow">{eyebrow}</p>}
          <h2 id={headingId ?? `${id}-heading`}>{heading}</h2>
          {description && <p>{description}</p>}
        </header>
      )}
      <div
        ref={stage}
        className="expanding-carousel-stage"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4)
            select(active + (dx < 0 ? 1 : -1));
        }}
        onTouchCancel={() => {
          touchStart.current = null;
        }}
      >
        {items.slice(1).map((item, index) => (
          <span
            key={`connector-${item.id}`}
            ref={(element) => {
              connectors.current[index] = element;
            }}
            className="expanding-carousel-connector"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 20 38"
              preserveAspectRatio="none"
              focusable="false"
              aria-hidden="true"
            >
              <path
                d="M0 0H1C1 7 3 14 10 14S19 7 19 0H20V38H19C19 31 17 24 10 24S1 31 1 38H0Z"
                fill="currentColor"
              />
            </svg>
          </span>
        ))}
        {items.map((item, index) => {
          let offset = (((index - active) % count) + count) % count;
          if (offset > count / 2) offset -= count;
          let previousOffset = (((index - previous) % count) + count) % count;
          if (previousOffset > count / 2) previousOffset -= count;
          const wrapped = Math.abs(offset - previousOffset) > count / 2;
          const isActive = index === active;
          const hidden = Math.abs(offset) > 2;
          const slot = Math.max(-3, Math.min(3, offset));
          return (
            <div
              className="expanding-carousel-card"
              data-slot={slot}
              data-slide-index={index}
              data-wrap={wrapped || undefined}
              key={item.id}
              aria-hidden={hidden || undefined}
              inert={hidden}
            >
              <div className="expanding-carousel-clip">
                <button
                  type="button"
                  className="expanding-carousel-preview"
                  tabIndex={-1}
                  aria-hidden={isActive}
                  inert={isActive}
                  aria-label={`${labels.slide} ${index + 1}: ${item.title}`}
                  onClick={() => select(index)}
                >
                  {renderPreview ? (
                    renderPreview(item)
                  ) : item.image ? (
                    <img
                      src={item.image.previewSrc ?? item.image.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ) : (
                    <span>{item.title}</span>
                  )}
                </button>
                <div
                  className="expanding-carousel-content-frame"
                  inert={!isActive}
                  aria-hidden={!isActive}
                >
                  <article
                    className="expanding-carousel-content"
                    data-custom={!!renderContent || undefined}
                    id={`${id}-panel-${index}`}
                    role="tabpanel"
                    aria-labelledby={`${id}-tab-${index}`}
                    tabIndex={isActive ? 0 : -1}
                  >
                    {renderContent ? (
                      renderContent(item, isActive)
                    ) : (
                      <>
                        <div className="expanding-carousel-copy">
                          <div className="expanding-carousel-heading">
                            {item.eyebrow && (
                              <p className="expanding-carousel-eyebrow">{item.eyebrow}</p>
                            )}
                            <h3>{item.title}</h3>
                          </div>
                          <div className="expanding-carousel-details">
                            <p className="expanding-carousel-description">{item.description}</p>
                            {item.badges && (
                              <ul className="expanding-carousel-badges">
                                {item.badges.map((badge) => (
                                  <li key={badge}>{badge}</li>
                                ))}
                              </ul>
                            )}
                            {item.links && (
                              <div className="expanding-carousel-links">
                                {item.links.map((link) => (
                                  <a
                                    key={link.href}
                                    href={link.href}
                                    target={link.external ? '_blank' : undefined}
                                    rel={link.external ? 'noopener noreferrer' : undefined}
                                  >
                                    {link.label}
                                    <span aria-hidden="true">{link.external ? '↗' : '→'}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="expanding-carousel-media">
                          {item.image && (
                            <img
                              src={item.image.src}
                              alt={item.image.alt}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              data-fit={item.image.fit ?? 'cover'}
                            />
                          )}
                          {item.terminal && (
                            <div className="expanding-carousel-terminal">
                              <p>{item.terminal.title}</p>
                              <pre>
                                {item.terminal.lines.map((line, lineIndex) => (
                                  <span key={`${lineIndex}-${line.text}`} data-type={line.type}>
                                    {line.type === 'command' ? '$ ' : ''}
                                    {line.text}
                                    {'\n'}
                                  </span>
                                ))}
                              </pre>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="expanding-carousel-controls" hidden={count < 2}>
        <button
          className="expanding-carousel-arrow"
          type="button"
          aria-label={labels.previous}
          onClick={() => select(active - 1)}
        >
          <ChevronLeft size={13} aria-hidden="true" />
        </button>
        <div className="expanding-carousel-tabs" role="tablist" aria-label={label}>
          {items.map((item, index) => (
            <button
              ref={(element) => {
                tabs.current[index] = element;
              }}
              key={item.id}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={index === active}
              aria-label={`${labels.slide} ${index + 1}: ${item.title}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                let next: number | undefined;
                if (event.key === 'ArrowRight') next = active + 1;
                if (event.key === 'ArrowLeft') next = active - 1;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = count - 1;
                if (next !== undefined) {
                  event.preventDefault();
                  select(next, true);
                }
              }}
            >
              <span className="expanding-carousel-tab-track">
                {index === active && (
                  <span
                    key={`${item.id}-${active}`}
                    className="expanding-carousel-progress"
                    data-animate={canRotate}
                    style={{
                      animationDuration: `${interval}ms`,
                      animationPlayState: playing ? 'running' : 'paused',
                    }}
                    onAnimationEnd={() => {
                      if (playing) select(active + 1);
                    }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
        <button
          className="expanding-carousel-arrow"
          type="button"
          aria-label={labels.next}
          onClick={() => select(active + 1)}
        >
          <ChevronRight size={13} aria-hidden="true" />
        </button>
        {canRotate && (
          <button
            className="expanding-carousel-arrow"
            type="button"
            aria-label={paused ? labels.play : labels.pause}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? (
              <Play size={11} aria-hidden="true" />
            ) : (
              <Pause size={11} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <span
        className="sr-only"
        aria-live={playing ? 'off' : 'polite'}
        aria-atomic="true"
      >{`${labels.slide} ${active + 1} / ${count}: ${items[active].title}`}</span>
    </section>
  );
}
