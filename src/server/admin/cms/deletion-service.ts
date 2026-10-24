import type { CloudflareEnv } from '../../../env.d';
import { resolveExistingContentTarget } from '../../../lib/content-routing';
import { parseSourceDocument } from '../../../lib/content-source';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../errors';
import { deletionRepository } from './deletion-repository';
import { type DeletionWriter, d1DeletionWriter, githubDeletionWriter } from './deletion-writer';
import { draftRepository } from './draft-repository';
import type { CmsRepository } from './repository';

/** 已发布文章删除只删除 Git 文件；不顺带清理可能被其他文章引用的图片。 */
export function deletionService(
  env: CloudflareEnv,
  content: CmsRepository,
  injectedWriter?: DeletionWriter,
) {
  const operations = deletionRepository(env);
  const drafts = draftRepository(env);
  const writer = () => {
    if (injectedWriter) return injectedWriter;
    if (content.mode === 'd1') return d1DeletionWriter(env);
    if (content.mode !== 'github')
      throw new AppError('本地仓库文件删除尚未开放', 503, 'CMS_LOCAL_DELETE_UNAVAILABLE');
    return githubDeletionWriter(env);
  };

  async function execute(operationId: string) {
    let attempt = await operations.get(operationId);
    if (['committed', 'conflict', 'failed'].includes(attempt.status)) return attempt;
    const adapter = writer();
    if (attempt.status !== 'prepared') {
      // 先查带操作 ID 的 Git 提交；超时或回执丢失时禁止重新删除当前路径的新版本。
      const commitSha = await adapter.reconcile({
        path: attempt.targetPath,
        operationId,
      });
      if (commitSha) attempt = await operations.finish(operationId, 'committed', commitSha);
      else if (attempt.status === 'in_flight' && Date.now() - attempt.updatedAt > 30000)
        attempt = await operations.finish(operationId, 'unknown');
      return attempt;
    }
    if (!(await operations.claim(operationId))) return execute(operationId);
    attempt = await operations.get(operationId);
    // 认领后再比对最初打开时的 blob SHA，避免请求排队期间文章被他人更新。
    let currentSha: string | null;
    try {
      currentSha = await content.sha(attempt.targetPath);
    } catch {
      return operations.finish(operationId, 'failed');
    }
    if (currentSha !== attempt.expectedBlobSha) return operations.finish(operationId, 'conflict');
    const result = await adapter.delete({
      path: attempt.targetPath,
      expectedBlobSha: attempt.expectedBlobSha,
      operationId,
    });
    return operations.finish(
      operationId,
      result.kind,
      result.kind === 'committed' ? result.commitSha : undefined,
    );
  }

  return {
    get: operations.get,
    async delete(path: string, expectedBlobSha: string, operationId: string, actorId: string) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          operationId,
        )
      )
        throw new ValidationError('删除操作 ID 必须是 UUID');
      if (!/^[a-f0-9]{40}$/i.test(expectedBlobSha))
        throw new ValidationError('删除必须携带打开时的 Git blob SHA');
      let existing: Awaited<ReturnType<typeof operations.get>> | null = null;
      try {
        existing = await operations.get(operationId);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
      if (existing) {
        // 重试复用原意图；同一个 UUID 不能用于另一条路径或另一个文件版本。
        if (existing.targetPath !== path || existing.expectedBlobSha !== expectedBlobSha)
          throw new ConflictError('操作 ID 已用于另一篇文章或版本');
        return execute(operationId);
      }
      writer();
      const collection = path.startsWith('content/blog/')
        ? 'blog'
        : path.startsWith('content/stories/')
          ? 'stories'
          : null;
      if (!collection) throw new ValidationError('只能删除 Blog 或 Stories 文章');
      try {
        resolveExistingContentTarget(collection, 'en', path);
      } catch {
        throw new ValidationError('文章路径不在允许的集合中');
      }
      const version = await content.readVersion(path);
      if (version.blobSha !== expectedBlobSha)
        throw new ConflictError('仓库文章已更新，请先刷新并比较版本');
      let lang: 'en' | 'zh' = 'en';
      try {
        if (parseSourceDocument(version.content).fields.lang === 'zh') lang = 'zh';
      } catch {
        // 删除无法解析的旧文章仍可进行，身份和文件版本由仓库路径与 SHA 锁定。
      }
      const target = resolveExistingContentTarget(collection, lang, path);
      // 活动草稿中可能有尚未发布的修改，必须先由用户处理草稿再删除仓库文件。
      if (await drafts.activeByPath(path))
        throw new ConflictError('文章仍有活动草稿，请先放弃草稿，再删除仓库文章');
      const attempt = await operations.create({
        operationId,
        targetPath: target.path,
        publicPath: target.publicPath,
        expectedBlobSha,
        createdBy: actorId,
      });
      if (attempt.targetPath !== path || attempt.expectedBlobSha !== expectedBlobSha)
        throw new ConflictError('操作 ID 已用于另一篇文章或版本');
      return execute(operationId);
    },
  };
}
