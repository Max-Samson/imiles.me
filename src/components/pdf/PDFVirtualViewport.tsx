import type { PDFDocumentProxy } from 'pdfjs-dist';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFPageDimension } from '@/hooks/usePDFDocument';
import type { PDFSearchMatch } from '@/hooks/usePDFSearch';
import PDFPageCanvas from './PDFPageCanvas';

export interface PDFVirtualViewportProps {
  pdf: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  scale: number;
  pageDimensions: PDFPageDimension[];
  searchQuery?: string;
  activeMatch?: PDFSearchMatch | null;
  onPageVisible: (pageNumber: number) => void;
  onScaleChange?: (updater: (prev: number) => number) => void;
}

export const PDFVirtualViewport: React.FC<PDFVirtualViewportProps> = ({
  pdf,
  numPages,
  currentPage,
  scale,
  pageDimensions,
  searchQuery = '',
  activeMatch,
  onPageVisible,
  onScaleChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [renderedPages, setRenderedPages] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    for (let i = 1; i <= Math.min(numPages, 3); i++) {
      initial.add(i);
    }
    return initial;
  });

  // Calculate placeholder dimensions based on scale & aspect ratio
  const getPagePlaceholderStyle = (pageNum: number) => {
    const dim = pageDimensions.find((d) => d.pageNumber === pageNum);
    if (!dim) {
      return { width: `${Math.floor(600 * scale)}px`, minHeight: `${Math.floor(800 * scale)}px` };
    }
    const width = Math.floor(dim.width * scale);
    const height = Math.floor(dim.height * scale);
    return { width: `${width}px`, minHeight: `${height}px` };
  };

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

  // Observe which page is currently dominant in the viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIndices: number[] = [];

        for (const entry of entries) {
          const pageNum = Number.parseInt(entry.target.getAttribute('data-page') || '0', 10);
          if (pageNum > 0 && entry.isIntersecting) {
            visibleIndices.push(pageNum);
          }
        }

        if (visibleIndices.length > 0) {
          // Report the lowest visible page
          const lowest = Math.min(...visibleIndices);
          lastTargetPageRef.current = lowest;
          onPageVisible(lowest);

          // Expand rendered pages set to visible pages +/- 2 buffer pages
          setRenderedPages((prev) => {
            const next = new Set(prev);
            for (const p of visibleIndices) {
              next.add(p);
              if (p > 1) next.add(p - 1);
              if (p < numPages) next.add(p + 1);
            }
            return next;
          });
        }
      },
      {
        root: container,
        rootMargin: '200px 0px',
        threshold: [0.1, 0.5],
      },
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [numPages, onPageVisible]);

  // Scroll to active page when requested programmatically
  const scrollToPage = useCallback((targetPage: number) => {
    const pageEl = pageRefs.current.get(targetPage);
    if (pageEl && containerRef.current) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Sync scroll on active match changes
  useEffect(() => {
    if (activeMatch?.pageNumber) {
      // Ensure target page is in renderedPages set
      setRenderedPages((prev) => {
        const next = new Set(prev);
        next.add(activeMatch.pageNumber);
        if (activeMatch.pageNumber > 1) next.add(activeMatch.pageNumber - 1);
        if (activeMatch.pageNumber < numPages) next.add(activeMatch.pageNumber + 1);
        return next;
      });
      scrollToPage(activeMatch.pageNumber);
    }
  }, [activeMatch, numPages, scrollToPage]);

  // Sync scroll on external page change (e.g. from sidebar outline/thumbnails)
  const lastTargetPageRef = useRef(currentPage);
  useEffect(() => {
    if (currentPage !== lastTargetPageRef.current) {
      setRenderedPages((prev) => {
        const next = new Set(prev);
        next.add(currentPage);
        if (currentPage > 1) next.add(currentPage - 1);
        if (currentPage < numPages) next.add(currentPage + 1);
        return next;
      });
      scrollToPage(currentPage);
      lastTargetPageRef.current = currentPage;
    }
  }, [currentPage, numPages, scrollToPage]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-y-auto overflow-x-auto bg-neutral-100/70 p-6 dark:bg-neutral-900/60 custom-scrollbar flex flex-col items-center select-text"
      style={{ height: 'calc(100dvh - 3.5rem)' }}
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-full pb-16">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
          const isRendered = renderedPages.has(pageNum);
          const isCurrentSearch = activeMatch?.pageNumber === pageNum;

          return (
            <div
              key={pageNum}
              data-page={pageNum}
              ref={(el) => {
                if (el) pageRefs.current.set(pageNum, el);
                else pageRefs.current.delete(pageNum);
              }}
              style={getPagePlaceholderStyle(pageNum)}
              className="flex justify-center"
            >
              {isRendered ? (
                <PDFPageCanvas
                  pdf={pdf}
                  pageNumber={pageNum}
                  scale={scale}
                  searchQuery={searchQuery}
                  isCurrentSearchPage={isCurrentSearch}
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center rounded-sm bg-neutral-200/60 shadow-md dark:bg-neutral-800/60"
                  style={getPagePlaceholderStyle(pageNum)}
                >
                  <span className="font-mono text-xs text-muted-foreground">Page {pageNum}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PDFVirtualViewport;
