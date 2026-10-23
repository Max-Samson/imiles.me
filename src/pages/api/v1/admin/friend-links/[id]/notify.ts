import { adminNotify } from '../../../../../../server/friend-links/routes';

/**
 * 管理员手动发送/重发友链通知邮件 API
 *
 * 路径: POST /api/v1/admin/friend-links/:id/notify
 * 权限: admin:write（管理员写权限）
 *
 * 供管理员向已审核通过的友链申请人手动发送附言通知邮件。
 * 调用 Resend 邮件服务，需配置有效的 RESEND_API_KEY。
 */
export const prerender = false;

export const ALL = adminNotify;
