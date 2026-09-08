import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PDFOutlineItem {
  title: string;
  pageNumber: number | null;
  items: PDFOutlineItem[];
  color?: Uint8ClampedArray | number[];
  italic?: boolean;
  bold?: boolean;
}

export interface PDFPageDimension {
  pageNumber: number;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface PDFDocumentState {
  pdf: PDFDocumentProxy | null;
  numPages: number;
  outline: PDFOutlineItem[];
  pageDimensions: PDFPageDimension[];
  loading: boolean;
  progress: number;
  error: string | null;
}

interface RawOutlineItem {
  title: string;
  dest?: unknown;
  items?: RawOutlineItem[];
  bold?: boolean;
  italic?: boolean;
}

export function usePDFDocument(url: string | null) {
  const [state, setState] = useState<PDFDocumentState>({
    pdf: null,
    numPages: 0,
    outline: [],
    pageDimensions: [],
    loading: true,
    progress: 0,
    error: null,
  });

  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);

  const loadDocument = useCallback(async () => {
    if (!url || typeof window === 'undefined') return;

    setState((s) => ({
      ...s,
      loading: true,
      progress: 0,
      error: null,
    }));

    try {
      // Configure workers and fonts with absolute paths
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

      if (loadingTaskRef.current) {
        try {
          await loadingTaskRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
      }

      const task = pdfjsLib.getDocument({
        url,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
        isEvalSupported: false,
      });

      loadingTaskRef.current = task;

      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (total > 0) {
          const pct = Math.round((loaded / total) * 100);
          setState((s) => ({ ...s, progress: pct }));
        }
      };

      const pdfDoc = await task.promise;
      const numPages = pdfDoc.numPages;

      // Extract page dimensions for viewport placeholder calculation
      const dimensions: PDFPageDimension[] = [];
      for (let i = 1; i <= Math.min(numPages, 100); i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 1.0 });
          dimensions.push({
            pageNumber: i,
            width: vp.width,
            height: vp.height,
            aspectRatio: vp.width / vp.height,
          });
        } catch (e) {
          console.warn(`Failed to get dimensions for page ${i}`, e);
        }
      }

      // Extract and recursively parse outline/bookmarks
      let parsedOutline: PDFOutlineItem[] = [];
      try {
        const rawOutline = (await pdfDoc.getOutline()) as unknown as RawOutlineItem[] | null;
        if (rawOutline && rawOutline.length > 0) {
          const resolveOutline = async (items: RawOutlineItem[]): Promise<PDFOutlineItem[]> => {
            const result: PDFOutlineItem[] = [];
            for (const item of items) {
              let targetPage: number | null = null;
              if (item.dest) {
                let dest = item.dest;
                if (typeof dest === 'string') {
                  dest = await pdfDoc.getDestination(dest);
                }
                if (Array.isArray(dest) && dest[0] && typeof dest[0] === 'object') {
                  const ref = dest[0] as { num: number; gen: number };
                  const pageIdx = await pdfDoc.getPageIndex(ref);
                  targetPage = pageIdx + 1;
                }
              }

              const children =
                item.items && item.items.length > 0 ? await resolveOutline(item.items) : [];

              result.push({
                title: item.title,
                pageNumber: targetPage,
                items: children,
                bold: item.bold,
                italic: item.italic,
              });
            }
            return result;
          };

          parsedOutline = await resolveOutline(rawOutline);
        }
      } catch (err) {
        console.warn('Could not parse PDF outline:', err);
      }

      setState({
        pdf: pdfDoc,
        numPages,
        outline: parsedOutline,
        pageDimensions: dimensions,
        loading: false,
        progress: 100,
        error: null,
      });
    } catch (err: unknown) {
      console.error('Error loading PDF document:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load PDF document. Please check the file URL.';
      setState((s) => ({
        ...s,
        loading: false,
        error: message,
      }));
    }
  }, [url]);

  useEffect(() => {
    loadDocument();
    return () => {
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [loadDocument]);

  return {
    ...state,
    reload: loadDocument,
  };
}
