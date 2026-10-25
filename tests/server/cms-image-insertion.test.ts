import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import sharp from 'sharp';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import {
  createImageRequestGate,
  isInsertableImageUrl,
  validateArticleImageFile,
} from '../../src/lib/admin/image-insertion';
import {
  cmsImagePreviewUrl,
  getSourceImages,
  isSafeImagePreviewUrl,
} from '../../src/lib/content-images';
import { cmsAssetService } from '../../src/server/admin/cms/asset-service';
import { documentService } from '../../src/server/admin/cms/document-service';
import { publicationService } from '../../src/server/admin/cms/publication-service';
import { preparePublication } from '../../src/server/admin/cms/publication-validation';
import { d1Repository } from '../../src/server/admin/cms/repository';
import type { CmsDraft } from '../../src/server/db/schema/cms';
import type { ObjectStorage } from '../../src/server/storage';
import type { WorkerBindings } from '../../src/worker-configuration';

const frontmatter =
  '---\ntitle: 测试\ndescription: 摘要\npubDate: 2026-10-25\ntags: [blog]\nlang: zh\n---\n\n';
function sample(body: string, format: 'md' | 'mdx' = 'md'): CmsDraft {
  const source = frontmatter + body;
  return {
    id: 'cmd_test',
    collection: 'blog',
    format,
    lang: 'zh',
    slug: 'test',
    targetPath: `content/blog/test-zh.${format}`,
    publicPath: '/zh/blog/test',
    source,
    sourceHash: 'test',
    sourceBytes: new TextEncoder().encode(source).length,
    baseBlobSha: null,
    revision: 1,
    status: 'active',
    titleCache: '测试',
    createdBy: 'user:test',
    updatedBy: 'user:test',
    createdAt: 0,
    updatedAt: 0,
    closedAt: null,
    publishedCommitSha: null,
  };
}

test('源码预览统一识别普通、引用式及缩放 HTML 图片，并忽略代码与注释', () => {
  const source =
    '![中文](/images/a.png)\n\n![引用][pic]\n\n[pic]: /images/b.jpg "标题"\n\n<img src="/images/c.webp" width="200" alt="a > b" />\n\n<!-- <img src="/images/hidden.png"> -->\n\n```html\n<img src="/images/code.png">\n```';
  const result = getSourceImages(source, false);
  assert.deepEqual(
    result.images.map((i) => i.url),
    ['/images/a.png', '/images/b.jpg', '/images/c.webp'],
  );
  assert.equal(result.images[2].alt, 'a > b');
  assert.deepEqual(result.issues, []);
  assert.equal(
    getSourceImages('![a](/images/a.png)\n\n![b](/images/a.png)', false).images.length,
    1,
  );
});

test('源码半个 JSX 不阻止已有图片预览；静态 JSX 和实体属性安全解析', () => {
  assert.equal(
    getSourceImages('![a](/images/a.png)\n\n<Broken', true).images[0]?.url,
    '/images/a.png',
  );
  assert.deepEqual(
    getSourceImages('<img src="/images/a.png" width="240" />', true).images.map((i) => i.url),
    ['/images/a.png'],
  );
  assert.equal(
    getSourceImages('<img src="/images/a&#x2e;png" alt="a &amp; b">', false).images[0]?.url,
    '/images/a.png',
  );
  assert.equal(getSourceImages('<img src={dynamic} />', true).images.length, 0);
});

test('图片请求取消、切换文稿和后续请求使旧上传结果失效', () => {
  const gate = createImageRequestGate();
  const first = gate.begin('one');
  assert.equal(gate.isCurrent(first, 'one'), true);
  assert.equal(gate.isCurrent(first, 'two'), false);
  gate.cancel();
  assert.equal(gate.isCurrent(first, 'one'), false);
  const second = gate.begin('one');
  const third = gate.begin('one');
  assert.equal(gate.isCurrent(second, 'one'), false);
  assert.equal(gate.isCurrent(third, 'one'), true);
});

test('图片客户端限制与预览 URL 不改变持久化路径，也不接受脚本地址', () => {
  const path = `/images/blog/cma_${'a'.repeat(32)}.jpg`;
  assert.equal(cmsImagePreviewUrl(path), `/api/v1/admin/cms/assets/cma_${'a'.repeat(32)}/preview`);
  assert.equal(cmsImagePreviewUrl(`public${path}`), cmsImagePreviewUrl(path));
  assert.equal(cmsImagePreviewUrl('/images/logo.png'), null);
  for (const url of [
    'javascript:alert(1)',
    '//evil.test/a.png',
    '/images/../a.png',
    '/images/a.png?secret=1',
    '/images/a.png\n',
  ]) {
    assert.equal(isInsertableImageUrl(url), false);
  }
  assert.equal(isSafeImagePreviewUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImagePreviewUrl('//evil.test/a.png'), false);
  assert.equal(isInsertableImageUrl(path), true);
  assert.doesNotThrow(() => validateArticleImageFile({ type: 'image/jpeg', size: 1024 }));
  for (const file of [
    { type: 'image/svg+xml', size: 10 },
    { type: 'image/png', size: 0 },
    { type: 'image/jpeg', size: 2097153 },
  ]) {
    assert.throws(() => validateArticleImageFile(file));
  }
});

test('发布资源集合包含引用式、HTML 和静态 JSX 图片，不漏掉缩放图', () => {
  const markdown = preparePublication(
    sample(
      '![图][a]\n\n[a]: /images/a.png\n\n<img src="/images/b.jpg" width="100" height="100" />',
    ),
  );
  assert.deepEqual(markdown.assetPaths, ['public/images/a.png', 'public/images/b.jpg']);
  const mdx = preparePublication(sample('<img src="/images/c.webp" width="200" />', 'mdx'));
  assert.deepEqual(mdx.assetPaths, ['public/images/c.webp']);
});

test('发布拒绝不可静态确定、外部新图与重复 src，不能绕过资源归属检查', () => {
  for (const draft of [
    sample('<img src={dynamic} />', 'mdx'),
    sample('<img src="/images/a.png" src="/images/b.png" />', 'mdx'),
    sample('<img src="/images/a.png" {...props} />', 'mdx'),
    sample('<img src="https://other.test/a.jpg" width="100">'),
    sample('<img src="/images/a.png" src="/images/b.png">'),
  ])
    assert.throws(() => preparePublication(draft));
});

let platform: PlatformProxy<WorkerBindings>;
before(async () => {
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
  for (const name of [
    '0001_marvelous_ares.sql',
    '0002_modern_dragon_man.sql',
    '0003_yielding_sasquatch.sql',
    '0004_shiny_makkari.sql',
    '0005_cms_document_history.sql',
  ]) {
    for (const sql of readFileSync(`drizzle/migrations/${name}`, 'utf8')
      .split('--> statement-breakpoint')
      .filter((p) => p.trim())) {
      await platform.env.DB.prepare(sql).run();
    }
  }
});
after(async () => platform?.dispose());

test('真实本地 D1：缩放图上传→保存→发布→公开读取，图片元数据随文章一起开放', async () => {
  for (const format of ['md', 'mdx'] as const) {
    const bytes = Uint8Array.from(
      await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
        .png()
        .toBuffer(),
    );
    const objects = new Map<string, Uint8Array<ArrayBuffer>>();
    const storage: ObjectStorage = {
      async put(key, value) {
        objects.set(key, value.bytes);
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
    const repo = d1Repository(platform.env);
    const docs = documentService(platform.env, () => repo);
    const draft = await docs.createDraft(
      {
        collection: 'blog',
        lang: 'zh',
        format,
        slug: `image-publish-${format}`,
        source: frontmatter + '原正文',
      },
      'user:test',
    );
    const form = new FormData();
    form.set('image', new Blob([bytes], { type: 'image/png' }));
    const service = cmsAssetService(platform.env, storage);
    const asset = await service.upload(
      draft.id,
      new Request('http://localhost/assets', { method: 'POST', body: form }),
      'user:test',
    );
    const source =
      frontmatter + `原正文\n\n<img src="${asset.publicUrl}" width="200" alt="测试图" />\n`;
    const saved = await docs.saveDraft(draft.id, draft.revision, source, 'user:test');
    const result = await publicationService(platform.env, repo).publish(
      saved.id,
      saved.revision,
      crypto.randomUUID(),
      'user:test',
    );
    assert.equal(result.status, 'committed');
    assert.equal((await service.list(draft.id))[0].status, 'committed');
    const response = await service.publicImage(asset.publicUrl.split('/').at(-1) as string);
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.match((await repo.readVersion(draft.targetPath)).content, /<img/);
  }
});
