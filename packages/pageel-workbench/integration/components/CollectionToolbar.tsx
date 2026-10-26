import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Database, FolderGit2, GitBranch, ShieldCheck } from 'lucide-react';
import { cmsDocumentClient, type CmsSessionInfo } from '../../../../src/lib/admin/cms-document-client';
import { useCollectionStore } from '../../upstream/features/collections/store';
import { useWorkbench } from '../context';

interface CollectionToolbarProps {
  className?: string;
}

const CollectionDropdown: React.FC<{
  activeCollectionId: string;
  collections: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
}> = ({ activeCollectionId, collections, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [isOpen]);

  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const displayName = activeCollection?.name || '文章集合';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-notion-border bg-notion-bg text-xs font-semibold text-notion-text hover:bg-notion-hover focus:outline-none focus:ring-2 focus:ring-notion-blue/20 transition-all cursor-pointer shadow-2xs"
        aria-expanded={isOpen}
      >
        <span>{displayName}</span>
        <ChevronDown
          className={`size-3 text-notion-muted shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[160px] rounded-xl border border-notion-border bg-notion-bg p-1 shadow-xl animate-in fade-in-0 zoom-in-95">
          <div className="py-1 px-2 text-[10px] font-semibold text-notion-muted/80 uppercase tracking-wider">
            文章集合
          </div>
          {collections.map((col) => {
            const isSelected = col.id === activeCollectionId;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => {
                  onSelect(col.id);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                  isSelected
                    ? 'bg-notion-blue/10 text-notion-blue font-semibold'
                    : 'text-notion-text hover:bg-notion-hover'
                }`}
              >
                <span>{col.name}</span>
                {isSelected && <Check className="size-3.5 text-notion-blue shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
    <div className={`cms-collection-toolbar flex w-full flex-wrap items-center justify-between sm:justify-end gap-2 sm:w-auto ${className}`}>
      <div className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-notion-border bg-notion-sidebar/60 px-2.5 sm:px-3 shadow-2xs">
        <FolderGit2 className="size-4 shrink-0 text-notion-muted" />
        <span className="text-xs font-medium text-notion-muted whitespace-nowrap">
          文章集合
        </span>
        <CollectionDropdown
          activeCollectionId={workspace?.activeCollectionId ?? ''}
          collections={workspace?.collections || []}
          onSelect={(nextCollection) => {
            void confirmLeave().then((allowed) => {
              if (allowed) setActiveCollection(nextCollection);
            });
          }}
        />
      </div>

      {session && (
        <div className="flex items-center">
          {session.mode === 'd1' ? (
            <span
              className="inline-flex h-9 items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap"
              title="Cloudflare D1 存储模式：文章直接存取于生产 D1 数据库，发布即时同步全站前台，无需等待构建"
            >
              <Database className="size-3.5 text-emerald-500 shrink-0" />
              <span className="sm:hidden">D1 即时发布</span><span className="hidden sm:inline">D1 数据库模式 · 即时同步</span>
            </span>
          ) : session.mode === 'snapshot' ? (
            <span
              className="inline-flex h-9 items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20 whitespace-nowrap"
              title="本地开发快照模式：未配置远程 GitHub Token，无法发布到远程，调试不会影响线上"
            >
              <GitBranch className="size-3.5 text-zinc-400 shrink-0" />
              本地快照只读 · 隔离安全
            </span>
          ) : session.isTestBranch ? (
            <span
              className="inline-flex h-9 items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap"
              title={`目标仓库: ${session.repo} | 本地调试分支: ${session.branch}。此分支不会触发 GitHub Actions 生产部署，本地调试内容与线上生产完全隔离。`}
            >
              <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
              本地调试分支: <strong className="font-mono">{session.branch}</strong> · 不影响生产
            </span>
          ) : (
            <span
              className="inline-flex h-9 items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap"
              title={`目标仓库: ${session.repo} | 生产主分支: ${session.branch}。⚠️ 警告：在此分支发布将触发 GitHub Actions 全站自动构建并上线生产环境！`}
            >
              <AlertTriangle className="size-3.5 text-rose-500 shrink-0" />
              生产分支: <strong className="font-mono">{session.branch}</strong> · 发布将触发上线
            </span>
          )}
        </div>
      )}

      {session?.mode === 'd1' ? (
        <div className="hidden items-center sm:flex">
          <span className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 whitespace-nowrap">
            <span className="size-1.5 rounded-full bg-blue-500" />
            草稿自动暂存 · 发布即时生效
          </span>
        </div>
      ) : (
        <div className="hidden items-center sm:flex">
          <span className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            草稿保存在 D1 · Git 提交与部署分别确认
          </span>
        </div>
      )}
    </div>
  );
}
