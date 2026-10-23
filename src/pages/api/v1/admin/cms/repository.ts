import { cmsRepositoryRoute } from '../../../../../server/admin/cms/routes';

/**
 * CMS 内容仓库（Repository）操作端点
 *
 * 路径: POST /api/v1/admin/cms/repository
 * 权限: admin:read
 *
 * 供 Pageel CMS 工作台只读访问博客与故事内容（读取文件列表、文件树、内容、SHA 等）。
 */
export const prerender = false;
export const ALL = cmsRepositoryRoute;
