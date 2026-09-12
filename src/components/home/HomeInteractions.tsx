'use client';

import { Search } from 'lucide-react';
import { type AnimationPlaybackControls, animate } from 'motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
import LineSidebar from '@/registry/react-bits/line-sidebar';

interface SearchItem {
  title: string;
  description: string;
  href: string;
}

export default function HomeInteractions({ lang, items }: { lang: Locale; items: SearchItem[] }) {
  const { t } = useTranslations(lang);
  const [active, setActive] = useState('hero-section');
  const [query, setQuery] = useState('');

  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const openSearch = () => {
    dialog.current?.showModal();
    searchInput.current?.focus();
  };
  const trigger = useRef<HTMLButtonElement>(null);

  const isZh = lang === 'zh';
  const sections = useMemo(
    () => [
      ['hero-section', isZh ? '首屏总览' : 'Overview'],
      ['projects-section', isZh ? '工程作品' : 'Projects'],
      ['blog-section', isZh ? '深度长文' : 'Essays'],
      ['tech-section', isZh ? '技术矩阵' : 'Tech Stack'],
      ['garden-section', isZh ? '数字花园' : 'Garden'],
    ],
    [isZh],
  );
  const sectionTitles = useMemo(() => sections.map(([, title]) => title), [sections]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.home-page section[id]'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    for (const element of elements) observer.observe(element);
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else {
          dialog.current?.showModal();
          searchInput.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', keydown);
    };
  }, []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const cleanups: (() => void)[] = [];
    const controls = new Set<AnimationPlaybackControls>();
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (!entry.isIntersecting) return;
          if (!preference.matches) {
            controls.add(
              animate(
                entry.target as HTMLElement,
                { opacity: [0, 1], y: [24, 0] },
                { duration: 0.55, delay: index * 0.08 },
              ),
            );
          }
          reveal.unobserve(entry.target);
        });
      },
      { threshold: 0.1 },
    );

    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>('[data-home-reveal]'),
    )) {
      if (preference.matches) {
        element.style.opacity = '1';
        element.style.transform = 'none';
      } else {
        element.style.opacity = '0';
        element.style.transform = 'translateY(24px)';
        reveal.observe(element);
      }
    }

    if (finePointer.matches && !preference.matches) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-magnetic]'))) {
        const move = (event: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - (rect.left + rect.width / 2)) * 0.2;
          const y = (event.clientY - (rect.top + rect.height / 2)) * 0.2;
          element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        };
        const leave = () => {
          element.style.transform = 'translate3d(0, 0, 0)';
        };
        element.addEventListener('mousemove', move);
        element.addEventListener('mouseleave', leave);
        cleanups.push(() => {
          element.removeEventListener('mousemove', move);
          element.removeEventListener('mouseleave', leave);
        });
      }
    }

    return () => {
      reveal.disconnect();
      controls.forEach((control) => {
        control.stop();
      });
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    };
  }, []);

  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const results = items.filter((item) =>
    terms.every((term) => `${item.title} ${item.description}`.toLocaleLowerCase().includes(term)),
  );
  const activeIndex = sections.findIndex(([id]) => id === active);

  const handleSectionClick = useCallback(
    (index: number) => {
      const [id] = sections[index];
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [sections],
  );

  return (
    <>
      <aside
        aria-label={t('HomeNavigation')}
        className="fixed left-2 sm:left-6 top-1/2 -translate-y-1/2 z-30 select-none hidden md:flex"
      >
        <LineSidebar
          ariaLabel={t('HomeNavigation')}
          items={sectionTitles}
          activeIndex={activeIndex >= 0 ? activeIndex : 0}
          onItemClick={handleSectionClick}
          hoverToRevealText={true}
          accentColor="var(--line-sidebar-accent)"
          textColor="var(--line-sidebar-text)"
          markerColor="var(--line-sidebar-marker)"
          showIndex={false}
          showMarker={true}
          proximityRadius={100}
          maxShift={30}
          falloff="smooth"
          markerLength={60}
          markerGap={0}
          tickScale={0.5}
          scaleTick={true}
          itemGap={20}
          fontSize={1.1}
          smoothing={100}
          defaultActive={0}
        />
      </aside>
      <button
        ref={trigger}
        className="home-search-trigger"
        aria-label={t('HomeSearch')}
        type="button"
        onClick={openSearch}
      >
        <Search size={16} aria-hidden="true" />
        <span className="hidden sm:inline">
          {t('HomeSearch')} <kbd>⌘/Ctrl K</kbd>
        </span>
      </button>
      <dialog
        ref={dialog}
        className="home-search-dialog"
        aria-labelledby="home-search-title"
        onClose={() => trigger.current?.focus()}
      >
        <div className="home-search-heading">
          <h2 id="home-search-title">{t('HomeSearch')}</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            {t('HomeClose')} · Esc
          </button>
        </div>
        <input
          ref={searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t('HomeSearch')}
          placeholder={t('HomeSearch')}
        />
        <ul>
          {results.map((item) => (
            <li key={item.href}>
              <a href={item.href}>
                {item.title}
                <small>{item.description}</small>
              </a>
            </li>
          ))}
        </ul>
        {results.length === 0 && <output>{t('HomeSearchEmpty')}</output>}
      </dialog>
    </>
  );
}
