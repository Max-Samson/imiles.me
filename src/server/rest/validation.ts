import { AppError, ValidationError } from '../errors';

/** Zod 等解析器可以直接传入，输出类型由 schema 推导。 */
export interface InputSchema<T> {
  parse(value: unknown): T;
}

export function parseInput<T>(schema: InputSchema<T>, value: unknown): T {
  return schema.parse(value);
}

/** 按实际流字节数限流，不能仅信任 Content-Length；默认最大 64 KiB。 */
export async function readJsonBody<T>(
  request: Request,
  schema: InputSchema<T>,
  maxBytes = 64 * 1024,
): Promise<T> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new TypeError('Invalid body size limit');
  const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (
    contentType !== 'application/json' &&
    !/^application\/[\w.+-]+\+json$/.test(contentType ?? '')
  ) {
    throw new AppError('请求体必须是 JSON', 415, 'UNSUPPORTED_MEDIA_TYPE');
  }
  const contentLength = request.headers.get('Content-Length');
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength)))
  ) {
    throw new ValidationError('Content-Length 无效');
  }
  if (contentLength !== null && Number(contentLength) > maxBytes) {
    throw new AppError('请求体过大', 413, 'PAYLOAD_TOO_LARGE');
  }
  if (!request.body) throw new ValidationError('请求体不能为空');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError('请求体过大', 413, 'PAYLOAD_TOO_LARGE');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof AppError) throw error;
    throw new ValidationError('无法读取有效的 UTF-8 JSON 请求体');
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ValidationError('JSON 格式无效');
  }
  return schema.parse(value);
}
