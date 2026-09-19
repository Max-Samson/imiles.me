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
}

declare global {
  namespace App {
    interface Locals extends Runtime<CloudflareEnv> {}
  }
}
