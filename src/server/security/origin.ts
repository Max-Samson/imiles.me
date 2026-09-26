import type { CloudflareEnv } from '../../env.d';
import { getSiteUrl } from '../config';
import { ForbiddenError } from '../errors';

export function requireSameOrigin(request: Request, env: CloudflareEnv): void {
  if (request.headers.get('Origin') !== getSiteUrl(env).origin) {
    throw new ForbiddenError('请求来源不允许');
  }
}
