import { AdminApiError } from './api-error';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error?: { message?: string };
}

export async function adminApiRequest<T>(
  path: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(path, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AdminApiError('network', '无法连接管理服务，请检查网络后重试');
  }

  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  if (response.redirected || response.status === 401) {
    throw new AdminApiError('session-expired', '登录状态已失效', requestId, response.status);
  }
  if (response.status === 403) {
    throw new AdminApiError('forbidden', '当前账号没有后台访问权限', requestId, response.status);
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AdminApiError('session-expired', '需要重新验证登录状态', requestId, response.status);
  }

  let payload: SuccessEnvelope<T> | ErrorEnvelope;
  try {
    payload = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  } catch {
    throw new AdminApiError('invalid-response', '管理服务返回了无法识别的响应', requestId);
  }

  if (!response.ok || payload.success !== true) {
    const message = payload.success === false ? payload.error?.message : undefined;
    throw new AdminApiError('api', message ?? '管理服务请求失败', requestId, response.status);
  }
  return payload.data;
}
