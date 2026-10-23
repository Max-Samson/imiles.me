import { publicList } from '../../../server/friend-links/routes';

/**
 * 公开友链列表查询 API
 *
 * 路径: GET /api/v1/friend-links
 * 权限: 公开无需鉴权
 *
 * 供前端页面查询已审核通过并发布的友链列表。
 * 支持分页查询参数（page, pageSize），响应中已剥离申请人邮箱等隐私数据。
 */
export const prerender = false;

export const ALL = publicList;
