import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import type { CloudflareEnv } from '../../env.d';
import { requireBinding } from '../env';
import * as schema from './schema';

/** 请求级创建 Drizzle 客户端；不能在模块顶层缓存 Worker binding。 */
export function createDrizzleClient(env: CloudflareEnv): DrizzleD1Database<typeof schema> {
  return drizzle(requireBinding(env, 'DB'), { schema });
}

export { schema };
export * from './batch';
