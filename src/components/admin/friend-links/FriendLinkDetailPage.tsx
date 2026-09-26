import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/registry/shadcn/button';
import { adminApiRequest } from '../../../lib/admin/api-client';
import { AdminApiError } from '../../../lib/admin/api-error';
import type { AdminSession } from '../../../shared/admin/session-contract';
import FriendCard from '../../friends/FriendCard';
import { FriendLinkStatusBadge, formatDate, statusLabels } from './FriendLinksTable';
import type { AdminFriendLinkDetail, FriendLinkStatus, ReviewAction } from './types';

const actions: Record<
  FriendLinkStatus,
  { action: ReviewAction; label: string; description: string }[]
> = {
  pending: [
    { action: 'approve', label: '批准并发布', description: '友链及其截图将出现在公开列表。' },
    { action: 'reject', label: '拒绝申请', description: '拒绝后无法恢复；申请人可以重新提交。' },
  ],
  active: [
    { action: 'hide', label: '隐藏友链', description: '公开列表和截图将不再显示这条友链。' },
  ],
  hidden: [{ action: 'restore', label: '恢复展示', description: '友链将重新出现在公开列表。' }],
  rejected: [],
};

export function FriendLinkDetailPage({ id, session }: { id: string; session: AdminSession }) {
  const [detail, setDetail] = useState<AdminFriendLinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmAction, setConfirmAction] = useState<ReviewAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canWrite = session.capabilities.includes('admin:write');

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey triggers an explicit detail reload.
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setLoading(true);
    setError(null);
    setConfirmAction(null);
    void adminApiRequest<AdminFriendLinkDetail>(
      `/api/v1/admin/friend-links/${encodeURIComponent(id)}`,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '详情加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, refreshKey]);

  async function review(action: ReviewAction) {
    if (!detail || submitting) return;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await adminApiRequest<{
        id: string;
        status: FriendLinkStatus;
        version: number;
      }>(`/api/v1/admin/friend-links/${encodeURIComponent(detail.id)}`, undefined, fetch, {
        method: 'PATCH',
        body: { action, expectedVersion: detail.version },
      });
      setNotice(`已处理：${statusLabels[result.status]}`);
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '操作失败，请重试');
      if (cause instanceof AdminApiError && cause.status === 409) {
        setRefreshKey((value) => value + 1);
      }
      if (cause instanceof AdminApiError && cause.kind === 'session-expired')
        window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  const chosenAction = detail
    ? actions[detail.status].find((item) => item.action === confirmAction)
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a
            href="/admin/friend-links"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回友链列表
          </a>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">友链详情</h1>
          <p className="mt-2 text-sm text-muted-foreground">核对申请信息、公开预览与审核状态。</p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          <RefreshCw className="size-4" />
          刷新详情
        </Button>
      </div>
      {notice && (
        <output className="block rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          {notice}
        </output>
      )}
      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">正在加载详情…</p>
      ) : error ? (
        <div role="alert" className="space-y-3 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>
            重试
          </Button>
        </div>
      ) : (
        detail && (
          <div className="space-y-6 pb-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{detail.name || new URL(detail.url).hostname}</h3>
                <p className="mt-1 text-xs text-muted-foreground">记录 ID：{detail.id}</p>
              </div>
              <FriendLinkStatusBadge status={detail.status} />
            </div>
            <dl className="grid gap-4 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">申请网址</dt>
                <dd className="mt-1 break-all">
                  <a
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
                    href={detail.submittedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {detail.submittedUrl}
                    <ExternalLink className="size-3" />
                  </a>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">简介</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">{detail.description}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">联系邮箱</dt>
                <dd className="mt-1 break-all">
                  {detail.email ? (
                    <a
                      className="text-primary underline underline-offset-4"
                      href={`mailto:${detail.email}`}
                    >
                      {detail.email}
                    </a>
                  ) : (
                    '未提供'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">提交时间</dt>
                <dd className="mt-1">{formatDate(detail.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">审核时间</dt>
                <dd className="mt-1">{formatDate(detail.reviewedAt)}</dd>
              </div>
              {detail.reviewedBy && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">审核人</dt>
                  <dd className="mt-1 break-all">{detail.reviewedBy}</dd>
                </div>
              )}
            </dl>
            <section aria-label="公开卡片预览" className="space-y-4 border-t pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">公开卡片预览</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    以下尺寸、内容和交互效果与公开友链页面一致。
                  </p>
                </div>
                {detail.screenshotUrl && (
                  <a
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    href={detail.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看原始截图
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <FriendCard
                  key={`${detail.id}-${detail.version}`}
                  item={{
                    id: detail.id,
                    name: detail.name,
                    url: detail.url,
                    description: detail.description,
                    screenshotUrl: detail.screenshotUrl,
                  }}
                  lang="zh"
                />
              </div>
            </section>
            {canWrite && actions[detail.status].length > 0 && (
              <section aria-label="审核操作" className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold">审核操作</h3>
                <div className="flex flex-wrap gap-2">
                  {actions[detail.status].map((item) => (
                    <Button
                      key={item.action}
                      variant={
                        item.action === 'reject' || item.action === 'hide' ? 'outline' : 'default'
                      }
                      disabled={submitting}
                      onClick={() => {
                        setConfirmAction(item.action);
                        setActionError(null);
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                {chosenAction && (
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">确认{chosenAction.label}？</p>
                    <p className="text-muted-foreground">{chosenAction.description}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => void review(chosenAction.action)}
                      >
                        {submitting ? '正在处理…' : '确认操作'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => setConfirmAction(null)}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}
            {detail.status === 'rejected' && (
              <p className="border-t pt-4 text-sm text-muted-foreground">
                该申请已拒绝，无法再次审核。
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
