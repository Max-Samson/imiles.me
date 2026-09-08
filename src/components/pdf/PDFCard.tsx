import { IconDownload, IconExternalLink, IconFileTypePdf } from '@tabler/icons-react';
import type React from 'react';
import { cn } from '@/lib/utils';

export interface PDFCardProps {
  /** Path or URL to the PDF document (e.g., "/docs/my-paper.pdf") */
  src: string;
  /** Title of the document */
  title: string;
  /** Brief description or abstract */
  description?: string;
  /** Author or publisher attribution */
  author?: string;
  /** Number of pages (e.g., 12 or "12 pages") */
  pages?: number | string;
  /** File size (e.g., "1.8 MB") */
  size?: string;
  /** Publication or release date */
  date?: string;
  /** Allow direct file download button */
  downloadable?: boolean;
  /** Additional CSS class names */
  className?: string;
}

export const PDFCard: React.FC<PDFCardProps> = ({
  src,
  title,
  description,
  author,
  pages,
  size,
  date,
  downloadable = true,
  className,
}) => {
  const readerUrl = `/pdf?src=${encodeURIComponent(src)}&title=${encodeURIComponent(title)}`;

  return (
    <div
      className={cn(
        'group not-prose my-6 flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-card/90 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {/* PDF File Badge Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30">
          <IconFileTypePdf size={28} stroke={1.5} />
        </div>

        {/* Info Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              PDF
            </span>
            {pages && (
              <span className="font-mono text-xs text-muted-foreground">
                {typeof pages === 'number' ? `${pages} pages` : pages}
              </span>
            )}
            {size && <span className="font-mono text-xs text-muted-foreground">• {size}</span>}
            {date && <span className="font-mono text-xs text-muted-foreground">• {date}</span>}
          </div>

          <h4 className="mt-1.5 truncate text-base font-semibold text-foreground group-hover:text-primary">
            {title}
          </h4>

          {description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}

          {author && <p className="mt-1 text-xs text-muted-foreground/80">By {author}</p>}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs dark:border-neutral-800/80">
        <span className="text-muted-foreground font-mono text-[11px]">
          Click to open in dedicated reader
        </span>

        <div className="flex items-center gap-2">
          {downloadable && (
            <a
              href={src}
              download
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
              title="Download PDF"
            >
              <IconDownload size={15} />
              <span>Download</span>
            </a>
          )}

          <a
            href={readerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground dark:bg-primary/20 dark:hover:bg-primary"
          >
            <span>Read Document</span>
            <IconExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default PDFCard;
