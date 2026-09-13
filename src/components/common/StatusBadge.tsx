'use client';

import type { ProjectStatus } from '@/data/projects';
import { type Locale, useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const statusConfig: Record<ProjectStatus, { dotClass: string }> = {
  active: { dotClass: 'status-dot-active' },
  completed: { dotClass: 'status-dot-completed' },
  wip: { dotClass: 'status-dot-wip' },
  archived: { dotClass: 'status-dot-archived' },
};

interface StatusBadgeProps {
  status: ProjectStatus;
  lang?: Locale;
  className?: string;
}

export default function StatusBadge({ status, lang, className }: StatusBadgeProps) {
  const { t } = useTranslations(lang);
  const { dotClass } = statusConfig[status] ?? statusConfig.active;

  const labelMap: Record<ProjectStatus, string> = {
    active: t('HomeActive'),
    completed: t('HomeCompleted'),
    wip: t('HomeWip'),
    archived: t('HomeArchived'),
  };

  const label = labelMap[status] ?? (status === 'completed' ? 'Completed' : 'Active');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      <span className={cn('status-dot', dotClass)} />
      {label}
    </span>
  );
}
