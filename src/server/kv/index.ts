import type { KVNamespace } from '@cloudflare/workers-types';
import type { CloudflareEnv } from '../../env.d';
import { requireBinding } from '../env';

export function getKVNamespace(env: CloudflareEnv): KVNamespace {
  return requireBinding(env, 'KV');
}

/** KV 仅用于允许陈旧或丢失的缓存，不能充当原子计数器、会话撤销源或严格限流器。 */
export const KV_PREFIXES = { CACHE: 'imiles:cache:' } as const;
export const DEFAULT_CACHE_TTL = 300;

export function cacheKey(module: string, identifier: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(module) || !identifier) throw new TypeError('Invalid cache key');
  const key = `${KV_PREFIXES.CACHE}${module}:${encodeURIComponent(identifier)}`;
  if (new TextEncoder().encode(key).length > 512) throw new TypeError('Cache key is too long');
  return key;
}

function cacheTtl(ttlSeconds: number): number {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new TypeError('Cache TTL must be a positive integer');
  }
  return Math.max(ttlSeconds, 60);
}

export function safeCacheGet(kv: KVNamespace, key: string): Promise<unknown | null>;
export function safeCacheGet<T>(
  kv: KVNamespace,
  key: string,
  parse: (value: unknown) => T,
): Promise<T | null>;
export async function safeCacheGet(
  kv: KVNamespace,
  key: string,
  parse?: (value: unknown) => unknown,
): Promise<unknown | null> {
  try {
    const value = await kv.get<unknown>(key, 'json');
    return value === null ? null : parse ? parse(value) : value;
  } catch {
    // 缓存故障/旧数据格式不影响权威数据读取，不输出可能包含敏感信息的 key。
    console.warn('[cache.read_failed]');
    return null;
  }
}

/** 默认五分钟；配置/序列化错误抛出，KV 网络写入失败返回 false。 */
export async function safeCacheSet<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  ttlSeconds = DEFAULT_CACHE_TTL,
): Promise<boolean> {
  const expirationTtl = cacheTtl(ttlSeconds);
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Cache value must be JSON serializable');
  // 项目约束，不是 KV 平台的单值上限。
  if (new TextEncoder().encode(serialized).length > 1024 * 1024) {
    throw new TypeError('Cache value exceeds the project 1 MiB budget');
  }
  try {
    await kv.put(key, serialized, { expirationTtl });
    return true;
  } catch {
    console.warn('[cache.write_failed]');
    return false;
  }
}

/** 删除失败可被调用方观测；删除成功也不保证全球立即一致。 */
export async function safeCacheDelete(kv: KVNamespace, key: string): Promise<boolean> {
  try {
    await kv.delete(key);
    return true;
  } catch {
    console.warn('[cache.delete_failed]');
    return false;
  }
}

/** Cache-Aside：解码缓存，未命中/失败回源；不缓存 null，不吞掉权威数据源错误。 */
export async function getOrLoadCache<T>(
  kv: KVNamespace,
  key: string,
  load: () => Promise<T | null>,
  options: { parse: (value: unknown) => T; ttlSeconds?: number },
): Promise<T | null> {
  const ttl = cacheTtl(options.ttlSeconds ?? DEFAULT_CACHE_TTL);
  const cached = await safeCacheGet(kv, key, options.parse);
  if (cached !== null) return cached;
  const value = await load();
  if (value !== null) await safeCacheSet(kv, key, value, ttl);
  return value;
}
