import { ArrowUpRight, ImageIcon } from 'lucide-react';
import { Button } from '@/registry/shadcn/button';
import type { AdminFriendLink, FriendLinkStatus } from './types';

export const statusLabels: Record<FriendLinkStatus, string> = {
  pending: '待审核',
  active: '已发布',
  hidden: '已隐藏',
  rejected: '已拒绝',
};

const statusClasses: Record<FriendLinkStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  hidden: 'border-slate-500/30 bg-slate-500/10 text-muted-foreground',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export function formatDate(value: number | null) {
  return value
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
    : '—';
}

export function FriendLinkStatusBadge({ status }: { status: FriendLinkStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

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
