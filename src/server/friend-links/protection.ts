import { appConfig } from '../../config/app';
import type { CloudflareEnv } from '../../env.d';
import { getSiteUrl } from '../config';
import { requireBinding } from '../env';
import { InternalServerError, RateLimitError, ValidationError } from '../errors';
import { readBoundedBytes } from '../rest/body';
import type { RestContext } from '../rest/context';

export async function limitSubmission(context: RestContext) {
  const limiter = requireBinding(context.env, 'FRIEND_LINK_RATE_LIMITER');
  const secret = requireBinding(context.env, 'SUBMISSION_HMAC_SECRET');
  if (secret.length < 32) throw new InternalServerError('限流密钥配置无效');
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
    // 固定 Cloudflare 地址，并限制异常响应体大小，避免上游响应耗尽 Worker 内存。
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
