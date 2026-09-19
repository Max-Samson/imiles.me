export interface CorsOptions {
  /** 默认允许无凭据公开访问；携带凭据时必须显式指定白名单。 */
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Request-Id', 'If-None-Match'];

export function validateCorsOptions(options: CorsOptions): void {
  if (
    options.credentials &&
    (!options.origin ||
      options.origin === '*' ||
      (Array.isArray(options.origin) && options.origin.includes('*')))
  ) {
    throw new TypeError('Credentialed CORS requires an explicit origin allowlist');
  }
  if (
    options.maxAge !== undefined &&
    (!Number.isSafeInteger(options.maxAge) || options.maxAge < 0)
  ) {
    throw new TypeError('CORS maxAge must be a non-negative integer');
  }
}

function appendVary(headers: Headers, ...names: string[]): void {
  const values = (headers.get('Vary') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (values.includes('*')) return;
  for (const name of names) {
    if (!values.some((v) => v.toLowerCase() === name.toLowerCase())) values.push(name);
  }
  headers.set('Vary', values.join(', '));
}

function allowedOrigin(origin: string, allowed: CorsOptions['origin']): boolean {
  // 沙盒 iframe / file:// 的 opaque origin 不默认开放。
  if (origin === 'null') return false;
  if (!allowed || allowed === '*') return true;
  if (typeof allowed === 'string') return allowed === origin;
  if (Array.isArray(allowed)) return allowed.includes(origin);
  return allowed(origin);
}

export function withCors(
  response: Response,
  request: Request,
  options: CorsOptions = {},
): Response {
  validateCorsOptions(options);
  const headers = new Headers(response.headers);
  // 即便来源被拒绝或没有 Origin，也必须隔离缓存变体。
  appendVary(headers, 'Origin');
  for (const name of [
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Expose-Headers',
  ])
    headers.delete(name);
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigin(origin, options.origin)) {
    headers.set(
      'Access-Control-Allow-Origin',
      !options.origin || options.origin === '*' ? '*' : origin,
    );
    if (options.credentials) headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set(
      'Access-Control-Expose-Headers',
      [...new Set(['X-Request-Id', ...(options.exposedHeaders ?? [])])].join(', '),
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** 预检同时检查来源、方法和请求头；普通 OPTIONS 仅返回能力列表。 */
export function handleCors(request: Request, options: CorsOptions = {}): Response | null {
  validateCorsOptions(options);
  if (request.method !== 'OPTIONS') return null;
  const methods = (options.methods ?? DEFAULT_METHODS).map((m) => m.toUpperCase());
  const allowedHeaders = options.allowedHeaders ?? DEFAULT_HEADERS;
  const origin = request.headers.get('Origin');
  const requestedMethod = request.headers.get('Access-Control-Request-Method');
  const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const denied =
    (origin && !allowedOrigin(origin, options.origin)) ||
    (requestedMethod && !methods.includes(requestedMethod.toUpperCase())) ||
    requestedHeaders.some((h) => !allowedHeaders.some((allowed) => allowed.toLowerCase() === h));
  const headers = new Headers({ Allow: methods.join(', '), 'Cache-Control': 'no-store' });
  appendVary(headers, 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers');
  if (!denied && origin && requestedMethod) {
    headers.set('Access-Control-Allow-Methods', methods.join(', '));
    headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    headers.set('Access-Control-Max-Age', String(options.maxAge ?? 600));
  }
  return withCors(new Response(null, { status: denied ? 403 : 204, headers }), request, options);
}
