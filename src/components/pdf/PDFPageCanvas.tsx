import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import '@/styles/pdf-reader.css';

export interface PDFPageCanvasProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  searchQuery?: string;
  isCurrentSearchPage?: boolean;
  className?: string;
  onRenderSuccess?: (pageNumber: number) => void;
}

export const PDFPageCanvas: React.FC<PDFPageCanvasProps> = ({
  pdf,
  pageNumber,
  scale,
  searchQuery = '',
  isCurrentSearchPage = false,
  className = '',
  onRenderSuccess,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const textLayerTaskRef = useRef<pdfjsLib.TextLayer | null>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!pdf || typeof window === 'undefined') return;

      try {
        const page = await pdf.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale, rotation: 0 });
        setDimensions({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Cancel previous canvas render task if active
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (isCancelled) return;

        // Render TextLayer
        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

          if (textLayerTaskRef.current) {
            try {
              textLayerTaskRef.current.cancel();
            } catch {
              // ignore
            }
          }

          const textContent = await page.getTextContent();
          if (isCancelled) return;

          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport,
          });

          textLayerTaskRef.current = textLayer;
          await textLayer.render();

          // Highlight search matches in textLayer if any
          if (searchQuery.trim().length > 0) {
            const query = searchQuery.trim().toLowerCase();
            const textSpans = textLayerDiv.querySelectorAll('span');
            textSpans.forEach((span) => {
              const text = span.textContent || '';
              const lower = text.toLowerCase();
              if (lower.includes(query)) {
                span.classList.add('pdf-search-highlight');
                if (isCurrentSearchPage) {
                  span.classList.add('active');
                }
              }
            });
          }
        }

        setRendered(true);
        onRenderSuccess?.(pageNumber);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          // Expected cancellation
          return;
        }
        console.warn(`Render error on page ${pageNumber}:`, err);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (textLayerTaskRef.current) {
        try {
          textLayerTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdf, pageNumber, scale, searchQuery, isCurrentSearchPage, onRenderSuccess]);

  return (
    <div
      className={`pdf-canvas-container relative mx-auto my-4 transition-all duration-200 shadow-xl rounded-sm ${className}`}
      style={{
        width: dimensions.width ? `${dimensions.width}px` : 'auto',
        minHeight: dimensions.height ? `${dimensions.height}px` : '400px',
      }}
    >
      <canvas ref={canvasRef} className="block rounded-sm bg-white" />
      <div ref={textLayerRef} className="pdf-text-layer textLayer" />

      {/* Placeholder skeleton before canvas renders */}
      {!rendered && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-100 dark:bg-neutral-900 rounded-sm"
          style={{ width: dimensions.width ? `${dimensions.width}px` : '100%' }}
        >
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="mt-2 font-mono text-xs text-muted-foreground">Page {pageNumber}</span>
        </div>
      )}
    </div>
  );
};

export default PDFPageCanvas;
