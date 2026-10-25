import { z } from 'astro/zod';
import { ValidationError } from '../../errors';
import { defineRestRoute } from '../../rest';
import { authorizeAdmin } from '../../security/access';
import { jsonSuccess } from '../../types';
import { historyRepository } from './history-repository';
import { historyService } from './history-service';

const listQuery = z
  .object({
    path: z.string().min(1).max(240),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(50))
      .optional(),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict();
const snapshotQuery = z.object({ path: z.string().min(1).max(240) }).strict();

/** 重复与未知参数一律拒绝；本接口的游标与通用页码分页相互独立。 */
function readQuery(url: URL, allowed: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key)) throw new ValidationError(`不支持的历史查询参数: ${key}`);
    if (Object.hasOwn(values, key)) throw new ValidationError(`参数不能重复: ${key}`);
    Object.defineProperty(values, key, { value, enumerable: true });
  }
  return values;
}

export const cmsHistoryListRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const input = listQuery.safeParse(
      readQuery(new URL(route.request.url), ['path', 'limit', 'cursor']),
    );
    if (!input.success) throw new ValidationError('历史查询参数无效');
    return jsonSuccess(await historyService(historyRepository(env)).list(input.data));
  },
});

/** 只在主动查看时读取单个快照；鉴权、路径归属与 no-store 同样适用于正文。 */
export const cmsHistorySnapshotRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const input = snapshotQuery.safeParse(readQuery(new URL(route.request.url), ['path']));
    if (!input.success || !route.params.id) throw new ValidationError('历史版本参数无效');
    // Astro 动态参数可能仍保留 %3A；只解码一次，再交给业务层校验固定事件 ID。
    let id: string;
    try {
      id = decodeURIComponent(route.params.id);
    } catch {
      throw new ValidationError('历史版本 ID 编码无效');
    }
    return jsonSuccess(await historyService(historyRepository(env)).snapshot(input.data.path, id));
  },
});
