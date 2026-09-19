/**
 * 跨域资源共享（CORS）配置选项
 *
 * 【前端视角通俗解释】：
 * 前端开发中最常遇到的错误之一就是 `Cross-Origin Request Blocked`（跨域被拦截）。
 * 当浏览器在不同域名、不同端口下调用我们的 API 时，浏览器会先发送一个 `OPTIONS` 预检请求询问服务端：
 * “你允许哪些域名访问？允许携带哪些 Header？允许什么请求方式？”。
 * 服务端必须正确响应 OPTIONS 请求并返回相应的 Access-Control-* 头，否则前端无法拿到数据。
 */
export interface CorsOptions {
  /** 允许的跨域来源（可为具体域名、域名数组或判断函数，默认为 '*' 允许所有） */
  origin?: string | string[] | ((origin: string) => boolean);
  /** 允许的 HTTP 动词（GET, POST 等） */
  methods?: string[];
  /** 允许客户端发送的自定义 Header 标头 */
  allowedHeaders?: string[];
  /** 允许前端 JS 读取的响应标头（暴露在 res.headers 中） */
  exposedHeaders?: string[];
  /** 预检请求的浏览器本地缓存有效时间（单位：秒，默认 86400 即 24 小时） */
  maxAge?: number;
  /** 是否允许跨域携带 Cookie 等身份凭据 */
  credentials?: boolean;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Request-Id', 'If-None-Match'];

/**
 * 校验来源 origin 是否在白名单中
 */
function isOriginAllowed(origin: string, allowed?: CorsOptions['origin']): boolean {
  if (!allowed || allowed === '*') return true;
  if (typeof allowed === 'string') return allowed === origin;
  if (Array.isArray(allowed)) return allowed.includes(origin);
  if (typeof allowed === 'function') return allowed(origin);
  return false;
}

/**
 * 处理浏览器跨域预检（OPTIONS）请求
 *
 * 【前端使用方式】：
 * 在每个 API 路由文件（如 `export const ALL = ...` 或单独的 `export const OPTIONS = ...`）的第一行调用：
 * ```ts
 * const corsRes = handleCors(request);
 * if (corsRes) return corsRes; // 如果是 OPTIONS 请求，直接返回 204
 * ```
 *
 * @param request 原生 Request 对象
 * @param options 可选的 CORS 配置参数
 * @returns 若为 OPTIONS 预检请求则返回 204 No Content 响应；若为普通请求则返回 null
 */
export function handleCors(request: Request, options: CorsOptions = {}): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const origin = request.headers.get('origin') ?? '*';
  if (!isOriginAllowed(origin, options.origin)) {
    return new Response(null, { status: 403 });
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', (options.methods ?? DEFAULT_METHODS).join(', '));
  headers.set(
    'Access-Control-Allow-Headers',
    (options.allowedHeaders ?? DEFAULT_HEADERS).join(', '),
  );

  if (options.exposedHeaders && options.exposedHeaders.length > 0) {
    headers.set('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));
  }

  if (options.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  headers.set('Access-Control-Max-Age', String(options.maxAge ?? 86400));

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * 为已有的业务 Response 响应对象注入 CORS 跨域头
 *
 * 【前端使用方式】：
 * 当你的业务接口正常返回数据（如 `jsonSuccess(data)`）或者报错（`handleApiError(err)`）时，
 * 包装一下 `withCors(res, request)`，确保返回给浏览器的报文带着跨域许可头，浏览器就不会报跨域拦截了。
 */
export function withCors(
  response: Response,
  request: Request,
  options: CorsOptions = {},
): Response {
  const origin = request.headers.get('origin') ?? '*';
  if (!isOriginAllowed(origin, options.origin)) {
    return response;
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', origin);

  if (options.credentials) {
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
  }

  if (options.exposedHeaders && options.exposedHeaders.length > 0) {
    newHeaders.set('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
