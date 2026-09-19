import type { CloudflareEnv } from '../env.d';
import { InternalServerError } from './errors';

/** 优先使用请求绑定；无 runtime 时仅为本地脚本提供标量环境变量。 */
export function getServerEnv(locals: Partial<App.Locals>): CloudflareEnv {
  const runtimeEnv = locals.runtime?.env;
  const processEnv = typeof process !== 'undefined' ? process.env : {};
  const environment =
    runtimeEnv?.ENVIRONMENT ??
    (processEnv.NODE_ENV === 'production' ? 'production' : 'development');
  const siteUrl = runtimeEnv?.SITE_URL ?? processEnv.SITE_URL ?? 'https://imiles.me';
  if (!['development', 'staging', 'production'].includes(environment)) {
    throw new InternalServerError('ENVIRONMENT 配置无效');
  }
  try {
    if (!['https:', 'http:'].includes(new URL(siteUrl).protocol)) throw new Error('Invalid scheme');
  } catch {
    throw new InternalServerError('SITE_URL 必须是有效的 HTTP(S) URL');
  }
  return {
    DB: runtimeEnv?.DB,
    KV: runtimeEnv?.KV,
    ENVIRONMENT: environment,
    SITE_URL: siteUrl,
    APP_SECRET: runtimeEnv ? runtimeEnv.APP_SECRET : processEnv.APP_SECRET,
  };
}

export function requireBinding<K extends keyof CloudflareEnv>(
  env: CloudflareEnv,
  bindingKey: K,
): NonNullable<CloudflareEnv[K]> {
  const binding = env[bindingKey];
  if (binding === undefined || binding === null || binding === '') {
    throw new InternalServerError(`Cloudflare 绑定资源 "${String(bindingKey)}" 未配置`);
  }
  return binding as NonNullable<CloudflareEnv[K]>;
}
