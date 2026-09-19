import { formatEtag, matchesEtag } from '../types/etag';

/**
 * HTTP 缓存控制（Cache-Control）配置选项
 *
 * 【前端视角通俗解释】：
 * 在前端页面加载时，我们希望静态数据（如文章详情、标签列表）不用每次都重新向服务端请求，
 * 而是让浏览器或者 Cloudflare CDN 边缘节点把结果缓存起来。
 * 通过设置 `Cache-Control` 和 `ETag`：
 * 1. 读者第一次打开：服务端查询 D1 返回数据，并在响应头带上 `ETag: "hash123"`。
 * 2. 读者刷新页面：浏览器自动携带请求头 `If-None-Match: "hash123"`。
 * 3. 服务端确认内容未变后返回 304（无实体），节省传输；数据库查询是否减少取决于校验方式。
 */
export interface CacheControlOptions {
  /** 允许公开共享缓存（实际边缘缓存需配合 Cache API / 缓存规则） */
  public?: boolean;
  /** 终端浏览器的本地缓存最长有效期（秒） */
  maxAge?: number;
  /** Cloudflare 边缘 CDN 节点的专用缓存有效期（秒，优先级高于 maxAge） */
  sMaxAge?: number;
  /** 允许使用陈旧缓存同时在后台静默更新（stale-while-revalidate 秒数，体验极致平滑） */
  staleWhileRevalidate?: number;
  /** 缓存过期后强制向服务端验证有效性 */
  mustRevalidate?: boolean;
  /** 禁用强缓存，必须每次回源协商 */
  noCache?: boolean;
  /** 严禁任何缓存（敏感数据、实时变更接口使用） */
  noStore?: boolean;
}

/**
 * 将配置对象转换为标准的 Cache-Control 标头字符串
 */
export function buildCacheControlHeader(options: CacheControlOptions = {}): string {
  for (const value of [options.maxAge, options.sMaxAge, options.staleWhileRevalidate]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new TypeError('Cache duration must be a non-negative integer');
    }
  }
  if (options.sMaxAge !== undefined && !options.public) {
    throw new TypeError('sMaxAge requires an explicitly public response');
  }
  if (options.noStore) {
    return 'no-store, no-cache, must-revalidate';
  }

  if (options.noCache) {
    return 'no-cache, must-revalidate';
  }

  const directives: string[] = [];

  if (options.public) {
    directives.push('public');
  } else {
    directives.push('private');
  }

  if (typeof options.maxAge === 'number') {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (typeof options.sMaxAge === 'number') {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (typeof options.staleWhileRevalidate === 'number') {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * 校验客户端发来的 If-None-Match 标头是否命中当前资源的 ETag 指纹
 *
 * @param request 原生 Request 对象
 * @param etag 当前资源的指纹字符串（如版本哈希或更新时间戳）
 * @returns true 代表内容未改变，应当直接返回 304 Not Modified
 */
export function checkEtagMatch(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  if (!ifNoneMatch) return false;

  return matchesEtag(ifNoneMatch, etag);
}

/**
 * 为响应对象注入 Cache-Control 和 ETag 标头
 *
 * 【前端使用示例】：
 * ```ts
 * const res = jsonSuccess(article);
 * return withCache(res, {
 *   public: true,
 *   maxAge: 60,                // 浏览器缓存 60 秒
 *   sMaxAge: 3600,             // Cloudflare 边缘 CDN 缓存 1 小时
 *   staleWhileRevalidate: 86400,
 *   etag: `W/"${article.updatedAt}"`
 * });
 * ```
 */
export function withCache(
  response: Response,
  options: CacheControlOptions & { etag?: string } = {},
): Response {
  const headers = new Headers(response.headers);
  const cacheControl = buildCacheControlHeader(options);

  if (cacheControl) {
    headers.set('Cache-Control', cacheControl);
  }

  if (options.etag) {
    headers.set('ETag', formatEtag(options.etag));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
