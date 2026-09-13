'use client';

import { useCallback, useEffect, useState } from 'react';
import ProfileCardMilesCommon from '@/components/common/ProfileCardMiles';
import type { Locale } from '@/lib/i18n';

export interface ProfileCardMilesProps {
  label: string;
  lang?: Locale;
}

export default function ProfileCardMiles({ label, lang = 'en' }: ProfileCardMilesProps) {
  const [isOpen, setIsOpen] = useState(false);

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
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 hover:bg-muted/80 mt-2.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-foreground backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:border-foreground/30 cursor-pointer"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span>{label}</span>
        <span aria-hidden="true" className="text-muted-foreground text-xs">
          ↗
        </span>
      </button>

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
              <button
                type="button"
                onClick={handleClose}
                className="group flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg hover:border-white/40"
                aria-label="Close modal"
              >
                <span>{lang === 'zh' ? '关闭' : 'Close'}</span>
                <kbd className="hidden sm:inline-block rounded border border-white/20 bg-white/10 px-1 py-0.2 text-[10px] font-mono opacity-60">
                  ESC
                </kbd>
                <span className="text-xs transition-transform duration-200 group-hover:rotate-90">
                  ✕
                </span>
              </button>
            </div>

            <ProfileCardMilesCommon lang={lang} />
          </div>
        </div>
      )}
    </>
  );
}
