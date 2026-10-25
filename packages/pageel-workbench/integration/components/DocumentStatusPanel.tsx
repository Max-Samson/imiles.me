import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  FileText,
  GitCommitHorizontal,
  History,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  cmsDocumentClient,
  type CmsDraftSummary,
  type CmsPublicationResult,
} from '../../../../src/lib/admin/cms-document-client';
import type { CmsHistoryItem, CmsHistorySnapshot } from '../../../../src/shared/admin/cms-history';
import {
  deploymentLabels,
  historyLabel,
  publicationBackend,
  publicationLabel,
  publicationTone,
  safePublicPath,
  type StatusNotice,
  type StatusTone,
} from '../status-model';
import { useCmsHistory } from './useCmsHistory';

interface Props {
  active: boolean;
  path: string | null;
  version: number;
  draft?: CmsDraftSummary;
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
  notice: StatusNotice | null;
  saveNotice: StatusNotice | null;
  publication: CmsPublicationResult | null;
  lastCommit: CmsPublicationResult | null;
  checkingDeployment: boolean;
  onVerifyDeployment: () => void;
  repoName: string;
}

const toneClasses: Record<StatusTone, string> = {
  success: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
  error: 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400',
  warning: 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400',
  info: 'border-notion-border bg-notion-sidebar/40 text-notion-muted',
};
const dateLabel = (value: number) =>
  new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
const timeLabel = (value: number) =>
  new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

function Notice({ notice }: { notice: StatusNotice | null }) {
  return notice ? (
    <p
      className={`rounded-lg border p-3 text-xs leading-relaxed break-words ${toneClasses[notice.tone]}`}
    >
      {notice.message}
    </p>
  ) : null;
}

function Snapshot({ path, item, active }: { path: string; item: CmsHistoryItem; active: boolean }) {
  const [snapshot, setSnapshot] = useState<CmsHistorySnapshot | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setError('');
    setSnapshot(null);
    cmsDocumentClient
      .historySnapshot(path, item.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSnapshot(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : '历史版本加载失败');
      });
    return () => controller.abort();
  }, [path, item.id, active, retry]);
  return (
    <div
      id={`snapshot-${item.id}`}
      className="mt-2 rounded-lg border border-notion-border bg-notion-bg p-2.5 text-xs"
    >
      <p className="mb-2 text-[11px] text-notion-muted">只读源文 · 不会替换当前编辑内容</p>
      {error ? (
        <div>
          <p role="alert" className="text-red-600 dark:text-red-400 break-words">
            {error}
          </p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            重试查看
          </button>
        </div>
      ) : snapshot ? (
        <pre
          tabIndex={0}
          aria-label="历史版本源文（只读）"
          className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-notion-text"
        >
          {snapshot.source}
        </pre>
      ) : (
        <p role="status" className="text-notion-muted">
          正在读取历史版本…
        </p>
      )}
    </div>
  );
}

function HistoryEntry({
  item,
  path,
  open,
  active,
  toggle,
}: {
  item: CmsHistoryItem;
  path: string;
  open: boolean;
  active: boolean;
  toggle: () => void;
}) {
  const result = item.publication;
  const tone = result
    ? publicationTone(result)
    : item.kind === 'draft_discarded'
      ? 'warning'
      : 'info';
  const backend = result ? publicationBackend(result) : null;
  const Icon = result
    ? tone === 'error'
      ? AlertCircle
      : tone === 'warning'
        ? Clock3
        : Check
    : FileText;
  return (
    <li className="cms-history-entry relative pb-5 pl-7 last:pb-0">
      <span
        className={`absolute left-0 top-0.5 flex size-5 items-center justify-center rounded-full border ${toneClasses[tone]}`}
      >
        <Icon aria-hidden="true" className="size-3" />
      </span>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-medium text-notion-text leading-5">{historyLabel(item)}</h4>
        <time
          className="shrink-0 text-[10px] tabular-nums leading-5 text-notion-muted"
          dateTime={new Date(item.occurredAt).toISOString()}
          title={new Date(item.occurredAt).toLocaleString('zh-CN')}
        >
          {timeLabel(item.occurredAt)}
        </time>
      </div>
      <p className="mt-0.5 text-[11px] text-notion-muted">
        修订 {item.revision} <span aria-hidden="true">·</span> 草稿 {item.draftId.slice(-6)}
        {backend && backend !== 'unknown' ? ` · ${backend === 'd1' ? 'D1' : 'GitHub'}` : ''}
      </p>
      {result?.status === 'committed' && backend === 'github' && (
        <p className="mt-1 text-[11px] text-notion-muted">
          {deploymentLabels[result.deploymentStatus]}
        </p>
      )}
      {result?.errorCode && (
        <p className="mt-1 break-words text-[11px] leading-relaxed text-red-600 dark:text-red-400">
          {result.errorCode}
        </p>
      )}
      {result?.resultCommitSha && backend === 'github' && (
        <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-notion-muted">
          <GitCommitHorizontal className="size-3" aria-hidden="true" />
          {result.resultCommitSha.slice(0, 12)}
        </p>
      )}
      {item.canViewSnapshot && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`snapshot-${item.id}`}
          onClick={toggle}
          className="mt-1.5 inline-flex min-h-7 items-center gap-1 text-[11px] text-notion-muted hover:text-notion-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text"
        >
          {open ? '收起版本' : '查看版本'}
          {open ? (
            <ChevronUp className="size-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3" aria-hidden="true" />
          )}
        </button>
      )}
      {open && <Snapshot path={path} item={item} active={active} />}
    </li>
  );
}

/** 状态与历史独立于正文编辑器；历史查看只读，失败不会阻止继续编辑。 */
export function DocumentStatusPanel(props: Props) {
  const history = useCmsHistory(props.path, props.active, props.version);
  const [openId, setOpenId] = useState<string | null>(null);
  const current = props.publication;
  const last = props.lastCommit;
  const lastBackend = last ? publicationBackend(last) : 'unknown';
  const publicPath = safePublicPath(last?.publicPath);
  const runUrl =
    last &&
    lastBackend === 'github' &&
    /^\d+$/.test(last.deploymentRef ?? '') &&
    /^[\w.-]+\/[\w.-]+$/.test(props.repoName)
      ? `https://github.com/${props.repoName}/actions/runs/${last.deploymentRef}`
      : null;
  const groups: { label: string; items: CmsHistoryItem[] }[] = [];
  for (const item of history.items) {
    const label = dateLabel(item.occurredAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1)?.items.push(item);
  }

  return (
    <div className="cms-status-panel space-y-5 p-4">
      <section
        aria-label="当前文稿状态"
        className="rounded-xl border border-notion-border bg-notion-bg p-3.5 shadow-2xs"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-notion-text">当前文稿</h3>
          <span className="rounded border border-notion-border px-1.5 py-0.5 text-[10px] text-notion-muted">
            工作区
          </span>
        </div>
        <p className="flex items-center gap-2 text-sm font-medium text-notion-text">
          {props.saving || props.publishing ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <span
              className={`size-2 rounded-full ${props.dirty ? 'bg-amber-500' : props.draft ? 'bg-emerald-500' : 'bg-notion-muted/50'}`}
            />
          )}
          {props.publishing
            ? '正在发布…'
            : props.saving
              ? '正在保存…'
              : props.dirty
                ? '有未保存修改'
                : props.draft
                  ? '草稿已保存'
                  : last
                    ? '无待保存修改'
                    : '尚未保存为草稿'}
        </p>
        {props.draft && (
          <p className="mt-2 text-[11px] text-notion-muted">
            修订 {props.draft.revision} ·{' '}
            {new Date(props.draft.updatedAt).toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </p>
        )}
        {(props.dirty || props.draft) && (
          <p className="mt-2 text-[11px] leading-relaxed text-notion-muted">
            {props.dirty ? '当前输入尚未全部保存。' : '保存草稿不会更新线上文章。'}
          </p>
        )}
      </section>

      <div className="space-y-2" aria-label="操作反馈">
        <Notice notice={props.saveNotice} />
        <Notice notice={props.notice} />
      </div>

      <section
        aria-label="最近发布状态"
        className="rounded-xl border border-notion-border bg-notion-bg p-3.5 shadow-2xs space-y-2.5"
      >
        <h3 className="text-xs font-semibold text-notion-text">最近发布</h3>
        {current && current.status !== 'committed' && !props.notice && (
          <div
            className={`rounded-lg border p-2.5 text-xs ${toneClasses[publicationTone(current)]}`}
          >
            <p className="font-medium">本次：{publicationLabel(current)}</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              {['prepared', 'in_flight', 'unknown'].includes(current.status)
                ? '请使用顶部“对账”，继续查询同一操作，勿重复新建发布。'
                : '草稿仍保留，可处理后重新发布。'}
            </p>
          </div>
        )}
        {last ? (
          <>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-notion-text">
                {current && current.operationId !== last.operationId ? '上次成功' : '最近成功'} ·
                修订 {last.draftRevision}
              </span>
              <span className="shrink-0 rounded bg-notion-sidebar px-1.5 py-0.5 text-[10px] text-notion-muted">
                {lastBackend === 'd1' ? 'D1' : lastBackend === 'github' ? 'GitHub' : '通道未记录'}
              </span>
            </div>
            {last.completedAt && (
              <time
                className="block text-[11px] text-notion-muted"
                dateTime={new Date(last.completedAt).toISOString()}
              >
                {new Date(last.completedAt).toLocaleString('zh-CN', { hour12: false })}
              </time>
            )}
            <p className="text-[11px] leading-relaxed text-notion-muted">
              {lastBackend === 'd1'
                ? '已写入 D1，无需等待构建；此状态不代表已核验公网页面。'
                : lastBackend === 'github'
                  ? deploymentLabels[last.deploymentStatus]
                  : '已记录成功发布；历史通道信息不完整。'}
            </p>
            {lastBackend === 'github' && last.resultCommitSha && (
              <p className="font-mono text-[11px] text-notion-muted">
                Git {last.resultCommitSha.slice(0, 12)}
              </p>
            )}
            {(props.dirty || props.draft) && (
              <p className="rounded-lg bg-amber-500/5 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                上次成功不代表当前工作区的修改已上线。
              </p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-notion-border pt-2.5 text-[11px]">
              {lastBackend === 'github' && (
                <button
                  type="button"
                  disabled={props.checkingDeployment}
                  onClick={props.onVerifyDeployment}
                  className="underline underline-offset-2 disabled:opacity-50"
                >
                  {props.checkingDeployment ? '检查中…' : '检查部署'}
                </button>
              )}
              {runUrl && (
                <a
                  href={runUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Deploy 记录 ↗
                </a>
              )}
              {publicPath && (
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-notion-text hover:underline underline-offset-2"
                >
                  查看当前线上版
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-notion-muted">
            暂无已记录的成功发布。已有线上文章不一定有 CMS 发布记录。
          </p>
        )}
      </section>

      <section aria-label="文稿历史记录">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-notion-text">
            <History aria-hidden="true" className="size-3.5" />
            文稿历史
          </h3>
          <button
            type="button"
            disabled={!props.path || history.loading}
            onClick={history.reload}
            aria-label="刷新历史记录"
            className="flex size-7 items-center justify-center rounded-md text-notion-muted hover:bg-notion-hover hover:text-notion-text disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-notion-text"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3.5 ${history.loading ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
          </button>
        </div>
        {!props.path ? (
          <p className="rounded-lg border border-dashed border-notion-border p-4 text-xs leading-relaxed text-notion-muted">
            首次保存草稿后，这里会显示修改与发布记录。
          </p>
        ) : (
          <>
            {history.error && (
              <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs">
                <p role="alert" className="break-words text-red-600 dark:text-red-400">
                  {history.error}
                </p>
                <button
                  type="button"
                  disabled={history.loading}
                  onClick={() => void history.retry()}
                  className="mt-2 text-notion-text underline"
                >
                  重试加载
                </button>
              </div>
            )}
            {history.loading && !history.loaded && (
              <div role="status" className="space-y-3 rounded-lg border border-notion-border p-3">
                <p className="text-xs text-notion-muted">正在加载历史记录…</p>
                <div
                  aria-hidden="true"
                  className="h-3 w-3/4 rounded bg-notion-hover animate-pulse motion-reduce:animate-none"
                />
                <div
                  aria-hidden="true"
                  className="h-3 w-1/2 rounded bg-notion-hover animate-pulse motion-reduce:animate-none"
                />
              </div>
            )}
            {history.loaded && history.items.length === 0 && (
              <div className="rounded-lg border border-dashed border-notion-border p-4 text-center">
                <History aria-hidden="true" className="mx-auto mb-2 size-5 text-notion-muted/60" />
                <p className="text-xs text-notion-muted">暂无历史记录</p>
                <p className="mt-1 text-[11px] leading-relaxed text-notion-muted">
                  下一次成功保存或发布后会显示在这里。
                </p>
              </div>
            )}
            <div aria-busy={history.loading} className="space-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <h4 className="mb-3 text-[10px] font-medium tracking-wide text-notion-muted">
                    {group.label}
                  </h4>
                  <ol className="cms-history-list">
                    {group.items.map((item) => (
                      <HistoryEntry
                        key={item.id}
                        item={item}
                        path={props.path ?? ''}
                        active={props.active}
                        open={openId === item.id}
                        toggle={() => setOpenId((value) => (value === item.id ? null : item.id))}
                      />
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            {history.nextCursor && (
              <button
                type="button"
                disabled={history.loading}
                onClick={() => void history.loadMore()}
                className="mt-4 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-notion-border text-xs text-notion-muted hover:bg-notion-hover hover:text-notion-text disabled:opacity-50"
              >
                {history.loading ? '加载中…' : '加载更早记录'}
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </>
        )}
        <p className="mt-4 border-t border-notion-border pt-3 text-[10px] leading-relaxed text-notion-muted">
          仅记录成功保存的修改与发布尝试。不包含未保存输入；历史功能启用前已覆盖的修订无法补回。发布记录展示该操作的最新已知结果。
        </p>
      </section>
    </div>
  );
}
