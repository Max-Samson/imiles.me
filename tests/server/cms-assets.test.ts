import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import sharp from 'sharp';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { cmsAssetService, readCmsImage } from '../../src/server/admin/cms/asset-service';
import { documentService } from '../../src/server/admin/cms/document-service';
import { snapshotRepository } from '../../src/server/admin/cms/repository';
import type { ObjectStorage } from '../../src/server/storage';
import type { WorkerBindings } from '../../src/worker-configuration';

let platform: PlatformProxy<WorkerBindings>;
before(async () => {
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
  for (const migration of [
    '0001_marvelous_ares.sql',
    '0002_modern_dragon_man.sql',
    '0003_yielding_sasquatch.sql',
  ]) {
    const sql = readFileSync(`drizzle/migrations/${migration}`, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').filter((part) => part.trim())) {
      await platform.env.DB.prepare(statement).run();
    }
  }
});
after(async () => platform?.dispose());

function upload(fields: [string, string | Blob][]) {
  const form = new FormData();
  for (const [key, value] of fields) form.append(key, value);
  return new Request('https://imiles.me/api/v1/admin/cms/drafts/cmd_test/assets', {
    method: 'POST',
    body: form,
  });
}

test('草稿图片上传只接收单张通过字节校验的图片', async () => {
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  const imageBytes = Uint8Array.from(bytes);
  const image = await readCmsImage(
    upload([['image', new Blob([imageBytes], { type: 'image/png' })]]),
  );
  assert.equal(image.mime, 'image/png');
  assert.equal(image.extension, 'png');
  assert.equal(image.bytes.length, bytes.length);
  await assert.rejects(readCmsImage(upload([['image', 'not a file']])), {
    code: 'VALIDATION_ERROR',
  });
  await assert.rejects(
    readCmsImage(
      upload([
        ['image', new Blob([imageBytes], { type: 'image/png' })],
        ['path', 'public/images/blog/overwrite.png'],
      ]),
    ),
    { code: 'VALIDATION_ERROR' },
  );
  await assert.rejects(
    readCmsImage(upload([['image', new Blob([imageBytes], { type: 'image/jpeg' })]])),
    { code: 'VALIDATION_ERROR' },
  );
});

test('草稿图片不得复用站点图片桶', () => {
  assert.throws(() => cmsAssetService({}), { code: 'CMS_MEDIA_NOT_CONFIGURED' });
  assert.throws(
    () =>
      cmsAssetService({
        CMS_DRAFT_STORAGE_BUCKET: 'public-images',
        SUPABASE_STORAGE_BUCKET: 'public-images',
      }),
    { code: 'CMS_MEDIA_NOT_CONFIGURED' },
  );
});

test('Blog 草稿图片只写私有存储与 D1，受保护预览核对字节', async () => {
  const objects = new Map<string, Uint8Array<ArrayBuffer>>();
  const storage: ObjectStorage = {
    async put(key, object) {
      objects.set(key, object.bytes);
    },
    async get(key) {
      return objects.get(key) ?? new Uint8Array();
    },
    async remove(key) {
      objects.delete(key);
    },
    async list() {
      return { objects: [] };
    },
  };
  const docs = documentService(platform.env, () => snapshotRepository({}));
  const draft = await docs.createDraft(
    {
      collection: 'blog',
      lang: 'en',
      slug: 'asset-test',
      source: '---\ntitle: Test\n---\nBody',
    },
    'user:test',
  );
  const bytes = Uint8Array.from(
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer(),
  );
  const service = cmsAssetService(platform.env, storage);
  const asset = await service.upload(
    draft.id,
    upload([['image', new Blob([bytes], { type: 'image/png' })]]),
    'user:test',
  );
  assert.equal(asset.status, 'staged');
  assert.match(asset.publicUrl, /^\/images\/blog\/cma_[a-f0-9]{32}\.png$/);
  assert.equal((await service.list(draft.id))[0].id, asset.id);
  assert.deepEqual(new Uint8Array(await (await service.preview(asset.id)).arrayBuffer()), bytes);
  const filename = asset.publicUrl.split('/').at(-1) as string;
  await assert.rejects(service.publicImage(filename), { code: 'NOT_FOUND' });
  assert.equal(
    await service.availableForPublication('cmd_other', `public${asset.publicUrl}`),
    undefined,
  );
  await service.publishReferenced(draft.id, [`public${asset.publicUrl}`]);
  assert.equal(
    (await service.availableForPublication('cmd_other', `public${asset.publicUrl}`))?.id,
    asset.id,
  );
  const response = await service.publicImage(filename);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  await assert.rejects(service.publicImage(`${filename}.bak`), { code: 'NOT_FOUND' });
  const [key] = objects.keys();
  objects.set(key, new Uint8Array(bytes.length));
  await assert.rejects(service.preview(asset.id));
  await assert.rejects(service.publicImage(filename));

  const story = await docs.createDraft(
    {
      collection: 'stories',
      lang: 'en',
      slug: 'asset-story-test',
      source: '---\ntitle: Test\n---\nBody',
    },
    'user:test',
  );
  await assert.rejects(
    service.upload(
      story.id,
      upload([['image', new Blob([bytes], { type: 'image/png' })]]),
      'user:test',
    ),
    { code: 'VALIDATION_ERROR' },
  );
});
