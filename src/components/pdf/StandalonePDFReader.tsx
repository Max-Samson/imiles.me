import {
  IconAlertTriangle,
  IconArrowLeft,
  IconFileTypePdf,
  IconRefresh,
} from '@tabler/icons-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePDFDocument } from '@/hooks/usePDFDocument';
import { usePDFSearch } from '@/hooks/usePDFSearch';
import { usePDFShortcuts } from '@/hooks/usePDFShortcuts';
import PDFSidebar from './PDFSidebar';
import PDFSinglePageViewport from './PDFSinglePageViewport';
import PDFToolbar from './PDFToolbar';
import PDFVirtualViewport from './PDFVirtualViewport';

export interface StandalonePDFReaderProps {
  /** Optional initial file URL if not using query param */
  initialSrc?: string;
  /** Optional initial title */
  initialTitle?: string;
}

export const StandalonePDFReader: React.FC<StandalonePDFReaderProps> = ({
  initialSrc,
  initialTitle,
}) => {
  const [fileUrl, setFileUrl] = useState<string | null>(initialSrc || null);
  const [docTitle, setDocTitle] = useState<string>(initialTitle || 'PDF Document');

  // Read URL query params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const srcParam = params.get('src') || params.get('file');
    const titleParam = params.get('title');

    if (srcParam) {
      setFileUrl(srcParam);
      if (titleParam) {
        setDocTitle(titleParam);
        document.title = `${titleParam} - PDF Reader`;
      } else {
        const filename = srcParam.split('/').pop() || 'PDF Document';
        setDocTitle(filename);
        document.title = `${filename} - PDF Reader`;
      }
    }
  }, []);

  // PDF Document Loading Hook
  const { pdf, numPages, outline, pageDimensions, loading, progress, error, reload } =
    usePDFDocument(fileUrl);

  // PDF Full-Text Search Hook
  const {
    query: searchQuery,
    matches,
    activeMatchIndex,
    activeMatch,
    searching,
    performSearch,
    nextMatch,
    prevMatch,
    goToMatch,
  } = usePDFSearch(pdf);

  // Viewer States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'outline' | 'thumbnails' | 'search'>(
    'outline',
  );

  // Auto-open outline sidebar if outlines exist on large screens
  useEffect(() => {
    if (outline.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1280) {
      setSidebarOpen(true);
    }
  }, [outline.length]);

  // Page Navigation Handlers
  const handlePageChange = useCallback(
    (page: number) => {
      const valid = Math.max(1, Math.min(numPages || 1, page));
      setCurrentPage(valid);
    },
    [numPages],
  );

  const handleNextPage = useCallback(() => {
    handlePageChange(currentPage + 1);
  }, [currentPage, handlePageChange]);

  const handlePrevPage = useCallback(() => {
    handlePageChange(currentPage - 1);
  }, [currentPage, handlePageChange]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(0.4, Number((s - 0.15).toFixed(2))));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  const handleToggleSidebar = useCallback(
    (tab?: 'outline' | 'thumbnails' | 'search') => {
      if (tab) {
        if (sidebarOpen && activeSidebarTab === tab) {
          setSidebarOpen(false);
        } else {
          setActiveSidebarTab(tab);
          setSidebarOpen(true);
        }
      } else {
        setSidebarOpen((prev) => !prev);
      }
    },
    [sidebarOpen, activeSidebarTab],
  );

  const handleDownload = useCallback(async () => {
    if (!fileUrl) return;
    const cleanTitle = (docTitle || 'document').trim();
    const filename = cleanTitle.toLowerCase().endsWith('.pdf') ? cleanTitle : `${cleanTitle}.pdf`;

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Download request failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback to direct anchor download
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [fileUrl, docTitle]);

  // Keyboard Shortcuts
  usePDFShortcuts({
    onNextPage: handleNextPage,
    onPrevPage: handlePrevPage,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetZoom: handleResetZoom,
    onOpenSearch: () => handleToggleSidebar('search'),
    onEscape: () => setSidebarOpen(false),
    enabled: Boolean(pdf && !loading),
  });

  // Empty state: No file specified
  if (!fileUrl) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-foreground">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
            <IconFileTypePdf size={36} />
          </div>
          <h2 className="text-xl font-bold">No PDF Document Specified</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Please provide a document URL via the query parameter, e.g.{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              /pdf?src=/docs/my-paper.pdf
            </code>
          </p>
          <a
            href="/"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:scale-105"
          >
            <IconArrowLeft size={16} />
            <span>Return to Home</span>
          </a>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-foreground">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <IconAlertTriangle size={36} />
          </div>
          <h2 className="text-xl font-bold">Failed to Load PDF</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <IconRefresh size={15} />
              <span>Retry</span>
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <span>Back Home</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* 1. Top Toolbar */}
      <PDFToolbar
        title={docTitle}
        numPages={numPages}
        currentPage={currentPage}
        scale={scale}
        viewMode={viewMode}
        onPageChange={handlePageChange}
        onScaleChange={setScale}
        onViewModeChange={setViewMode}
        onDownload={handleDownload}
      />

      {/* 2. Main Body: Sidebar + Viewport */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <PDFSidebar
          pdf={pdf}
          numPages={numPages}
          currentPage={currentPage}
          outline={outline}
          activeTab={activeSidebarTab}
          isOpen={sidebarOpen}
          searchQuery={searchQuery}
          matches={matches}
          activeMatchIndex={activeMatchIndex}
          searching={searching}
          onTabChange={(tab) => {
            setActiveSidebarTab(tab);
            setSidebarOpen(true);
          }}
          onClose={() => setSidebarOpen(false)}
          onSearch={performSearch}
          onNextMatch={nextMatch}
          onPrevMatch={prevMatch}
          onSelectMatch={goToMatch}
        />

        {/* Viewport Canvas Area */}
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="h-14 w-14 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <IconFileTypePdf size={24} className="text-primary" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-foreground">Loading Document...</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {progress > 0 ? `${progress}%` : 'Parsing structure'}
              </span>
            </div>
          </div>
        ) : pdf ? (
          viewMode === 'continuous' ? (
            <PDFVirtualViewport
              pdf={pdf}
              numPages={numPages}
              currentPage={currentPage}
              scale={scale}
              pageDimensions={pageDimensions}
              searchQuery={searchQuery}
              activeMatch={activeMatch}
              onPageVisible={setCurrentPage}
              onScaleChange={setScale}
            />
          ) : (
            <PDFSinglePageViewport
              pdf={pdf}
              numPages={numPages}
              currentPage={currentPage}
              scale={scale}
              searchQuery={searchQuery}
              activeMatch={activeMatch}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
              onScaleChange={setScale}
            />
          )
        ) : null}
      </div>
    </div>
  );
};

export default StandalonePDFReader;
