import { adminList } from '../../../../../server/friend-links/routes';

/**
 * 管理员友链管理列表查询 API
 *
 * 路径: GET /api/v1/admin/friend-links
 * 权限: admin:read（管理员只读权限）
 *
 * 供管理后台查询全部友链申请与记录，支持：
 * - 状态筛选（pending / approved / rejected / hidden / all）
 * - 分页参数（page, pageSize）
 * - 返回完整的审核元数据与申请人联系方式
 */
export const prerender = false;

export const ALL = adminList;
