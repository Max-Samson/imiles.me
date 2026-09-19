import { appConfig } from '../config/app';
import type { CloudflareEnv } from '../env.d';
import { InternalServerError } from './errors';

/** 项目级非敏感默认值；环境变量仅用于测试/预发布覆盖。 */
export const storageDefaults = {
  endpoint: 'YOUR_SUPABASE_S3_ENDPOINT',
  region: 'YOUR_SUPABASE_S3_REGION',
  bucket: 'YOUR_SUPABASE_STORAGE_BUCKET',
} as const;

/** 信任配置，不从 Host、Origin 或转发头推导站点，以免客户端扩大许可范围。 */
export function getSiteUrl(env: Pick<CloudflareEnv, 'SITE_URL'>): URL {
  try {
    const url = new URL(env.SITE_URL ?? appConfig.siteUrl);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid site URL');
    return url;
  } catch {
    throw new InternalServerError('站点配置必须是无路径、凭据或参数的 HTTP(S) 地址');
  }
}
