import { AlertCircle, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/registry/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/shadcn/card';
import { adminApiRequest } from '../../../lib/admin/api-client';
import { FriendLinksTable } from './FriendLinksTable';
import type { AdminFriendLinkPage, FriendLinkStatus } from './types';

const filters: { label: string; value?: FriendLinkStatus }[] = [
  { label: '全部' },
  { label: '待审核', value: 'pending' },
  { label: '已发布', value: 'active' },
  { label: '已隐藏', value: 'hidden' },
  { label: '已拒绝', value: 'rejected' },
];

export function FriendLinksAdmin() {
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
    <div className="mx-auto max-w-7xl space-y-6">
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
            {filters.map((item) => (
              <Button
                key={item.label}
                size="sm"
                variant={filter === item.value ? 'default' : 'outline'}
                aria-pressed={filter === item.value}
                onClick={() => {
                  setFilter(item.value);
                  changePage(1);
                }}
              >
                {item.label}
              </Button>
            ))}
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
            !error && <FriendLinksTable items={list?.items ?? []} />
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
