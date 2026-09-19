import type { CloudflareEnv } from '../env.d';
import { getSiteUrl } from './config';
import { InternalServerError } from './errors';

/** 优先使用请求绑定；无 runtime 时仅为本地脚本提供标量环境变量。 */
export function getServerEnv(locals: Partial<App.Locals>): CloudflareEnv {
  const runtimeEnv = locals.runtime?.env;
  const processEnv = typeof process !== 'undefined' ? process.env : {};
  const environment =
    runtimeEnv?.ENVIRONMENT ??
    (processEnv.NODE_ENV === 'production' ? 'production' : 'development');
  const siteUrl = getSiteUrl({
    SITE_URL: runtimeEnv ? runtimeEnv.SITE_URL : processEnv.SITE_URL,
  }).origin;
  if (!['development', 'staging', 'production'].includes(environment)) {
    throw new InternalServerError('ENVIRONMENT 配置无效');
  }
  return {
    DB: runtimeEnv?.DB,
    KV: runtimeEnv?.KV,
    FRIEND_LINK_RATE_LIMITER: runtimeEnv?.FRIEND_LINK_RATE_LIMITER,
    ACCESS_ISSUER: runtimeEnv ? runtimeEnv.ACCESS_ISSUER : processEnv.ACCESS_ISSUER,
    ACCESS_AUD: runtimeEnv ? runtimeEnv.ACCESS_AUD : processEnv.ACCESS_AUD,
    ADMIN_EMAILS: runtimeEnv ? runtimeEnv.ADMIN_EMAILS : processEnv.ADMIN_EMAILS,
    TURNSTILE_SECRET_KEY: runtimeEnv
      ? runtimeEnv.TURNSTILE_SECRET_KEY
      : processEnv.TURNSTILE_SECRET_KEY,
    SUBMISSION_HMAC_SECRET: runtimeEnv
      ? runtimeEnv.SUBMISSION_HMAC_SECRET
      : processEnv.SUBMISSION_HMAC_SECRET,
    ENVIRONMENT: environment,
    SITE_URL: siteUrl,
    APP_SECRET: runtimeEnv ? runtimeEnv.APP_SECRET : processEnv.APP_SECRET,
    SUPABASE_S3_ENDPOINT: runtimeEnv
      ? runtimeEnv.SUPABASE_S3_ENDPOINT
      : processEnv.SUPABASE_S3_ENDPOINT,
    SUPABASE_S3_REGION: runtimeEnv ? runtimeEnv.SUPABASE_S3_REGION : processEnv.SUPABASE_S3_REGION,
    SUPABASE_STORAGE_BUCKET: runtimeEnv
      ? runtimeEnv.SUPABASE_STORAGE_BUCKET
      : processEnv.SUPABASE_STORAGE_BUCKET,
    SUPABASE_S3_ACCESS_KEY_ID: runtimeEnv
      ? runtimeEnv.SUPABASE_S3_ACCESS_KEY_ID
      : processEnv.SUPABASE_S3_ACCESS_KEY_ID,
    SUPABASE_S3_SECRET_ACCESS_KEY: runtimeEnv
      ? runtimeEnv.SUPABASE_S3_SECRET_ACCESS_KEY
      : processEnv.SUPABASE_S3_SECRET_ACCESS_KEY,
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
