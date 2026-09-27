import type { FriendLinkApprovedEmailParams } from '../types';

export function renderFriendLinkApprovedEmail(params: FriendLinkApprovedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const recipientName = params.applicantName?.trim() || '朋友';

  // 邮件外部展示与资源地址强制使用公网规范域名（消除本地开发环境注入的 localhost 地址）
  const rawSiteUrl = params.siteUrl.replace(/\/+$/, '');
  const siteUrl = /(?:localhost|127\.0\.0\.1|\[::1\])/i.test(rawSiteUrl)
    ? 'https://imiles.me'
    : rawSiteUrl;

  const friendsUrl = `${siteUrl}/friends`;
  // 站点官方 Logo 地址
  const logoUrl = `${siteUrl}/images/weblogo.jpeg`;
  const subject = '【imiles.me】Friend Link Application Approved | 友情链接申请已通过审批';

  const bioZh = '全栈开发者的数字花园，记录前端工程、系统思考与设计。';
  const bioEn = 'Digital garden of a full-stack engineer, exploring tech, design & thought.';

  // 纯文本版（CLI 风格，高信息密度，双语）
  const textLines = [
    `Hi ${recipientName}：`,
    '',
    '很高兴地通知你，你在 imiles.me 提交的友情链接申请已通过审核，站点已正式公开收录于博客友链页面。',
    'We are pleased to inform you that your friend link application for imiles.me has been approved. Your site is now listed on the public friends page.',
    '',
    `收录目标 / Target: ${params.applicantUrl}`,
    `友链页面 / Friends Page: ${friendsUrl}`,
  ];

  if (params.customMessage?.trim()) {
    textLines.push('', `// Admin Note / 站长附言:`, params.customMessage.trim());
  }

  textLines.push(
    '',
    '// --------------------------------------------------',
    '// My Site Info (for link exchange):',
    '- Website: imiles',
    `- URL: ${siteUrl}`,
    `- Logo: ${logoUrl}`,
    `- Desc CN: ${bioZh}`,
    `- Desc EN: ${bioEn}`,
    '',
    'Markdown Snippet:',
    `[imiles](${siteUrl}) - ${bioZh}`,
    `[imiles](${siteUrl}) - ${bioEn}`,
    '// --------------------------------------------------',
    '',
    '祝代码常青，生活愉快！',
    'Happy coding and best regards!',
    'Cheers,',
    'Miles // imiles.me',
  );

  const text = textLines.join('\n');

  // 站长附言模块（编辑式左边线引用，无嵌套盒子边框，双语标题）
  const customMessageHtml = params.customMessage?.trim()
    ? `
      <div style="margin: 22px 0; padding: 4px 0 4px 14px; border-left: 3px solid #10b981; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
        <span style="font-size: 11px; color: #059669; font-weight: 600; display: block; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; font-family: ui-monospace, monospace;">// Admin Note / 站长附言</span>
        ${escapeHtml(params.customMessage.trim())}
      </div>
    `
    : '';

  // HTML 版：清爽白色极简风格，双语对照
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
        <!-- 单层主卡片：纯白、单个细边框，内部不再嵌套任何边框盒子 -->
        <table role="presentation" class="email-card" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 36px 32px; box-sizing: border-box;">
          
          <!-- Header 区域：站点 Logo 与状态 -->
          <tr>
            <td style="padding-bottom: 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <a href="${escapeHtml(siteUrl)}" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center; gap: 10px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align: middle; padding-right: 12px;">
                            <img src="${escapeHtml(logoUrl)}" width="36" height="36" alt="imiles logo" style="display: block; width: 36px; height: 36px; border-radius: 8px; object-fit: cover;">
                          </td>
                          <td style="vertical-align: middle;">
                            <span style="font-size: 16px; font-weight: 700; color: #111827; letter-spacing: -0.02em; display: block; line-height: 1.2;">imiles.me</span>
                            <span style="font-size: 12px; color: #6b7280; display: block; line-height: 1.3; margin-top: 2px;">Digital Garden · Friend Link Notice</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-size: 12px; font-weight: 500; color: #059669; display: inline-flex; align-items: center; gap: 6px;">
                      <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10b981;"></span>
                      Approved
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 发丝分割线 -->
          <tr>
            <td style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
              <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #111827; letter-spacing: -0.02em; line-height: 1.3;">
                Friend Link Application Approved<br/>友链申请审核通过
              </h1>
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #374151;">
                Hi <strong>${escapeHtml(recipientName)}</strong>, we’re glad to tell you that your friend link application has been approved. Your site is now visible on our public friends page.
              </p>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #374151;">
                你好 <strong>${escapeHtml(recipientName)}</strong>，你在本站提交的友情链接申请已核对通过，站点已正式在公开友链页面上线展出。
              </p>

              <!-- 收录目标：自然流式展示，不加外层边框盒子 -->
              <div style="margin: 16px 0 20px; font-size: 13px; color: #4b5563; line-height: 1.6;">
                <span style="color: #6b7280;">Target Site：</span>
                <a href="${escapeHtml(params.applicantUrl)}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">${escapeHtml(params.applicantUrl)} ↗</a>
              </div>

              ${customMessageHtml}

              <!-- 主行动按钮 -->
              <div style="margin: 24px 0 32px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <a class="button-cta" href="${escapeHtml(friendsUrl)}" target="_blank" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 11px 22px; border-radius: 6px; font-size: 13px; font-weight: 500; letter-spacing: -0.01em;">
                        View Friends Page →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- 本站互换信息区域：扁平开放列表，无嵌套盒子 -->
          <tr>
            <td style="border-top: 1px solid #f3f4f6; padding-top: 28px;">
              <div style="font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 14px;">
                本站友链信息（欢迎互换添加）/ My Info for Link Exchange
              </div>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.7; color: #374151;">
                <tr>
                  <td style="width: 82px; color: #6b7280; vertical-align: top; padding: 3px 0;"> Website：</td>
                  <td style="color: #111827; font-weight: 500; padding: 3px 0;">imiles</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; vertical-align: top; padding: 3px 0;">URL：</td>
                  <td style="padding: 3px 0;">
                    <a href="${escapeHtml(siteUrl)}" target="_blank" style="color: #2563eb; text-decoration: none;">${escapeHtml(siteUrl)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="color: #6b7280; vertical-align: top; padding: 3px 0;">Logo：</td>
                  <td style="word-break: break-all; padding: 3px 0;">
                    <a href="${escapeHtml(logoUrl)}" target="_blank" style="color: #2563eb; text-decoration: none;">${escapeHtml(logoUrl)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="color: #6b7280; vertical-align: top; padding: 3px 0;">CN Bio：</td>
                  <td style="color: #4b5563; padding: 3px 0;">${escapeHtml(bioZh)}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; vertical-align: top; padding: 3px 0;">EN Bio：</td>
                  <td style="color: #4b5563; padding: 3px 0;">${escapeHtml(bioEn)}</td>
                </tr>
              </table>

              <!-- Markdown 快捷引用（无边框，极简柔和底色） -->
              <div style="margin-top: 16px;">
                <span style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 6px;">Markdown Snippet：</span>
                <pre style="margin: 0; padding: 12px 14px; background-color: #f3f4f6; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; line-height: 1.7; color: #1f2937; overflow-x: auto; white-space: pre-wrap; border: none;">[imiles](${escapeHtml(siteUrl)}) - ${escapeHtml(bioZh)}
[imiles](${escapeHtml(siteUrl)}) - ${escapeHtml(bioEn)}</pre>
              </div>
            </td>
          </tr>

          <!-- Footer 区域：极简一行 -->
          <tr>
            <td style="border-top: 1px solid #f3f4f6; margin-top: 28px; padding-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
              imiles.me · automated notification · no reply required
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
