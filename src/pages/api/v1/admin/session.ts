import { adminSessionRoute } from '../../../../server/admin/session/routes';

/**
 * 管理后台通用身份与会话信息查询 API
 *
 * 路径: GET /api/v1/admin/session
 * 权限: 管理员身份验证（Cloudflare Access JWT 或本地开发模拟会话）
 *
 * 解析请求头中的 Cloudflare Access 凭证，返回当前操作员信息、角色与授权能力列表。
 */
export const prerender = false;

export const ALL = adminSessionRoute;
