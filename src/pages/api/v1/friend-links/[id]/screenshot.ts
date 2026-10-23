import { screenshotRoute } from '../../../../../server/friend-links/routes';

/**
 * 公开友链网站截图获取 API
 *
 * 路径: GET /api/v1/friend-links/:id/screenshot
 * 权限: 公开无需鉴权
 *
 * 仅允许获取已发布（published）状态的友链截图，未发布或待审核的友链将被拒绝。
 * 从对象存储（S3/R2）中流式传输截图文件，带有缓存响应头。
 */
export const prerender = false;

export const ALL = screenshotRoute('public');
