import { AlertTriangle, LoaderCircle, LogIn, ShieldX } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/registry/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/shadcn/card';
import { Skeleton } from '@/registry/shadcn/skeleton';
import { AdminApiError } from '../../lib/admin/api-error';
import type { AdminSession } from '../../shared/admin/session-contract';
import { AdminShell } from './AdminShell';

export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; session: AdminSession }
  | { status: 'error'; error: unknown };

function StateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          {icon}
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action && <CardContent>{action}</CardContent>}
      </Card>
    </div>
  );
}

export function SessionBoundary({
  state,
  onRetry,
  section,
  friendLinkId,
}: {
  state: SessionState;
  onRetry: () => void;
  section: string;
  friendLinkId?: string;
}) {
  const error =
    state.status === 'error' && state.error instanceof AdminApiError ? state.error : null;
  useEffect(() => {
    if (error?.kind !== 'session-expired') return;
    const timer = window.setTimeout(() => window.location.assign(window.location.href), 900);
    return () => window.clearTimeout(timer);
  }, [error]);

  if (state.status === 'ready')
    return <AdminShell session={state.session} section={section} friendLinkId={friendLinkId} />;
  if (state.status === 'loading')
    return (
      <div className="flex min-h-dvh">
        <div className="hidden w-60 border-r lg:block" />
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="space-y-5">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        </div>
      </div>
    );
  if (error?.kind === 'session-expired')
    return (
      <StateCard
        icon={<LoaderCircle className="mb-2 size-6 animate-spin text-primary" />}
        title="会话已过期"
        description="正在重新建立安全会话，如果未自动跳转请点击重新验证。"
        action={
          <Button className="w-full" onClick={() => window.location.reload()}>
            重新验证
          </Button>
        }
      />
    );
  if (error?.kind === 'forbidden')
    return (
      <StateCard
        icon={<ShieldX className="mb-2 size-6 text-destructive" />}
        title="无管理权限"
        description="您的身份已通过 Cloudflare Access 验证，但未被授予此站点的管理权限。"
        action={
          <Button variant="outline" className="w-full" asChild>
            <a href="/">返回博客首页</a>
          </Button>
        }
      />
    );
  const requestId = error?.requestId;
  return (
    <StateCard
      icon={<AlertTriangle className="mb-2 size-6 text-destructive" />}
      title="登录状态异常"
      description={
        requestId
          ? `验证身份时发生错误（请求 ID: ${requestId}）。请重试或重新登录。`
          : '无法建立与管理后台的安全会话。请重试或重新登录。'
      }
      action={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onRetry}>
            重试
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <a href="/cdn-cgi/access/login">
              <LogIn />
              重新登录
            </a>
          </Button>
        </div>
      }
    />
  );
}
