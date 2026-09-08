import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFile,
  IconFileTypePdf,
  IconLayoutRows,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import type React from 'react';

export interface PDFToolbarProps {
  title?: string;
  numPages: number;
  currentPage: number;
  scale: number;
  viewMode: 'continuous' | 'single';
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
  onViewModeChange: (mode: 'continuous' | 'single') => void;
  onDownload: () => void;
}

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  title,
  numPages,
  currentPage,
  scale,
  viewMode,
  onPageChange,
  onScaleChange,
  onViewModeChange,
  onDownload,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/80 bg-background/80 px-4 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80 select-none">
      {/* Left: Document Icon & Title */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
          <IconFileTypePdf size={18} />
        </div>

        {title && (
          <span
            className="max-w-[200px] sm:max-w-[320px] md:max-w-[450px] truncate font-semibold text-xs text-foreground"
            title={title}
          >
            {title}
          </span>
        )}
      </div>

      {/* Center: Pagination controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1 || numPages <= 0}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground disabled:opacity-30 dark:hover:bg-neutral-900"
          title="Previous Page (K / PageUp)"
        >
          <IconChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-1 font-mono text-xs text-foreground">
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={currentPage || 1}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val) && val >= 1 && val <= numPages) {
                onPageChange(val);
              }
            }}
            className="h-7 w-12 rounded-md border border-border/80 bg-background px-1 text-center font-mono text-xs text-foreground focus:border-primary focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
          />
          <span className="text-muted-foreground">/ {numPages || '--'}</span>
        </div>

        <button
          type="button"
          disabled={currentPage >= numPages || numPages <= 0}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground disabled:opacity-30 dark:hover:bg-neutral-900"
          title="Next Page (J / PageDown)"
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      {/* Right: Zoom, View Mode, Actions */}
      <div className="flex items-center gap-1.5">
        {/* Zoom */}
        <div className="hidden sm:flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => onScaleChange(Math.max(0.4, Number((scale - 0.15).toFixed(2))))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            title="Zoom Out (-)"
          >
            <IconZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={() => onScaleChange(1.0)}
            className="px-2 font-mono text-xs text-foreground hover:text-primary"
            title="Reset Zoom (0)"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onScaleChange(Math.min(2.5, Number((scale + 0.15).toFixed(2))))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            title="Zoom In (+)"
          >
            <IconZoomIn size={15} />
          </button>
        </div>

        {/* View Mode Toggle (Continuous vs Single) */}
        <div className="hidden lg:flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => onViewModeChange('continuous')}
            className={`flex h-7 px-2 items-center gap-1 rounded-md text-xs ${
              viewMode === 'continuous'
                ? 'bg-background text-foreground shadow-xs dark:bg-neutral-800'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Continuous Vertical Scroll"
          >
            <IconLayoutRows size={14} />
            <span>Scroll</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('single')}
            className={`flex h-7 px-2 items-center gap-1 rounded-md text-xs ${
              viewMode === 'single'
                ? 'bg-background text-foreground shadow-xs dark:bg-neutral-800'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Single Page Mode"
          >
            <IconFile size={14} />
            <span>Page</span>
          </button>
        </div>

        {/* Download Action */}
        <div className="flex items-center gap-1 border-l border-border/60 pl-1.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onDownload}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground dark:bg-primary/20 dark:hover:bg-primary"
            title="下载完整 PDF"
            aria-label="下载完整 PDF"
          >
            <IconDownload size={16} />
            <span className="hidden sm:inline">下载 PDF</span>
            <span className="inline sm:hidden">下载</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default PDFToolbar;
