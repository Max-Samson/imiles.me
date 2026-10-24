import React from 'react';
import { FolderGit2 } from 'lucide-react';
import { useCollectionStore } from '../../upstream/features/collections/store';
import { useWorkbench } from '../context';

interface CollectionToolbarProps {
  className?: string;
}

/** 替代上游应用侧栏，只提供文章集合选择；账户和导航由 AdminShell 负责。 */
export function CollectionToolbar({ className = '' }: CollectionToolbarProps) {
  const { workspace, setActiveCollection } = useCollectionStore();
  const { confirmLeave } = useWorkbench();
  return (
    <div className={`cms-collection-toolbar flex flex-wrap items-center gap-2.5 ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-notion-border bg-notion-sidebar/60 px-3 py-1.5 shadow-2xs backdrop-blur-md">
        <FolderGit2 className="size-4 text-notion-muted" />
        <label htmlFor="cms-collection" className="text-xs font-medium text-notion-muted whitespace-nowrap">
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
            <option key={collection.id} value={collection.id} className="bg-notion-bg text-notion-text">
              {collection.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          草稿保存在 D1 · Git 提交与线上部署分别确认
        </span>
      </div>
    </div>
  );
}
