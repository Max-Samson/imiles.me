import { ArrowUpRight, ImageIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/registry/shadcn/button';
import { adminApiRequest } from '../../../lib/admin/api-client';
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
export function FriendLinksTable({
  items,
  canWrite = true,
  onDeleted,
}: {
  items: AdminFriendLink[];
  canWrite?: boolean;
  onDeleted?: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  async function handleDelete(id: string) {
    setIsDeleting(true);
    setActionError(null);
    try {
      await adminApiRequest(
        `/api/v1/admin/friend-links/${encodeURIComponent(id)}`,
        undefined,
        undefined,
        { method: 'DELETE' },
      );
      setDeletingId(null);
      onDeleted?.();
    } catch (err) {
      setActionError({
        id,
        message: err instanceof Error ? err.message : '删除失败，请稍后重试',
      });
    } finally {
      setIsDeleting(false);
    }
  }
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
            {deletingId === item.id ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-destructive">确认删除此友链记录？</span>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isDeleting}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => void handleDelete(item.id)}
                    >
                      {isDeleting ? '删除中…' : '确认删除'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isDeleting}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        setDeletingId(null);
                        setActionError(null);
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
                {actionError?.id === item.id && (
                  <p className="mt-1.5 text-destructive">{actionError.message}</p>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a
                    href={`/admin/friend-links/${encodeURIComponent(item.id)}`}
                    aria-label={`查看 ${item.name || item.url} 详情`}
                  >
                    查看详情
                  </a>
                </Button>
                {canWrite && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setDeletingId(item.id);
                      setActionError(null);
                    }}
                    aria-label={`删除 ${item.name || item.url} 友链记录`}
                  >
                    <Trash2 className="size-3.5" />
                    <span>删除</span>
                  </Button>
                )}
              </div>
            )}
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
                <td className="whitespace-nowrap px-4 py-4 align-top font-mono text-xs text-muted-foreground">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right align-top">
                  {deletingId === item.id ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-medium text-destructive">确认删除？</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isDeleting}
                        className="h-7 px-2 text-xs"
                        onClick={() => void handleDelete(item.id)}
                      >
                        {isDeleting ? '删除中…' : '确认'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isDeleting}
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setDeletingId(null);
                          setActionError(null);
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`/admin/friend-links/${encodeURIComponent(item.id)}`}
                          aria-label={`查看 ${item.name || item.url} 详情`}
                        >
                          查看详情
                        </a>
                      </Button>
                      {canWrite && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setDeletingId(item.id);
                            setActionError(null);
                          }}
                          aria-label={`删除 ${item.name || item.url} 友链记录`}
                        >
                          <Trash2 className="size-3.5" />
                          <span>删除</span>
                        </Button>
                      )}
                    </div>
                  )}
                  {actionError?.id === item.id && (
                    <p className="mt-1 text-right text-xs text-destructive">
                      {actionError.message}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
