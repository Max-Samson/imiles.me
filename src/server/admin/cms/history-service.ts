import type { CmsHistoryPage } from '../../../shared/admin/cms-history';
import { NotFoundError, ValidationError } from '../../errors';
import type { CmsHistoryRepository, HistoryPosition } from './history-repository';
import { contentPath } from './policy';

const eventId =
  /^(?:revision:cmr_[a-f0-9]{32}|publication:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|discard:cmd_[a-f0-9]{32})$/i;

/** 游标只携带公开元数据，不是授权凭证；路径绑定防止将另一篇文章的游标误用。 */
function decodeCursor(cursor: string, path: string): HistoryPosition {
  try {
    if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const bytes = Uint8Array.from(atob(cursor.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
      char.charCodeAt(0),
    );
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (
      value.v !== 1 ||
      value.path !== path ||
      !Number.isSafeInteger(value.at) ||
      value.at < 0 ||
      typeof value.id !== 'string' ||
      !eventId.test(value.id)
    )
      throw new Error();
    return { at: value.at, id: value.id };
  } catch {
    throw new ValidationError('历史游标无效，请刷新历史记录');
  }
}

function encodeCursor(path: string, position: HistoryPosition): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, path, ...position }));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** 业务层只依赖历史仓储，不接收 HTTP 对象或环境绑定，也不触发发布/部署核验。 */
export function historyService(repository: CmsHistoryRepository) {
  return {
    async list(input: { path: string; limit?: number; cursor?: string }): Promise<CmsHistoryPage> {
      const path = contentPath(input.path);
      const limit = input.limit ?? 20;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
        throw new ValidationError('历史每页条数必须在 1 至 50 之间');
      const before = input.cursor === undefined ? undefined : decodeCursor(input.cursor, path);
      const rows = await repository.list(path, limit + 1, before);
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > limit && last
            ? encodeCursor(path, { at: last.occurredAt, id: last.id })
            : null,
      };
    },
    async snapshot(path: string, id: string) {
      contentPath(path);
      if (!eventId.test(id) || id.startsWith('discard:'))
        throw new ValidationError('历史版本 ID 无效');
      const snapshot = await repository.snapshot(path, id);
      if (!snapshot) throw new NotFoundError('历史版本不存在或未保留源文快照');
      return snapshot;
    },
  };
}
