import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { appConfig } from '../../config/app';
import type { CloudflareEnv } from '../../env.d';
import { getSiteUrl } from '../config';
import { requireBinding } from '../env';
import {
  ForbiddenError,
  InternalServerError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from '../errors';
import type { RestContext } from '../rest/context';

export function requireSameOrigin(request: Request, env: CloudflareEnv) {
  const origin = request.headers.get('Origin');
  const allowed = getSiteUrl(env).origin;

  if (origin === allowed) {
    return;
  }

  throw new ForbiddenError('请求来源不允许');
}

export async function requireAdmin(
  request: Request,
  env: CloudflareEnv,
  verificationKey?: JWTVerifyGetKey,
): Promise<string> {
  const issuer = requireBinding(env, 'ACCESS_ISSUER');
  const audience = requireBinding(env, 'ACCESS_AUD');
  const emails = requireBinding(env, 'ADMIN_EMAILS')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const serviceIds = (env.ADMIN_SERVICE_TOKEN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !emails.length)
    throw new InternalServerError('Access 配置无效');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) throw new UnauthorizedError();
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(
      token,
      verificationKey ??
        createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), { timeoutDuration: 5000 }),
      {
        issuer,
        audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'sub'],
      },
    ));
  } catch {
    throw new UnauthorizedError('管理员身份无效或已过期');
  }
  if (typeof payload.email === 'string' && emails.includes(payload.email.toLowerCase()))
    return payload.email.toLowerCase();
  if (
    payload.sub === '' &&
    typeof payload.common_name === 'string' &&
    serviceIds.includes(payload.common_name)
  )
    return `service:${payload.common_name}`;
  throw new ForbiddenError();
}

export async function requireAdminMutation(
  request: Request,
  env: CloudflareEnv,
  verificationKey?: JWTVerifyGetKey,
): Promise<string> {
  const actor = await requireAdmin(request, env, verificationKey);
  // Non-browser API clients do not send Origin. Only allow that for a verified service token.
  if (!actor.startsWith('service:') || request.headers.has('Origin')) {
    requireSameOrigin(request, env);
  }
  return actor;
}

export async function limitSubmission(context: RestContext) {
  const limiter = requireBinding(context.env, 'FRIEND_LINK_RATE_LIMITER');
  const secret = requireBinding(context.env, 'SUBMISSION_HMAC_SECRET');
  if (!context.clientIp) throw new ValidationError('无法识别请求来源');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(context.clientIp),
  );
  const hash = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
  let success: boolean;
  try {
    ({ success } = await limiter.limit({ key: `friend-links:${hash}` }));
  } catch {
    throw new InternalServerError('限流服务不可用');
  }
  if (!success) throw new RateLimitError();
}

export async function verifyTurnstile(
  token: string,
  env: CloudflareEnv,
  fetcher: typeof fetch = fetch,
) {
  const secret = requireBinding(env, 'TURNSTILE_SECRET_KEY');
  const hostname = getSiteUrl(env).hostname;
  const action = appConfig.turnstile.actions.friendLinkSubmit;
  let result: unknown;
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('upstream');
    // 固定 Cloudflare 地址；限制异常响应体大小。
    const { readBoundedBytes } = await import('../rest/body');
    result = JSON.parse(new TextDecoder().decode(await readBoundedBytes(response.body, 16384)));
  } catch {
    throw new InternalServerError('验证码服务不可用');
  }
  if (
    typeof result !== 'object' ||
    result === null ||
    !('success' in result) ||
    result.success !== true ||
    !('hostname' in result) ||
    result.hostname !== hostname ||
    !('action' in result) ||
    result.action !== action
  )
    throw new ValidationError('验证码校验失败，请重新验证');
}
