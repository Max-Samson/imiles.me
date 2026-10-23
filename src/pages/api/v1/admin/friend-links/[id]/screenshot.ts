import { screenshotRoute } from '../../../../../../server/friend-links/routes';

/**
 * 管理员友链截图查看与下载 API
 *
 * 路径: GET /api/v1/admin/friend-links/:id/screenshot
 * 权限: admin:read（管理员只读权限）
 *
 * 供管理后台查看任意状态（包括 pending/rejected 等尚未公开发布）的友链网站截图。
 */
export const prerender = false;

export const ALL = screenshotRoute('admin');
