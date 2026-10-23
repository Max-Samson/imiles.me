import { cleanup } from '../../../../../server/friend-links/routes';

/**
 * 友链存储维护与垃圾资源清理 API
 *
 * 路径: POST /api/v1/admin/friend-links/cleanup
 * 权限: admin:maintenance（管理员运维权限）
 *
 * 定期或按需清理未引用的孤立截图、过期游标对象以及待清理数据。
 * 支持游标分页扫描，防止单次执行超时。
 */
export const prerender = false;

export const ALL = cleanup;
