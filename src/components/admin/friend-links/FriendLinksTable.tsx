import { ArrowUpRight, ImageIcon } from 'lucide-react';
import { Button } from '@/registry/shadcn/button';
import { cn } from '../../../lib/utils';
import type { AdminFriendLink, FriendLinkStatus } from './types';
/** 友链状态对应的中文展示标签。 */
export const statusLabels: Record<FriendLinkStatus, string> = {
  pending: '待审核',
  active: '已发布',
  hidden: '已隐藏',
  rejected: '已拒绝',
};
/** 各状态徽章在明暗模式下的背景、边框与文字配色。 */
const statusClasses: Record<FriendLinkStatus, string> = {
  pending:
    'border-amber-500/30 dark:border-amber-400/30 bg-amber-500/10 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300',
  active:
    'border-emerald-500/30 dark:border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300',
  hidden:
    'border-slate-500/30 dark:border-slate-500/40 bg-slate-500/10 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300',
  rejected:
    'border-rose-500/30 dark:border-rose-400/30 bg-rose-500/10 dark:bg-rose-400/15 text-rose-800 dark:text-rose-300',
};
/** 状态徽章内置的状态语义小圆点颜色。 */
const statusDotClasses: Record<FriendLinkStatus, string> = {
  pending: 'bg-amber-500 dark:bg-amber-400',
  active: 'bg-emerald-500 dark:bg-emerald-400',
  hidden: 'bg-slate-400 dark:bg-slate-400',
  rejected: 'bg-rose-500 dark:bg-rose-400',
};
/** 格式化毫秒时间戳为易读的年月日时间格式。 */
export function formatDate(value: number | null) {
  return value
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
    : '—';
}
/**
 * 友链状态徽章组件。
 * 带有语义色彩背景与内嵌指示小圆点。
 */
export function FriendLinkStatusBadge({
  status,
  className,
}: {
  status: FriendLinkStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusClasses[status],
        className,
      )}
    >
      <span
        className={cn('size-1.5 shrink-0 rounded-full', statusDotClasses[status])}
        aria-hidden="true"
      />
      {statusLabels[status]}
    </span>
  );
}

/**
 * 友链管理数据列表组件。
 * 响应式布局：在移动端呈现卡片堆叠，在桌面端以数据表格呈现。
 */
export function FriendLinksTable({ items }: { items: AdminFriendLink[] }) {
  if (!items.length)
    return (
      <p className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
        当前筛选下没有友链记录。
      </p>
    );
  return (
    <>
      <div className="divide-y rounded-lg border md:hidden">
        {items.map((item) => (
          <div key={item.id} className="space-y-3 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{item.name || new URL(item.url).hostname}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{item.url}</p>
              </div>
              <FriendLinkStatusBadge status={item.status} />
            </div>
            <p className="line-clamp-2 text-muted-foreground">{item.description}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.email || '未提供邮箱'} · {formatDate(item.createdAt)}
              {item.hasScreenshot ? ' · 有截图' : ''}
            </p>
            <Button size="sm" variant="outline" className="w-full" asChild>
              <a
                href={`/admin/friend-links/${encodeURIComponent(item.id)}`}
                aria-label={`查看 ${item.name || item.url} 详情`}
              >
                查看详情
              </a>
            </Button>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted/60 text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                站点
              </th>
              <th scope="col" className="px-4 py-3">
                简介
              </th>
              <th scope="col" className="px-4 py-3">
                联系邮箱
              </th>
              <th scope="col" className="px-4 py-3">
                状态
              </th>
              <th scope="col" className="px-4 py-3">
                提交时间
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="max-w-56 px-4 py-4 align-top">
                  <div className="font-medium">{item.name || new URL(item.url).hostname}</div>
                  <a
                    className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="truncate">{item.url}</span>
                    <ArrowUpRight className="size-3 shrink-0" />
                  </a>
                </td>
                <td className="max-w-56 px-4 py-4 align-top text-muted-foreground">
                  <span className="line-clamp-2">{item.description}</span>
                  {item.hasScreenshot && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs">
                      <ImageIcon className="size-3" />
                      有截图
                    </span>
                  )}
                </td>
                <td
                  className="max-w-44 truncate px-4 py-4 align-top text-muted-foreground"
                  title={item.email ?? undefined}
                >
                  {item.email || '—'}
                </td>
                <td className="px-4 py-4 align-top">
                  <FriendLinkStatusBadge status={item.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 align-top text-muted-foreground">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right align-top">
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={`/admin/friend-links/${encodeURIComponent(item.id)}`}
                      aria-label={`查看 ${item.name || item.url} 详情`}
                    >
                      查看详情
                    </a>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
