import { cmsSessionRoute } from '../../../../../server/admin/cms/routes';

/**
 * CMS 工作台专用身份与运行模式查询 API
 *
 * 路径: GET /api/v1/admin/cms/session
 * 权限: 管理员身份验证
 *
 * 返回当前管理员会话信息以及 CMS 当前连接的数据源运行模式：
 * - `snapshot`: 本地开发模式下的只读静态文件快照
 * - `github`: 生产或已配置 GitHub Token 时的远程仓库只读读取
 * 明确指示只读约束（writable: false）。
 */
export const prerender = false;

export const ALL = cmsSessionRoute;
