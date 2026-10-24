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
  const saveDraft = useRef<(() => Promise<boolean>) | null>(null);
  const savingLeaveRef = useRef(false);
  const pendingLeave = useRef<((allowed: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [savingOnLeave, setSavingOnLeave] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const registerSaveDraft = useCallback((save: () => Promise<boolean>) => {
    saveDraft.current = save;
    return () => {
      if (saveDraft.current === save) saveDraft.current = null;
    };
  }, []);
  const confirmLeave = useCallback((): Promise<boolean> => {
    if (!dirty.current) return Promise.resolve(true);
    if (pendingLeave.current) return Promise.resolve(false);
    setLeaveError('');
    const request = new Promise<boolean>((resolve) => {
      pendingLeave.current = resolve;
    });
    setLeaveOpen(true);
    return request;
  }, []);
  const finishLeave = useCallback((allowed: boolean) => {
    if (allowed) dirty.current = false;
    setLeaveOpen(false);
    setLeaveError('');
    pendingLeave.current?.(allowed);
    pendingLeave.current = null;
  }, []);
  const saveAndLeave = useCallback(async () => {
    if (savingLeaveRef.current) return;
    if (!saveDraft.current) {
      setLeaveError('无法连接到当前编辑器，请留在页面重试。');
      return;
    }
    savingLeaveRef.current = true;
    setSavingOnLeave(true);
    setLeaveError('');
    try {
      if (await saveDraft.current()) finishLeave(true);
      else setLeaveError('草稿未保存成功，请检查编辑页的提示后重试。');
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : '草稿保存失败，请重试。');
    } finally {
      savingLeaveRef.current = false;
      setSavingOnLeave(false);
    }
  }, [finishLeave]);
  useEffect(() => registerAdminLeaveGuard(confirmLeave), [confirmLeave]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (leaveOpen && !dialog?.open) dialog?.showModal();
    else if (!leaveOpen && dialog?.open) dialog.close();
  }, [leaveOpen]);
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
      pendingLeave.current?.(false);
      pendingLeave.current = null;
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
    <>
      <Suspense fallback={<output className="block p-6">正在加载文章工作台…</output>}>
        <Workbench
          user={user}
          gitService={service}
          dark={dark}
          onDirtyChange={onDirtyChange}
          confirmLeave={confirmLeave}
          registerSaveDraft={registerSaveDraft}
        />
      </Suspense>
      <dialog
        ref={dialogRef}
        aria-labelledby="article-leave-title"
        aria-describedby="article-leave-description"
        onClick={(event) => {
          if (event.target === dialogRef.current && !savingOnLeave) {
            finishLeave(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !savingOnLeave) {
            event.preventDefault();
            finishLeave(false);
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          if (!savingOnLeave) finishLeave(false);
        }}
        className="fixed inset-0 m-auto h-fit w-[min(92vw,28rem)] rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs z-50 outline-none"
      >
        <div className="space-y-4 p-6">
          <div className="space-y-1.5">
            <h2
              id="article-leave-title"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              离开文章编辑页？
            </h2>
            <p
              id="article-leave-description"
              className="text-sm text-muted-foreground leading-relaxed"
            >
              本次修改还没有保存到草稿。你可以先保存，也可以放弃本次修改。
            </p>
          </div>
          {leaveError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {leaveError}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={savingOnLeave}
              onClick={() => finishLeave(false)}
              className="rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              继续编辑
            </button>
            <button
              type="button"
              disabled={savingOnLeave}
              onClick={() => finishLeave(true)}
              className="rounded-lg px-3.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              放弃本次修改
            </button>
            <button
              type="button"
              disabled={savingOnLeave}
              onClick={() => void saveAndLeave()}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {savingOnLeave ? '保存中…' : '保存草稿并离开'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
