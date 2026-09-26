import { Boxes, CheckCircle2, LockKeyhole } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/shadcn/card';
import type { AdminSession } from '../../shared/admin/session-contract';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { FriendLinkDetailPage } from './friend-links/FriendLinkDetailPage';
import { FriendLinksAdmin } from './friend-links/FriendLinksAdmin';

export function AdminShell({
  session,
  section,
  friendLinkId,
}: {
  session: AdminSession;
  section: 'dashboard' | 'friend-links';
  friendLinkId?: string;
}) {
  return (
    <div className="flex h-dvh min-h-[32rem] bg-muted/20">
      <AdminSidebar section={section} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader actor={session.actor} section={section} />
        <main id="admin-main" className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {section === 'friend-links' ? (
            friendLinkId ? (
              <FriendLinkDetailPage id={friendLinkId} session={session} />
            ) : (
              <FriendLinksAdmin />
            )
          ) : (
            <div className="mx-auto max-w-6xl space-y-6">
              <div>
                <p className="text-sm font-medium text-primary">Dashboard</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">管理后台</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  从左侧导航进入友链管理，查看申请、预览卡片并处理审核。
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <LockKeyhole className="mb-2 size-5 text-primary" />
                    <CardTitle className="text-base">Access 身份</CardTitle>
                    <CardDescription>登录和会话由 Cloudflare Access 托管。</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CheckCircle2 className="mb-2 size-5 text-primary" />
                    <CardTitle className="text-base">服务端授权</CardTitle>
                    <CardDescription>Worker 已验证身份并返回最小会话信息。</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <Boxes className="mb-2 size-5 text-primary" />
                    <CardTitle className="text-base">业务模块</CardTitle>
                    <CardDescription>
                      <a
                        className="text-primary underline underline-offset-4"
                        href="/admin/friend-links"
                      >
                        管理友链申请
                      </a>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>当前能力</CardTitle>
                  <CardDescription>能力由服务端计算，客户端仅用于展示。</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {session.capabilities.map((capability) => (
                      <code
                        key={capability}
                        className="rounded-md border bg-muted px-2.5 py-1 text-xs"
                      >
                        {capability}
                      </code>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
