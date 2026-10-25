import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import type { APIContext } from 'astro';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import {
  historyLabel,
  publicationBackend,
  publicationLabel,
  safePublicPath,
} from '../../packages/pageel-workbench/integration/status-model';
import type { CloudflareEnv } from '../../src/env.d';
import { documentService } from '../../src/server/admin/cms/document-service';
import { draftRepository } from '../../src/server/admin/cms/draft-repository';
import { historyRepository } from '../../src/server/admin/cms/history-repository';
import {
  cmsHistoryListRoute,
  cmsHistorySnapshotRoute,
} from '../../src/server/admin/cms/history-routes';
import { historyService } from '../../src/server/admin/cms/history-service';
import { publicationRepository } from '../../src/server/admin/cms/publication-repository';
import { publicationService } from '../../src/server/admin/cms/publication-service';
import { snapshotRepository } from '../../src/server/admin/cms/repository';
import type { CmsHistoryItem, CmsHistoryPage } from '../../src/shared/admin/cms-history';
import type { WorkerBindings } from '../../src/worker-configuration';

let platform: PlatformProxy<WorkerBindings>;
const legacyPath = 'content/blog/history-legacy-zh.mdx';
const legacyId = `cmd_${'a'.repeat(32)}`;
const legacyOperation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const source = '---\ntitle: "历史测试"\n---\n\n原文';
before(async () => {
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
  const migrate = async (name: string) => {
    for (const statement of readFileSync(`drizzle/migrations/${name}`, 'utf8')
      .split('--> statement-breakpoint')
      .filter((part) => part.trim()))
      await platform.env.DB.prepare(statement).run();
  };
  await migrate('0001_marvelous_ares.sql');
  await migrate('0002_modern_dragon_man.sql');
  // 模拟升级前就有的业务记录，验证加法迁移保留数据且不伪造旧修订。
  await platform.env.DB.prepare(
    `INSERT INTO cms_drafts (id,collection,format,lang,slug,target_path,public_path,source,source_hash,source_bytes,created_by,updated_by,created_at,updated_at) VALUES (?, 'blog','mdx','zh','history-legacy',?,'/zh/blog/history-legacy',?,'legacy-hash',1,'test','test',1000,1000)`,
  )
    .bind(legacyId, legacyPath, source)
    .run();
  await platform.env.DB.prepare(
    `INSERT INTO cms_publication_attempts (operation_id,draft_id,draft_revision,request_hash,source_hash,source_bytes,target_path,public_path,status,created_by,created_at,updated_at) VALUES (?,?,1,'test','test',1,?,'/zh/blog/history-legacy','failed','test',1000,1000)`,
  )
    .bind(legacyOperation, legacyId, legacyPath)
    .run();
  await migrate('0005_cms_document_history.sql');
});
after(async () => platform?.dispose());
const drafts = () => documentService(platform.env, () => snapshotRepository({}));
const history = () => historyService(historyRepository(platform.env));
const create = (slug: string) =>
  drafts().createDraft({ collection: 'blog', lang: 'zh', slug, source }, 'user:test');

test('旧记录迁移后保留，未知通道/缺失快照不被猜测或补造', async () => {
  const page = await history().list({ path: legacyPath });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].canViewSnapshot, false);
  assert.equal(page.items[0].publication?.backend, null);
  const oldPublication = page.items[0].publication;
  assert.ok(oldPublication);
  assert.equal(publicationBackend(oldPublication), 'unknown');
  assert.equal((await drafts().getDraft(legacyId)).source, source);
  await assert.rejects(history().snapshot(legacyPath, `publication:${legacyOperation}`), {
    code: 'NOT_FOUND',
  });
});

test('每次保存留不可变快照，旧窗口冲突和失败批处理均不产生幽灵修订', async () => {
  const draft = await create('history-save');
  const updated = await drafts().saveDraft(draft.id, 1, `${source}\n第二版`, 'user:test');
  await assert.rejects(drafts().saveDraft(draft.id, 1, '旧窗口覆盖', 'user:test'), {
    code: 'CONFLICT',
  });
  const repo = draftRepository(platform.env);
  await assert.rejects(
    repo.save(draft.id, 2, {
      source: '非法字节数',
      sourceHash: 'test',
      sourceBytes: 0,
      titleCache: null,
      updatedBy: 'user:test',
    }),
  );
  assert.equal((await repo.get(draft.id)).revision, 2);
  assert.equal((await repo.get(draft.id)).source, updated.source);
  // 测试专用触发器让第二条 UPDATE 失败，证明此前插入的快照同样回滚。
  await platform.env.DB.prepare(
    `CREATE TRIGGER test_reject_draft_update BEFORE UPDATE ON cms_drafts WHEN NEW.id = '${draft.id}' BEGIN SELECT RAISE(ABORT, 'test-update-failure'); END`,
  ).run();
  try {
    await assert.rejects(drafts().saveDraft(draft.id, 2, `${source}\n不会保留`, 'user:test'));
    assert.equal((await repo.get(draft.id)).revision, 2);
  } finally {
    await platform.env.DB.prepare('DROP TRIGGER test_reject_draft_update').run();
  }

  const page = await history().list({ path: draft.targetPath });
  assert.equal(page.items.length, 2);
  assert.deepEqual(page.items.map((item) => item.revision).sort(), [1, 2]);
  const original = page.items.find((item) => item.revision === 1);
  assert.ok(original);
  assert.equal((await history().snapshot(draft.targetPath, original.id)).source, source);
  assert.equal('source' in page.items[0], false);
  assert.equal(JSON.stringify(page).includes('sourceSnapshot'), false);
  assert.equal(JSON.stringify(page).includes('user:test'), false);
  assert.equal(JSON.stringify(page).includes('第二版'), false);
  await assert.rejects(history().snapshot(legacyPath, original.id), { code: 'NOT_FOUND' });
  // 测试专用触发器使第二条 INSERT 失败，第一条合法草稿也必须原子回滚。
  const id = `cmd_${'b'.repeat(32)}`;
  await platform.env.DB.prepare(
    "CREATE TRIGGER test_reject_snapshot BEFORE INSERT ON cms_document_revisions WHEN NEW.target_path = 'content/blog/invalid-zh.mdx' BEGIN SELECT RAISE(ABORT, 'test-snapshot-failure'); END",
  ).run();
  try {
    await assert.rejects(
      repo.create({
        id,
        collection: 'blog',
        format: 'mdx',
        lang: 'zh',
        slug: 'invalid',
        targetPath: 'content/blog/invalid-zh.mdx',
        publicPath: '/zh/blog/invalid',
        source,
        sourceHash: 'test',
        sourceBytes: new TextEncoder().encode(source).length,
        createdBy: 'test',
        updatedBy: 'test',
      }),
    );
    await assert.rejects(repo.get(id), { code: 'NOT_FOUND' });
  } finally {
    await platform.env.DB.prepare('DROP TRIGGER test_reject_snapshot').run();
  }
});

test('并发保存仅一个修订胜出，另一请求不留下多余快照', async () => {
  const draft = await create('history-concurrent');
  const results = await Promise.allSettled([
    drafts().saveDraft(draft.id, 1, `${source}\n窗口 A`, 'user:a'),
    drafts().saveDraft(draft.id, 1, `${source}\n窗口 B`, 'user:b'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected && rejected.status === 'rejected');
  assert.equal(rejected.reason.code, 'CONFLICT');
  const saved = await drafts().getDraft(draft.id);
  assert.equal(saved.revision, 2);
  const page = await history().list({ path: draft.targetPath });
  assert.equal(page.items.length, 2);
  const version = page.items.find((item) => item.revision === 2);
  assert.ok(version);
  assert.equal((await history().snapshot(draft.targetPath, version.id)).source, saved.source);
});

test('同毫秒游标稳定分页，跨草稿轮次合并，新增头部事件不使后续页重复', async () => {
  const draft = await create('history-pages');
  await drafts().saveDraft(draft.id, 1, `${source}\n第二版`, 'user:test');
  await drafts().discardDraft(draft.id, 2, 'user:test');
  const nextDraft = await create('history-pages');
  const operationId = crypto.randomUUID().toUpperCase();
  await publicationRepository(platform.env).create({
    operationId,
    draftId: nextDraft.id,
    draftRevision: 1,
    requestHash: 'fixed',
    sourceSnapshot: source,
    sourceHash: 'hash',
    sourceBytes: 1,
    targetPath: draft.targetPath,
    publicPath: draft.publicPath,
    backend: 'd1',
    status: 'failed',
    errorCode: 'TEST_FAILURE',
    createdBy: 'test',
    createdAt: 2000,
    updatedAt: 2000,
  });
  await platform.env.DB.prepare(
    'UPDATE cms_document_revisions SET created_at = 2000 WHERE target_path = ?',
  )
    .bind(draft.targetPath)
    .run();
  await platform.env.DB.prepare('UPDATE cms_drafts SET closed_at = 2000 WHERE id = ?')
    .bind(draft.id)
    .run();
  const full = await history().list({ path: draft.targetPath });
  assert.equal(full.items.length, 5);
  assert.equal(new Set(full.items.map((item) => item.draftId)).size, 2);
  let page = await history().list({ path: draft.targetPath, limit: 1 });
  const ids = page.items.map((item) => item.id);
  await drafts().saveDraft(nextDraft.id, 1, `${source}\n新头部`, 'user:test');
  const firstCursor = page.nextCursor;
  assert.ok(firstCursor);
  while (page.nextCursor) {
    page = await history().list({ path: draft.targetPath, limit: 1, cursor: page.nextCursor });
    ids.push(...page.items.map((item) => item.id));
  }
  assert.deepEqual(
    ids,
    full.items.map((item) => item.id),
  );
  assert.equal(new Set(ids).size, ids.length);
  await assert.rejects(history().list({ path: legacyPath, cursor: firstCursor }), {
    code: 'VALIDATION_ERROR',
  });
  for (const cursor of ['', '%%%', 'a'.repeat(2050)])
    await assert.rejects(history().list({ path: draft.targetPath, cursor }), {
      code: 'VALIDATION_ERROR',
    });
  const publication = full.items.find((item) => item.kind === 'publication');
  assert.ok(publication);
  assert.equal(publication.canViewSnapshot, true);
  assert.equal((await history().snapshot(draft.targetPath, publication.id)).source, source);
  assert.equal(publication.publication?.errorCode, 'TEST_FAILURE');
});

function apiContext(
  path: string,
  options: { method?: string; env?: CloudflareEnv; id?: string } = {},
) {
  const request = new Request(`http://localhost:4321${path}`, { method: options.method });
  return {
    request,
    url: new URL(request.url),
    params: { id: options.id },
    locals: {
      runtime: {
        env: options.env ?? {
          ...platform.env,
          ENVIRONMENT: 'development',
          SITE_URL: 'http://localhost:4321',
        },
      },
    },
  } as unknown as APIContext;
}

test('历史接口遵循鉴权、参数白名单、方法、标准响应和 no-store 规范', async () => {
  const path = `/api/v1/admin/cms/history?${new URLSearchParams({ path: legacyPath })}`;
  const response = await cmsHistoryListRoute(apiContext(path));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(response.headers.get('x-request-id'));
  const body = (await response.json()) as { success: boolean; data: CmsHistoryPage };
  assert.equal(body.success, true);
  assert.equal(body.data.items.length, 1);
  for (const extra of [
    '&limit=0',
    '&limit=51',
    '&limit=1.5',
    '&cursor=',
    '&page=1',
    '&path=x',
    '&__proto__=x',
  ])
    assert.equal((await cmsHistoryListRoute(apiContext(path + extra))).status, 400);
  assert.equal(
    (
      await cmsHistoryListRoute(
        apiContext('/api/v1/admin/cms/history?path=content/blog/../secret.md'),
      )
    ).status,
    400,
  );
  assert.equal((await cmsHistoryListRoute(apiContext(path, { method: 'POST' }))).status, 405);
  assert.equal((await cmsHistoryListRoute(apiContext(path, { method: 'HEAD' }))).status, 200);
  assert.equal((await cmsHistoryListRoute(apiContext(path, { method: 'OPTIONS' }))).status, 204);
  const unauthorized = await cmsHistoryListRoute(
    apiContext(path, {
      env: {
        ACCESS_ISSUER: 'https://imiles.cloudflareaccess.com',
        ACCESS_AUD: 'test',
        ADMIN_EMAILS: 'test@example.test',
        SITE_URL: 'https://imiles.me',
      },
    }),
  );
  assert.equal(unauthorized.status, 401);
  const missing = await cmsHistorySnapshotRoute(
    apiContext(path, { id: `publication:${legacyOperation}` }),
  );
  assert.equal(missing.status, 404);
  const denied = await cmsHistorySnapshotRoute(
    apiContext(path, {
      id: `publication:${legacyOperation}`,
      env: {
        ACCESS_ISSUER: 'https://imiles.cloudflareaccess.com',
        ACCESS_AUD: 'test',
        ADMIN_EMAILS: 'test@example.test',
        SITE_URL: 'https://imiles.me',
      },
    }),
  );
  assert.equal(denied.status, 401);
  const draft = await create('history-api');
  const item = (await history().list({ path: draft.targetPath })).items[0];
  const snapshot = await cmsHistorySnapshotRoute(
    apiContext(
      `/api/v1/admin/cms/history/${encodeURIComponent(item.id)}?${new URLSearchParams({ path: draft.targetPath })}`,
      { id: encodeURIComponent(item.id) },
    ),
  );
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.headers.get('cache-control'), 'no-store');
  assert.equal((await snapshot.json()).data.source, source);
  const invalidEncoding = await cmsHistorySnapshotRoute(
    apiContext(path, { id: 'revision%invalid' }),
  );
  assert.equal(invalidEncoding.status, 400);
});

test('当前 D1 会话不能把历史 Git 提交误标为部署已核实', async () => {
  const draft = await create('history-channel-verification');
  const operations = publicationRepository(platform.env);
  const operationId = crypto.randomUUID();
  await operations.create({
    operationId,
    draftId: draft.id,
    draftRevision: 1,
    requestHash: 'fixed',
    sourceSnapshot: source,
    sourceHash: 'hash',
    sourceBytes: 1,
    targetPath: draft.targetPath,
    publicPath: draft.publicPath,
    backend: 'github',
    status: 'committed',
    resultBlobSha: 'a'.repeat(40),
    resultCommitSha: 'b'.repeat(40),
    createdBy: 'test',
  });
  const service = publicationService(platform.env, { ...snapshotRepository({}), mode: 'd1' });
  await assert.rejects(service.verifyDeployment(operationId), {
    code: 'CMS_LOCAL_DEPLOYMENT_UNAVAILABLE',
  });
  assert.equal((await operations.get(operationId)).deploymentStatus, 'unverified');
  const d1Operation = crypto.randomUUID();
  await operations.create({
    operationId: d1Operation,
    draftId: draft.id,
    draftRevision: 1,
    requestHash: 'fixed-d1',
    sourceSnapshot: source,
    sourceHash: 'hash',
    sourceBytes: 1,
    targetPath: draft.targetPath,
    publicPath: draft.publicPath,
    backend: 'd1',
    status: 'committed',
    resultBlobSha: 'a'.repeat(40),
    resultCommitSha: 'd1:cmp_record',
    createdBy: 'test',
  });
  assert.equal((await service.verifyDeployment(d1Operation)).deploymentRef, 'd1-instant');
});

test('界面状态区分 D1/Git 与待对账，不将未知记录误标成当前会话的发布成功', () => {
  const result = {
    operationId: crypto.randomUUID(),
    draftId: legacyId,
    draftRevision: 1,
    targetPath: legacyPath,
    publicPath: '/zh/blog/history',
    status: 'committed' as const,
    deploymentStatus: 'unverified' as const,
    deploymentRef: null,
    deployedAt: null,
    errorCode: null,
    resultBlobSha: 'hash',
    resultCommitSha: 'd1:cmp_same-id',
  };
  assert.equal(publicationBackend(result), 'd1');
  assert.equal(publicationLabel(result), '已写入 D1');
  assert.equal(publicationBackend({ ...result, resultCommitSha: 'a'.repeat(40) }), 'github');
  assert.equal(publicationBackend({ ...result, resultCommitSha: null }), 'unknown');
  assert.equal(publicationLabel({ ...result, status: 'unknown' }), '发布结果待对账');
  assert.equal(
    historyLabel({ kind: 'draft_saved', publication: null } as CmsHistoryItem),
    '保存草稿',
  );
  assert.equal(safePublicPath('//evil.test/path'), null);
  assert.equal(safePublicPath('javascript:alert(1)'), null);
  assert.equal(safePublicPath('/zh/blog/history'), '/zh/blog/history');
});
