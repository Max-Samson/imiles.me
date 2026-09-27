import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminApiRequest } from '../../src/lib/admin/api-client';
import { createResendClient } from '../../src/server/email/client';
import { createEmailService } from '../../src/server/email/service';
import { renderAdminNewApplicationEmail } from '../../src/server/email/templates/admin-new-application';
import { renderFriendLinkApprovedEmail } from '../../src/server/email/templates/friend-link-approved';
import { notifySchema, reviewSchema } from '../../src/server/friend-links/validation';

test('邮件模板：友链审批通过模板渲染 HTML、纯文本及站长附言', () => {
  const result = renderFriendLinkApprovedEmail({
    applicantName: '张三 <test>',
    applicantUrl: 'https://zhangsan.blog/',
    siteUrl: 'https://imiles.me',
    customMessage: '欢迎互换友链！祝博客越办越好。<script>',
  });

  assert.equal(
    result.subject,
    '【imiles.me】Friend Link Application Approved | 友情链接申请已通过审批',
  );
  assert.ok(result.text.includes('张三 <test>'));
  assert.ok(result.text.includes('https://zhangsan.blog/'));
  assert.ok(result.text.includes('https://imiles.me/friends'));
  assert.ok(result.text.includes('欢迎互换友链！'));
  assert.ok(result.text.includes('https://imiles.me/images/weblogo.jpeg'));

  // HTML 应转义特殊字符
  assert.ok(result.html.includes('&lt;test&gt;'));
  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(!result.html.includes('<script>'));
  assert.ok(result.html.includes('https://imiles.me/friends'));
});

test('邮件模板：管理员新友链申请通知模板正确渲染各项字段', () => {
  const result = renderAdminNewApplicationEmail({
    applicantName: '李四',
    applicantUrl: 'https://lisi.dev/',
    applicantEmail: 'lisi@lisi.dev',
    description: '专注于 Rust 和 WebAssembly 开发',
    detailUrl: 'https://imiles.me/admin/friend-links/fl_123',
  });

  assert.equal(result.subject, '【友链审核待处理】来自 李四 的友链申请');
  assert.ok(result.text.includes('李四'));
  assert.ok(result.text.includes('https://lisi.dev/'));
  assert.ok(result.text.includes('lisi@lisi.dev'));
  assert.ok(result.text.includes('https://imiles.me/admin/friend-links/fl_123'));
  assert.ok(result.html.includes('https://lisi.dev/'));
  assert.ok(result.html.includes('专注于 Rust 和 WebAssembly 开发'));
});

test('Resend 客户端：请求头、体格式校验及成功/错误模拟', async () => {
  // 1. 未配置 API 密钥时静默跳过发信
  const unconfiguredClient = createResendClient({
    apiKey: '',
    defaultFrom: 'imiles <noreply@imiles.me>',
  });
  const unconfiguredRes = await unconfiguredClient.send({
    to: 'test@example.com',
    subject: 'test',
    html: '<p>test</p>',
  });
  assert.equal(unconfiguredRes.success, false);
  assert.ok(unconfiguredRes.error?.includes('未配置'));

  // 2. 空收件人保护
  const clientWithEmptyTo = createResendClient({
    apiKey: 're_test_key',
    defaultFrom: 'imiles <noreply@imiles.me>',
  });
  const emptyToRes = await clientWithEmptyTo.send({
    to: [],
    subject: 'test',
    html: '<p>test</p>',
  });
  assert.equal(emptyToRes.success, false);
  assert.ok(emptyToRes.error?.includes('收件人'));

  // 3. 模拟 Resend API 200 成功响应
  let capturedUrl = '';
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody: string | undefined;

  const mockSuccessFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = input.toString();
    capturedHeaders = init?.headers;
    capturedBody = init?.body as string;
    return new Response(JSON.stringify({ id: 'msg_123456' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const validClient = createResendClient({
    apiKey: 're_mock_123',
    defaultFrom: 'imiles <noreply@imiles.me>',
    fetchFn: mockSuccessFetch,
  });

  const sendResult = await validClient.send({
    to: 'friend@example.com',
    subject: '审批通过',
    html: '<p>祝贺！</p>',
    text: '祝贺！',
  });

  assert.equal(sendResult.success, true);
  assert.equal(sendResult.id, 'msg_123456');
  assert.equal(capturedUrl, 'https://api.resend.com/emails');

  const headers = new Headers(capturedHeaders);
  assert.equal(headers.get('Authorization'), 'Bearer re_mock_123');
  assert.equal(headers.get('Content-Type'), 'application/json');

  const parsedBody = JSON.parse(capturedBody || '{}') as {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  };
  assert.equal(parsedBody.from, 'imiles <noreply@imiles.me>');
  assert.deepEqual(parsedBody.to, ['friend@example.com']);
  assert.equal(parsedBody.subject, '审批通过');

  // 4. 模拟 Resend API 422 业务错误响应
  const mockErrorFetch = (async () => {
    return new Response(
      JSON.stringify({
        statusCode: 422,
        name: 'validation_error',
        message: 'The domain is not verified',
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const errorClient = createResendClient({
    apiKey: 're_mock_123',
    defaultFrom: 'imiles <noreply@imiles.me>',
    fetchFn: mockErrorFetch,
  });

  const errRes = await errorClient.send({
    to: 'friend@example.com',
    subject: '测试错误',
    html: '<p>测试</p>',
  });
  assert.equal(errRes.success, false);
  assert.ok(errRes.error?.includes('The domain is not verified'));
});

test('邮件领域服务：根据环境装配及未配置跳过策略', async () => {
  // 未配置环境
  const unconfiguredService = createEmailService({});
  assert.equal(unconfiguredService.isConfigured(), false);
  const skipApproval = await unconfiguredService.sendFriendLinkApproved('a@b.com', {
    applicantUrl: 'https://b.com',
  });
  assert.equal(skipApproval.success, false);
  assert.ok(skipApproval.error?.includes('跳过'));

  // 配置环境正常发信
  let sent = false;
  const mockFetch = (async () => {
    sent = true;
    return new Response(JSON.stringify({ id: 'msg_888' }), { status: 200 });
  }) as typeof fetch;

  const configuredService = createEmailService(
    {
      RESEND_API_KEY: 're_test',
      ADMIN_EMAILS: 'admin@imiles.me',
      SITE_URL: 'https://imiles.me',
    },
    mockFetch,
  );

  assert.equal(configuredService.isConfigured(), true);
  const approvalRes = await configuredService.sendFriendLinkApproved('friend@test.com', {
    applicantName: '小明',
    applicantUrl: 'https://xiaoming.blog',
  });
  assert.equal(approvalRes.success, true);
  assert.equal(approvalRes.id, 'msg_888');
  assert.equal(sent, true);

  // 管理员新申请通知发信
  const adminRes = await configuredService.sendAdminNewApplication({
    applicantName: '小红',
    applicantUrl: 'https://xiaohong.blog',
    applicantEmail: 'xiaohong@test.com',
    description: '技术杂谈',
    detailUrl: 'https://imiles.me/admin/friend-links/fl_999',
  });
  assert.equal(adminRes.success, true);
});

test('校验与请求契约：审核与手动通知 Schema 及 POST API 客户端请求', async () => {
  // 1. reviewSchema 允许附带 notifyApplicant 与 customMessage
  const parsedReview = reviewSchema.parse({
    action: 'approve',
    expectedVersion: 1,
    notifyApplicant: true,
    customMessage: '欢迎互换友链！',
  });
  assert.equal(parsedReview.notifyApplicant, true);
  assert.equal(parsedReview.customMessage, '欢迎互换友链！');

  // 未提供参数时默认通过校验
  const defaultReview = reviewSchema.parse({
    action: 'approve',
    expectedVersion: 2,
  });
  assert.equal(defaultReview.notifyApplicant, undefined);
  assert.equal(defaultReview.customMessage, undefined);

  // 严格校验阻止未知参数
  assert.throws(() =>
    reviewSchema.parse({
      action: 'approve',
      expectedVersion: 1,
      unknownProp: true,
    }),
  );

  // 2. notifySchema 校验
  const parsedNotify = notifySchema.parse({ customMessage: '你好' });
  assert.equal(parsedNotify.customMessage, '你好');
  assert.deepEqual(notifySchema.parse({}), {});

  // 3. adminApiRequest 支持 POST 请求与自定义请求体
  let sentMethod = '';
  let sentBody = '';
  await adminApiRequest(
    '/api/v1/admin/friend-links/fl_123/notify',
    undefined,
    async (_url, init) => {
      sentMethod = init?.method ?? '';
      sentBody = String(init?.body);
      return Response.json({ success: true, data: { sent: true } });
    },
    { method: 'POST', body: { customMessage: '手动通知' } },
  );

  assert.equal(sentMethod, 'POST');
  assert.deepEqual(JSON.parse(sentBody), { customMessage: '手动通知' });
});
