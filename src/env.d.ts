/// <reference types="astro/client" />

import type { Runtime } from '@astrojs/cloudflare';
import type { WorkerBindings } from './worker-configuration';

/**
 * Cloudflare Worker environment bindings
 */
export interface CloudflareEnv
  extends Partial<Pick<WorkerBindings, 'DB' | 'KV' | 'FRIEND_LINK_RATE_LIMITER'>> {
  // Environment variables / secrets
  ENVIRONMENT?: 'development' | 'staging' | 'production';
  APP_SECRET?: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  ADMIN_SERVICE_TOKEN_IDS?: string;
  ADMIN_SERVICE_TOKEN_CAPABILITIES?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  SUBMISSION_HMAC_SECRET?: string;
  SITE_URL?: string;
  SUPABASE_S3_ENDPOINT?: string;
  SUPABASE_S3_REGION?: string;
  SUPABASE_STORAGE_BUCKET?: string;
  SUPABASE_S3_ACCESS_KEY_ID?: string;
  SUPABASE_S3_SECRET_ACCESS_KEY?: string;

  // Email service (Resend)
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  ADMIN_NOTIFICATION_EMAIL?: string;

  // Cloudflare resource metadata (local only; do not commit secrets)
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_NAME?: string;
  CLOUDFLARE_ACCESS_TEAM_NAME?: string;
  CLOUDFLARE_ACCESS_APPLICATION_ID?: string;
  CLOUDFLARE_D1_DATABASE_NAME?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
  CLOUDFLARE_KV_NAMESPACE_NAME?: string;
  CLOUDFLARE_KV_NAMESPACE_ID?: string;
  CLOUDFLARE_SESSION_KV_NAMESPACE_NAME?: string;
  CLOUDFLARE_SESSION_KV_NAMESPACE_ID?: string;
  CLOUDFLARE_TURNSTILE_WIDGET_NAME?: string;

  // Supabase project metadata
  SUPABASE_PROJECT_REF?: string;
}

declare global {
  namespace App {
    interface Locals extends Runtime<CloudflareEnv> {}
  }
}
