import React, { useEffect, useState } from 'react';
import { AlertTriangle, FolderGit2, GitBranch, ShieldCheck } from 'lucide-react';
import { cmsDocumentClient, type CmsSessionInfo } from '../../../../src/lib/admin/cms-document-client';
import { useCollectionStore } from '../../upstream/features/collections/store';
import { useWorkbench } from '../context';

interface CollectionToolbarProps {
  className?: string;
}

/** 替代上游应用侧栏，提供文章集合选择与当前 GitHub 分支隔离环境指示。 */
export function CollectionToolbar({ className = '' }: CollectionToolbarProps) {
  const { workspace, setActiveCollection } = useCollectionStore();
  const { confirmLeave } = useWorkbench();
  const [session, setSession] = useState<CmsSessionInfo | null>(null);

  useEffect(() => {
    let active = true;
    cmsDocumentClient
      .session()
      .then((info) => {
        if (active) setSession(info);
      })
      .catch(() => {
        if (active)
          setSession({
            mode: 'snapshot',
            repo: 'local/content-snapshot',
            branch: 'local',
            isProductionBranch: false,
            isTestBranch: false,
            isConfigured: false,
            writable: false,
          });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={`cms-collection-toolbar flex flex-wrap items-center gap-2.5 ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-notion-border bg-notion-sidebar/60 px-3 py-1.5 shadow-2xs backdrop-blur-md">
        <FolderGit2 className="size-4 text-notion-muted" />
        <label
          htmlFor="cms-collection"
          className="text-xs font-medium text-notion-muted whitespace-nowrap"
        >
          文章集合
        </label>
        <select
          id="cms-collection"
          value={workspace?.activeCollectionId ?? ''}
          onChange={(event) => {
            const nextCollection = event.target.value;
            void confirmLeave().then((allowed) => {
              if (allowed) setActiveCollection(nextCollection);
            });
          }}
          className="rounded-lg border border-notion-border bg-notion-bg px-2.5 py-1 text-xs font-semibold text-notion-text focus:outline-none focus:ring-2 focus:ring-notion-blue/20 focus:border-notion-blue transition-all cursor-pointer shadow-2xs"
        >
          {workspace?.collections.map((collection) => (
            <option
              key={collection.id}
              value={collection.id}
              className="bg-notion-bg text-notion-text"
            >
              {collection.name}
            </option>
          ))}
        </select>
      </div>

      {session && (
        <div className="flex items-center">
          {session.mode === 'snapshot' ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20 shadow-2xs whitespace-nowrap"
              title="本地开发快照模式：未配置远程 GitHub Token，无法发布到远程，调试不会影响线上"
            >
              <GitBranch className="size-3.5 text-zinc-400 shrink-0" />
              本地快照只读 · 隔离安全
            </span>
          ) : session.isTestBranch ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs whitespace-nowrap"
              title={`目标仓库: ${session.repo} | 本地调试分支: ${session.branch}。此分支不会触发 GitHub Actions 生产部署，本地调试内容与线上生产完全隔离。`}
            >
              <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
              本地调试分支: <strong className="font-mono">{session.branch}</strong> · 不影响生产
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs whitespace-nowrap"
              title={`目标仓库: ${session.repo} | 生产主分支: ${session.branch}。⚠️ 警告：在此分支发布将触发 GitHub Actions 全站自动构建并上线生产环境！`}
            >
              <AlertTriangle className="size-3.5 text-rose-500 shrink-0" />
              生产分支: <strong className="font-mono">{session.branch}</strong> · 发布将触发上线
            </span>
          )}
        </div>
      )}

      <div className="flex items-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          草稿保存在 D1 · Git 提交与部署分别确认
        </span>
      </div>
    </div>
  );
}
