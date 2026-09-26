import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { readSubmission } from '../../src/server/friend-links/upload';
import { canonicalizeUrl, parseListQuery } from '../../src/server/friend-links/validation';
import { validateImage as validateScreenshot } from '../../src/server/media/images';

test('图片格式/大小检查拒绝伪造、截断、动画、SVG、尺寸过大', async () => {
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const bytes = new Uint8Array(
      await sharp({ create: { width: 16, height: 9, channels: 3, background: '#fff' } })
        [format]()
        .toBuffer(),
    );
    assert.equal((await validateScreenshot(bytes, `image/${format}`)).mime, `image/${format}`);
    await assert.rejects(validateScreenshot(bytes.slice(0, -1), `image/${format}`));
    await assert.rejects(validateScreenshot(bytes, 'image/gif'));
  }
  await assert.rejects(validateScreenshot(new TextEncoder().encode('<svg/>'), 'image/svg+xml'));
  await assert.rejects(validateScreenshot(new Uint8Array(2097153), 'image/png'), {
    statusCode: 413,
  });
  const large = new Uint8Array(
    await sharp({ create: { width: 4097, height: 1, channels: 3, background: '#fff' } })
      .png()
      .toBuffer(),
  );
  await assert.rejects(validateScreenshot(large, 'image/png'));
  const animated = new Uint8Array(30);
  animated.set(new TextEncoder().encode('RIFF'), 0);
  new DataView(animated.buffer).setUint32(4, 22, true);
  animated.set(new TextEncoder().encode('WEBPVP8X'), 8);
  new DataView(animated.buffer).setUint32(16, 10, true);
  animated[20] = 2;
  await assert.rejects(validateScreenshot(animated, 'image/webp'));
});

test('multipart 有界读取，拒绝重复、未知字段和非法网站链接', async () => {
  const form = new FormData();
  form.set('url', 'https://blog.real.net/');
  form.set('description', 'hello');
  form.set('email', 'a@b.net');
  form.set('turnstileToken', 'x');
  form.set('name', 'Dillion');
  const sub = await readSubmission(
    new Request('https://imiles.me', { method: 'POST', body: form }),
  );
  assert.equal(sub.email, 'a@b.net');
  assert.equal(sub.name, 'Dillion');
  form.set('name', 'a'.repeat(51));
  await assert.rejects(
    readSubmission(new Request('https://imiles.me', { method: 'POST', body: form })),
  );
  form.delete('name');
  form.append('email', 'other@b.net');
  await assert.rejects(
    readSubmission(new Request('https://imiles.me', { method: 'POST', body: form })),
  );
  form.delete('email');
  form.set('email', 'a@b.net');
  form.set('status', 'active');
  await assert.rejects(
    readSubmission(new Request('https://imiles.me', { method: 'POST', body: form })),
  );
  await assert.rejects(
    readSubmission(
      new Request('https://imiles.me', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
        body: new Uint8Array(3 * 1024 * 1024 + 1),
      }),
    ),
    { statusCode: 413 },
  );
  for (const url of [
    'http://a.net',
    'https://127.0.0.1',
    'https://0x7f000001',
    'https://[::1]',
    'https://a.local',
    'https://a.net/?a=1',
    'https://u:p@a.net',
    'https://a.net:8443',
  ])
    assert.throws(() => canonicalizeUrl(url));
  assert.equal(canonicalizeUrl('https://BLOG.real.net:443/Path/'), 'https://blog.real.net/Path');
  assert.throws(() => parseListQuery(new URL('https://imiles.me?page=1&page=2')));
  assert.throws(() => parseListQuery(new URL('https://imiles.me?status=pending')));
});
