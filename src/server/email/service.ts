import type { CloudflareEnv } from '../../env.d';
import { getSiteUrl } from '../config';
import { createResendClient } from './client';
import { renderAdminNewApplicationEmail } from './templates/admin-new-application';
import { renderFriendLinkApprovedEmail } from './templates/friend-link-approved';
import type {
  AdminNewApplicationEmailParams,
  EmailClient,
  FriendLinkApprovedEmailParams,
  SendEmailResult,
} from './types';

export interface EmailService {
  isConfigured(): boolean;
  sendFriendLinkApproved(
    to: string,
    params: Omit<FriendLinkApprovedEmailParams, 'siteUrl'>,
  ): Promise<SendEmailResult>;
  sendAdminNewApplication(params: AdminNewApplicationEmailParams): Promise<SendEmailResult>;
}

export function createEmailService(env: CloudflareEnv, fetchFn?: typeof fetch): EmailService {
  const apiKey = env.RESEND_API_KEY?.trim();
  // 默认发件地址，已验证域名为 imiles.me
  const defaultFrom = env.EMAIL_FROM?.trim() || 'imiles <noreply@imiles.me>';

  // 邮件发送给外部收件人，静态资源与站点公开链接必须使用公网规范地址（避免本地测试时向外部发出无法访问的 localhost 地址）
  const resolvedUrl = getSiteUrl(env);
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(resolvedUrl.hostname);
  const siteUrl = isLoopback ? 'https://imiles.me' : resolvedUrl.origin;

  let client: EmailClient | null = null;
  if (apiKey) {
    client = createResendClient({
      apiKey,
      defaultFrom,
      fetchFn,
    });
  }

  return {
    isConfigured() {
      return Boolean(apiKey && client);
    },

    async sendFriendLinkApproved(to, params) {
      if (!client) {
        return {
          success: false,
          error: 'RESEND_API_KEY 未配置，跳过发送友链通过通知',
        };
      }

      const { subject, html, text } = renderFriendLinkApprovedEmail({
        ...params,
        siteUrl,
      });

      return client.send({
        to,
        subject,
        html,
        text,
      });
    },

    async sendAdminNewApplication(params) {
      if (!client) {
        return {
          success: false,
          error: 'RESEND_API_KEY 未配置，跳过发送管理员新申请通知',
        };
      }

      // 获取管理员通知邮箱：优先 ADMIN_NOTIFICATION_EMAIL，其次 ADMIN_EMAILS 第一个
      const adminEmail =
        env.ADMIN_NOTIFICATION_EMAIL?.trim() || env.ADMIN_EMAILS?.split(',')[0]?.trim();

      if (!adminEmail) {
        return {
          success: false,
          error: '未配置管理员通知邮箱 (ADMIN_NOTIFICATION_EMAIL 或 ADMIN_EMAILS)',
        };
      }

      const { subject, html, text } = renderAdminNewApplicationEmail(params);

      return client.send({
        to: adminEmail,
        subject,
        html,
        text,
      });
    },
  };
}
