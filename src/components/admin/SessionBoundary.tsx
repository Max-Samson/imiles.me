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
  section: 'dashboard' | 'friend-links';
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
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-6xl space-y-5">
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
        icon={<LogIn className="size-6 text-primary" />}
        title="正在重新验证登录"
        description="Cloudflare Access 会将你带回安全登录流程。"
      />
    );
  if (error?.kind === 'forbidden')
    return (
      <StateCard
        icon={<ShieldX className="size-6 text-destructive" />}
        title="没有后台访问权限"
        description="当前身份已通过验证，但不在应用管理员许可范围内。"
        action={
          <a
            className="text-sm font-medium text-primary underline underline-offset-4"
            href="/cdn-cgi/access/logout"
          >
            退出并更换账号
          </a>
        }
      />
    );
  const requestId = error?.requestId;
  return (
    <StateCard
      icon={<AlertTriangle className="size-6 text-destructive" />}
      title="无法加载后台"
      description={error?.message ?? '后台启动时发生未知错误。'}
      action={
        <div className="space-y-3">
          <Button onClick={onRetry}>
            <LoaderCircle />
            重试
          </Button>
          {requestId && (
            <p className="text-xs text-muted-foreground">
              Request ID: <code>{requestId}</code>
            </p>
          )}
        </div>
      }
    />
  );
}
