import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '@/registry/shadcn/button';
import { adminApiRequest } from '../../../lib/admin/api-client';
import { AdminApiError } from '../../../lib/admin/api-error';
import { cn } from '../../../lib/utils';
import type { AdminSession } from '../../../shared/admin/session-contract';
import FriendCard from '../../friends/FriendCard';
import { FriendLinkStatusBadge, formatDate, statusLabels } from './FriendLinksTable';
import type { AdminFriendLinkDetail, FriendLinkStatus, ReviewAction } from './types';

/** 各友链状态下允许执行的生命周期审核操作集合。 */
const actions: Record<
  FriendLinkStatus,
  { action: ReviewAction; label: string; description: string }[]
> = {
  pending: [
    { action: 'approve', label: '批准通过', description: '友链将立即收录并在公开页面展示。' },
    { action: 'reject', label: '拒绝申请', description: '拒绝后不可恢复，申请人可重新提交。' },
  ],
  active: [
    { action: 'hide', label: '隐藏友链', description: '公开列表和截图将不再显示这条友链。' },
  ],
  hidden: [{ action: 'restore', label: '恢复展示', description: '友链将重新出现在公开列表。' }],
  rejected: [],
};
/** 各审核操作对应的按钮图标、配色样式、确认按钮高亮与基础变体配置。 */
const actionConfig: Record<
  ReviewAction,
  {
    icon: typeof CheckCircle2;
    buttonClass: string;
    selectedClass: string;
    confirmClass: string;
    panelClass: string;
    accentGradient: string;
    iconWrapperClass: string;
    variant: 'default' | 'outline' | 'destructive' | 'secondary';
  }
> = {
  approve: {
    icon: CheckCircle2,
    variant: 'default',
    buttonClass:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-xs border-transparent focus-visible:ring-emerald-500',
    selectedClass: 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-background shadow-md',
    confirmClass:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-xs',
    panelClass:
      'border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    accentGradient: 'via-emerald-500/70',
    iconWrapperClass:
      'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
  reject: {
    icon: XCircle,
    variant: 'destructive',
    buttonClass:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-xs border-transparent focus-visible:ring-rose-500',
    selectedClass: 'ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-background shadow-md',
    confirmClass:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-xs',
    panelClass: 'border-rose-500/30 bg-rose-500/5 dark:border-rose-500/20 dark:bg-rose-500/10',
    accentGradient: 'via-rose-500/70',
    iconWrapperClass: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
  },
  hide: {
    icon: EyeOff,
    variant: 'outline',
    buttonClass:
      'border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 hover:border-amber-500/60 hover:text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20 dark:hover:text-amber-200 shadow-xs focus-visible:ring-amber-500',
    selectedClass:
      'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-background border-amber-500 bg-amber-500/20 shadow-md',
    confirmClass:
      'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 shadow-xs',
    panelClass: 'border-amber-500/30 bg-amber-500/5 dark:border-amber-500/20 dark:bg-amber-500/10',
    accentGradient: 'via-amber-500/70',
    iconWrapperClass: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  },
  restore: {
    icon: Eye,
    variant: 'default',
    buttonClass:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-xs border-transparent focus-visible:ring-emerald-500',
    selectedClass: 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-background shadow-md',
    confirmClass:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-xs',
    panelClass:
      'border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    accentGradient: 'via-emerald-500/70',
    iconWrapperClass:
      'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
};

/**
 * 友链详情与审核页面组件。
 * 展示申请表单详情、公开卡片实际渲染预览、并支持管理员执行批准、拒绝、隐藏与恢复等操作，
 * 支持在审批通过时向申请人发送邮件通知及手动重发通知。
 */
export function FriendLinkDetailPage({ id, session }: { id: string; session: AdminSession }) {
  const [detail, setDetail] = useState<AdminFriendLinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmAction, setConfirmAction] = useState<ReviewAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notifyApplicant, setNotifyApplicant] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [showManualEmailForm, setShowManualEmailForm] = useState(false);
  const [manualMessage, setManualMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteRecord() {
    if (!detail || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await adminApiRequest(
        `/api/v1/admin/friend-links/${encodeURIComponent(detail.id)}`,
        undefined,
        undefined,
        { method: 'DELETE' },
      );
      window.location.href = '/admin/friend-links';
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败，请稍后重试');
      setIsDeleting(false);
    }
  }
  const canWrite = session.capabilities.includes('admin:write');

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey triggers an explicit detail reload.
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setLoading(true);
    setError(null);
    setConfirmAction(null);
    setShowManualEmailForm(false);
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
  useEffect(() => {
    if (!confirmAction) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        setConfirmAction(null);
        setActionError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmAction, submitting]);
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
        emailSent?: boolean;
      }>(`/api/v1/admin/friend-links/${encodeURIComponent(detail.id)}`, undefined, fetch, {
        method: 'PATCH',
        body: {
          action,
          expectedVersion: detail.version,
          notifyApplicant: action === 'approve' ? notifyApplicant : undefined,
          customMessage:
            action === 'approve' && customMessage.trim() ? customMessage.trim() : undefined,
        },
      });
      const emailNote = result.emailSent ? '（已向申请人发送通知邮件）' : '';
      setNotice(`已处理：${statusLabels[result.status]}${emailNote}`);
      setConfirmAction(null);
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

  async function sendNotificationEmail(message?: string) {
    if (!detail || sendingEmail || !detail.email) return;
    setSendingEmail(true);
    setActionError(null);
    setNotice(null);
    try {
      await adminApiRequest<{ sent: boolean; recipient: string }>(
        `/api/v1/admin/friend-links/${encodeURIComponent(detail.id)}/notify`,
        undefined,
        fetch,
        {
          method: 'POST',
          body: { customMessage: message?.trim() || undefined },
        },
      );
      setNotice(`通知邮件已成功发送至 ${detail.email}`);
      setShowManualEmailForm(false);
      setManualMessage('');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '邮件发送失败，请检查服务配置');
    } finally {
      setSendingEmail(false);
    }
  }

  const chosenAction = detail
    ? actions[detail.status].find((item) => item.action === confirmAction)
    : null;

  return (
    <div className="space-y-6">
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
        <div className="flex items-center gap-2">
          {canWrite && detail && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || submitting || isDeleting}
              className="gap-1.5 text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteError(null);
              }}
            >
              <Trash2 className="size-4" />
              删除记录
            </Button>
          )}
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            <RefreshCw className="size-4" />
            刷新详情
          </Button>
        </div>
      </div>
      {showDeleteConfirm && (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">确认删除该友链申请记录？</p>
          <p className="text-xs text-muted-foreground">
            删除后该记录将彻底从数据库移除。若该网址曾被收录或拒绝，删除后将释放其规范网址限制，便于重新审批该网站二次提交的新申请。
          </p>
          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDeleteRecord()}
            >
              {isDeleting ? '正在删除…' : '确认彻底删除'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteError(null);
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}
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
            <dl className="divide-y divide-border/60 rounded-lg border text-sm">
              {/* 申请网址 */}
              <div className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
                <dt className="w-20 shrink-0 text-xs text-muted-foreground">申请网址</dt>
                <dd className="min-w-0 break-all">
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
                    href={detail.submittedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {detail.submittedUrl}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </dd>
              </div>

              {/* 简介 */}
              <div className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
                <dt className="w-20 shrink-0 text-xs text-muted-foreground">简介</dt>
                <dd className="min-w-0 whitespace-pre-wrap break-words leading-relaxed">
                  {detail.description}
                </dd>
              </div>

              {/* 联系邮箱 */}
              <div className="px-4 py-2.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <dt className="w-20 shrink-0 text-xs text-muted-foreground">联系邮箱</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-2 break-all">
                    {detail.email ? (
                      <>
                        <a
                          className="text-primary hover:underline underline-offset-4"
                          href={`mailto:${detail.email}`}
                        >
                          {detail.email}
                        </a>
                        {canWrite && detail.status === 'active' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={sendingEmail || submitting}
                            className="h-6 gap-1 px-2 text-[11px]"
                            onClick={() => {
                              setShowManualEmailForm(!showManualEmailForm);
                              setActionError(null);
                            }}
                          >
                            <Mail className="size-3" />
                            {showManualEmailForm ? '收起' : '补发通知'}
                          </Button>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">未提供</span>
                    )}
                  </dd>
                </div>
                {showManualEmailForm && detail.email && (
                  <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs space-y-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="manual-approval-msg"
                        className="block text-[11px] text-muted-foreground"
                      >
                        站长附言（可选）
                      </label>
                      <input
                        id="manual-approval-msg"
                        type="text"
                        placeholder="例如：已为你重新发送友链收录通知！"
                        value={manualMessage}
                        onChange={(e) => setManualMessage(e.target.value)}
                        maxLength={500}
                        className="w-full rounded border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        disabled={sendingEmail}
                        className="h-6 px-2.5 text-[11px] bg-emerald-600 text-white hover:bg-emerald-500"
                        onClick={() => void sendNotificationEmail(manualMessage)}
                      >
                        {sendingEmail ? '发送中…' : '发送邮件'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={sendingEmail}
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          setShowManualEmailForm(false);
                          setManualMessage('');
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 时间行 — 提交 + 审核并排 */}
              <div className="flex flex-wrap gap-x-8 gap-y-1 px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground">提交</dt>
                  <dd>{formatDate(detail.createdAt)}</dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground">审核</dt>
                  <dd>{formatDate(detail.reviewedAt)}</dd>
                </div>
                {detail.reviewedBy && (
                  <div className="flex items-baseline gap-2">
                    <dt className="text-xs text-muted-foreground">审核人</dt>
                    <dd className="break-all">{detail.reviewedBy}</dd>
                  </div>
                )}
              </div>
            </dl>
            <section aria-label="预览与操作" className="space-y-4 border-t pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">预览与操作</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    左侧为公开页面实际渲染效果，右侧可执行审核操作。
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

              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
                {/* 左栏 — 卡片预览（模拟公开页面渲染环境） */}
                <div className="lg:col-span-3">
                  <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground/60 uppercase">
                    公开页面效果
                  </p>
                  <div className="rounded-xl bg-background dark:bg-[#0a0a0c] border border-border/40 dark:border-white/5 p-5 sm:p-6">
                    <div className="max-w-sm">
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
                  </div>
                </div>

                {/* 右栏 — 操作面板 */}
                <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 lg:col-span-2">
                  {/* 当前状态 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">当前状态</span>
                    <FriendLinkStatusBadge status={detail.status} />
                  </div>

                  {canWrite && actions[detail.status].length > 0 ? (
                    <>
                      <div className="h-px bg-border/60" />
                      <div>
                        <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                          可用操作
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {actions[detail.status].map((item) => {
                            const cfg = actionConfig[item.action];
                            const Icon = cfg.icon;
                            return (
                              <Button
                                key={item.action}
                                size="sm"
                                variant={cfg.variant}
                                className={cn('gap-1.5 transition-all', cfg.buttonClass)}
                                disabled={submitting}
                                onClick={() => {
                                  setConfirmAction(item.action);
                                  setActionError(null);
                                }}
                              >
                                <Icon className="size-3.5" />
                                {item.label}
                              </Button>
                            );
                          })}
                        </div>
                        {/* 操作说明 */}
                        <ul className="mt-2.5 space-y-1">
                          {actions[detail.status].map((item) => {
                            const cfg = actionConfig[item.action];
                            const Icon = cfg.icon;
                            return (
                              <li
                                key={item.action}
                                className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"
                              >
                                <Icon className="mt-0.5 size-3 shrink-0 opacity-50" />
                                <span>
                                  <span className="font-medium text-foreground/80">
                                    {item.label}
                                  </span>
                                  {' — '}
                                  {item.description}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </>
                  ) : detail.status === 'rejected' ? (
                    <>
                      <div className="h-px bg-border/60" />
                      <p className="text-xs text-muted-foreground">
                        该申请已拒绝，无法再次审核。申请人可重新提交。
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </section>

            {/* 审核操作确认弹窗 */}
            <AnimatePresence>
              {chosenAction && detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                  {/* 遮罩 */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                      if (!submitting) {
                        setConfirmAction(null);
                        setActionError(null);
                      }
                    }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                  />

                  {/* 弹窗卡片 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 12 }}
                    transition={{ type: 'spring', duration: 0.25, bounce: 0 }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="review-modal-title"
                    className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 z-10 text-foreground overflow-hidden space-y-4"
                  >
                    {/* 顶部操作语义装饰线 */}
                    <div
                      className={cn(
                        'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent to-transparent',
                        actionConfig[chosenAction.action].accentGradient,
                      )}
                      aria-hidden="true"
                    />

                    {/* 关闭按钮 */}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setConfirmAction(null);
                        setActionError(null);
                      }}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="关闭弹窗"
                    >
                      <X className="size-4" />
                    </button>

                    {/* 弹窗头部 */}
                    <div className="flex items-start gap-3 pr-8">
                      <div
                        className={cn(
                          'size-10 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                          actionConfig[chosenAction.action].iconWrapperClass,
                        )}
                      >
                        {(() => {
                          const ActionIcon = actionConfig[chosenAction.action].icon;
                          return <ActionIcon className="size-5" />;
                        })()}
                      </div>
                      <div>
                        <h3 id="review-modal-title" className="text-base font-bold text-foreground">
                          确认{chosenAction.label}？
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {chosenAction.description}
                        </p>
                      </div>
                    </div>

                    {/* 目标友链信息摘要 */}
                    <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground truncate max-w-[280px]">
                          {detail.name || '未命名友链'}
                        </span>
                        <FriendLinkStatusBadge status={detail.status} />
                      </div>
                      <p className="text-muted-foreground font-mono text-[11px] truncate">
                        {detail.url}
                      </p>
                    </div>

                    {/* 批准时的邮件附言配置 */}
                    {chosenAction.action === 'approve' && (
                      <div className="space-y-2 rounded-xl border bg-muted/30 p-3.5 text-xs">
                        {detail.email ? (
                          <>
                            <label className="flex cursor-pointer items-center gap-2 font-medium">
                              <input
                                type="checkbox"
                                checked={notifyApplicant}
                                onChange={(e) => setNotifyApplicant(e.target.checked)}
                                className="size-3.5 rounded border-muted-foreground/30 accent-emerald-600 cursor-pointer"
                              />
                              <span>向申请人发送通过通知邮件（收件人：{detail.email}）</span>
                            </label>
                            {notifyApplicant && (
                              <div className="space-y-1 pt-1.5 pl-5.5">
                                <label
                                  htmlFor="modal-custom-approval-msg"
                                  className="block text-[11px] text-muted-foreground"
                                >
                                  自定义附言（可选，将展示在邮件正文中）：
                                </label>
                                <input
                                  id="modal-custom-approval-msg"
                                  type="text"
                                  placeholder="例如：已添加贵站友链，欢迎常来交流！"
                                  value={customMessage}
                                  onChange={(e) => setCustomMessage(e.target.value)}
                                  maxLength={500}
                                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="size-3.5 shrink-0" />
                            <span>申请人未留下联系邮箱，批准后将仅更新状态，不发送邮件通知。</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 操作错误提示 */}
                    {actionError && (
                      <div
                        role="alert"
                        className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive dark:text-rose-400 text-xs flex items-start gap-2"
                      >
                        <XCircle className="size-4 shrink-0 mt-0.5" />
                        <span>{actionError}</span>
                      </div>
                    )}

                    {/* 弹窗底部操作按钮 */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => {
                          setConfirmAction(null);
                          setActionError(null);
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={submitting}
                        className={cn(
                          'font-medium',
                          actionConfig[chosenAction.action].confirmClass,
                        )}
                        onClick={() => void review(chosenAction.action)}
                      >
                        {submitting ? '正在处理…' : `确认${chosenAction.label}`}
                      </Button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  );
}
