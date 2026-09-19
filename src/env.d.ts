/// <reference types="astro/client" />

import type { Runtime } from '@astrojs/cloudflare';
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker environment bindings
 */
export interface CloudflareEnv {
  // Database bindings
  DB?: D1Database;
  // Key-Value cache bindings
  KV?: KVNamespace;
  // Object storage bindings
  STORAGE?: R2Bucket;

  // Environment variables / secrets
  ENVIRONMENT?: 'development' | 'staging' | 'production';
  APP_SECRET?: string;
  SITE_URL?: string;
}

declare global {
  namespace App {
    interface Locals extends Runtime<CloudflareEnv> {}
  }
}
