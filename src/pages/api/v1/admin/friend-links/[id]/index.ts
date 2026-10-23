import { adminDetail } from '../../../../../../server/friend-links/routes';

/**
 * 管理员单个友链详情、审核与删除 API
 *
 * 路径:
 * - GET    /api/v1/admin/friend-links/:id  查询单个友链完整详情（包含申请人邮箱与操作流水）
 * - PATCH  /api/v1/admin/friend-links/:id  审批或变更状态（approve/reject/hide 等），支持带版本号乐观锁与自动发信
 * - DELETE /api/v1/admin/friend-links/:id  彻底删除友链及关联资源
 *
 * 权限:
 * - GET: admin:read
 * - PATCH / DELETE: admin:write
 */
export const prerender = false;

export const ALL = adminDetail;
