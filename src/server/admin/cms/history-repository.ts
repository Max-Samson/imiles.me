import { and, eq, sql } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import type {
  CmsHistoryItem,
  CmsHistorySnapshot,
  CmsPublicationResult,
} from '../../../shared/admin/cms-history';
import { createDrizzleClient, schema } from '../../db';

export interface HistoryPosition {
  at: number;
  id: string;
}

export interface CmsHistoryRepository {
  list(path: string, limit: number, before?: HistoryPosition): Promise<CmsHistoryItem[]>;
  snapshot(path: string, id: string): Promise<CmsHistorySnapshot | null>;
}

type HistoryRow = Omit<CmsHistoryItem, 'publication' | 'canViewSnapshot'> & {
  canViewSnapshot: number;
  operationId: string | null;
  targetPath: string;
  publicPath: string | null;
  status: CmsPublicationResult['status'] | null;
  deploymentStatus: CmsPublicationResult['deploymentStatus'] | null;
  deploymentRef: string | null;
  deployedAt: number | null;
  errorCode: string | null;
  resultBlobSha: string | null;
  resultCommitSha: string | null;
  backend: CmsPublicationResult['backend'];
  completedAt: number | null;
};

/** 摘要查询只投影元数据，不读取修订正文或发布快照；所有过滤值使用绑定参数。 */
export function historyRepository(env: CloudflareEnv): CmsHistoryRepository {
  const db = createDrizzleClient(env);
  return {
    async list(path, limit, before) {
      const position = before
        ? sql`WHERE occurredAt < ${before.at} OR (occurredAt = ${before.at} AND id < ${before.id})`
        : sql``;
      const rows = await db.all<HistoryRow>(sql`
        WITH events AS (
          SELECT 'revision:' || id AS id,
            CASE WHEN revision = 1 THEN 'draft_created' ELSE 'draft_saved' END AS kind,
            created_at AS occurredAt, draft_id AS draftId, revision, title_cache AS title,
            1 AS canViewSnapshot, NULL AS operationId, target_path AS targetPath,
            NULL AS publicPath, NULL AS status, NULL AS deploymentStatus,
            NULL AS deploymentRef, NULL AS deployedAt, NULL AS errorCode,
            NULL AS resultBlobSha, NULL AS resultCommitSha, NULL AS backend, NULL AS completedAt
          FROM cms_document_revisions WHERE target_path = ${path}
          UNION ALL
          SELECT 'publication:' || operation_id, 'publication', created_at,
            draft_id, draft_revision, NULL, source_snapshot IS NOT NULL,
            operation_id, target_path, public_path, status, deployment_status,
            deployment_ref, deployed_at, error_code, result_blob_sha, result_commit_sha,
            backend, completed_at
          FROM cms_publication_attempts WHERE target_path = ${path}
          UNION ALL
          SELECT 'discard:' || id, 'draft_discarded', closed_at, id, revision, title_cache,
            0, NULL, target_path, public_path, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
          FROM cms_drafts WHERE target_path = ${path} AND status = 'discarded'
        )
        SELECT * FROM events ${position}
        ORDER BY occurredAt DESC, id DESC LIMIT ${limit}
      `);
      return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        occurredAt: row.occurredAt,
        draftId: row.draftId,
        revision: row.revision,
        title: row.title,
        canViewSnapshot: Boolean(row.canViewSnapshot),
        publication:
          row.operationId && row.status && row.deploymentStatus
            ? {
                operationId: row.operationId,
                draftId: row.draftId,
                draftRevision: row.revision,
                targetPath: row.targetPath,
                publicPath: row.publicPath ?? '',
                status: row.status,
                deploymentStatus: row.deploymentStatus,
                deploymentRef: row.deploymentRef,
                deployedAt: row.deployedAt,
                errorCode: row.errorCode,
                resultBlobSha: row.resultBlobSha,
                resultCommitSha: row.resultCommitSha,
                backend: row.backend,
                createdAt: row.occurredAt,
                completedAt: row.completedAt,
              }
            : null,
      }));
    },
    async snapshot(path, id) {
      const [kind, key] = id.split(':');
      if (kind === 'revision') {
        const revisions = schema.cmsDocumentRevisions;
        const [row] = await db
          .select({
            draftId: revisions.draftId,
            revision: revisions.revision,
            occurredAt: revisions.createdAt,
            source: revisions.source,
          })
          .from(revisions)
          .where(and(eq(revisions.id, key), eq(revisions.targetPath, path)))
          .limit(1);
        return row ? { id, ...row } : null;
      }
      if (kind === 'publication') {
        const attempts = schema.cmsPublicationAttempts;
        const [row] = await db
          .select({
            draftId: attempts.draftId,
            revision: attempts.draftRevision,
            occurredAt: attempts.createdAt,
            source: attempts.sourceSnapshot,
          })
          .from(attempts)
          .where(and(eq(attempts.operationId, key), eq(attempts.targetPath, path)))
          .limit(1);
        return row?.source != null ? { ...row, id, source: row.source } : null;
      }
      return null;
    },
  };
}
