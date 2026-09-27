import { AlertCircle, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/registry/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/shadcn/card';
import { adminApiRequest } from '../../../lib/admin/api-client';
import { cn } from '../../../lib/utils';
import type { AdminSession } from '../../../shared/admin/session-contract';
import { FriendLinksTable } from './FriendLinksTable';
import type { AdminFriendLinkPage, FriendLinkStatus } from './types';

/** 状态过滤选项配置列表。 */
const filters: { label: string; value?: FriendLinkStatus }[] = [
  { label: '全部' },
  { label: '待审核', value: 'pending' },
  { label: '已发布', value: 'active' },
  { label: '已隐藏', value: 'hidden' },
  { label: '已拒绝', value: 'rejected' },
];
/**
 * 状态过滤按钮在明暗模式下的专属高对比度语义样式配置。
 * 包含：专属圆点颜色、选中态（背景/边框/文本/阴影）、未选中态及悬浮过渡样式。
 */
const filterStyles: Record<
  string,
  {
    dotActive: string;
    dotInactive: string;
    active: string;
    inactive: string;
  }
> = {
  all: {
    dotActive: 'bg-white dark:bg-neutral-900',
    dotInactive: 'bg-muted-foreground/60',
    active:
      'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 font-semibold shadow-xs',
    inactive:
      'border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:border-border/80 dark:bg-transparent dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-muted/30',
  },
  pending: {
    dotActive: 'bg-amber-500 dark:bg-amber-400',
    dotInactive: 'bg-amber-500 dark:bg-amber-400',
    active:
      'border-amber-500/60 bg-amber-500/15 text-amber-950 hover:bg-amber-500/25 dark:border-amber-400/50 dark:bg-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-400/30 font-semibold shadow-xs shadow-amber-500/10',
    inactive:
      'border-border/80 text-muted-foreground hover:border-amber-500/40 hover:text-amber-800 hover:bg-amber-500/10 dark:border-border/80 dark:bg-transparent dark:text-muted-foreground dark:hover:border-amber-400/40 dark:hover:text-amber-300 dark:hover:bg-amber-400/10',
  },
  active: {
    dotActive: 'bg-emerald-500 dark:bg-emerald-400',
    dotInactive: 'bg-emerald-500 dark:bg-emerald-400',
    active:
      'border-emerald-500/60 bg-emerald-500/15 text-emerald-950 hover:bg-emerald-500/25 dark:border-emerald-400/50 dark:bg-emerald-400/20 dark:text-emerald-200 dark:hover:bg-emerald-400/30 font-semibold shadow-xs shadow-emerald-500/10',
    inactive:
      'border-border/80 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-800 hover:bg-emerald-500/10 dark:border-border/80 dark:bg-transparent dark:text-muted-foreground dark:hover:border-emerald-400/40 dark:hover:text-emerald-300 dark:hover:bg-emerald-400/10',
  },
  hidden: {
    dotActive: 'bg-slate-500 dark:bg-slate-400',
    dotInactive: 'bg-slate-400 dark:bg-slate-500',
    active:
      'border-slate-500/60 bg-slate-500/15 text-slate-900 hover:bg-slate-500/25 dark:border-slate-400/50 dark:bg-slate-400/20 dark:text-slate-200 dark:hover:bg-slate-400/30 font-semibold shadow-xs shadow-slate-500/10',
    inactive:
      'border-border/80 text-muted-foreground hover:border-slate-500/40 hover:text-slate-800 hover:bg-slate-500/10 dark:border-border/80 dark:bg-transparent dark:text-muted-foreground dark:hover:border-slate-400/40 dark:hover:text-slate-300 dark:hover:bg-slate-400/10',
  },
  rejected: {
    dotActive: 'bg-rose-500 dark:bg-rose-400',
    dotInactive: 'bg-rose-500 dark:bg-rose-400',
    active:
      'border-rose-500/60 bg-rose-500/15 text-rose-950 hover:bg-rose-500/25 dark:border-rose-400/50 dark:bg-rose-400/20 dark:text-rose-200 dark:hover:bg-rose-400/30 font-semibold shadow-xs shadow-rose-500/10',
    inactive:
      'border-border/80 text-muted-foreground hover:border-rose-500/40 hover:text-rose-800 hover:bg-rose-500/10 dark:border-border/80 dark:bg-transparent dark:text-muted-foreground dark:hover:border-rose-400/40 dark:hover:text-rose-300 dark:hover:bg-rose-400/10',
  },
};

/**
 * 友链管理后台列表页组件。
 * 负责按状态筛选、分页浏览申请记录、列表刷新以及进入单条审核详情。
 */
export function FriendLinksAdmin({ session }: { session?: AdminSession } = {}) {
  const canWrite = session ? session.capabilities.includes('admin:write') : true;
  const [filter, setFilter] = useState<FriendLinkStatus | undefined>();
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminFriendLinkPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey triggers an explicit reload.
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (filter) query.set('status', filter);
    setLoading(true);
    setError(null);
    void adminApiRequest<AdminFriendLinkPage>(
      `/api/v1/admin/friend-links?${query}`,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setList(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '友链列表加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, filter, refreshKey]);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }
  function changePage(next: number) {
    setPage(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Friend links</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">友链管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            浏览申请记录，打开详情核对预览并处理审核。
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className="size-4" />
          刷新列表
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>申请记录</CardTitle>
          <CardDescription>
            按提交时间排序；点击详情查看截图、公开卡片预览和审核操作。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="flex flex-wrap gap-2" aria-label="按状态筛选">
            {filters.map((item) => {
              const key = item.value ?? 'all';
              const style = filterStyles[key];
              const isSelected = filter === item.value;
              return (
                <Button
                  key={item.label}
                  size="sm"
                  variant="outline"
                  aria-pressed={isSelected}
                  className={cn(
                    'gap-2 transition-colors',
                    isSelected ? style.active : style.inactive,
                  )}
                  onClick={() => {
                    setFilter(item.value);
                    changePage(1);
                  }}
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full transition-transform',
                      isSelected ? style.dotActive : style.dotInactive,
                      isSelected && 'scale-110 ring-2 ring-current/25',
                    )}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </fieldset>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </p>
          )}
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">正在加载申请…</p>
          ) : (
            !error && (
              <FriendLinksTable items={list?.items ?? []} canWrite={canWrite} onDeleted={refresh} />
            )
          )}
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              第 {page} 页{list && ` · 每页 ${list.pageSize} 条`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || loading}
                onClick={() => changePage(page - 1)}
              >
                <ArrowLeft className="size-4" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!list?.hasNextPage || loading}
                onClick={() => changePage(page + 1)}
              >
                下一页
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
