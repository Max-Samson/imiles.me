import type { CmsHistoryItem, CmsPublicationResult } from '../../../src/shared/admin/cms-history';

export type StatusTone = 'success' | 'error' | 'warning' | 'info';
export interface StatusNotice {
  tone: StatusTone;
  message: string;
}

export const deploymentLabels: Record<CmsPublicationResult['deploymentStatus'], string> = {
  unverified: '部署未核实',
  pending: '部署排队中',
  running: '部署运行中',
  verified: '部署已核实',
  failed: '部署失败',
  cancelled: '部署已取消',
};

/** 以记录自身的通道/结果判断历史，不将当前会话模式套用到旧记录。 */
export function publicationBackend(result: CmsPublicationResult): 'd1' | 'github' | 'unknown' {
  if (result.backend) return result.backend;
  if (result.resultCommitSha?.startsWith('d1:')) return 'd1';
  if (result.resultCommitSha && /^[a-f0-9]{40}$/i.test(result.resultCommitSha)) return 'github';
  return 'unknown';
}

export function publicationLabel(result: CmsPublicationResult): string {
  if (result.status === 'committed') {
    return publicationBackend(result) === 'd1' ? '已写入 D1' : '发布提交已确认';
  }
  return {
    prepared: '发布已准备',
    in_flight: '发布处理中',
    unknown: '发布结果待对账',
    conflict: '发布版本冲突',
    failed: '发布失败',
  }[result.status];
}

export function publicationTone(result: CmsPublicationResult): StatusTone {
  if (result.status === 'failed' || result.status === 'conflict') return 'error';
  if (result.status !== 'committed') return 'warning';
  if (
    publicationBackend(result) === 'github' &&
    ['failed', 'cancelled'].includes(result.deploymentStatus)
  )
    return 'error';
  return 'success';
}

export function historyLabel(item: CmsHistoryItem): string {
  if (item.publication) return publicationLabel(item.publication);
  return {
    draft_created: '创建草稿',
    draft_saved: '保存草稿',
    draft_discarded: '废弃草稿',
    publication: '发布记录',
  }[item.kind];
}

/** 服务端生成的站内文章路径也做展示边界检查，拒绝协议相对 URL 和控制字符。 */
export function safePublicPath(path?: string | null): string | null {
  return path &&
    /^\/(?:zh\/)?(?:blog|stories)\/[^?#\\\s]+$/.test(path) &&
    !/[\u0000-\u001f\u007f]/.test(path)
    ? path
    : null;
}
