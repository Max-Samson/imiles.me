import { adminInfraRoute } from '../../../../server/admin/infra/routes';

/**
 * 管理员基础设施状态与配置查看 API
 *
 * 路径: GET /api/v1/admin/infra
 * 权限: admin:read（管理员只读权限）
 *
 * 供管理后台查看 Cloudflare、Supabase/S3、Resend 邮件服务以及系统环境配置的就绪状态。
 * 所有敏感凭据与连接串均经过严格脱敏与过滤处理，仅暴露资源名称与安全标识符。
 */
export const prerender = false;

export const ALL = adminInfraRoute;
