import { cn } from '@/lib/utils';

interface BackButtonProps {
  href: string;
  label: string;
  className?: string;
}

export default function BackButton({ href, label, className }: BackButtonProps) {
  return (
    <div className={cn('mb-5', className)}>
      <a
        href={href}
        className="group inline-flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm transition-all hover:border-border hover:bg-muted/40 hover:text-foreground"
        aria-label={`Back to ${label}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200 group-hover:-translate-x-0.5"
          aria-hidden="true"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        <span>{label}</span>
      </a>
    </div>
  );
}
