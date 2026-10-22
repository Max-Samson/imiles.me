import { useCollectionStore } from '../../upstream/features/collections/store';
import { useWorkbench } from '../context';

/** 替代上游应用侧栏，只提供文章集合选择；账户和导航由 AdminShell 负责。 */
export function CollectionToolbar() {
  const { workspace, setActiveCollection } = useCollectionStore();
  const { confirmLeave } = useWorkbench();
  return (
    <div className="cms-collection-toolbar">
      <label htmlFor="cms-collection">文章集合</label>
      <select id="cms-collection" value={workspace?.activeCollectionId ?? ''}
        onChange={(event) => {
          if (confirmLeave()) setActiveCollection(event.target.value);
        }}>
        {workspace?.collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
      </select>
      <span>仅内存编辑 · 保存与发布暂未开放</span>
    </div>
  );
}
