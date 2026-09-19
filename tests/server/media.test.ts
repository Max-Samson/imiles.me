import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { createImageService } from '../../src/server/media/image-service';
import { validateImage } from '../../src/server/media/images';
import { readBoundedBytes } from '../../src/server/rest/body';
import { createS3Storage, type ObjectStorage } from '../../src/server/storage';

test('通用图片服务可用于独立业务前缀，自定义限制且校验下载完整性', async () => {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const storage: ObjectStorage = {
    async put(key, object) {
      files.set(key, object.bytes);
    },
    async get(key) {
      return files.get(key) ?? new Uint8Array();
    },
    async remove(key) {
      files.delete(key);
    },
    async list() {
      return { objects: [] };
    },
  };
  const service = createImageService(storage);
  const bytes = new Uint8Array(
    await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } })
      .png()
      .toBuffer(),
  );
  await assert.rejects(validateImage(bytes, 'image/png', { maxWidth: 10 }));
  const image = await validateImage(bytes, 'image/png', { maxBytes: 1024, maxWidth: 32 });
  const a = await service.save(image, 'avatars');
  const b = await service.save(image, 'projects/covers');
  assert.match(a.key, /^avatars\//);
  assert.match(b.key, /^projects\/covers\//);
  assert.notEqual(a.key, b.key);
  const response = await service.read(a);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  files.set(a.key, new Uint8Array(bytes.length));
  await assert.rejects(service.read(a), { code: 'INTERNAL_SERVER_ERROR' });
  await assert.rejects(service.save(image, '../unsafe'));
});

test('通用 S3 适配器限制下载大小、隐藏 SDK 错误、区分对象不存在', async () => {
  const storage = createS3Storage(() => ({
    endpoint: 'https://storage.real.net',
    region: 'test',
    bucket: 'test',
    accessKeyId: 'test',
    secretAccessKey: 'test',
  }));
  let cancelled = false;
  const send = mock.method(S3Client.prototype, 'send', async (command: unknown) => {
    assert.ok(command instanceof GetObjectCommand);
    return {
      ContentLength: 100,
      Body: {
        transformToWebStream: () =>
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
      },
    };
  });
  try {
    await assert.rejects(storage.get('other-business/file', 10), { code: 'INTERNAL_SERVER_ERROR' });
    assert.equal(cancelled, true);
    send.mock.mockImplementation(async () => {
      throw Object.assign(new Error('private provider details'), { name: 'NoSuchKey' });
    });
    await assert.rejects(storage.get('other-business/file', 10), { code: 'NOT_FOUND' });
    send.mock.mockImplementation(async () => {
      throw new Error('private provider details');
    });
    await assert.rejects(
      storage.remove('other-business/file'),
      (error: unknown) =>
        error instanceof Error && !error.message.includes('private provider details'),
    );
    await assert.rejects(storage.get('../unsafe', 10));
  } finally {
    send.mock.restore();
  }
});

test('未知 Content-Length 的流依旧受实际读取字节上限约束', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(11));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readBoundedBytes(body, 10), { statusCode: 413 });
  assert.equal(cancelled, true);
});
