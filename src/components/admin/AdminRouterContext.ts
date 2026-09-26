import { createContext, useContext } from 'react';
import { adminNavigation, findNavItemByPath } from './config';

/** 后台当前路由状态定义。 */
export interface AdminRoute {
  /** 当前所属后台功能模块键（对应 nav.ts 中的 key）。 */
  section: string;
  /** 当前标准路径（如 `/admin` 或 `/admin/friend-links`）。 */
  path: string;
  /** 若处于友链详情页，记录当前友链的唯一 ID。 */
  friendLinkId?: string;
}

/** 路由上下文提供给各子组件的完整接口。 */
export interface AdminRouterContextValue extends AdminRoute {
  /** 客户端无刷新路由跳转函数。 */
  navigate: (href: string) => void;
}

/** 后台单页客户端路由上下文。 */
export const AdminRouterContext = createContext<AdminRouterContextValue | null>(null);

/**
 * 获取后台当前路由上下文。
 * 若在 Provider 外部调用，提供降级使用原生 location.assign 的兜底逻辑。
 */
export function useAdminRouter(): AdminRouterContextValue {
  const ctx = useContext(AdminRouterContext);
  if (!ctx) {
    const defaultNav = adminNavigation[0] ?? { key: 'dashboard', href: '/admin' };
    return {
      section: defaultNav.key,
      path: defaultNav.href,
      friendLinkId: undefined,
      navigate: (href: string) => {
        if (typeof window !== 'undefined') {
          window.location.assign(href);
        }
      },
    };
  }
  return ctx;
}

/**
 * 将浏览器 URL 路径解析为后台结构化路由状态。
 * 优先基于 nav.ts 的统一配置进行动态匹配，自动适配后续新增的功能导航项。
 *
 * @param pathname 传入的路径字符串，例如 `/admin/friend-links/abc`
 * @returns 解析得到的后台路由对象
 */
export function parseAdminPath(pathname: string): AdminRoute {
  // 去除末尾斜杠，规范化根路径
  const clean = pathname.replace(/\/$/, '') || '/admin';

  // 针对带参数的子详情页（如友链详情）的解析支持
  if (clean.startsWith('/admin/friend-links/')) {
    const id = clean.slice('/admin/friend-links/'.length);
    return {
      section: 'friend-links',
      path: clean,
      friendLinkId: decodeURIComponent(id),
    };
  }

  // 动态匹配 nav.ts 中配置的所有导航项
  const matched = findNavItemByPath(clean);
  if (matched) {
    return {
      section: matched.key,
      path: matched.href,
    };
  }

  // 未匹配到其他路径时默认回退到第一个导航配置项（概览）
  const fallback = adminNavigation[0] ?? { key: 'dashboard', href: '/admin' };
  return {
    section: fallback.key,
    path: fallback.href,
  };
}
