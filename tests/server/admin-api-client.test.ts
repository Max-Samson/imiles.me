import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminApiRequest } from '../../src/lib/admin/api-client';

test('admin API client accepts JSON and always requests same-origin credentials', async () => {
  let received: RequestInit | undefined;
  const data = await adminApiRequest<{ ok: boolean }>(
    '/api/v1/admin/session',
    undefined,
    async (_input, init) => {
      received = init;
      return Response.json({ success: true, data: { ok: true } });
    },
  );
  assert.deepEqual(data, { ok: true });
  assert.equal(received?.credentials, 'same-origin');
  assert.equal(new Headers(received?.headers).get('Accept'), 'application/json');
});

test('admin API client treats redirects, HTML, 401, and 403 as identity failures', async () => {
  const cases: Array<{ response: Response; kind: string }> = [
    { response: new Response('', { status: 401 }), kind: 'session-expired' },
    { response: new Response('', { status: 403 }), kind: 'forbidden' },
    {
      response: new Response('<html>Access login</html>', {
        headers: { 'Content-Type': 'text/html' },
      }),
      kind: 'session-expired',
    },
  ];
  const redirected = Response.json({ success: true, data: {} });
  Object.defineProperty(redirected, 'redirected', { value: true });
  cases.push({ response: redirected, kind: 'session-expired' });

  for (const { response, kind } of cases) {
    await assert.rejects(
      adminApiRequest('/api/v1/admin/session', undefined, async () => response),
      (error: unknown) =>
        error instanceof Error && 'kind' in error && (error as { kind: string }).kind === kind,
    );
  }
});

test('admin API client sends versioned review as same-origin JSON PATCH', async () => {
  let received: RequestInit | undefined;
  await adminApiRequest(
    '/api/v1/admin/friend-links/fl_11111111111111111111111111111111',
    undefined,
    async (_input, init) => {
      received = init;
      return Response.json({ success: true, data: { id: 'fl_1', status: 'active', version: 2 } });
    },
    { method: 'PATCH', body: { action: 'approve', expectedVersion: 1 } },
  );
  assert.equal(received?.method, 'PATCH');
  assert.equal(received?.credentials, 'same-origin');
  assert.equal(new Headers(received?.headers).get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(String(received?.body)), { action: 'approve', expectedVersion: 1 });
});

test('admin API client sends image FormData without overriding multipart boundary', async () => {
  let received: RequestInit | undefined;
  const form = new FormData();
  form.set('image', new Blob(['image bytes'], { type: 'image/png' }));
  await adminApiRequest(
    '/api/v1/admin/cms/drafts/cmd_test/assets',
    undefined,
    async (_input, init) => {
      received = init;
      return Response.json({ success: true, data: { id: 'cma_test' } });
    },
    { method: 'POST', body: form },
  );
  assert.equal(received?.credentials, 'same-origin');
  assert.equal(new Headers(received?.headers).has('Content-Type'), false);
  assert.equal(received?.body, form);
});
