import type { CloudflareEnv } from '../env.d';
import { InternalServerError } from './errors';

/**
 * Astro 运行时上下文接口类型定义
 *
 * 【前端视角通俗解释】：
 * 在传统 Node.js 开发中，大家习惯直接调用 `process.env.XXX` 获取环境变量。
 * 但在 Cloudflare Workers 边缘运行时中，Worker 不是常驻的 Node 进程，而是轻量级的 V8 隔离区（Isolate）。
 * 所有外部资源（比如数据库 D1、缓存 KV、密码秘钥）都是由 Cloudflare 在每次收到 HTTP 请求时，
 * 动态通过上下文注入到 Astro 的 `context.locals.runtime.env` 中的。
 */
interface LocalsWithRuntime {
  runtime?: {
    env?: Record<string, unknown>;
  };
}

/**
 * 安全提取并标准化 Cloudflare 运行时环境绑定（Bindings & Env）
 *
 * 【前端视角通俗解释】：
 * 类似于前端 React 中的 `useContext(AppContext)`。
 * 传入 Astro API 路由中的 `context.locals`，此函数会帮我们安全解析出所有可用的数据库/KV绑定。
 * 如果在本地开发或轻量单元测试环境下没有真实的 Cloudflare 边缘环境，会自动降级读取 `process.env`，避免代码抛出 undefined 异常。
 *
 * @param locals Astro 路由上下文中的 context.locals 对象
 * @returns 包含 DB、KV 以及环境变量的强类型 CloudflareEnv 实例
 */
export function getServerEnv(locals: unknown): CloudflareEnv {
  const typedLocals = locals as LocalsWithRuntime | undefined;
  const runtimeEnv = typedLocals?.runtime?.env;

  // 1. 如果处于 Cloudflare 真实边缘环境，优先提取 runtime.env 绑定的 D1 和 KV
  if (runtimeEnv && typeof runtimeEnv === 'object') {
    return runtimeEnv as CloudflareEnv;
  }

  // 2. 本地 Node.js 脚本或单元测试环境下的安全降级兜底方案
  const processEnv = typeof process !== 'undefined' ? process.env : {};
  return {
    ENVIRONMENT: (processEnv.NODE_ENV as CloudflareEnv['ENVIRONMENT']) ?? 'development',
    APP_SECRET: processEnv.APP_SECRET,
    SITE_URL: processEnv.SITE_URL ?? 'https://imiles.me',
  };
}

/**
 * 校验并强制获取指定的 Cloudflare 资源绑定（如数据库 D1 或缓存 KV）
 *
 * 【前端视角通俗解释】：
 * 类似于 TypeScript 中的非空断言与防御性断言。
 * 当后续业务必须使用 D1 数据库执行 SQL 时，我们不能让代码在执行到一半时报 `Cannot read properties of undefined`。
 * 调用此函数若发现 `wrangler.toml` 没绑定对应资源，会直接抛出友好的服务端配置缺失异常，提示开发者去配置。
 *
 * @param env 环境变量聚合对象
 * @param bindingKey 需要提取的绑定名称，如 'DB' 或 'KV'
 * @throws InternalServerError 当配置不存在时中断并提示检查 wrangler.toml
 */
export function requireBinding<K extends keyof CloudflareEnv>(
  env: CloudflareEnv,
  bindingKey: K,
): NonNullable<CloudflareEnv[K]> {
  const binding = env[bindingKey];

  if (!binding) {
    throw new InternalServerError(
      `Cloudflare 绑定资源 "${String(bindingKey)}" 未配置，请检查 wrangler.toml 中的 [[d1_databases]] 或 [[kv_namespaces]] 配置。`,
    );
  }

  return binding as NonNullable<CloudflareEnv[K]>;
}
