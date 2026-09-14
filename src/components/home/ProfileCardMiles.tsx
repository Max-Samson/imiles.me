'use client';

import { ArrowRight, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ProfileCardMilesCommon from '@/components/common/ProfileCardMiles';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import type { Locale } from '@/lib/i18n';

export interface ProfileCardMilesProps {
  label?: string;
  lang?: Locale;
}

export default function ProfileCardMiles({
  label = 'Liquid Glass',
  lang = 'en',
}: ProfileCardMilesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDark(root.classList.contains('dark'));
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  return (
    <>
      {/* Trigger Button beside H2 title */}
      <LiquidGlassButton
        type="button"
        onClick={() => setIsOpen(true)}
        variant={isDark ? 'obsidian' : 'default'}
        size="sm"
        shimmer
        glow
        iconRight={<ArrowRight className="size-4" />}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="mt-2.5 cursor-pointer"
      >
        {label}
      </LiquidGlassButton>

      {/* Full-screen Modal Overlay — clicking backdrop closes modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          {/* Backdrop button: clicking anywhere outside card closes modal */}
          <button
            type="button"
            aria-label="Close overlay"
            tabIndex={-1}
            onClick={handleClose}
            className="fixed inset-0 h-full w-full bg-black/85 backdrop-blur-2xl border-none cursor-default"
          />

          {/* Top-right floating close button */}
          <button
            type="button"
            onClick={handleClose}
            className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[110] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-xl transition-all hover:bg-white/20 hover:text-white hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
            aria-label="Close modal"
            title={lang === 'zh' ? '关闭 (Esc)' : 'Close (Esc)'}
          >
            <span className="text-base font-light leading-none">✕</span>
          </button>

          {/* Modal Content container — clicking inside does not close modal */}
          <div className="relative z-10 w-fit max-w-[420px] flex flex-col items-center justify-center my-auto py-6 pointer-events-auto">
            {/* Above-card quick action bar aligned exactly to card width */}
            <div className="w-full flex items-center justify-between mb-2.5 px-2">
              <div className="flex items-center gap-2 text-[11px] tracking-wider uppercase text-white/60 font-mono">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{lang === 'zh' ? '名片卡' : 'Profile'}</span>
              </div>
              <LiquidGlassButton
                type="button"
                onClick={handleClose}
                variant="brand"
                size="sm"
                shimmer
                glow
                aria-label="Close modal"
                iconRight={
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="hidden sm:inline-block rounded border border-current/20 bg-black/10 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-mono opacity-70 leading-none">
                      ESC
                    </kbd>
                    <X className="size-3.5 transition-transform duration-200 group-hover:rotate-90" />
                  </span>
                }
              >
                {lang === 'zh' ? '关闭' : 'Close'}
              </LiquidGlassButton>
            </div>

            <ProfileCardMilesCommon lang={lang} />
          </div>
        </div>
      )}
    </>
  );
}
