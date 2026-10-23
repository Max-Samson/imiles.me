import React from 'react';
import { FolderGit2 } from 'lucide-react';
import { useCollectionStore } from '../../upstream/features/collections/store';
import { useWorkbench } from '../context';

/** 替代上游应用侧栏，只提供文章集合选择；账户和导航由 AdminShell 负责。 */
export function CollectionToolbar() {
  const { workspace, setActiveCollection } = useCollectionStore();
  const { confirmLeave } = useWorkbench();
  return (
    <div className="cms-collection-toolbar">
      <div className="flex items-center gap-2">
        <FolderGit2 className="size-4 text-notion-muted" />
        <label htmlFor="cms-collection" className="text-xs font-medium text-notion-muted">
          文章集合
        </label>
        <select
          id="cms-collection"
          value={workspace?.activeCollectionId ?? ''}
          onChange={(event) => {
            if (confirmLeave()) setActiveCollection(event.target.value);
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

      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          仅内存编辑 · 保存与发布暂未开放
        </span>
      </div>
    </div>
  );
}
