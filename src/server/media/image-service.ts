import { InternalServerError } from '../errors';
import { sha256 } from '../security/hash';
import type { ObjectStorage } from '../storage';
import type { ValidatedImage } from './images';

export function createImageService(storage: ObjectStorage) {
  return {
    async save(image: ValidatedImage, prefix: string) {
      if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(prefix))
        throw new TypeError('Invalid image namespace');
      const key = `${prefix}/${crypto.randomUUID()}.${image.extension}`;
      await storage.put(key, { bytes: image.bytes, contentType: image.mime });
      return { key, mime: image.mime, size: image.bytes.length, hash: image.hash };
    },
    async read(metadata: { key: string; mime: string; size: number; hash: string }) {
      const bytes = await storage.get(metadata.key, metadata.size);
      if (bytes.length !== metadata.size || (await sha256(bytes)) !== metadata.hash)
        throw new InternalServerError('图片完整性校验失败');
      return new Response(bytes, {
        headers: {
          'Content-Type': metadata.mime,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
  };
}
