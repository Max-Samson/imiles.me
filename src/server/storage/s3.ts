import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { InternalServerError, NotFoundError } from '../errors';
import { readBoundedBytes } from '../rest/body';

export interface ObjectStorage {
  put(key: string, object: { bytes: Uint8Array<ArrayBuffer>; contentType: string }): Promise<void>;
  get(key: string, maxBytes: number): Promise<Uint8Array<ArrayBuffer>>;
  remove(key: string): Promise<void>;
  list(options: {
    prefix: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ objects: { key: string; modified: number }[]; cursor?: string }>;
}
export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}
function validatePath(key: string) {
  if (
    !key ||
    key.length > 1024 ||
    key.startsWith('/') ||
    key.split('/').includes('..') ||
    [...key].some((char) => char.charCodeAt(0) < 32 || char === String.fromCharCode(92))
  )
    throw new InternalServerError('存储路径无效');
}
/** 通用 S3 适配器：不依赖业务表、审核状态或图片格式，不提供匿名上传入口。 */
export function createS3Storage(loadConfig: () => S3StorageConfig): ObjectStorage {
  let client: S3Client | undefined;
  let bucket: string;
  const config = () => {
    if (!client) {
      const cfg = loadConfig();
      const url = new URL(cfg.endpoint);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !cfg.bucket
      )
        throw new InternalServerError('S3 配置无效');
      bucket = cfg.bucket;
      client = new S3Client({
        endpoint: cfg.endpoint,
        region: cfg.region,
        forcePathStyle: true,
        maxAttempts: 1,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    }
    return { client, bucket };
  };
  const options = () => ({ abortSignal: AbortSignal.timeout(10000) });
  return {
    async put(key, object) {
      validatePath(key);
      const { client, bucket } = config();
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: object.bytes,
            ContentType: object.contentType,
            CacheControl: 'no-store',
          }),
          options(),
        );
      } catch {
        throw new InternalServerError('文件存储写入失败');
      }
    },
    async get(key, maxBytes) {
      validatePath(key);
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
        throw new TypeError('Invalid download limit');
      const { client, bucket } = config();
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          options(),
        );
        if (
          !result.Body ||
          (result.ContentLength !== undefined && result.ContentLength > maxBytes)
        ) {
          await result.Body?.transformToWebStream().cancel();
          throw new Error('Invalid object size');
        }
        return await readBoundedBytes(result.Body.transformToWebStream(), maxBytes);
      } catch (error) {
        if (error instanceof Error && error.name === 'NoSuchKey') throw new NotFoundError();
        throw new InternalServerError('文件存储读取失败');
      }
    },
    async remove(key) {
      validatePath(key);
      const { client, bucket } = config();
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), options());
      } catch {
        throw new InternalServerError('文件存储删除失败');
      }
    },
    async list({ prefix, cursor, limit = 100 }) {
      validatePath(prefix);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new TypeError('Invalid list limit');
      const { client, bucket } = config();
      try {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: limit,
            ContinuationToken: cursor,
          }),
          options(),
        );
        return {
          objects: (result.Contents ?? []).flatMap((item) =>
            item.Key && item.LastModified
              ? [{ key: item.Key, modified: item.LastModified.getTime() }]
              : [],
          ),
          cursor: result.NextContinuationToken,
        };
      } catch {
        throw new InternalServerError('文件存储列举失败');
      }
    },
  };
}
