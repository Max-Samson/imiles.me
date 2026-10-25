import { useCallback, useEffect, useRef, useState } from 'react';
import { cmsDocumentClient } from '../../../../src/lib/admin/cms-document-client';
import type { CmsHistoryItem } from '../../../../src/shared/admin/cms-history';

/** 仅在状态面板可见时查询；文稿切换、关闭和新一轮刷新会使旧请求失效。 */
export function useCmsHistory(path: string | null, active: boolean, version: number) {
  const [items, setItems] = useState<CmsHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const failedCursor = useRef<string | undefined>(undefined);
  const request = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      if (!path || !active || request.current) return;
      failedCursor.current = cursor;
      const controller = new AbortController();
      const current = generation.current;
      request.current = controller;
      setLoading(true);
      setError('');
      try {
        const page = await cmsDocumentClient.history(path, cursor, controller.signal);
        if (controller.signal.aborted || current !== generation.current) return;
        setItems((previous) =>
          cursor
            ? [
                ...previous,
                ...page.items.filter((item) => !previous.some((old) => old.id === item.id)),
              ]
            : page.items,
        );
        setNextCursor(page.nextCursor);
        setLoaded(true);
      } catch (failure) {
        if (!controller.signal.aborted && current === generation.current) {
          setError(failure instanceof Error ? failure.message : '历史记录加载失败');
        }
      } finally {
        if (request.current === controller) {
          request.current = null;
          setLoading(false);
        }
      }
    },
    [path, active],
  );

  useEffect(() => {
    // version 由成功保存/发布/核验推进，refresh 只由用户刷新推进，不随正文键入变化。
    void version;
    void refresh;
    generation.current += 1;
    request.current?.abort();
    request.current = null;
    setLoading(false);
    if (active && path) void fetchPage();
    return () => {
      generation.current += 1;
      request.current?.abort();
      request.current = null;
    };
  }, [path, active, version, refresh, fetchPage]);

  return {
    items,
    nextCursor,
    loading,
    loaded,
    error,
    retry: () => fetchPage(failedCursor.current),
    reload: () => setRefresh((value) => value + 1),
    loadMore: () => (nextCursor ? fetchPage(nextCursor) : Promise.resolve()),
  };
}
