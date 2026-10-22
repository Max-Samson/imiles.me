import {
  AlertCircle,
  Box,
  Compass,
  ExternalLink,
  Highlighter as HighlighterIcon,
  Plus,
  Search,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { DocumentComponents } from './DocumentComponents';
import { useComponentInspector } from './InspectorContext';
import {
  canInsertComponent,
  getSavedSelectionText,
  restoreEditorSelection,
} from './insertion';
import {
  type ComponentCategory,
  type ContentComponentConfig,
  componentCategories,
  componentRegistry,
} from './registry';

function renderStaticExample(name: string) {
  switch (name) {
    case 'Highlighter':
      return (
        <div className="flex items-center justify-between text-[11px] rounded bg-notion-sidebar/60 px-2 py-1.5 border border-notion-border/40">
          <div className="flex items-center gap-2">
            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200 border-b-2 border-amber-400 font-medium">
              重点手绘高亮
            </span>
            <span className="inline-block px-1.5 py-0.5 rounded border border-rose-400/60 text-rose-600 dark:text-rose-300 text-[10px]">
              边框
            </span>
          </div>
          <span className="text-[10px] text-notion-muted">手绘动画</span>
        </div>
      );
    case 'PreviewLink':
      return (
        <div className="flex items-center justify-between text-[11px] rounded bg-blue-500/5 px-2 py-1.5 border border-blue-500/20">
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
            <ExternalLink className="h-3 w-3 text-blue-500 shrink-0" />
            <span>AskSoul.me</span>
          </div>
          <span className="text-[10px] text-notion-muted">悬浮卡片预览</span>
        </div>
      );
    case 'ExploreCard':
      return (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-notion-text flex items-center justify-between">
          <span className="font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <Compass className="h-3.5 w-3.5 text-amber-500" />
            Snippet of the Week
          </span>
          <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5 font-medium">
            折叠容器
          </span>
        </div>
      );
    case 'TechSkillsCloud':
      return (
        <div className="flex flex-wrap items-center gap-1 text-[10px] rounded bg-notion-sidebar/60 p-1.5 border border-notion-border/40">
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
            Vue 3
          </span>
          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-medium">
            React
          </span>
          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-medium">
            TypeScript
          </span>
          <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium">
            Three.js
          </span>
        </div>
      );
    case 'TechStackTerminal':
      return (
        <div className="rounded-md bg-slate-900 dark:bg-slate-950 p-2 font-mono text-[10px] text-sky-300 leading-tight border border-slate-800 shadow-inner">
          <div className="flex items-center gap-1 mb-1.5 opacity-60">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            <span className="ml-1 text-[9px] text-slate-400">terminal</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-400">❯</span>
            <span>profile.export()</span>
            <span className="animate-pulse text-sky-400 font-bold">_</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function ComponentLibrary() {
  const inspector = useComponentInspector();
  const [search, setSearch] = useState('');
  const [promptModal, setPromptModal] = useState<{
    open: boolean;
    component: ContentComponentConfig | null;
    defaultText: string;
  }>({ open: false, component: null, defaultText: '' });
  const [inputText, setInputText] = useState('');

  const isStories = inspector.collection === 'stories';

  const filteredComponents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return componentRegistry;
    return componentRegistry.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [search]);

  // Group filtered components by category
  const categorized = useMemo(() => {
    const map = new Map<ComponentCategory, ContentComponentConfig[]>();
    for (const cat of componentCategories) {
      map.set(cat, []);
    }
    for (const comp of filteredComponents) {
      const list = map.get(comp.category) ?? [];
      list.push(comp);
      map.set(comp.category, list);
    }
    return map;
  }, [filteredComponents]);

  const handleInsertClick = (component: ContentComponentConfig) => {
    // Check collection restriction
    const check = canInsertComponent(inspector.collection, component);
    if (!check.allowed) {
      alert(check.reason);
      return;
    }

    // Restore selection in editor
    restoreEditorSelection();
    const selectedText = getSavedSelectionText();

    if (component.kind === 'text') {
      if (selectedText) {
        // If text is selected in editor, wrap it immediately!
        inspector.executeInsert(component, selectedText);
      } else {
        // Prompt for text to wrap
        setInputText(component.defaultChildren || '高亮文字');
        setPromptModal({
          open: true,
          component,
          defaultText: component.defaultChildren || '高亮文字',
        });
      }
    } else {
      // Block component
      inspector.executeInsert(component);
    }
  };

  const handleConfirmPrompt = () => {
    if (promptModal.component) {
      restoreEditorSelection();
      inspector.executeInsert(promptModal.component, inputText || promptModal.defaultText);
    }
    setPromptModal({ open: false, component: null, defaultText: '' });
  };

  return (
    <div className="p-4 text-xs text-notion-text">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-notion-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索组件名称或说明…"
          className="w-full rounded-md border border-notion-border bg-notion-bg py-1.5 pl-8 pr-7 text-xs text-notion-text placeholder:text-notion-muted focus:border-notion-blue focus:ring-1 focus:ring-notion-blue/20 focus:outline-none transition-all shadow-2xs"
        />
        {Boolean(search) && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-2 p-0.5 rounded text-notion-muted hover:text-notion-text hover:bg-notion-hover"
            title="清空搜索"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Section 1: 本文已用 (Document Components Navigation) */}
      <DocumentComponents />

      {/* Divider */}
      <div className="mb-5 border-t border-notion-border" />

      {/* Section 2: 可添加组件 (Available Components) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-xs text-notion-text">可添加组件</span>
          <span className="text-[10px] text-notion-muted">按用途分类</span>
        </div>

        {isStories && (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5 leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              故事 (Stories) 为纯文本 Markdown，排版仅支持加粗、倾斜、换行与分隔线，不开放自定义组件插入。
            </span>
          </div>
        )}

        <div className="space-y-5">
          {componentCategories.map((category) => {
            const list = categorized.get(category) ?? [];
            if (list.length === 0) return null;

            const categoryIcon =
              category === '文字与链接' ? (
                <HighlighterIcon className="h-3 w-3 text-amber-500" />
              ) : category === '内容容器' ? (
                <Box className="h-3 w-3 text-blue-500" />
              ) : (
                <Sparkles className="h-3 w-3 text-purple-500" />
              );

            return (
              <div key={category} className="space-y-2">
                <div className="text-[11px] font-semibold text-notion-muted px-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {categoryIcon}
                    <span>{category}</span>
                  </span>
                  <span className="text-[10px] font-mono text-notion-muted/70">{list.length}</span>
                </div>

                <div className="space-y-2.5">
                  {list.map((comp) => {
                    return (
                      <div
                        key={comp.name}
                        className="group rounded-lg border border-notion-border bg-notion-sidebar/40 hover:bg-notion-sidebar/80 p-3 hover:border-notion-blue/40 transition-all shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-notion-text group-hover:text-notion-blue transition-colors">
                                {comp.label}
                              </span>
                              <span className="font-mono text-[10px] text-notion-muted">
                                &lt;{comp.name}&gt;
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-notion-muted leading-relaxed line-clamp-2">
                              {comp.description}
                            </p>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {/* Support Badge */}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-medium border ${
                                comp.supportLevel === 'configurable'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {comp.supportLevel === 'configurable' ? '可配置' : '需源码配置'}
                            </span>

                            {/* Insert Button */}
                            {!isStories && (
                              <LiquidGlassButton
                                type="button"
                                size="xs"
                                shape="rounded"
                                variant={comp.supportLevel === 'configurable' ? 'blue' : 'brand'}
                                glow={comp.supportLevel === 'configurable'}
                                icon={
                                  comp.supportLevel === 'configurable' ? (
                                    <Plus className="size-3.5" />
                                  ) : (
                                    <Terminal className="size-3.5" />
                                  )
                                }
                                onClick={() => handleInsertClick(comp)}
                                className="mt-1 font-medium"
                                title={
                                  comp.supportLevel === 'configurable'
                                    ? `在正文中插入${comp.label}`
                                    : `在正文中插入${comp.label}占位模板`
                                }
                              >
                                {comp.supportLevel === 'configurable' ? '插入' : '源码配置'}
                              </LiquidGlassButton>
                            )}
                          </div>
                        </div>

                        {/* Static Example Preview */}
                        <div className="mt-2.5 pt-2 border-t border-notion-border/40">
                          {renderStaticExample(comp.name)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prompt Modal for Inline Components without text selection */}
      {promptModal.open && promptModal.component && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg border border-notion-border bg-white dark:bg-slate-900 p-4 shadow-xl text-xs">
            <h4 className="font-semibold text-sm mb-1 text-notion-text">
              插入 {promptModal.component.label}
            </h4>
            <p className="text-[11px] text-notion-muted mb-3">
              当前正文未选中文字，请输入该组件需要包裹的显示文字：
            </p>
            <input
              type="text"
              autoFocus
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmPrompt();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setPromptModal({ open: false, component: null, defaultText: '' });
                }
              }}
              placeholder={promptModal.defaultText}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <div className="flex justify-end gap-2">
              <LiquidGlassButton
                type="button"
                size="xs"
                variant="ghost"
                shape="rounded"
                onClick={() => setPromptModal({ open: false, component: null, defaultText: '' })}
              >
                取消
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                size="xs"
                variant="blue"
                shape="rounded"
                glow
                onClick={handleConfirmPrompt}
              >
                插入到正文
              </LiquidGlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
