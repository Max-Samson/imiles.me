import type { AdminNewApplicationEmailParams } from '../types';

export function renderAdminNewApplicationEmail(params: AdminNewApplicationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const applicantName = params.applicantName?.trim() || '未命名站点';
  const subject = `【友链审核待处理】来自 ${applicantName} 的友链申请`;

  // 纯文本版（CLI 风格，高信息密度）
  const text = `
收到新的友情链接申请 (New Friend Link Application)：

- 站点名称 / Name: ${applicantName}
- 申请网址 / URL: ${params.applicantUrl}
- 联系邮箱 / Email: ${params.applicantEmail}
- 站点简介 / Bio: ${params.description}

审核地址 (Review URL):
${params.detailUrl}

// 建议审核维度:
// 1. HTTPS 可正常连通访问
// 2. 博客含原创技术文章或生活思考
// 3. 具备长久维护互换意愿

imiles.me // admin control plane
  `.trim();

  // HTML 版：清爽白色极简风格，无多层盒子边框嵌套
  const html = `
<!DOCTYPE html>
<html lang="zh-CN" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #fafafa;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 16px 8px !important; }
      .email-card { padding: 24px 18px !important; border-radius: 8px !important; }
      .button-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; color: #111827; line-height: 1.6;">
  <table role="presentation" class="email-wrapper" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafafa; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- 单层主卡片：扁平开阔，内部无嵌套盒子边框 -->
        <table role="presentation" class="email-card" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 36px 32px; box-sizing: border-box;">
          
          <!-- Header 区域：站点 Logo 与状态 -->
          <tr>
            <td style="padding-bottom: 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <img src="https://imiles.me/images/weblogo.jpeg" width="36" height="36" alt="imiles logo" style="display: block; width: 36px; height: 36px; border-radius: 8px; object-fit: cover;">
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 16px; font-weight: 700; color: #111827; letter-spacing: -0.02em; display: block; line-height: 1.2;">imiles.me</span>
                          <span style="font-size: 12px; color: #6b7280; display: block; line-height: 1.3; margin-top: 2px;">管理平台 · 审核提醒</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-size: 12px; font-weight: 500; color: #b45309; display: inline-flex; align-items: center; gap: 6px;">
                      <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #f59e0b;"></span>
                      待审核申请
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 发丝分割线 -->
          <tr>
            <td style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
              <h1 style="margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #111827; letter-spacing: -0.02em; line-height: 1.3;">
                收到新的友链申请
              </h1>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #374151;">
                访客已通过博客公开申请表单提交友链交换请求，详情如下：
              </p>

              <!-- 申请信息：扁平无边框表格 -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.7; color: #374151;">
                <tr>
                  <td style="width: 82px; color: #6b7280; vertical-align: top; padding: 4px 0;">站点名称：</td>
                  <td style="color: #111827; font-weight: 600; padding: 4px 0;">${escapeHtml(applicantName)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; vertical-align: top; padding: 4px 0;">申请网址：</td>
                  <td style="padding: 4px 0;">
                    <a href="${escapeHtml(params.applicantUrl)}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500; word-break: break-all;">
                      ${escapeHtml(params.applicantUrl)} ↗
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color: #6b7280; vertical-align: top; padding: 4px 0;">联系邮箱：</td>
                  <td style="padding: 4px 0;">
                    <a href="mailto:${escapeHtml(params.applicantEmail)}" style="color: #2563eb; text-decoration: none;">
                      ${escapeHtml(params.applicantEmail)}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color: #6b7280; vertical-align: top; padding: 4px 0;">站点简介：</td>
                  <td style="color: #374151; padding: 4px 0; white-space: pre-wrap;">${escapeHtml(params.description)}</td>
                </tr>
              </table>

              <!-- 审核建议：轻量左边线强调，无多余盒子 -->
              <div style="margin: 20px 0 24px; padding: 4px 0 4px 12px; border-left: 2px solid #f59e0b; font-size: 12px; color: #6b7280; line-height: 1.6;">
                审核建议：确认 HTTPS 正常连通 · 包含原创内容 · 具备长久维护意愿
              </div>

              <!-- 主行动按钮 -->
              <div style="margin: 24px 0 8px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <a class="button-cta" href="${escapeHtml(params.detailUrl)}" target="_blank" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 11px 22px; border-radius: 6px; font-size: 13px; font-weight: 500; letter-spacing: -0.01em;">
                        前往后台审核此申请 (Review Link) →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer 区域 -->
          <tr>
            <td style="border-top: 1px solid #f3f4f6; margin-top: 28px; padding-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
              imiles.me admin control plane · internal only
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
