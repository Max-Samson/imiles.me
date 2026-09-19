import { defineRestRoute } from '../../../server/rest';
import { jsonSuccess } from '../../../server/types';

export const prerender = false;

/** 存活探针，不查询数据库，不公开资源 ID/密钥；不代表依赖就绪。 */
export const ALL = defineRestRoute({
  GET: (context) => jsonSuccess({ status: 'ok' }, undefined, { requestId: context.requestId }),
});
