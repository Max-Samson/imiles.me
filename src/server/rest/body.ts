import { AppError, ValidationError } from '../errors';

export async function readBoundedBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('Invalid body limit');
  if (!body) throw new ValidationError('请求体不能为空');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, 15000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (expired) throw new AppError('请求读取超时', 408, 'REQUEST_TIMEOUT');
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new AppError('请求体过大', 413, 'PAYLOAD_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
