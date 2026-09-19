/// <reference types="astro/client" />

import type { Runtime } from '@astrojs/cloudflare';
import type { WorkerBindings } from './worker-configuration';

/**
 * Cloudflare Worker environment bindings
 */
export interface CloudflareEnv extends Partial<Pick<WorkerBindings, 'DB' | 'KV'>> {
  // Environment variables / secrets
  ENVIRONMENT?: 'development' | 'staging' | 'production';
  APP_SECRET?: string;
  SITE_URL?: string;
  SUPABASE_S3_ENDPOINT?: string;
  SUPABASE_S3_REGION?: string;
  SUPABASE_STORAGE_BUCKET?: string;
  SUPABASE_S3_ACCESS_KEY_ID?: string;
  SUPABASE_S3_SECRET_ACCESS_KEY?: string;
}

declare global {
  namespace App {
    interface Locals extends Runtime<CloudflareEnv> {}
  }
}
