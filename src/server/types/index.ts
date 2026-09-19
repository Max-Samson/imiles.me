import { formatEtag } from './etag';

export * from './query';

/**
 * API 错误详情载荷类型定义
 */
export interface ApiErrorDetail {
  /** 业务错误代码，如 "NOT_FOUND"、"VALIDATION_ERROR" */
  code: string;
  /** 供前端展示给用户的友好错误文案 */
  message: string;
  /** 错误附加详情（如具体哪个字段未通过校验） */
  details?: unknown;
}

/**
 * 标准成功响应报文结构（全站所有 2xx 响应统一遵守）
 *
 * 【前端视角通俗解释】：
 * 前端调用接口时，最怕每个接口返回格式都不一样（有的返回 `{ data }`，有的直接返回数组，有的返回 `{ result }`）。
 * 本站所有成功的 API 统一输出 `{ success: true, data: ..., meta: { timestamp } }`。
 * 前端 Axios 拦截器只需判断 `res.data.success === true` 即可放心使用 `res.data.data`。
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: number;
    requestId?: string;
    [key: string]: unknown;
  };
}

/**
 * 标准失败响应报文结构（全站所有 4xx/5xx 响应统一遵守）
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
  meta?: {
    timestamp: number;
    requestId?: string;
  };
}

/**
 * 统一 API 响应联合类型（用于前端 TypeScript 类型推导）
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 分页请求查询参数契约
 * 【场景】：`?page=1&pageSize=20`
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 分页元数据结构
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * 标准分页列表返回结构
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * 创建标准 200 OK 成功响应
 *
 * @param data 返回给前端的数据实体（如文章对象、阅读数等）
 * @param init 额外的 ResponseInit 配置（如 status, headers）
 * @param meta 额外的元数据（如分页参数、耗时等）
 */
export function jsonSuccess<T>(
  data: T,
  init?: ResponseInit,
  meta?: Record<string, unknown>,
): Response {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...meta,
    },
  };

  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    status: init?.status ?? 200,
    headers,
  });
}

/**
 * 创建标准 201 Created 资源创建成功响应
 * 【场景】：POST 成功创建了一条新的点赞或留言
 *
 * @param data 新创建的资源数据实体
 * @param location 新建资源定位 URI
 */
export function jsonCreated<T>(
  data: T,
  location: string,
  init?: ResponseInit,
  meta?: Record<string, unknown>,
): Response {
  const headers = new Headers(init?.headers);
  if (location) {
    headers.set('Location', location);
  }
  return jsonSuccess(data, { ...init, status: 201, headers }, meta);
}

/**
 * 创建标准 204 No Content 无实体成功响应
 * 【场景】：DELETE 成功删除了记录，或无需向前端回传任何数据体
 */
export function jsonNoContent(init?: ResponseInit): Response {
  return new Response(null, {
    ...init,
    status: 204,
  });
}

/**
 * 创建标准 304 Not Modified 缓存协商未修改响应
 * 【场景】：前端发来 If-None-Match，服务端比对发现数据没变，返回 304 节省网络出网流量
 */
export function jsonNotModified(etag?: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (etag) {
    headers.set('ETag', formatEtag(etag));
  }
  return new Response(null, {
    ...init,
    status: 304,
    headers,
  });
}

/**
 * 创建标准 405 Method Not Allowed 响应
 * 【场景】：接口只允许 GET，但前端发来了 DELETE，返回 405 并提示允许的动词
 */
export function jsonMethodNotAllowed(allowedMethods: string[], init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Allow', allowedMethods.join(', '));
  return jsonError(
    {
      code: 'METHOD_NOT_ALLOWED',
      message: `请求方法不支持，允许的方法: ${allowedMethods.join(', ')}`,
      details: { allowedMethods },
    },
    405,
    { ...init, headers },
  );
}

/**
 * 创建标准 JSON 错误响应
 */
export function jsonError(
  error: { code: string; message: string; details?: unknown },
  status = 500,
  init?: ResponseInit,
): Response {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  const requestId = headers.get('X-Request-Id');
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
    meta: {
      timestamp: Date.now(),
      ...(requestId ? { requestId } : {}),
    },
  };

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    status,
    headers,
  });
}
