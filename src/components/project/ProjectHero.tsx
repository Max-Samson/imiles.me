'use client';

import { Github } from 'lucide-react';
import { motion } from 'motion/react';
import ShareButton from '@/components/article/actions/ShareButton';
import StatusBadge from '@/components/common/StatusBadge';
import type { Project } from '@/data/projects';
import { type Locale, useTranslations } from '@/lib/i18n';
import { InteractiveHoverButton } from '@/registry/magicui/interactive-hover-button';

interface ProjectHeroProps {
  project: Project;
  lang?: Locale;
}

export default function ProjectHero({ project, lang }: ProjectHeroProps) {
  const chars = project.title.split('');
  const { t } = useTranslations(lang);
  const actionButtonClass =
    'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto';
  const interactiveButtonSizeClass =
    'col-span-2 min-h-11 w-full px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto';

  return (
    <section className="container mx-auto px-4 pt-28 pb-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <StatusBadge status={project.status} />
      </motion.div>

      <h1 className="mb-4 text-4xl font-bold sm:text-5xl lg:text-6xl">
        {chars.map((char, i) => (
          <motion.span
            key={`${i}-${char}`}
            className="inline-block"
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              duration: 0.4,
              delay: 0.2 + i * 0.03,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </h1>

      <motion.p
        className="mb-6 max-w-2xl text-lg text-muted-foreground"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        {project.tagline}
      </motion.p>

      <motion.div
        className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.65 }}
      >
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={actionButtonClass}
        >
          <Github className="h-4 w-4" />
          {t('ProjectGithubButton')}
        </a>
        <ShareButton
          url={typeof window !== 'undefined' ? window.location.href : ''}
          title={project.title}
          description={project.tagline}
          className={actionButtonClass}
        />
        {project.pageUrl && (
          <InteractiveHoverButton
            type="button"
            onClick={() => window.open(project.pageUrl, '_blank', 'noopener,noreferrer')}
            className={interactiveButtonSizeClass}
          >
            {t('ProjectPageButton')}
          </InteractiveHoverButton>
        )}
      </motion.div>
    </section>
  );
}
