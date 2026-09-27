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

  /** 从 runtime 或 process.env 中读取标量值的辅助函数 */
  const scalar = (key: keyof CloudflareEnv): string | undefined =>
    runtimeEnv ? (runtimeEnv[key] as string | undefined) : (processEnv[key] as string | undefined);

  return {
    DB: runtimeEnv?.DB,
    KV: runtimeEnv?.KV,
    FRIEND_LINK_RATE_LIMITER: runtimeEnv?.FRIEND_LINK_RATE_LIMITER,
    ACCESS_ISSUER: scalar('ACCESS_ISSUER'),
    ACCESS_AUD: scalar('ACCESS_AUD'),
    ADMIN_EMAILS: scalar('ADMIN_EMAILS'),
    ADMIN_SERVICE_TOKEN_IDS: scalar('ADMIN_SERVICE_TOKEN_IDS'),
    ADMIN_SERVICE_TOKEN_CAPABILITIES: scalar('ADMIN_SERVICE_TOKEN_CAPABILITIES'),
    TURNSTILE_SECRET_KEY: scalar('TURNSTILE_SECRET_KEY'),
    TURNSTILE_SITE_KEY: scalar('TURNSTILE_SITE_KEY'),
    SUBMISSION_HMAC_SECRET: scalar('SUBMISSION_HMAC_SECRET'),
    ENVIRONMENT: environment,
    SITE_URL: siteUrl,
    APP_SECRET: scalar('APP_SECRET'),
    SUPABASE_S3_ENDPOINT: scalar('SUPABASE_S3_ENDPOINT'),
    SUPABASE_S3_REGION: scalar('SUPABASE_S3_REGION'),
    SUPABASE_STORAGE_BUCKET: scalar('SUPABASE_STORAGE_BUCKET'),
    SUPABASE_S3_ACCESS_KEY_ID: scalar('SUPABASE_S3_ACCESS_KEY_ID'),
    SUPABASE_S3_SECRET_ACCESS_KEY: scalar('SUPABASE_S3_SECRET_ACCESS_KEY'),
    // Email service (Resend)
    RESEND_API_KEY: scalar('RESEND_API_KEY'),
    EMAIL_FROM: scalar('EMAIL_FROM'),
    ADMIN_NOTIFICATION_EMAIL: scalar('ADMIN_NOTIFICATION_EMAIL'),
    // Cloudflare resource metadata
    CLOUDFLARE_ACCOUNT_ID: scalar('CLOUDFLARE_ACCOUNT_ID'),
    CLOUDFLARE_WORKER_NAME: scalar('CLOUDFLARE_WORKER_NAME'),
    CLOUDFLARE_ACCESS_TEAM_NAME: scalar('CLOUDFLARE_ACCESS_TEAM_NAME'),
    CLOUDFLARE_ACCESS_APPLICATION_ID: scalar('CLOUDFLARE_ACCESS_APPLICATION_ID'),
    CLOUDFLARE_D1_DATABASE_NAME: scalar('CLOUDFLARE_D1_DATABASE_NAME'),
    CLOUDFLARE_D1_DATABASE_ID: scalar('CLOUDFLARE_D1_DATABASE_ID'),
    CLOUDFLARE_KV_NAMESPACE_NAME: scalar('CLOUDFLARE_KV_NAMESPACE_NAME'),
    CLOUDFLARE_KV_NAMESPACE_ID: scalar('CLOUDFLARE_KV_NAMESPACE_ID'),
    CLOUDFLARE_SESSION_KV_NAMESPACE_NAME: scalar('CLOUDFLARE_SESSION_KV_NAMESPACE_NAME'),
    CLOUDFLARE_SESSION_KV_NAMESPACE_ID: scalar('CLOUDFLARE_SESSION_KV_NAMESPACE_ID'),
    CLOUDFLARE_TURNSTILE_WIDGET_NAME: scalar('CLOUDFLARE_TURNSTILE_WIDGET_NAME'),
    // Supabase project metadata
    SUPABASE_PROJECT_REF: scalar('SUPABASE_PROJECT_REF'),
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
