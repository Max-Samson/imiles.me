import { defineRestRoute } from '../../../server/rest';
import { jsonSuccess } from '../../../server/types';

/**
 * 服务存活探针（Liveness Probe）API
 *
 * 路径: GET /api/v1/health
 * 权限: 公开无需鉴权
 *
 * 用于基础设施健康探测（如 Cloudflare Healthchecks、Uptime 监控等）。
 * 仅返回进程存活状态，不主动查询底层数据库与存储服务，不公开系统资源 ID 或密钥。
 */
export const prerender = false;

export const ALL = defineRestRoute({
  GET: (context) => jsonSuccess({ status: 'ok' }, undefined, { requestId: context.requestId }),
});
