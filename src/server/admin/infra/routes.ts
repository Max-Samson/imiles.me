import type { AdminInfraConfig } from '../../../shared/admin/infra-contract';
import { defineRestRoute } from '../../rest';
import { getAdminAccess } from '../../security/access';
import { jsonSuccess } from '../../types';

/** 安全地提取 URL 的 host 部分，失败时返回 null。 */
function safeHost(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** 将逗号分隔的邮箱字符串解析为数组，过滤空值。 */
function parseEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const adminInfraRoute = defineRestRoute({
  GET: async (context, route) => {
    // 校验管理员身份（无效令牌抛出 401/403）
    await getAdminAccess(route.request, context.env);

    const env = context.env;

    const infra: AdminInfraConfig = {
      cloudflare: {
        accountId: env.CLOUDFLARE_ACCOUNT_ID ?? null,
        workerName: env.CLOUDFLARE_WORKER_NAME ?? null,
        accessTeamName: env.CLOUDFLARE_ACCESS_TEAM_NAME ?? null,
        accessApplicationId: env.CLOUDFLARE_ACCESS_APPLICATION_ID ?? null,
        d1DatabaseName: env.CLOUDFLARE_D1_DATABASE_NAME ?? null,
        d1DatabaseId: env.CLOUDFLARE_D1_DATABASE_ID ?? null,
        kvNamespaceName: env.CLOUDFLARE_KV_NAMESPACE_NAME ?? null,
        kvNamespaceId: env.CLOUDFLARE_KV_NAMESPACE_ID ?? null,
        sessionKvNamespaceName: env.CLOUDFLARE_SESSION_KV_NAMESPACE_NAME ?? null,
        sessionKvNamespaceId: env.CLOUDFLARE_SESSION_KV_NAMESPACE_ID ?? null,
        turnstileWidgetName: env.CLOUDFLARE_TURNSTILE_WIDGET_NAME ?? null,
      },
      supabase: {
        projectRef: env.SUPABASE_PROJECT_REF ?? null,
        s3Region: env.SUPABASE_S3_REGION ?? null,
        storageBucket: env.SUPABASE_STORAGE_BUCKET ?? null,
        // 仅暴露端点 host，隐藏完整路径
        s3EndpointHost: safeHost(env.SUPABASE_S3_ENDPOINT),
      },
      resend: {
        configured: Boolean(env.RESEND_API_KEY),
        emailFrom: env.EMAIL_FROM ?? 'imiles <noreply@imiles.me>',
        verifiedDomain: 'imiles.me',
      },
      environment: env.ENVIRONMENT ?? 'development',
      adminEmails: parseEmails(env.ADMIN_EMAILS),
    };

    return jsonSuccess(infra, undefined, { requestId: context.requestId });
  },
});
