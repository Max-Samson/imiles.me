import type { ContentCollection, ContentLanguage } from '../../config/content-collections';
import { adminApiRequest } from './api-client';

/** 编辑台只与同源受保护接口通信；Git 凭据和 D1 版本检查始终留在服务端。 */
export interface CmsDraftSummary {
  id: string;
  collection: ContentCollection;
  format: 'md' | 'mdx';
  lang: ContentLanguage;
  slug: string;
  targetPath: string;
  publicPath: string;
  baseBlobSha: string | null;
  revision: number;
  titleCache: string | null;
  updatedAt: number;
}

export interface CmsDraft extends CmsDraftSummary {
  source: string;
  publication?: CmsPublicationResult | null;
}

export interface CmsPublicationResult {
  operationId: string;
  draftId: string;
  draftRevision: number;
  targetPath: string;
  publicPath: string;
  status: 'prepared' | 'in_flight' | 'unknown' | 'committed' | 'conflict' | 'failed';
  deploymentStatus: 'unverified' | 'pending' | 'running' | 'verified' | 'failed' | 'cancelled';
  deploymentRef: string | null;
  deployedAt: number | null;
  resultBlobSha: string | null;
  resultCommitSha: string | null;
}

export interface CmsDeletionResult {
  operationId: string;
  targetPath: string;
  publicPath: string;
  expectedBlobSha: string;
  status: CmsPublicationResult['status'];
  resultCommitSha: string | null;
  deploymentStatus: CmsPublicationResult['deploymentStatus'];
}

export interface CmsDraftAsset {
  id: string;
  draftId: string;
  publicUrl: string;
  previewUrl: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: number;
  contentHash: string;
  status: 'staged' | 'committed';
  createdAt: number;
}

const endpoint = '/api/v1/admin/cms/drafts';

export interface CmsSessionInfo {
  mode: 'snapshot' | 'github' | 'd1';
  repo: string;
  branch: string;
  isProductionBranch: boolean;
  isTestBranch: boolean;
  isLocalBranch?: boolean;
  isConfigured: boolean;
  writable: boolean;
  session?: unknown;
}

export const cmsDocumentClient = {
  list: () => adminApiRequest<CmsDraftSummary[]>(endpoint),
  get: (id: string) => adminApiRequest<CmsDraft>(`${endpoint}/${encodeURIComponent(id)}`),
  create: (input: {
    collection: ContentCollection;
    lang: ContentLanguage;
    slug: string;
    format: 'md' | 'mdx';
    path?: string;
    baseBlobSha?: string;
    source: string;
  }) =>
    adminApiRequest<CmsDraftSummary>(endpoint, undefined, fetch, { method: 'POST', body: input }),
  save: (id: string, expectedRevision: number, source: string) =>
    adminApiRequest<CmsDraftSummary>(`${endpoint}/${encodeURIComponent(id)}`, undefined, fetch, {
      method: 'PUT',
      body: { expectedRevision, source },
    }),
  discard: (id: string, expectedRevision: number) =>
    adminApiRequest<CmsDraftSummary>(`${endpoint}/${encodeURIComponent(id)}`, undefined, fetch, {
      method: 'DELETE',
      body: { expectedRevision },
    }),
  listAssets: (id: string) =>
    adminApiRequest<CmsDraftAsset[]>(`${endpoint}/${encodeURIComponent(id)}/assets`),
  uploadAsset: (id: string, image: File) => {
    const form = new FormData();
    form.set('image', image);
    return adminApiRequest<CmsDraftAsset>(
      `${endpoint}/${encodeURIComponent(id)}/assets`,
      undefined,
      fetch,
      { method: 'POST', body: form },
    );
  },
  publish: (id: string, expectedRevision: number, operationId: string) =>
    adminApiRequest<CmsPublicationResult>(
      `${endpoint}/${encodeURIComponent(id)}/publish`,
      undefined,
      fetch,
      {
        method: 'POST',
        body: { expectedRevision, operationId },
      },
    ),
  publication: (operationId: string) =>
    adminApiRequest<CmsPublicationResult>(
      `/api/v1/admin/cms/publications/${encodeURIComponent(operationId)}`,
    ),
  latestPublication: (path: string) =>
    adminApiRequest<CmsPublicationResult | null>(
      `/api/v1/admin/cms/publications?path=${encodeURIComponent(path)}`,
    ),
  pendingPublications: () =>
    adminApiRequest<CmsPublicationResult[]>('/api/v1/admin/cms/publications?pending=true'),
  verifyDeployment: (operationId: string) =>
    adminApiRequest<CmsPublicationResult>(
      `/api/v1/admin/cms/publications/${encodeURIComponent(operationId)}/verify`,
      undefined,
      fetch,
      { method: 'POST' },
    ),
  deleteArticle: (path: string, expectedBlobSha: string, operationId: string) =>
    adminApiRequest<CmsDeletionResult>('/api/v1/admin/cms/deletions', undefined, fetch, {
      method: 'POST',
      body: { path, expectedBlobSha, operationId },
    }),
  pendingDeletion: (path: string) =>
    adminApiRequest<CmsDeletionResult | null>(
      `/api/v1/admin/cms/deletions?path=${encodeURIComponent(path)}`,
    ),
  pendingDeletions: () => adminApiRequest<CmsDeletionResult[]>('/api/v1/admin/cms/deletions'),
  deletion: (operationId: string) =>
    adminApiRequest<CmsDeletionResult>(
      `/api/v1/admin/cms/deletions/${encodeURIComponent(operationId)}`,
    ),
  session: () => adminApiRequest<CmsSessionInfo>('/api/v1/admin/cms/session'),
};
