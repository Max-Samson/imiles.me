import type { CloudflareEnv } from '../../../env.d';
import { resolveExistingContentTarget } from '../../../lib/content-routing';
import { parseSourceDocument } from '../../../lib/content-source';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../errors';
import { commitCmsDraftAssets, findCmsAssetForPublication } from './asset-service';
import { deletionRepository } from './deletion-repository';
import { verifyGitHubPublicationDeployment } from './deployment-verifier';
import { draftRepository } from './draft-repository';
import { postRepository } from './post-repository';
import { publicationRepository } from './publication-repository';
import { preparePublication } from './publication-validation';
import { d1PublicationWriter, githubPublicationWriter, type PublicationWriter } from './publisher';
import type { CmsRepository } from './repository';

async function assertPublicPathAvailable(
  content: CmsRepository,
  draft: { collection: 'blog' | 'stories'; targetPath: string; publicPath: string },
  env?: CloudflareEnv,
) {
  // D1 原生模式：直接查询索引，O(1) 完成冲突判定，避免多级目录扫描
  if (content.mode === 'd1' && env) {
    const posts = postRepository(env);
    const existing = await posts.findByPath(draft.publicPath);
    if (existing && existing.targetPath !== draft.targetPath) {
      throw new ConflictError(`公开地址已由仓库文件占用：${existing.targetPath}`);
    }
    return;
  }

  // 文件名不同也可能归一化到同一 URL；必须检查集合内其他文件，而非仅查目标路径。
  const directories = [draft.collection === 'blog' ? 'content/blog' : 'content/stories'];
  let inspected = 0;
  while (directories.length) {
    let entries: Awaited<ReturnType<CmsRepository['list']>>;
    try {
      entries = await content.list(directories.pop() as string);
    } catch (error) {
      if (error instanceof NotFoundError) continue;
      throw error;
    }
    for (const entry of entries) {
      if (++inspected > 1000)
        throw new AppError('文章目录过大，无法安全检查公开地址', 503, 'CMS_URL_SCAN_LIMIT');
      if (entry.type === 'dir') {
        directories.push(entry.path);
        continue;
      }
      if (entry.path === draft.targetPath || !/\.mdx?$/.test(entry.path)) continue;
      const version = await content.readVersion(entry.path);
      let lang: 'en' | 'zh' = 'en';
      try {
        if (parseSourceDocument(version.content).fields.lang === 'zh') lang = 'zh';
      } catch {
        throw new AppError(
          '仓库存在无法解析属性的文章，无法确认公开地址',
          503,
          'CMS_URL_SCAN_ERROR',
        );
      }
      const target = resolveExistingContentTarget(draft.collection, lang, entry.path);
      if (target.publicPath === draft.publicPath) {
        throw new ConflictError(`公开地址已由仓库文件占用：${entry.path}`);
      }
    }
  }
}

async function sha256(source: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** D1 固定意图、Git 条件写入与结果未知对账；永不从浏览器接收仓库或 Token。 */
export function publicationService(
  env: CloudflareEnv,
  content: CmsRepository,
  injectedWriter?: PublicationWriter,
) {
  const drafts = draftRepository(env);
  const operations = publicationRepository(env);
  const writer = () => {
    if (injectedWriter) return injectedWriter;
    if (content.mode === 'd1') return d1PublicationWriter(env);
    if (content.mode !== 'github')
      throw new AppError('本地发布文件适配尚未开放', 503, 'CMS_LOCAL_PUBLISH_UNAVAILABLE');
    return githubPublicationWriter(env);
  };
  const publicResult = (attempt: Awaited<ReturnType<typeof operations.get>>) => {
    const { sourceSnapshot, ...result } = attempt;
    void sourceSnapshot;
    return result;
  };

  async function settleCommitted(attempt: Awaited<ReturnType<typeof operations.get>>) {
    // Git 提交已确认后开放该固定快照引用的私有图片；重复对账可以安全重试。
    const draft = await drafts.get(attempt.draftId);
    const referenced = preparePublication({
      ...draft,
      source: attempt.sourceSnapshot ?? '',
    }).assetPaths;
    await commitCmsDraftAssets(env, attempt.draftId, referenced);
    await operations.settleDraft(attempt);
  }

  async function execute(operationId: string) {
    let attempt = await operations.get(operationId);
    if (attempt.status === 'committed') {
      // Git 已确认但 D1 草稿收尾可能在上次请求中断；重复执行只补收尾，不再次写 Git。
      await settleCommitted(attempt);
      return publicResult(attempt);
    }
    if (attempt.status === 'conflict' || attempt.status === 'failed') return publicResult(attempt);
    const publisher = writer();
    if (attempt.status !== 'prepared') {
      // in_flight/unknown 的请求可能已被 GitHub 执行；先查提交标记与文件版本，绝不盲写第二次。
      const confirmed = await publisher.reconcile({
        path: attempt.targetPath,
        source: attempt.sourceSnapshot ?? '',
        operationId,
      });
      if (confirmed) {
        attempt = await operations.finish(operationId, 'committed', confirmed);
        await settleCommitted(attempt);
      } else if (attempt.status === 'in_flight' && Date.now() - attempt.updatedAt > 30000) {
        // 超时只表示需要人工或后续请求继续对账，不能据此断言 Git 写入失败。
        attempt = await operations.finish(operationId, 'unknown');
      }
      return publicResult(attempt);
    }
    if (!(await operations.claim(operationId))) return execute(operationId);
    attempt = await operations.get(operationId);
    // 在写入前复查 Git 基准；GitHub PUT 还会使用同一个 blob SHA 做最终条件更新。
    let currentSha: string | null;
    try {
      await assertPublicPathAvailable(
        content,
        {
          collection: attempt.targetPath.startsWith('content/stories/') ? 'stories' : 'blog',
          targetPath: attempt.targetPath,
          publicPath: attempt.publicPath,
        },
        env,
      );
      currentSha = await content.sha(attempt.targetPath);
    } catch (error) {
      attempt = await operations.finish(
        operationId,
        error instanceof ConflictError ? 'conflict' : 'failed',
        { errorCode: error instanceof Error ? error.message : 'PATH_ASSERTION_FAILED' },
      );
      return publicResult(attempt);
    }
    if (currentSha !== attempt.expectedBlobSha) {
      attempt = await operations.finish(operationId, 'conflict', {
        errorCode: 'BLOB_SHA_MISMATCH',
      });
      return publicResult(attempt);
    }
    const result = await publisher.write({
      path: attempt.targetPath,
      source: attempt.sourceSnapshot ?? '',
      expectedBlobSha: attempt.expectedBlobSha,
      operationId,
      actorId: attempt.createdBy,
    });
    attempt = await operations.finish(
      operationId,
      result.kind,
      result.kind === 'committed' ? result : { errorCode: result.errorCode },
    );
    if (attempt.status === 'committed') await settleCommitted(attempt);
    return publicResult(attempt);
  }

  return {
    async get(operationId: string) {
      return publicResult(await operations.get(operationId));
    },
    async pendingPublications() {
      return operations.pendingPublications();
    },
    async latestCommittedForPath(path: string) {
      const attempt = await operations.latestCommittedForPath(path);
      return attempt ? publicResult(attempt) : null;
    },
    async verifyDeployment(operationId: string) {
      const attempt = await operations.get(operationId);
      if (attempt.status !== 'committed' || !attempt.resultBlobSha || !attempt.resultCommitSha)
        throw new ConflictError('Git 提交尚未确认，无法核验部署');
      if (content.mode === 'd1' || attempt.resultCommitSha.startsWith('d1:')) {
        return publicResult(
          await operations.recordDeployment(operationId, {
            status: 'verified',
            ref: 'd1-instant',
            deployedAt: attempt.completedAt ?? Date.now(),
          }),
        );
      }
      if (content.mode !== 'github')
        throw new AppError('本地 snapshot 不支持部署核验', 503, 'CMS_LOCAL_DEPLOYMENT_UNAVAILABLE');
      const evidence = await verifyGitHubPublicationDeployment(env, {
        targetPath: attempt.targetPath,
        resultBlobSha: attempt.resultBlobSha,
        resultCommitSha: attempt.resultCommitSha,
      });
      return publicResult(await operations.recordDeployment(operationId, evidence));
    },
    async publish(draftId: string, expectedRevision: number, operationId: string, actorId: string) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          operationId,
        )
      ) {
        throw new ValidationError('发布操作 ID 必须是 UUID');
      }
      const requestHash = await sha256(`${draftId}:${expectedRevision}`);
      let existing: Awaited<ReturnType<typeof operations.get>> | undefined;
      try {
        existing = await operations.get(operationId);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
      if (existing) {
        // 操作 ID 是不可变意图的幂等键；同 ID 不得指向另一份草稿修订。
        if (
          existing.draftId !== draftId ||
          existing.draftRevision !== expectedRevision ||
          existing.requestHash !== requestHash
        ) {
          throw new ConflictError('操作 ID 已用于另一份发布意图');
        }
        return execute(operationId);
      }
      // 配置门禁先于 D1 创建，避免本地留下永远不能执行的 prepared 操作。
      writer();
      const draft = await drafts.get(draftId);
      if (draft.status !== 'active' || draft.revision !== expectedRevision)
        throw new ConflictError('草稿修订已变化，请先保存并重新发起发布');
      if (await deletionRepository(env).pendingForPath(draft.targetPath))
        throw new ConflictError('目标文章正在删除或待对账');
      const prepared = preparePublication(draft);
      // 仓库已有图片可直接引用；CMS 上传图片必须属于这份草稿，提交确认后由 Worker 公开。
      for (const assetPath of prepared.assetPaths) {
        if (
          !(await content.sha(assetPath)) &&
          !(await findCmsAssetForPublication(env, draftId, assetPath))
        )
          throw new ValidationError(`图片不存在或不属于当前草稿：${assetPath}`);
      }
      await assertPublicPathAvailable(content, draft, env);
      const sourceBytes = new TextEncoder().encode(prepared.source).length;
      // 固定实际送往 Git 的文本，后续重试不得读取草稿的新修订替换这份快照。
      const attempt = await operations.create({
        operationId,
        draftId,
        draftRevision: expectedRevision,
        requestHash,
        sourceSnapshot: prepared.source,
        sourceHash: await sha256(prepared.source),
        sourceBytes,
        targetPath: draft.targetPath,
        publicPath: draft.publicPath,
        expectedBlobSha: draft.baseBlobSha,
        createdBy: actorId,
      });
      if (
        attempt.draftId !== draftId ||
        attempt.draftRevision !== expectedRevision ||
        attempt.requestHash !== requestHash
      )
        throw new ConflictError('操作 ID 已用于另一份发布意图');
      return execute(operationId);
    },
  };
}
