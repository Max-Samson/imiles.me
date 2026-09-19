import type { APIContext, APIRoute } from 'astro';
import { handleApiError, MethodNotAllowedError } from '../errors';
import { createRequestId, createRestContext, type RestContext } from './context';
import { type CorsOptions, handleCors, validateCorsOptions, withCors } from './cors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
type RestHandler = (context: RestContext, route: APIContext) => Response | Promise<Response>;

/** 在 Astro 中导出 ALL；统一覆盖成功、异常、OPTIONS、HEAD 和 405。 */
export function defineRestRoute(
  handlers: Partial<Record<Method, RestHandler>>,
  options: { cors?: CorsOptions } = {},
): APIRoute {
  if (options.cors) validateCorsOptions(options.cors);
  const methods = Object.keys(handlers);
  if (handlers.GET && !handlers.HEAD) methods.push('HEAD');
  methods.push('OPTIONS');
  const cors = options.cors ? { ...options.cors, methods } : undefined;
  return async (route) => {
    const requestId = createRequestId(route.request);
    const headers = { 'X-Request-Id': requestId };
    let response: Response;
    try {
      const preflight = cors ? handleCors(route.request, cors) : null;
      if (preflight) response = preflight;
      else if (route.request.method === 'OPTIONS') {
        response = new Response(null, { status: 204, headers: { Allow: methods.join(', ') } });
      } else {
        const method = route.request.method;
        const handler =
          Object.entries(handlers).find(([key]) => key === method)?.[1] ??
          (method === 'HEAD' ? handlers.GET : undefined);
        if (!handler) throw new MethodNotAllowedError(methods);
        response = await handler(createRestContext(route, requestId), route);
      }
    } catch (error) {
      response = handleApiError(error, { headers });
    }
    const finalHeaders = new Headers(response.headers);
    finalHeaders.set('X-Request-Id', requestId);
    finalHeaders.set('X-Content-Type-Options', 'nosniff');
    if (response.status >= 400 || !['GET', 'HEAD'].includes(route.request.method)) {
      finalHeaders.set('Cache-Control', 'no-store');
    } else if (!finalHeaders.has('Cache-Control')) {
      finalHeaders.set('Cache-Control', 'no-store');
    }
    response = new Response(route.request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    });
    return cors ? withCors(response, route.request, cors) : response;
  };
}
