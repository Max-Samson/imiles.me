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
