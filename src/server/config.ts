import { appConfig } from '../config/app';
import type { CloudflareEnv } from '../env.d';
import { InternalServerError } from './errors';

const TURNSTILE_ALWAYS_PASS_TEST_SECRET = '1x0000000000000000000000000000000AA';
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface RuntimeConfig {
  environment: NonNullable<CloudflareEnv['ENVIRONMENT']>;
  siteUrl: URL;
  services: {
    adminAuth: 'cloudflare-access' | 'local-development';
    turnstileValidation: 'strict' | 'official-test';
  };
}

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

/** 集中解析本地和部署环境的服务模式，业务模块不直接判断环境变量。 */
export function getRuntimeConfig(env: CloudflareEnv): RuntimeConfig {
  const environment = env.ENVIRONMENT ?? 'production';
  const siteUrl = getSiteUrl(env);
  const localDevelopment =
    environment === 'development' && LOOPBACK_HOSTNAMES.has(siteUrl.hostname);
  return {
    environment,
    siteUrl,
    services: {
      adminAuth: localDevelopment ? 'local-development' : 'cloudflare-access',
      turnstileValidation:
        localDevelopment && env.TURNSTILE_SECRET_KEY === TURNSTILE_ALWAYS_PASS_TEST_SECRET
          ? 'official-test'
          : 'strict',
    },
  };
}
