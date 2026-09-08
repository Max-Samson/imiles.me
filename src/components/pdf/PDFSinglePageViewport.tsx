import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type React from 'react';
import { useEffect, useRef } from 'react';
import type { PDFSearchMatch } from '@/hooks/usePDFSearch';
import PDFPageCanvas from './PDFPageCanvas';

export interface PDFSinglePageViewportProps {
  pdf: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  scale: number;
  searchQuery?: string;
  activeMatch?: PDFSearchMatch | null;
  onNextPage: () => void;
  onPrevPage: () => void;
  onScaleChange?: (updater: (prev: number) => number) => void;
}

export const PDFSinglePageViewport: React.FC<PDFSinglePageViewportProps> = ({
  pdf,
  numPages,
  currentPage,
  scale,
  searchQuery = '',
  activeMatch,
  onNextPage,
  onPrevPage,
  onScaleChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cmd / Ctrl + Mouse Wheel Zoom Listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onScaleChange) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        onScaleChange((prev) => Math.max(0.4, Math.min(3.0, Number((prev + delta).toFixed(2)))));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [onScaleChange]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-auto bg-neutral-100/70 p-6 dark:bg-neutral-900/60 custom-scrollbar flex items-center justify-center select-text"
      style={{ height: 'calc(100dvh - 3.5rem)' }}
    >
      {/* Floating Prev Button */}
      {currentPage > 1 && (
        <button
          type="button"
          onClick={onPrevPage}
          className="absolute left-6 z-10 hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-background dark:border-neutral-800"
          title="Previous Page (K / PageUp)"
        >
          <IconChevronLeft size={24} />
        </button>
      )}

      {/* Main Single Page Canvas */}
      <div className="flex items-center justify-center my-auto">
        <PDFPageCanvas
          pdf={pdf}
          pageNumber={currentPage}
          scale={scale}
          searchQuery={searchQuery}
          isCurrentSearchPage={activeMatch?.pageNumber === currentPage}
        />
      </div>

      {/* Floating Next Button */}
      {currentPage < numPages && (
        <button
          type="button"
          onClick={onNextPage}
          className="absolute right-6 z-10 hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-background dark:border-neutral-800"
          title="Next Page (J / PageDown)"
        >
          <IconChevronRight size={24} />
        </button>
      )}
    </div>
  );
};

export default PDFSinglePageViewport;
