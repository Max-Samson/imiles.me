import { useCallback, useEffect, useState } from 'react';
import { adminApiRequest } from '../../lib/admin/api-client';
import type { AdminSession } from '../../shared/admin/session-contract';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { type AdminRoute, AdminRouterContext, parseAdminPath } from './AdminRouterContext';
import { findNavItemByKey } from './config';
import { SessionBoundary, type SessionState } from './SessionBoundary';

/** 会话存储中的缓存键名。 */
const SESSION_CACHE_KEY = 'imiles_admin_cached_session';

/** 运行时内存中的会话单例，切页时免去重复反序列化。 */
let inMemorySession: AdminSession | null = null;

/**
 * 获取初始会话状态。
 * 优先读取内存与 sessionStorage 中的缓存会话，以达到零延迟渲染、消除切页骨架屏抖动的效果。
 */
function getInitialSession(): SessionState {
  if (inMemorySession) {
    return { status: 'ready', session: inMemorySession };
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminSession;
        if (parsed?.actor && Array.isArray(parsed?.capabilities)) {
          inMemorySession = parsed;
          return { status: 'ready', session: parsed };
        }
      }
    } catch {
      // 忽略存储访问或反序列化异常
    }
  }
  return { status: 'loading' };
}

/**
 * 根据当前后台路由动态更新浏览器 document.title。
 */
function updatePageTitle(route: AdminRoute) {
  if (route.section === 'friend-links') {
    document.title = route.friendLinkId ? '友链详情 · imiles.me' : '友链管理 · imiles.me';
    return;
  }
  const item = findNavItemByKey(route.section);
  if (item) {
    document.title = `${item.label} · imiles.me`;
    return;
  }
  document.title = '管理后台 · imiles.me';
}

/**
 * 后台管理系统的 React 单页顶层应用入口组件。
 * 负责客户端路由接管、Session 会话保活缓存、全局链接点击代理与错误边界包装。
 */
export default function AdminApp({
  section: initialSection = 'dashboard',
  friendLinkId: initialFriendLinkId,
}: {
  section?: string;
  friendLinkId?: string;
}) {
  // 初始化客户端路由状态：优先从浏览器实际 URL 路径解析
  const [route, setRoute] = useState<AdminRoute>(() => {
    if (typeof window !== 'undefined') {
      return parseAdminPath(window.location.pathname);
    }
    return { section: initialSection, friendLinkId: initialFriendLinkId };
  });

  // 会话状态管理：初始化时若已有缓存则立即就绪，避免骨架屏瞬间闪烁
  const [state, setState] = useState<SessionState>(getInitialSession);

  /**
   * 客户端无刷新路由切换函数。
   * 更新组件内路由状态、同步 HTML5 历史记录、刷新网页标题并将主内容区平滑回滚至顶部。
   */
  const navigate = useCallback((href: string) => {
    const nextRoute = parseAdminPath(href);
    setRoute(nextRoute);

    if (typeof window !== 'undefined') {
      if (window.location.pathname !== href) {
        window.history.pushState(null, '', href);
      }
      updatePageTitle(nextRoute);
      const mainEl = document.getElementById('admin-main');
      if (mainEl) mainEl.scrollTop = 0;
    }
  }, []);

  /** 会话失效或异常时的重试触发器。 */
  const retry = useCallback(() => {
    setState({ status: 'loading' });
  }, []);

  // 监听浏览器前进、后退操作（popstate），实现与浏览器历史导航的无缝同步
  useEffect(() => {
    const onPopState = () => {
      const nextRoute = parseAdminPath(window.location.pathname);
      setRoute(nextRoute);
      updatePageTitle(nextRoute);
      const mainEl = document.getElementById('admin-main');
      if (mainEl) mainEl.scrollTop = 0;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 后台异步静默校验会话（SWR 模式），验证凭证是否依然有效，若失效则安全退出
  useEffect(() => {
    const controller = new AbortController();
    void adminApiRequest<AdminSession>('/api/v1/admin/session', controller.signal)
      .then((session) => {
        inMemorySession = session;
        try {
          sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
        } catch {
          // 忽略存储异常
        }
        setState({ status: 'ready', session });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        inMemorySession = null;
        try {
          sessionStorage.removeItem(SESSION_CACHE_KEY);
        } catch {
          // 忽略存储异常
        }
        setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, []);

  // 全局事件代理：自动拦截页面内部的所有 /admin/* 链接点击，转换为客户端 SPA 无刷新跳转
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      // 仅拦截普通的左键点击且同属后台内部路径的链接，保留 Command/Ctrl+Click 在新标签页打开等原生行为
      if (
        href?.startsWith('/admin') &&
        !target.target &&
        !target.hasAttribute('download') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        e.button === 0
      ) {
        e.preventDefault();
        navigate(href);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [navigate]);

  return (
    <AdminRouterContext.Provider value={{ ...route, navigate }}>
      <AdminErrorBoundary>
        <SessionBoundary
          state={state}
          onRetry={retry}
          section={route.section}
          friendLinkId={route.friendLinkId}
        />
      </AdminErrorBoundary>
    </AdminRouterContext.Provider>
  );
}
