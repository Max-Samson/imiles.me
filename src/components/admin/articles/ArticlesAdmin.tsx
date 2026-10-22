import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registerAdminLeaveGuard } from '../../../lib/admin/navigation-guard';
import { PageelReadAdapter } from '../../../lib/admin/pageel-adapter';
import type { AdminSession } from '../../../shared/admin/session-contract';

// 仅进入文章模块后加载第三方工作台，避免增加概览和友链页面的初始化成本。
const Workbench = lazy(() => import('../../../../packages/pageel-workbench'));

/** 宿主边界：复用后台身份，注入网络适配器、主题及未保存修改保护。 */
export function ArticlesAdmin({ session }: { session: AdminSession }) {
  const service = useMemo(() => new PageelReadAdapter(), []);
  const dirty = useRef(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const confirmLeave = useCallback(
    () => !dirty.current || window.confirm('当前修改仅保存在内存中，离开将丢弃修改。确定继续？'),
    [],
  );
  useEffect(() => registerAdminLeaveGuard(confirmLeave), [confirmLeave]);
  useEffect(() => {
    // 后台主题按钮改变根节点 class；同步给编辑器，不重新挂载或丢弃文章状态。
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark')),
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      observer.disconnect();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);
  const name = session.actor.kind === 'user' ? session.actor.email : session.actor.id;
  const user = useMemo(
    () => ({ login: name, name, avatar_url: '/favicon.ico', html_url: '/admin' }),
    [name],
  );
  return (
    <Suspense fallback={<output className="block p-6">正在加载文章工作台…</output>}>
      <Workbench
        user={user}
        gitService={service}
        dark={dark}
        onDirtyChange={onDirtyChange}
        confirmLeave={confirmLeave}
      />
    </Suspense>
  );
}
