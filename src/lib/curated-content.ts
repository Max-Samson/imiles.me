import { research as notes } from '@/data/notes';
import { getProjects } from '@/data/projects';
import type { Locale } from './i18n';

export interface CuratedContentEntry {
  kind: 'project' | 'note';
  lang: Locale;
  path: string;
  title: string;
  description: string;
  tags: string[];
}

/** Only detail pages that the site actually renders belong in discovery outputs. */
export function getCuratedContentEntries(): CuratedContentEntry[] {
  const entries: CuratedContentEntry[] = [];

  for (const lang of ['en', 'zh'] as const) {
    const prefix = lang === 'zh' ? '/zh' : '';
    for (const project of getProjects(lang)) {
      if (!project.hasDetailPage) continue;
      entries.push({
        kind: 'project',
        lang,
        path: `${prefix}/projects/${project.slug}`,
        title: project.title,
        description: project.description,
        tags: project.tags ?? [],
      });
    }
  }

  // Notes currently have Chinese-only copy; avoid presenting the English route as a translation.
  for (const note of notes) {
    if (!note.hasDetailPage) continue;
    entries.push({
      kind: 'note',
      lang: 'zh',
      path: `/zh/notes/${note.slug}`,
      title: note.title,
      description: note.description,
      tags: note.tags,
    });
  }

  return entries;
}
