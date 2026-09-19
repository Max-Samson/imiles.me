import type { KVNamespace } from '@cloudflare/workers-types';
import type { CloudflareEnv } from '../../env.d';
import { requireBinding } from '../env';

/**
 * 从环境变量中提取 Cloudflare Workers KV 命名空间句柄
 *
 * 【前端视角通俗解释】：
 * Workers KV 本质上是部署在 Cloudflare 全球数百个数据中心边缘节点上的分布式只读键值存储。
 * 它的读取速度极其恐怖（通常只需 1~5 毫秒），相当于前端的 `localStorage`，
 * 但它是跨全网共享的，非常适合做只读缓存、访问计数防刷拦截。
 *
 * @param env 环境变量聚合对象
 * @returns 原生 KV 命名空间实例
 */
export function getKVNamespace(env: CloudflareEnv): KVNamespace {
  return requireBinding(env, 'KV');
}

/**
 * KV 缓存键名前缀统一定义（命名空间隔离）
 *
 * 【前端视角通俗解释】：
 * 就像我们在 localStorage 里存东西时，为了避免键名冲突，习惯加上前缀（如 `my_app_token`、`my_app_theme`）。
 * 服务端所有的 KV 缓存 key 统一在这里定义前缀，防止不同业务互相覆盖。
 */
export const KV_PREFIXES = {
  /** 接口限流计数器与令牌桶，Key 形如: "rate_limit:192.168.1.1" */
  RATE_LIMIT: 'rate_limit:',
  /** 通用业务只读缓存前缀，Key 形如: "cache:my_key" */
  CACHE: 'cache:',
  /** 临时会话与瞬态状态前缀，Key 形如: "session:token" */
  SESSION: 'session:',
} as const;

/**
 * 从 Workers KV 中安全读取并自动反序列化 JSON 数据
 *
 * 【前端视角通俗解释】：
 * 类似于 `JSON.parse(localStorage.getItem(key))` 的安全异步包装版本。
 * 自带了 `try...catch` 异常保护，即便网络瞬时波动或格式损坏，也不会导致整个 HTTP 请求崩溃，而是优雅返回 null。
 *
 * @param kv KV 命名空间句柄
 * @param key 完整的缓存键名（建议使用 KV_PREFIXES 拼接）
 * @returns 解析后的 JavaScript 数据对象，未命中缓存或读取失败时返回 null
 */
export async function safeCacheGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    return await kv.get<T>(key, 'json');
  } catch (error) {
    console.warn(`[KV 缓存读取失败] 键名 "${key}":`, error);
    return null;
  }
}

/**
 * 安全地向 Workers KV 写入数据（自动序列化为 JSON，并支持配置有效时长 TTL）
 *
 * 【前端视角通俗解释】：
 * 类似于 `localStorage.setItem(key, JSON.stringify(value))`，但额外支持自动过期清理功能！
 * 传入 `ttlSeconds`（存活秒数），到达时间后 Cloudflare 会自动在后台将该键删除，不需要我们写定时任务清理。
 *
 * ⚠️ 注意点：Cloudflare 规定 KV 的最小过期时长为 60 秒（小于 60 秒会自动修正为 60 秒）。
 *
 * @param kv KV 命名空间句柄
 * @param key 缓存键名
 * @param value 需要缓存的任意 JavaScript 对象或基本类型
 * @param ttlSeconds 缓存有效期（单位：秒）。不传则永久保存直到被手动覆盖或删除
 */
export async function safeCacheSet<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const options: KVNamespacePutOptions = {};
    if (ttlSeconds && ttlSeconds > 0) {
      // Cloudflare KV 强制限制最小过期时长不得小于 60 秒
      options.expirationTtl = Math.max(ttlSeconds, 60);
    }
    await kv.put(key, JSON.stringify(value), options);
  } catch (error) {
    console.warn(`[KV 缓存写入失败] 键名 "${key}":`, error);
  }
}

/**
 * 从 Workers KV 中安全删除指定的缓存键
 *
 * 【前端视角通俗解释】：
 * 类似于 `localStorage.removeItem(key)` 的异步安全版本。
 * 常用于“缓存主动失效”场景（例如文章内容被编辑后，主动删掉老缓存，强制下次请求重新从 D1 数据库拉取最新的数据）。
 *
 * @param kv KV 命名空间句柄
 * @param key 需要清除的缓存键名
 */
export async function safeCacheDelete(kv: KVNamespace, key: string): Promise<void> {
  try {
    await kv.delete(key);
  } catch (error) {
    console.warn(`[KV 缓存删除失败] 键名 "${key}":`, error);
  }
}
