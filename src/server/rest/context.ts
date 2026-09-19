import type { APIContext } from 'astro';
import type { CloudflareEnv } from '../../env.d';
import { getServerEnv } from '../env';

export interface RestContext {
  requestId: string;
  /** 无可信地址时为 null，不使用客户端可伪造的 X-Forwarded-For。 */
  clientIp: string | null;
  userAgent: string;
  method: string;
  url: URL;
  env: CloudflareEnv;
  timestamp: number;
  /** 仅用于允许失败的后台工作；返回 promise，调用方必须 await。 */
  defer(task: () => Promise<unknown>): Promise<void>;
}

/** Cloudflare Ray ID 优先；不采纳未经信任的客户端追踪 ID。 */
export function createRequestId(request: Request): string {
  const ray = request.headers.get('cf-ray');
  return ray && /^[a-zA-Z0-9-]{1,80}$/.test(ray) ? ray : `req_${crypto.randomUUID()}`;
}

export function createRestContext(
  context: APIContext,
  requestId = createRequestId(context.request),
): RestContext {
  const { request } = context;
  let clientIp = request.headers.get('cf-connecting-ip');
  if (!clientIp) {
    try {
      clientIp = context.clientAddress ?? null;
    } catch {
      clientIp = null;
    }
  }
  const execution = context.locals.runtime?.ctx;
  return {
    requestId,
    clientIp,
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    method: request.method,
    url: new URL(request.url),
    env: getServerEnv(context.locals),
    timestamp: Date.now(),
    async defer(task) {
      const pending = Promise.resolve()
        .then(task)
        .catch((error: unknown) => {
          console.error('[server.background_failed]', { requestId, error });
        });
      if (execution) execution.waitUntil(pending);
      else await pending;
    },
  };
}
