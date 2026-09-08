import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PDFSearchMatch {
  id: string;
  pageNumber: number;
  snippet: string;
  matchIndex: number;
}

export function usePDFSearch(pdf: PDFDocumentProxy | null) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PDFSearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [searching, setSearching] = useState(false);

  // Cached full-text per page
  const pageTextsRef = useRef<Map<number, string>>(new Map());

  // Reset cache when document changes
  useEffect(() => {
    const _doc = pdf;
    pageTextsRef.current.clear();
    setMatches([]);
    setActiveMatchIndex(-1);
    setQuery('');
  }, [pdf]);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      setQuery(searchQuery);

      if (!pdf || trimmed.length === 0) {
        setMatches([]);
        setActiveMatchIndex(-1);
        setSearching(false);
        return;
      }

      setSearching(true);
      const results: PDFSearchMatch[] = [];
      const numPages = pdf.numPages;
      const lowerQuery = trimmed.toLowerCase();

      try {
        for (let i = 1; i <= numPages; i++) {
          let text = pageTextsRef.current.get(i);
          if (text === undefined) {
            try {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageStrings = textContent.items
                .filter((item): item is TextItem => 'str' in item)
                .map((item) => item.str);
              text = pageStrings.join(' ');
              pageTextsRef.current.set(i, text);
            } catch (e) {
              console.warn(`Failed to extract text from page ${i}`, e);
              text = '';
            }
          }

          if (!text) continue;

          const lowerText = text.toLowerCase();
          let startIndex = 0;
          let matchCount = 0;

          let foundIndex = lowerText.indexOf(lowerQuery, startIndex);
          while (foundIndex !== -1) {
            startIndex = foundIndex;
            const snippetStart = Math.max(0, startIndex - 30);
            const snippetEnd = Math.min(text.length, startIndex + lowerQuery.length + 40);
            const rawSnippet = text.slice(snippetStart, snippetEnd);
            const snippet =
              (snippetStart > 0 ? '...' : '') +
              rawSnippet +
              (snippetEnd < text.length ? '...' : '');

            results.push({
              id: `${i}-${startIndex}`,
              pageNumber: i,
              snippet,
              matchIndex: matchCount,
            });

            matchCount++;
            startIndex += lowerQuery.length;
            foundIndex = lowerText.indexOf(lowerQuery, startIndex);
          }
        }

        setMatches(results);
        setActiveMatchIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        console.error('Error performing PDF search:', err);
      } finally {
        setSearching(false);
      }
    },
    [pdf],
  );

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const goToMatch = useCallback(
    (index: number) => {
      if (index >= 0 && index < matches.length) {
        setActiveMatchIndex(index);
      }
    },
    [matches.length],
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setMatches([]);
    setActiveMatchIndex(-1);
  }, []);

  const activeMatch =
    activeMatchIndex >= 0 && activeMatchIndex < matches.length ? matches[activeMatchIndex] : null;

  return {
    query,
    matches,
    activeMatchIndex,
    activeMatch,
    searching,
    performSearch,
    nextMatch,
    prevMatch,
    goToMatch,
    clearSearch,
  };
}
