import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createContext } from 'astro/middleware';
import { z } from 'astro/zod';
import {
  AppError,
  handleApiError,
  InternalServerError,
  ValidationError,
} from '../../src/server/errors';
import { checkEtagMatch, withCache } from '../../src/server/rest/cache';
import { createRestContext } from '../../src/server/rest/context';
import { handleCors, withCors } from '../../src/server/rest/cors';
import { defineRestRoute } from '../../src/server/rest/handler';
import { parseRestQuery } from '../../src/server/rest/query';
import { readJsonBody } from '../../src/server/rest/validation';
import { jsonNotModified, jsonSuccess } from '../../src/server/types';

function context(method = 'GET', headers: HeadersInit = {}) {
  // 故意不提供 Worker runtime，以验证本地/SSG 上下文的降级行为。
  return createContext({
    request: new Request('https://imiles.me/api/test', { method, headers }),
    defaultLocale: 'en',
    locals: {} as App.Locals,
  });
}

test('内部异常响应不泄漏 SQL、details 或堆栈，日志与响应关联 requestId', async () => {
  const log = mock.method(console, 'error', () => {});
  try {
    for (const error of [
      new InternalServerError('secret SQL', { secret: 'token' }),
      new Error('private path'),
      'secret',
      new AppError('secret', 503, 'PRIVATE_CODE'),
    ]) {
      const response = handleApiError(error, { headers: { 'X-Request-Id': 'test-request' } });
      assert.equal(response.status, 500);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.meta.requestId, 'test-request');
      assert.deepEqual(body.error, {
        code: 'INTERNAL_SERVER_ERROR',
        message: '服务暂时不可用，请稍后重试',
      });
    }
    assert.equal(log.mock.callCount(), 4);
  } finally {
    log.mock.restore();
  }
});

test('Zod 错误映射到字段级 400，伪造的 ZodError 不会破坏错误出口', async () => {
  const parsed = z.object({ count: z.number().positive() }).safeParse({ count: -1 });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const response = handleApiError(parsed.error);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.details[0].field, 'count');
  }
  const log = mock.method(console, 'error', () => {});
  try {
    assert.equal(handleApiError({ name: 'ZodError', issues: [null] }).status, 500);
  } finally {
    log.mock.restore();
  }
});

test('凭据 CORS 必须有白名单，缓存按 Origin 隔离且保留既有 Vary', () => {
  const request = new Request('https://imiles.me', {
    headers: { Origin: 'https://reader.example' },
  });
  assert.throws(() => withCors(new Response(), request, { credentials: true }), TypeError);
  const response = withCors(new Response(null, { headers: { Vary: 'Accept-Encoding' } }), request, {
    origin: ['https://reader.example'],
    credentials: true,
  });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://reader.example');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  assert.equal(response.headers.get('Vary'), 'Accept-Encoding, Origin');
  const denied = withCors(response, request, { origin: 'https://other.example' });
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(denied.headers.get('Access-Control-Allow-Credentials'), null);
  const opaque = withCors(
    new Response(),
    new Request('https://imiles.me', { headers: { Origin: 'null' } }),
  );
  assert.equal(opaque.headers.get('Access-Control-Allow-Origin'), null);
});

test('预检检查实际方法、请求头及白名单', () => {
  const preflight = (method: string, header = 'Content-Type', origin = 'https://reader.example') =>
    new Request('https://imiles.me', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': header,
      },
    });
  const options = { origin: 'https://reader.example', methods: ['GET'] };
  assert.equal(handleCors(preflight('GET'), options)?.status, 204);
  assert.equal(handleCors(preflight('DELETE'), options)?.status, 403);
  assert.equal(handleCors(preflight('GET', 'X-Secret'), options)?.status, 403);
  assert.equal(
    handleCors(preflight('GET', 'Content-Type', 'https://evil.example'), options)?.status,
    403,
  );
});

test('路由封装统一 HEAD、OPTIONS、405、异常 CORS、请求 ID 与缓存策略', async () => {
  const route = defineRestRoute(
    {
      GET: () => jsonSuccess({ ok: true }),
      POST: () => {
        throw new ValidationError('invalid');
      },
    },
    { cors: { origin: 'https://reader.example' } },
  );
  const headers = { Origin: 'https://reader.example', 'X-Request-Id': 'untrusted-id' };
  const get = await route(context('GET', headers));
  assert.equal(get.status, 200);
  assert.match(get.headers.get('X-Request-Id') ?? '', /^req_/);
  assert.equal(get.headers.get('Cache-Control'), 'no-store');
  const head = await route(context('HEAD', headers));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const options = await route(context('OPTIONS', headers));
  assert.equal(options.status, 204);
  const missing = await route(context('DELETE', headers));
  assert.equal(missing.status, 405);
  assert.equal(missing.headers.get('Allow'), 'GET, POST, HEAD, OPTIONS');
  const failed = await route(context('POST', headers));
  assert.equal(failed.status, 400);
  assert.equal(failed.headers.get('Access-Control-Allow-Origin'), 'https://reader.example');
  assert.equal((await failed.json()).meta.requestId, failed.headers.get('X-Request-Id'));
});

test('HEAD 错误分支也没有实体，显式公开 GET 缓存被保留', async () => {
  const onlyPost = defineRestRoute({ POST: () => jsonSuccess({}) });
  const head = await onlyPost(context('HEAD'));
  assert.equal(head.status, 405);
  assert.equal(await head.text(), '');
  const publicRoute = defineRestRoute({
    GET: () => withCache(jsonSuccess({}), { public: true, maxAge: 10 }),
  });
  assert.equal((await publicRoute(context())).headers.get('Cache-Control'), 'public, max-age=10');
});

test('本地 defer 等待完成，Worker defer 使用绑定后的 waitUntil', async () => {
  let completed = false;
  await createRestContext(context()).defer(async () => {
    completed = true;
  });
  assert.equal(completed, true);
  const tasks: Promise<unknown>[] = [];
  const execution = {
    waitUntil(promise: Promise<unknown>) {
      assert.equal(this, execution);
      tasks.push(promise);
    },
  };
  const routeContext = context();
  Object.defineProperty(routeContext.locals, 'runtime', { value: { env: {}, ctx: execution } });
  await createRestContext(routeContext).defer(async () => {
    completed = false;
  });
  await Promise.all(tasks);
  assert.equal(tasks.length, 1);
  assert.equal(completed, false);
});

test('分页拒绝溢出、部分数字、重复字段、未实现的 cursor 以及未授权字段', () => {
  for (const query of [
    `page=${'9'.repeat(308)}`,
    'page=2x',
    'page=-1',
    'page=1.2',
    'page=0',
    'page=1&page=2',
    'cursor=secret',
    'offset=20',
    'pageSize=10&limit=20',
    'fields=password',
    'filter[__proto__]=x',
    'sort=secret',
    'status=active',
    'sort=createdAt:down',
  ]) {
    assert.throws(() => parseRestQuery(query), ValidationError, query);
  }
  const parsed = parseRestQuery(
    'page=2&pageSize=999&sort=-createdAt&filter[status]=active&fields=id,title',
    { allowedFilterFields: ['status'], allowedFields: ['id', 'title'] },
  );
  assert.equal(parsed.pageSize, 100);
  assert.equal(parsed.offset, 100);
  assert.deepEqual(parsed.fields, ['id', 'title']);
  assert.deepEqual(parsed.filters, { status: 'active' });
  assert.throws(() => parseRestQuery('', { maxPageSize: 0 }), TypeError);
});

test('强弱 ETag、列表内逗号、304 格式与缓存时长校验', () => {
  const request = (value: string) =>
    new Request('https://imiles.me', { headers: { 'If-None-Match': value } });
  assert.equal(checkEtagMatch(request('W/"abc"'), 'abc'), true);
  assert.equal(checkEtagMatch(request('"other", W/"a,b"'), 'a,b'), true);
  assert.equal(checkEtagMatch(request('*'), 'abc'), true);
  assert.equal(checkEtagMatch(request('"other"'), 'abc'), false);
  assert.equal(checkEtagMatch(request('prefix"abc"'), 'abc'), false);
  assert.equal(withCache(new Response(), { etag: 'W/"abc"' }).headers.get('etag'), 'W/"abc"');
  assert.equal(jsonNotModified('W/"abc"').headers.get('etag'), 'W/"abc"');
  assert.throws(() => withCache(new Response(), { maxAge: -1 }), TypeError);
  assert.throws(() => withCache(new Response(), { sMaxAge: 10 }), TypeError);
});

test('JSON 校验覆盖格式错误、类型错误、415 和超长实际流', async () => {
  const schema = z.object({ title: z.string() });
  const request = (body: string, type = 'application/json') =>
    new Request('https://imiles.me', { method: 'POST', body, headers: { 'Content-Type': type } });
  assert.deepEqual(await readJsonBody(request('{"title":"ok"}'), schema), { title: 'ok' });
  await assert.rejects(readJsonBody(request('{'), schema), ValidationError);
  await assert.rejects(readJsonBody(request('{"title":1}'), schema), z.ZodError);
  await assert.rejects(readJsonBody(request('{}', 'text/plain'), schema), { statusCode: 415 });
  await assert.rejects(readJsonBody(request('{"title":"long"}'), schema, 5), { statusCode: 413 });
});
