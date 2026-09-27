/**
 * 后台控制面板基础设施元数据契约。
 * 仅包含非敏感的资源标识符与配置名称；所有密钥与凭据严格保留在服务端。
 */
export interface AdminInfraConfig {
  cloudflare: {
    accountId: string | null;
    workerName: string | null;
    /** Cloudflare Access Zero Trust 团队名称（subdomain），用于构造 Access 控制台链接。 */
    accessTeamName: string | null;
    accessApplicationId: string | null;
    d1DatabaseName: string | null;
    d1DatabaseId: string | null;
    kvNamespaceName: string | null;
    kvNamespaceId: string | null;
    sessionKvNamespaceName: string | null;
    sessionKvNamespaceId: string | null;
    turnstileWidgetName: string | null;
  };
  supabase: {
    projectRef: string | null;
    s3Region: string | null;
    storageBucket: string | null;
    /** S3 端点 URL，截取 host 部分展示（不含路径），保护完整 URL 不在前端直接渲染。 */
    s3EndpointHost: string | null;
  };
  resend?: {
    configured: boolean;
    emailFrom: string | null;
    verifiedDomain: string;
  };
  /** 环境标识：development | staging | production */
  environment: string;
  /** 管理员邮箱列表（从 ADMIN_EMAILS 解析） */
  adminEmails: string[];
}
