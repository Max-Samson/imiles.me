import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import type { APIContext } from 'astro';
import sharp from 'sharp';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import type { CloudflareEnv } from '../../src/env.d';
import { generateEntityId } from '../../src/server/db/schema/common';
import { getServerEnv } from '../../src/server/env';
import { friendLinkRepository } from '../../src/server/friend-links/repository';
import { adminDetail, adminList, publicList, submit } from '../../src/server/friend-links/routes';
import { friendLinkService } from '../../src/server/friend-links/service';
import {
  type ValidatedImage as Screenshot,
  validateImage as validateScreenshot,
} from '../../src/server/media/images';
import { sha256 } from '../../src/server/security/hash';
import type { ObjectStorage } from '../../src/server/storage';
import type { WorkerBindings } from '../../src/worker-configuration';

let platform: PlatformProxy<WorkerBindings>;
let repo: ReturnType<typeof friendLinkRepository>;
before(async () => {
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
  const sql = readFileSync('drizzle/migrations/0000_friend_links.sql', 'utf8');
  for (const statement of sql.split('--> statement-breakpoint').filter((s) => s.trim()))
    await platform.env.DB.prepare(statement).run();
  repo = friendLinkRepository(platform.env);
});
after(async () => {
  await platform?.dispose();
});
function memoryImages() {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const images: ObjectStorage = {
    async put(key, image) {
      files.set(key, image.bytes);
    },
    async get(key) {
      const image = files.get(key);
      if (!image) throw new Error('missing');
      return image;
    },
    async remove(key) {
      files.delete(key);
    },
    async list() {
      return {
        objects: [...files.keys()].map((key) => ({ key, modified: Date.now() - 2 * 86400000 })),
      };
    },
  };
  return { files, images };
}
const input = (suffix: string, screenshot?: Screenshot) => ({
  url: `https://${suffix}.real-blog.net/`,
  description: '我的博客',
  email: 'private@real-blog.net',
  turnstileToken: 'token',
  screenshot,
});
const noVerify = async () => {};
function apiContext(request: Request, env: CloudflareEnv, params = {}): APIContext {
  return {
    request,
    url: new URL(request.url),
    locals: { runtime: { env } },
    params,
    clientAddress: '203.0.113.1',
  } as APIContext;
}

test('单表：幂等回执、公开字段隔离、审核并发、隐藏恢复', async () => {
  const { images } = memoryImages();
  const service = friendLinkService(repo, images);
  const key = crypto.randomUUID();
  let verifications = 0;
  const row = await service.submit(input('lifecycle'), key, async () => {
    verifications++;
  });
  assert.equal(row.created, true);
  const retry = await service.submit(input('lifecycle'), key, async () => {
    verifications++;
  });
  assert.equal(retry.id, row.id);
  assert.equal(retry.created, false);
  assert.equal(verifications, 1);
  await assert.rejects(
    service.submit({ ...input('lifecycle'), email: 'other@real-blog.net' }, key, noVerify),
    { code: 'CONFLICT' },
  );
  assert.equal(
    (await service.listPublished(1, 100)).items.some((v) => v.id === row.id),
    false,
  );
  const concurrent = await Promise.allSettled([
    repo.transition(row.id, 'approve', 1, 'owner'),
    repo.transition(row.id, 'approve', 1, 'owner'),
  ]);
  assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
  // 两次相同审批只有一次成功，结果不依赖请求执行顺序。
  const current = await repo.detail(row.id);
  assert.equal(current.status, 'active');
  const visible = (await service.listPublished(1, 100)).items.find((v) => v.id === row.id);
  assert.deepEqual(Object.keys(visible ?? {}).sort(), [
    'description',
    'id',
    'name',
    'screenshotUrl',
    'url',
  ]);
  const firstPublished = current.publishedAt;
  await repo.transition(row.id, 'hide', 2, 'owner');
  assert.equal(
    (await service.listPublished(1, 100)).items.some((v) => v.id === row.id),
    false,
  );
  await repo.transition(row.id, 'restore', 3, 'owner');
  assert.equal((await repo.detail(row.id)).publishedAt, firstPublished);
  assert.equal(
    (await service.submit(input('lifecycle'), key, noVerify)).message,
    '已收到，等待人工审核',
  );
});

test('待审同网址可重复，已收录/隐藏网址唯一且冲突不改变审核状态', async () => {
  const { images } = memoryImages();
  const service = friendLinkService(repo, images);
  const a = await service.submit(input('duplicate'), crypto.randomUUID(), noVerify);
  const b = await service.submit(input('duplicate'), crypto.randomUUID(), noVerify);
  await repo.transition(a.id, 'approve', 1, 'owner');
  await repo.transition(a.id, 'hide', 2, 'owner');
  await assert.rejects(repo.transition(b.id, 'approve', 1, 'owner'), { code: 'CONFLICT' });
  assert.equal((await repo.detail(b.id)).status, 'pending');
  await repo.transition(b.id, 'reject', 1, 'owner');
  await assert.rejects(repo.transition(b.id, 'approve', 2, 'owner'), { code: 'CONFLICT' });
});

test('数据库 CHECK 阻止无审核人直接发布和不完整图片元数据', async () => {
  const id = generateEntityId('fl');
  await assert.rejects(
    repo.insert({
      id,
      submittedUrl: 'https://a.net',
      canonicalUrl: 'https://a.net/',
      description: 'x',
      submissionKeyHash: id,
      submissionPayloadHash: id,
      status: 'active',
    }),
  );
  await assert.rejects(
    repo.insert({
      id,
      submittedUrl: 'https://a.net',
      canonicalUrl: 'https://a.net/',
      description: 'x',
      submissionKeyHash: id,
      submissionPayloadHash: id,
      screenshotKey: 'bad',
    }),
  );
});

test('图片审核门禁、摘要验证与拒绝/孤立对象清理', async () => {
  const bytes = new Uint8Array(
    await sharp({ create: { width: 16, height: 9, channels: 3, background: '#f00' } })
      .png()
      .toBuffer(),
  );
  const image = await validateScreenshot(bytes, 'image/png');
  const { images, files } = memoryImages();
  const service = friendLinkService(repo, images);
  const row = await service.submit(input('images', image), crypto.randomUUID(), noVerify);
  await assert.rejects(service.screenshot(row.id, false), { code: 'NOT_FOUND' });
  assert.equal((await service.screenshot(row.id, true)).headers.get('Cache-Control'), 'no-store');
  await repo.transition(row.id, 'approve', 1, 'owner');
  assert.equal((await service.screenshot(row.id, false)).status, 200);
  await repo.transition(row.id, 'hide', 2, 'owner');
  await assert.rejects(service.screenshot(row.id, false), { code: 'NOT_FOUND' });
  const rejected = await service.submit(
    input('reject-image', image),
    crypto.randomUUID(),
    noVerify,
  );
  await repo.transition(rejected.id, 'reject', 1, 'owner');
  await platform.env.DB.prepare('UPDATE friend_links SET reviewed_at = ? WHERE id = ?')
    .bind(Date.now() - 8 * 86400000, rejected.id)
    .run();
  files.set('orphan', bytes);
  const cleanup = await service.cleanup();
  assert.equal(cleanup.removed, 2);
  assert.equal(cleanup.detached, 1);
  assert.equal(files.size, 1); // hidden 图片仍保留
  assert.equal((await repo.detail(rejected.id)).screenshotKey, null);
  const preserved = (await repo.detail(row.id)).screenshotKey;
  assert.ok(preserved);
  files.set(preserved, new Uint8Array([1]));
  await assert.rejects(service.screenshot(row.id, true), { code: 'INTERNAL_SERVER_ERROR' });
});

test('S3 写入失败不落库；D1 结果不明确时不删除已上传对象', async () => {
  const bytes = new Uint8Array(
    await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
      .png()
      .toBuffer(),
  );
  const image = await validateScreenshot(bytes, 'image/png');
  const key = crypto.randomUUID();
  const { images, files } = memoryImages();
  await assert.rejects(
    friendLinkService(repo, {
      ...images,
      async put() {
        throw new Error('offline');
      },
    }).submit(input('s3-failed', image), key, noVerify),
  );
  assert.equal(await repo.bySubmissionKey(await sha256(key)), undefined);
  await assert.rejects(
    friendLinkService(
      {
        ...repo,
        async insert() {
          throw new Error('unknown commit');
        },
      },
      images,
    ).submit(input('d1-unknown', image), crypto.randomUUID(), noVerify),
  );
  assert.equal(files.size, 1);
});

test('并发同幂等键只插入一次申请，未使用的图片被清理', async () => {
  const bytes = new Uint8Array(
    await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
      .png()
      .toBuffer(),
  );
  const image = await validateScreenshot(bytes, 'image/png');
  const { images, files } = memoryImages();
  const key = crypto.randomUUID();
  const service = friendLinkService(repo, images);
  const results = await Promise.all([
    service.submit(input('parallel', image), key, noVerify),
    service.submit(input('parallel', image), key, noVerify),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(results.filter((r) => r.created).length, 1);
  assert.equal(files.size, 1);
});

test('HTTP：公开列表不泄露邮箱，后台无 JWT 拒绝，限流返回 Retry-After', async () => {
  const env: CloudflareEnv = {
    ...platform.env,
    ACCESS_ISSUER: 'https://imiles.cloudflareaccess.com',
    ACCESS_AUD: 'app',
    ADMIN_EMAILS: 'owner@real.net',
    SUBMISSION_HMAC_SECRET: 'a'.repeat(32),
  };
  const response = await publicList(
    apiContext(new Request('https://imiles.me/api/v1/friend-links'), env),
  );
  assert.equal(response.status, 200);
  assert.doesNotMatch(
    await response.text(),
    /private@|contactEmail|submissionKey|reviewedBy|screenshotKey/,
  );
  assert.equal(
    (await adminList(apiContext(new Request('https://imiles.me/api/v1/admin/friend-links'), env)))
      .status,
    401,
  );
  const blocked = new Request('https://imiles.me/api/v1/admin/friend-links/a', {
    method: 'PATCH',
    headers: { Origin: 'https://evil.net' },
  });
  assert.equal((await adminDetail(apiContext(blocked, env, { id: 'a' }))).status, 403);
  env.FRIEND_LINK_RATE_LIMITER = {
    async limit() {
      return { success: false };
    },
  };
  const limited = await submit(
    apiContext(
      new Request('https://imiles.me/api/v1/friend-link-applications', {
        method: 'POST',
        headers: { Origin: 'https://imiles.me' },
      }),
      env,
    ),
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(getServerEnv({ runtime: { env } } as Partial<App.Locals>).ACCESS_AUD, 'app');
});
