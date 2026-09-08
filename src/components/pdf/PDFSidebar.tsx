import {
  IconArrowRight,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconListTree,
  IconPhoto,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { PDFOutlineItem } from '@/hooks/usePDFDocument';
import type { PDFSearchMatch } from '@/hooks/usePDFSearch';

export interface PDFSidebarProps {
  pdf: PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  outline: PDFOutlineItem[];
  activeTab: 'outline' | 'thumbnails' | 'search';
  isOpen: boolean;
  searchQuery: string;
  matches: PDFSearchMatch[];
  activeMatchIndex: number;
  searching: boolean;
  onTabChange: (tab: 'outline' | 'thumbnails' | 'search') => void;
  onClose: () => void;
  onSelectPage: (page: number) => void;
  onSearch: (query: string) => void;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onSelectMatch: (index: number) => void;
}

export const PDFSidebar: React.FC<PDFSidebarProps> = ({
  pdf,
  numPages,
  currentPage,
  outline,
  activeTab,
  isOpen,
  searchQuery,
  matches,
  activeMatchIndex,
  searching,
  onTabChange,
  onClose,
  onSelectPage,
  onSearch,
  onNextMatch,
  onPrevMatch,
  onSelectMatch,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen && activeTab === 'search') {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localSearch);
  };

  return (
    <aside className="relative z-20 flex h-[calc(100dvh-3.5rem)] shrink-0 border-r border-border/80 bg-background/95 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95 select-none">
      {/* 1. Left Slim Icon Activity Rail */}
      <div className="flex w-12 flex-col items-center gap-2 border-r border-border/60 py-3 dark:border-neutral-800/80 bg-muted/20 dark:bg-neutral-900/30">
        <button
          type="button"
          onClick={() => {
            if (isOpen && activeTab === 'outline') {
              onClose();
            } else {
              onTabChange('outline');
            }
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
            isOpen && activeTab === 'outline'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-neutral-200/70 hover:text-foreground dark:hover:bg-neutral-800'
          }`}
          title="Table of Contents (Outline)"
          aria-label="Table of Contents"
        >
          <IconListTree size={18} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (isOpen && activeTab === 'thumbnails') {
              onClose();
            } else {
              onTabChange('thumbnails');
            }
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
            isOpen && activeTab === 'thumbnails'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-neutral-200/70 hover:text-foreground dark:hover:bg-neutral-800'
          }`}
          title="Page Thumbnails"
          aria-label="Page Thumbnails"
        >
          <IconPhoto size={18} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (isOpen && activeTab === 'search') {
              onClose();
            } else {
              onTabChange('search');
            }
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
            isOpen && activeTab === 'search'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-neutral-200/70 hover:text-foreground dark:hover:bg-neutral-800'
          }`}
          title="Search in Document (Cmd+F)"
          aria-label="Search Document"
        >
          <IconSearch size={18} />
        </button>
      </div>

      {/* 2. Expandable Function Panel */}
      {isOpen && (
        <div className="flex w-72 flex-col overflow-hidden transition-all duration-200">
          {/* Panel Header */}
          <div className="flex h-12 items-center justify-between border-b border-border/60 px-3.5 dark:border-neutral-800">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              {activeTab === 'outline' && (
                <>
                  <IconListTree size={16} className="text-primary" />
                  <span>Table of Contents</span>
                </>
              )}
              {activeTab === 'thumbnails' && (
                <>
                  <IconPhoto size={16} className="text-primary" />
                  <span>Page Thumbnails ({numPages})</span>
                </>
              )}
              {activeTab === 'search' && (
                <>
                  <IconSearch size={16} className="text-primary" />
                  <span>Search Document</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-900"
              title="Collapse Panel (Esc)"
            >
              <IconX size={15} />
            </button>
          </div>

          {/* Panel Body Content */}
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {/* Tab 1: Outline */}
            {activeTab === 'outline' && (
              <div className="flex flex-col gap-1">
                {outline && outline.length > 0 ? (
                  outline.map((item, idx) => (
                    <OutlineNode
                      key={`${item.title}-${idx}`}
                      item={item}
                      currentPage={currentPage}
                      onSelectPage={onSelectPage}
                    />
                  ))
                ) : (
                  <div className="my-10 flex flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                    <IconListTree size={24} className="opacity-40" />
                    <span>No embedded outline in this document.</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Thumbnails */}
            {activeTab === 'thumbnails' && (
              <div className="flex flex-col gap-4 items-center px-1">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <ThumbnailItem
                    key={pageNum}
                    pdf={pdf}
                    pageNumber={pageNum}
                    isActive={currentPage === pageNum}
                    onClick={() => onSelectPage(pageNum)}
                  />
                ))}
              </div>
            )}

            {/* Tab 3: Search */}
            {activeTab === 'search' && (
              <div className="flex flex-col gap-3">
                <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2">
                  <div className="relative flex items-center">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Find in document..."
                      value={localSearch}
                      onChange={(e) => setLocalSearch(e.target.value)}
                      className="w-full rounded-lg border border-border/80 bg-background py-2 pl-3 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
                    />
                    {localSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalSearch('');
                          onSearch('');
                        }}
                        className="absolute right-2 text-muted-foreground hover:text-foreground"
                      >
                        <IconX size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {searching
                        ? 'Searching...'
                        : matches.length > 0
                          ? `${activeMatchIndex + 1} of ${matches.length} matches`
                          : localSearch.trim()
                            ? 'No matches'
                            : 'Enter keyword'}
                    </span>

                    {matches.length > 0 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={onPrevMatch}
                          className="p-1 rounded-md hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
                          title="Previous Match"
                        >
                          <IconChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={onNextMatch}
                          className="p-1 rounded-md hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
                          title="Next Match"
                        >
                          <IconChevronDown size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </form>

                <div className="flex flex-col gap-1.5 mt-2">
                  {matches.map((m, idx) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => onSelectMatch(idx)}
                      className={`flex flex-col gap-1 rounded-lg border p-2.5 text-left text-xs transition-colors ${
                        activeMatchIndex === idx
                          ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/20'
                          : 'border-border/60 bg-card/40 text-foreground hover:border-border hover:bg-card dark:border-neutral-800/80 dark:bg-neutral-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                        <span>Page {m.pageNumber}</span>
                        {activeMatchIndex === idx && (
                          <IconArrowRight size={13} className="text-primary" />
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {m.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

// Recursive outline node renderer
const OutlineNode: React.FC<{
  item: PDFOutlineItem;
  currentPage: number;
  onSelectPage: (page: number) => void;
  level?: number;
}> = ({ item, currentPage, onSelectPage, level = 0 }) => {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = item.items && item.items.length > 0;
  const isCurrent = item.pageNumber === currentPage;

  return (
    <div className="flex flex-col">
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
          isCurrent
            ? 'bg-primary/10 font-semibold text-primary dark:bg-primary/20'
            : 'text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-900'
        }`}
        style={{ paddingLeft: `${Math.max(8, level * 14 + 8)}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5 text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}

        <button
          type="button"
          onClick={() => {
            if (item.pageNumber) {
              onSelectPage(item.pageNumber);
            }
          }}
          disabled={!item.pageNumber}
          className="flex-1 truncate text-left disabled:opacity-50"
          title={item.title}
        >
          {item.title}
        </button>

        {item.pageNumber && (
          <span className="font-mono text-[10px] text-muted-foreground opacity-60 group-hover:opacity-100">
            {item.pageNumber}
          </span>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="flex flex-col">
          {item.items.map((child, idx) => (
            <OutlineNode
              key={`${child.title}-${idx}`}
              item={child}
              currentPage={currentPage}
              onSelectPage={onSelectPage}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Mini thumbnail renderer
const ThumbnailItem: React.FC<{
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ pdf, pageNumber, isActive, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const renderThumbnail = async () => {
      if (!pdf) return;
      try {
        const page = await pdf.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        if (!isCancelled) {
          setRendered(true);
        }
      } catch {
        // ignore thumbnail cancellation
      }
    };

    renderThumbnail();
    return () => {
      isCancelled = true;
    };
  }, [pdf, pageNumber]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full max-w-[210px] flex flex-col items-center gap-2 rounded-xl border p-2 transition-all cursor-pointer ${
        isActive
          ? 'border-primary ring-2 ring-primary/40 bg-primary/5 shadow-sm'
          : 'border-border/70 hover:border-primary/40 bg-card/50 hover:bg-card dark:border-neutral-800 dark:bg-neutral-900/40'
      }`}
    >
      <div className="relative flex aspect-[1/1.4] w-full items-center justify-center overflow-hidden rounded-lg bg-white shadow-xs dark:bg-neutral-900">
        <canvas ref={canvasRef} className="max-h-full max-w-full block rounded-sm" />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-muted-foreground bg-neutral-100 dark:bg-neutral-900">
            Page {pageNumber}
          </div>
        )}
      </div>
      <span
        className={`font-mono text-xs transition-colors ${
          isActive
            ? 'font-semibold text-primary'
            : 'text-muted-foreground group-hover:text-foreground'
        }`}
      >
        Page {pageNumber}
      </span>
    </button>
  );
};

export default PDFSidebar;
