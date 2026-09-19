import { ZodError } from 'astro/zod';
import { jsonError } from '../types';

/**
 * 业务领域异常基类（所有自定义业务错误都继承自该类）
 *
 * 【前端视角通俗解释】：
 * 在前端开发中，如果一个组件请求失败，我们通常通过状态码判断是“没登录 401”还是“找不到 404”。
 * 服务端也是如此！我们在 Service 或 Repository 里发现不合规时，不要到处手动写 `return new Response(...)`，
 * 而是直接 `throw new NotFoundError('文章不存在')`。
 * 外层的全局异常拦截器 `handleApiError` 会自动捕获并把它打包成标准状态码与 JSON 返回给前端。
 */
export class AppError extends Error {
  /** HTTP 响应状态码（如 400, 401, 403, 404, 500） */
  readonly statusCode: number;
  /** 业务错误标识码（如 "NOT_FOUND"、"VALIDATION_ERROR"，方便前端做国际化或分支判断） */
  readonly code: string;
  /** 额外的错误细节（如哪个表单字段校验不通过） */
  readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 Bad Request：客户端入参格式或参数校验不通过
 * 【场景】：前端漏传必填字段、传入的不是合法 URL、数字格式错误等
 */
export class ValidationError extends AppError {
  constructor(message = '请求参数校验失败', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * 401 Unauthorized：未登录或身份认证失败
 * 【场景】：未携带 Token、Token 已过期失效
 */
export class UnauthorizedError extends AppError {
  constructor(message = '需要身份凭证才能访问', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden：已登录但权限不足
 * 【场景】：普通用户尝试删除文章、或访问仅限博主操作的敏感接口
 */
export class ForbiddenError extends AppError {
  constructor(message = '拒绝访问：无操作权限', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found：请求的资源不存在
 * 【场景】：根据文章 slug 找不到对应记录
 */
export class NotFoundError extends AppError {
  constructor(message = '请求的资源未找到', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict：资源状态冲突
 * 【场景】：创建文章时 slug 已被占用、重复点赞或并发版本冲突
 */
export class ConflictError extends AppError {
  constructor(message = '资源存在冲突', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/**
 * 429 Too Many Requests：请求过于频繁（触发限流）
 * 【场景】：1 秒内连续发送 20 次请求被防刷机制拦截
 */
export class RateLimitError extends AppError {
  constructor(message = '请求过于频繁，请稍后再试', details?: unknown) {
    super(message, 429, 'RATE_LIMITED', details);
    this.name = 'RateLimitError';
  }
}

/**
 * 405 Method Not Allowed：请求的 HTTP 动词不支持
 * 【场景】：一个只支持 GET 的接口被前端误用 POST 访问
 */
export class MethodNotAllowedError extends AppError {
  readonly allowedMethods: string[];

  constructor(
    allowedMethods: string[] = ['GET'],
    message = `当前请求方法不支持，支持的方法包括: ${allowedMethods.join(', ')}`,
  ) {
    super(message, 405, 'METHOD_NOT_ALLOWED', { allowedMethods });
    this.name = 'MethodNotAllowedError';
    this.allowedMethods = allowedMethods;
  }
}

/**
 * 412 Precondition Failed：先决条件不满足
 * 【场景】：前端携带了 If-Match 或 ETag 进行并发乐观锁更新时未命中
 */
export class PreconditionFailedError extends AppError {
  constructor(message = '先决条件不满足', details?: unknown) {
    super(message, 412, 'PRECONDITION_FAILED', details);
    this.name = 'PreconditionFailedError';
  }
}

/**
 * 422 Unprocessable Entity：语义业务规则违背
 * 【场景】：参数语法合规，但业务规则不合法（如：下架状态的文章不允许发布评论）
 */
export class UnprocessableEntityError extends AppError {
  constructor(message = '业务规则处理失败', details?: unknown) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
    this.name = 'UnprocessableEntityError';
  }
}

/**
 * 500 Internal Server Error：服务端内部未预期的错误
 * 【场景】：D1 数据库连接异常、第三方接口崩溃等
 */
export class InternalServerError extends AppError {
  constructor(message = '服务端内部错误', details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
    this.name = 'InternalServerError';
  }
}

/**
 * 类型守卫函数（判断一个未知的 catch(e) 对象是不是本项目自定义的 AppError）
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** HTTP 错误出口：内部错误始终脱敏，与 NODE_ENV 无关。 */
export function handleApiError(error: unknown, init?: ResponseInit): Response {
  if (error instanceof ZodError) {
    return jsonError(
      {
        code: 'VALIDATION_ERROR',
        message: '请求参数校验不通过',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
      init,
    );
  }

  if (isAppError(error) && error.statusCode >= 400 && error.statusCode < 500) {
    const headers = new Headers(init?.headers);
    if (error instanceof RateLimitError) headers.set('Retry-After', '60');
    if (error instanceof MethodNotAllowedError) {
      headers.set('Allow', error.allowedMethods.join(', '));
    }
    return jsonError(
      { code: error.code, message: error.message, details: error.details },
      error.statusCode,
      { ...init, headers },
    );
  }

  // 日志保留内部原因；响应只暴露稳定错误码和关联 ID。
  console.error('[server.error]', {
    requestId: new Headers(init?.headers).get('X-Request-Id'),
    error,
  });
  return jsonError(
    { code: 'INTERNAL_SERVER_ERROR', message: '服务暂时不可用，请稍后重试' },
    500,
    init,
  );
}
