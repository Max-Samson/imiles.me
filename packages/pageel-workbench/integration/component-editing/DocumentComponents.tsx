import { ChevronDown, ChevronRight, CornerDownRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useComponentInspector } from './InspectorContext';
import { type DocumentComponentInstance, useDocumentComponents } from './useDocumentComponents';

export function DocumentComponents() {
  const inspector = useComponentInspector();
  const { grouped, totalCount, typeCount } = useDocumentComponents(inspector.content);

  // Keep track of collapsed groups (all expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const handleInstanceClick = (instance: DocumentComponentInstance) => {
    inspector.selectInstance(instance);
  };

  if (totalCount === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-notion-border p-4 text-center text-xs text-notion-muted">
        <Sparkles className="mx-auto mb-1.5 h-4 w-4 opacity-50" />
        <p>本文暂未使用自定义组件</p>
        <p className="mt-1 text-[11px] opacity-75">可在下方“可添加组件”中选择插入</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-notion-text">
        <div className="flex items-center gap-1.5">
          <span>本文已用</span>
          <span className="text-notion-muted font-normal">
            · {typeCount} 类 / {totalCount} 处
          </span>
        </div>
      </div>

      {/* Grouped Component Instances */}
      <div className="space-y-2">
        {grouped.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.name]);
          return (
            <div
              key={group.name}
              className="rounded-md border border-notion-border bg-notion-sidebar/50 overflow-hidden"
            >
              {/* Group Header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.name)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-notion-text hover:bg-notion-hover/70 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-notion-muted" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-notion-muted" />
                  )}
                  <span className="font-semibold">{group.label}</span>
                </div>
                <span className="rounded-full bg-notion-border/70 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-notion-muted">
                  {group.count}
                </span>
              </button>

              {/* Instances List */}
              {!isCollapsed && (
                <div className="border-t border-notion-border/60 divide-y divide-notion-border/40 bg-notion-bg">
                  {group.instances.map((inst) => {
                    const isSelected = inspector.selectedInstanceId === inst.id;
                    const isNested = inst.depth > 0;
                    return (
                      <button
                        type="button"
                        key={inst.id}
                        onClick={() => handleInstanceClick(inst)}
                        style={{ paddingLeft: isNested ? `${inst.depth * 16 + 12}px` : '12px' }}
                        className={`group flex w-full items-center justify-between py-2 pr-3 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border-l-2 border-blue-500'
                            : 'text-notion-text hover:bg-notion-hover/50'
                        }`}
                        title={`点击在正文中定位并配置参数：${inst.displayTitle}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isNested && (
                            <CornerDownRight className="h-3.5 w-3.5 text-notion-muted/70 shrink-0" />
                          )}
                          <span className="truncate text-[11px]">
                            {inst.label} · <span className="opacity-80 font-normal">{inst.summary}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-[10px] font-mono text-notion-muted/70">
                            #{inst.indexInType + 1}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 transition-opacity">
                            →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
