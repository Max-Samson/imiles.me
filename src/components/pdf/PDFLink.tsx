import { IconExternalLink, IconFileTypePdf } from '@tabler/icons-react';
import type React from 'react';
import { cn } from '@/lib/utils';

export interface PDFLinkProps {
  /** Path or URL to the PDF document */
  src: string;
  /** Title of the document */
  title: string;
  /** Custom link text (defaults to title) */
  children?: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
}

export const PDFLink: React.FC<PDFLinkProps> = ({ src, title, children, className }) => {
  const readerUrl = `/pdf?src=${encodeURIComponent(src)}&title=${encodeURIComponent(title)}`;

  return (
    <a
      href={readerUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open "${title}" in PDF Reader`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-medium text-foreground underline decoration-red-500/40 decoration-1 underline-offset-4 transition-colors hover:bg-red-500/10 hover:text-red-600 hover:decoration-red-500 dark:hover:text-red-400',
        className,
      )}
    >
      <IconFileTypePdf size={16} className="text-red-500 shrink-0" stroke={1.75} />
      <span>{children || title}</span>
      <IconExternalLink size={12} className="text-muted-foreground shrink-0 opacity-70" />
    </a>
  );
};

export default PDFLink;
