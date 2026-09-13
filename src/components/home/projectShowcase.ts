import type { ExpandingCarouselItem } from '@/components/ui/expanding-carousel';
import { getProjectCategory, type Project } from '@/data/projects';
import { type Locale, localizePathname, useTranslations } from '@/lib/i18n';

export function getProjectShowcaseItems(
  projects: Project[],
  lang: Locale,
): ExpandingCarouselItem[] {
  const { t } = useTranslations(lang);

  return projects.slice(0, 6).map<ExpandingCarouselItem>((project) => {
    const status = t(
      project.status === 'completed'
        ? 'HomeCompleted'
        : project.status === 'active'
          ? 'HomeActive'
          : project.status === 'wip'
            ? 'HomeWip'
            : 'HomeArchived',
    );
    const category = getProjectCategory(project.category, lang);
    const links: NonNullable<ExpandingCarouselItem['links']> = [];
    if (project.hasDetailPage) {
      links.push({
        label: t('HomeProjectDetail'),
        href: localizePathname(`/projects/${project.slug}`, lang),
      });
    }
    if (project.pageUrl) {
      const pageLabel =
        project.pageLabel ?? (project.pageUrl.includes('npmjs.com') ? 'npm' : t('HomeVisit'));
      links.push({ label: pageLabel, href: project.pageUrl, external: true });
    }
    links.push({ label: 'GitHub', href: project.githubUrl, external: true });

    const coverSrc =
      project.coverImage ??
      (project.demo?.kind === 'image' ? project.demo.images[0]?.src : undefined);
    const coverAlt =
      project.demo?.kind === 'image' ? project.demo.images[0]?.alt : `${project.title} cover`;
    const fit = project.coverImage
      ? ('cover' as const)
      : project.demo?.kind === 'image'
        ? ((project.demo.images[0]?.fit ?? 'contain') as 'cover' | 'contain')
        : ('contain' as const);

    return {
      id: project.slug,
      category,
      status,
      eyebrow: category ? `${category} · ${status}` : status,
      title: project.title,
      description: project.tagline,
      badges: project.tech.slice(0, 5).map((tech) => tech.name),
      links,
      image: coverSrc
        ? {
            src: coverSrc,
            alt: coverAlt,
            fit,
          }
        : undefined,
    };
  });
}
