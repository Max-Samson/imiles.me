import type { EmailClient, SendEmailPayload, SendEmailResult } from './types';

export interface ResendClientOptions {
  apiKey: string;
  defaultFrom: string;
  fetchFn?: typeof fetch;
}

/**
 * Resend 邮件发送客户端。
 * 纯原生 Fetch 实现，零外部 SDK 依赖，适配 Cloudflare Workers Edge Runtime。
 */
export function createResendClient(options: ResendClientOptions): EmailClient {
  const fetchImpl = options.fetchFn ?? fetch;

  return {
    async send(payload: SendEmailPayload): Promise<SendEmailResult> {
      const from = payload.from || options.defaultFrom;
      const to = Array.isArray(payload.to) ? payload.to : [payload.to];

      if (!options.apiKey) {
        return {
          success: false,
          error: 'RESEND_API_KEY 未配置，已跳过发信',
        };
      }

      if (to.length === 0) {
        return {
          success: false,
          error: '收件人地址不能为空',
        };
      }

      const body: Record<string, unknown> = {
        from,
        to,
        subject: payload.subject,
        html: payload.html,
      };

      if (payload.text) {
        body.text = payload.text;
      }
      if (payload.replyTo) {
        body.reply_to = payload.replyTo;
      }

      try {
        const response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'imiles-blog/1.0',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const status = response.status;
          let errorMessage = `Resend API 错误 [${status}]`;
          try {
            const errData = (await response.json()) as { message?: string; name?: string };
            if (errData?.message) {
              errorMessage = `Resend API [${status}]: ${errData.message}`;
            }
          } catch {
            const text = await response.text();
            if (text) errorMessage = `Resend API [${status}]: ${text.slice(0, 200)}`;
          }
          return { success: false, error: errorMessage };
        }

        const data = (await response.json()) as { id: string };
        return { success: true, id: data.id };
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : '网络请求失败';
        return { success: false, error };
      }
    },
  };
}
