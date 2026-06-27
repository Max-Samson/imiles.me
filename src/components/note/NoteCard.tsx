'use client';

import { ExternalLink, Github, NotebookPen } from 'lucide-react';
import { motion } from 'motion/react';
import type { ResearchItem } from '@/data/notes';
import { type Locale, localizePathname, t } from '@/lib/i18n';
import { PixelImage } from '@/registry/magicui/pixel-image';
import { ShineBorder } from '@/registry/magicui/shine-border';

interface ResearchCardProps {
  item: ResearchItem;
  index: number;
  lang: Locale;
}

export default function ResearchCard({ item, index, lang }: ResearchCardProps) {
  const detailHref = item.hasDetailPage ? localizePathname(`/notes/${item.slug}`, lang) : undefined;

  return (
    <motion.div
      className="group relative block overflow-hidden rounded-xl border border-border bg-white/5 dark:bg-black/5 backdrop-blur-md p-6 transition-all duration-300 ease-out hover:scale-[0.98] hover:border-primary/50"
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
    >
      {detailHref && (
        <a href={detailHref} className="absolute inset-0 z-0" aria-label={item.title}>
          <span className="sr-only">{item.title}</span>
        </a>
      )}
      <ShineBorder
        className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        shineColor={['#A07CFE', '#FE8FB5', '#FFBE7B']}
      />
      <div className="pointer-events-none relative z-10 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            {item.category === 'paper' ? (
              <>
                <NotebookPen className="h-3 w-3" />
                {t('Headernotes')}
              </>
            ) : (
              <>
                <Github className="h-3 w-3" />
                Tooling
              </>
            )}
          </span>
          {item.venue && <span className="text-xs text-muted-foreground">{item.venue}</span>}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{item.year}</span>
      </div>
      <div className="note-content pointer-events-none relative z-10 flex flex-col gap-6 md:flex-row md:items-center">
        <div className="note-text w-full md:w-2/3">
          <h3 className="mb-1 text-lg font-semibold text-foreground">{item.title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            {item.tech.map((t) => (
              <span key={t} className="tech-badge">
                {t}
              </span>
            ))}
            <span className="flex-1" />
            {/* 文章跳转连接 */}
            {item.paperUrl && (
              <a
                href={item.paperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto relative z-20 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <NotebookPen className="h-3.5 w-3.5" />
                {t('NoteLink')}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {/* <a
              href={item.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <Github className="h-3.5 w-3.5" />
              Code
              <ExternalLink className="h-3 w-3" />
            </a> */}
          </div>
        </div>
        <PixelImage
          src={item.notePicItems?.[index]?.src || ''}
          grayscaleAnimation={false}
          grid="8x8"
          pixelFadeInDuration={1500}
          className="h-52 w-52 md:h-58 md:w-58 note-pic w-full md:w-1/3"
        />
      </div>
    </motion.div>
  );
}
