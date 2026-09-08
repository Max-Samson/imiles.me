import { useEffect } from 'react';

export interface PDFShortcutsHandlers {
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onOpenSearch?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function usePDFShortcuts({
  onNextPage,
  onPrevPage,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenSearch,
  onEscape,
  enabled = true,
}: PDFShortcutsHandlers) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Search shortcut (Cmd+F / Ctrl+F) works even when outside or triggers search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      // If user is currently typing in an input field, do not trigger single-key shortcuts
      if (isInput) {
        if (e.key === 'Escape') {
          onEscape?.();
        }
        return;
      }

      // Single-key shortcuts
      switch (e.key) {
        case 'PageDown':
        case 'j':
        case 'J':
        case 'ArrowRight':
          e.preventDefault();
          onNextPage?.();
          break;

        case 'PageUp':
        case 'k':
        case 'K':
        case 'ArrowLeft':
          e.preventDefault();
          onPrevPage?.();
          break;

        case '+':
        case '=':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
          }
          onZoomIn?.();
          break;

        case '-':
        case '_':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
          }
          onZoomOut?.();
          break;

        case '0':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
          }
          onResetZoom?.();
          break;

        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNextPage, onPrevPage, onZoomIn, onZoomOut, onResetZoom, onOpenSearch, onEscape]);
}
