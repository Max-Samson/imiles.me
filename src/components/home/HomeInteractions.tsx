'use client';

import { Search } from 'lucide-react';
import { animate } from 'motion';
import { useEffect, useRef, useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';

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
  const sections = [
    ['hero-section', t('Headerhome')],
    ['projects-section', t('HomeProjectsTitle')],
    ['blog-section', t('HomeBlogTitle')],
    ['tech-section', t('HomeTechTitle')],
    ['garden-section', t('HomeGardenTitle')],
  ];

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
    const controls = new Set<ReturnType<typeof animate>>();
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
    document.querySelectorAll('[data-home-reveal]').forEach((element) => {
      reveal.observe(element);
    });
    document
      .querySelectorAll<HTMLElement>('[data-magnetic], [data-home-tilt]')
      .forEach((element) => {
        let animation: ReturnType<typeof animate> | undefined;
        const move = (event: PointerEvent) => {
          if (preference.matches || !finePointer.matches) return;
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          animation?.stop();
          animation = element.hasAttribute('data-magnetic')
            ? animate(element, { x: x * 10, y: y * 8 }, { duration: 0.2 })
            : animate(
                element,
                { rotateX: -y * 4, rotateY: x * 4, transformPerspective: 1200 },
                { duration: 0.2 },
              );
        };
        const reset = () => {
          animation?.stop();
          animation = animate(
            element,
            { x: 0, y: 0, rotateX: 0, rotateY: 0 },
            { duration: preference.matches ? 0 : 0.3 },
          );
        };
        element.addEventListener('pointermove', move);
        element.addEventListener('pointerleave', reset);
        preference.addEventListener('change', reset);
        cleanups.push(() => {
          animation?.stop();
          element.removeEventListener('pointermove', move);
          element.removeEventListener('pointerleave', reset);
          preference.removeEventListener('change', reset);
        });
      });
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

  return (
    <>
      <nav className="home-scroll-nav" aria-label={t('HomeNavigation')}>
        {sections.map(([id, title]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-label={title}
            aria-current={active === id ? 'location' : undefined}
          >
            <span>{title}</span>
          </a>
        ))}
      </nav>
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
