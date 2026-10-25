/** 发布结果只描述服务端已知事实；写入成功与公网页面核验是不同的状态。 */
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
  errorCode: string | null;
  resultBlobSha: string | null;
  resultCommitSha: string | null;
  /** 旧记录未保存通道时为 null；不能以浏览器当前会话补写历史事实。 */
  backend?: 'd1' | 'github' | null;
  createdAt?: number;
  completedAt?: number | null;
}

export interface CmsHistoryItem {
  id: string;
  kind: 'draft_created' | 'draft_saved' | 'draft_discarded' | 'publication';
  occurredAt: number;
  draftId: string;
  revision: number;
  title: string | null;
  publication: CmsPublicationResult | null;
  canViewSnapshot: boolean;
}

/** 文稿历史使用独立的稳定游标契约，不与通用 page/pageSize 分页混用。 */
export interface CmsHistoryPage {
  items: CmsHistoryItem[];
  nextCursor: string | null;
}

export interface CmsHistorySnapshot {
  id: string;
  draftId: string;
  revision: number;
  occurredAt: number;
  source: string;
}
