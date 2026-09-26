import { LayoutDashboard, UsersRound } from 'lucide-react';
import type { AdminNavItem } from './types';

/**
 * 后台全局功能导航统一配置源（Single Source of Truth）。
 * 后续添加新功能导航只需在此处补充对应项，系统会自动同步路由、标签栏、侧边栏及生成对应管理页面。
 */
export const adminNavigation: AdminNavItem[] = [
  {
    key: 'dashboard',
    label: '概览',
    href: '/admin',
    icon: LayoutDashboard,
    enabled: true,
    description: '系统整体运行指标、Cloudflare 会话授权与核心模块概况',
    category: 'core',
    badge: '站点服务面板',
  },
  {
    key: 'friend-links',
    label: '友链',
    href: '/admin/friend-links',
    icon: UsersRound,
    enabled: true,
    description: '管理博客收录的友情链接申请，核对截图与控制发布状态',
    category: 'business',
    badge: 'Links 审查',
    requiredCapability: 'admin:read',
  },
];

/**
 * 获取系统默认导航项（通常为概览 Dashboard）。
 */
export function getDefaultNavItem(): AdminNavItem {
  return (
    adminNavigation[0] ?? {
      key: 'dashboard',
      label: '概览',
      href: '/admin',
      icon: LayoutDashboard,
      enabled: true,
    }
  );
}

/**
 * 获取所有已启用（enabled: true）的功能导航模块。
 */
export function getEnabledNavItems(): AdminNavItem[] {
  return adminNavigation.filter((item) => item.enabled);
}

/**
 * 根据 URL 路径查找匹配的后台功能导航项。
 * 兼容完全匹配（如 `/admin/friend-links`）与子路径匹配（如 `/admin/friend-links/123`）。
 */
export function findNavItemByPath(pathname: string): AdminNavItem | undefined {
  const clean = pathname.replace(/\/$/, '') || '/admin';
  return adminNavigation.find(
    (item) => item.href === clean || (item.href !== '/admin' && clean.startsWith(`${item.href}/`)),
  );
}

/**
 * 根据唯一模块键（key）查找导航配置项。
 */
export function findNavItemByKey(key: string): AdminNavItem | undefined {
  return adminNavigation.find((item) => item.key === key);
}
