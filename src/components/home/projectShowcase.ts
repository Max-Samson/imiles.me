import type { ExpandingCarouselItem } from '@/components/ui/expanding-carousel';
import type { Project } from '@/data/projects';
import { type Locale, localizePathname, useTranslations } from '@/lib/i18n';

// Each existing MTimer screenshot is paired with the feature it actually demonstrates.
const MTIMER_FEATURES: Record<string, number> = {
  'mtimer-index.png': 0,
  'stat-daily.png': 4,
  'stat-pomo.png': 4,
  'stat-task.png': 1,
  'todo_music.png': 5,
  'ai-helper.png': 3,
};

export function getProjectShowcaseItems(
  projects: Project[],
  lang: Locale,
): ExpandingCarouselItem[] {
  const { t } = useTranslations(lang);
  return projects.slice(0, 3).flatMap<ExpandingCarouselItem>((project) => {
    const status = t(
      project.status === 'active'
        ? 'HomeActive'
        : project.status === 'wip'
          ? 'HomeWip'
          : 'HomeArchived',
    );
    const links: NonNullable<ExpandingCarouselItem['links']> = [];
    if (project.hasDetailPage)
      links.push({
        label: t('HomeProjectDetail'),
        href: localizePathname(`/projects/${project.slug}`, lang),
      });
    if (project.pageUrl)
      links.push({ label: t('HomeVisit'), href: project.pageUrl, external: true });
    links.push({ label: 'GitHub', href: project.githubUrl, external: true });
    const base = {
      eyebrow: `${project.title} · ${status}`,
      badges: project.tech.slice(0, 5).map((tech) => tech.name),
      links,
    };
    if (project.demo?.kind === 'image' && project.demo.images.length) {
      return project.demo.images.map((image) => {
        const featureIndex =
          project.slug === 'mtimer' ? MTIMER_FEATURES[image.src.split('/').pop() ?? ''] : undefined;
        const feature = featureIndex === undefined ? undefined : project.features[featureIndex];
        return {
          ...base,
          id: `${project.slug}-${image.src}`,
          title: image.caption ?? feature?.title ?? project.title,
          description: feature?.description ?? project.tagline,
          image: { src: image.src, alt: image.alt, fit: 'contain' as const },
        };
      });
    }
    return [
      {
        ...base,
        id: project.slug,
        title: project.title,
        description: project.tagline,
        terminal: project.demo?.kind === 'terminal' ? project.demo : undefined,
      },
    ];
  });
}
