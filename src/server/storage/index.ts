import type { CloudflareEnv } from '../../env.d';
import { requireBinding } from '../env';
import { createS3Storage } from './s3';

export type { ObjectStorage, S3StorageConfig } from './s3';
export { createS3Storage } from './s3';

/** 项目配置装配层；S3 适配器本身也可接入其他兼容供应商。 */
export function createObjectStorage(env: CloudflareEnv) {
  return createS3Storage(() => ({
    endpoint: requireBinding(env, 'SUPABASE_S3_ENDPOINT'),
    region: requireBinding(env, 'SUPABASE_S3_REGION'),
    bucket: requireBinding(env, 'SUPABASE_STORAGE_BUCKET'),
    accessKeyId: requireBinding(env, 'SUPABASE_S3_ACCESS_KEY_ID'),
    secretAccessKey: requireBinding(env, 'SUPABASE_S3_SECRET_ACCESS_KEY'),
  }));
}
