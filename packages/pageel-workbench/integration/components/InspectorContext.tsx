import type { JsxEditorProps } from '@mdxeditor/editor';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ComponentLibrary } from './ComponentLibrary';
import { ComponentProperties } from './ComponentProperties';
import {
  type InsertJsxHandler,
  buildInsertPayload,
  canInsertComponent,
} from '../insertion';
import { type ContentComponentConfig, findComponent } from '../component-config';
import type { DocumentComponentInstance } from './useDocumentComponents';

export type InspectorMode = 'article' | 'status' | 'library' | 'component';

export interface SelectedComponentData {
  id?: string;
  name: string;
  summary: string;
  instanceContext?: string;
  attributes: Record<string, string>;
  rawNode?: JsxEditorProps['mdastNode'] | null;
  applyAttributes?: (values: Record<string, string>) => void;
}

export interface JsxNodeEntry {
  id: string;
  name: string;
  mdastNode: JsxEditorProps['mdastNode'];
  domElement: HTMLDivElement | null;
  updateAttributes: (values: Record<string, string>) => void;
}

interface InspectorState {
  mode: InspectorMode;
  setMode: (mode: InspectorMode) => void;
  selectedId: string | null;
  selectedInstanceId: string | null;
  selectedComponent: SelectedComponentData | null;
  content: string;
  setContent: (content: string) => void;
  collection: string;
  setCollection: (collection: string) => void;
  // Node actions
  selectNode: (
    id: string,
    mdastNode: JsxEditorProps['mdastNode'],
    applyAttributes: (values: Record<string, string>) => void,
  ) => void;
  selectInstance: (instance: DocumentComponentInstance) => void;
  returnToLibrary: () => void;
  // Registration
  registerNode: (id: string, entry: JsxNodeEntry) => void;
  unregisterNode: (id: string) => void;
  // Insertion
  setInsertHandler: (handler: InsertJsxHandler | null) => void;
  executeInsert: (
    component: ContentComponentConfig,
    text?: string,
    props?: Record<string, string>,
  ) => boolean;
  // Legacy compatibility target ref
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
  selected: string | null;
  select: (id: string | null) => void;
}

const Context = createContext<InspectorState | null>(null);

export function ComponentEditingProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<InspectorMode>('article');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<SelectedComponentData | null>(null);
  const [content, setContent] = useState<string>('');
  const [collection, setCollection] = useState<string>('blog');
  const [target, setTarget] = useState<HTMLDivElement | null>(null);

  const registeredNodes = useRef<Map<string, JsxNodeEntry>>(new Map());
  const insertHandlerRef = useRef<InsertJsxHandler | null>(null);

  const pendingInsert = useRef<string | null>(null);

  const registerNode = useCallback((id: string, entry: JsxNodeEntry) => {
    const isNew = !registeredNodes.current.has(id);
    registeredNodes.current.set(id, entry);
    if (isNew && pendingInsert.current === entry.name) {
      pendingInsert.current = null;
      // 使用真实节点触发选择，属性面板随后持有官方更新回调。
      entry.domElement?.click();
    }
  }, []);

  const unregisterNode = useCallback((id: string) => {
    registeredNodes.current.delete(id);
    setSelectedId(current => current === id ? null : current);
    setSelectedComponent(current => current?.id === id ? null : current);
  }, []);

  const setInsertHandler = useCallback((handler: InsertJsxHandler | null) => {
    insertHandlerRef.current = handler;
  }, []);

  // When a node in the editor is directly clicked/focused
  const selectNode = useCallback(
    (
      id: string,
      mdastNode: JsxEditorProps['mdastNode'],
      applyAttributes: (values: Record<string, string>) => void,
    ) => {
      // MDX 片段没有组件名，不登记为可配置组件，避免伪造字符串名称。
      if (!mdastNode.name) return;
      const name = mdastNode.name;
      setSelectedId(id);
      setSelectedInstanceId(id);

      // Extract literal attributes
      const attributes: Record<string, string> = {};
      for (const attr of mdastNode.attributes) {
        if (attr.type === 'mdxJsxAttribute' && typeof attr.value === 'string') {
          attributes[attr.name] = attr.value;
        }
      }

      const config = findComponent(mdastNode.name);
      setSelectedComponent(previous => previous?.id === id && JSON.stringify(previous.rawNode?.attributes) === JSON.stringify(mdastNode.attributes) ? previous : {
        id,
        name,
        summary: attributes.title || attributes.href || attributes.headingId || config?.label || '',
        instanceContext: `${config?.label || mdastNode.name} · 参数配置`,
        attributes,
        rawNode: mdastNode,
        applyAttributes,
      });

      setMode('component');
    },
    [],
  );

  // When an instance in "本文已用" is clicked
  const selectInstance = useCallback((instance: DocumentComponentInstance) => {
    setSelectedInstanceId(instance.id);

    // Locate the matching DOM element in document order
    const elements = Array.from(
      [...registeredNodes.current.values()].filter(entry => entry.name === instance.name && entry.domElement).map(entry => entry.domElement!),
    );
    const targetEl = elements.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)[instance.indexInType];

    let foundEntry: JsxNodeEntry | undefined;

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add temporary highlight outline animation
      targetEl.classList.remove('cms-target-highlight');
      // trigger reflow
      void targetEl.offsetWidth;
      targetEl.classList.add('cms-target-highlight');

      // Find registered node matching this element
      for (const entry of registeredNodes.current.values()) {
        if (entry.domElement === targetEl) {
          foundEntry = entry;
          break;
        }
      }
    }

    if (foundEntry) {
      setSelectedId(foundEntry.id);
      setSelectedComponent({
        id: foundEntry.id,
        name: foundEntry.name,
        summary: instance.summary,
        instanceContext: `本文第 ${instance.indexInType + 1} 处 · ${instance.summary}`,
        attributes: { ...instance.attributes },
        rawNode: foundEntry.mdastNode,
        applyAttributes: foundEntry.updateAttributes,
      });
    } else {
      setSelectedId(instance.id);
      setSelectedComponent({
        id: instance.id,
        name: instance.name,
        summary: instance.summary,
        instanceContext: `本文第 ${instance.indexInType + 1} 处 · ${instance.summary}`,
        attributes: { ...instance.attributes },
        rawNode: null,
      });
    }

    setMode('component');
  }, []);

  const returnToLibrary = useCallback(() => {
    setMode('library');
  }, []);

  const executeInsert = useCallback(
    (component: ContentComponentConfig, text?: string, props?: Record<string, string>) => {
      if (!insertHandlerRef.current) {
        alert('编辑器尚未就绪，请先在编辑器正文中点击确定插入位置。');
        return false;
      }

      const allowed = canInsertComponent(collection, component);
      if (!allowed.allowed) { alert(allowed.reason); return false; }
      const payload = buildInsertPayload(component, text, props);
      try {
        pendingInsert.current = component.name;
        insertHandlerRef.current(payload);
        return true;
      } catch (err) {
        pendingInsert.current = null;
        console.error('Insert JSX failed:', err);
        alert(err instanceof Error ? err.message : '插入失败');
        return false;
      }
    },
    [collection],
  );

  // Backward compatibility legacy methods
  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id) {
        const entry = registeredNodes.current.get(id);
        if (entry) {
          selectNode(id, entry.mdastNode, entry.updateAttributes);
        } else {
          setMode('component');
        }
      }
    },
    [selectNode],
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      selectedId,
      selectedInstanceId,
      selectedComponent,
      content,
      setContent,
      collection,
      setCollection,
      selectNode,
      selectInstance,
      returnToLibrary,
      registerNode,
      unregisterNode,
      setInsertHandler,
      executeInsert,
      target,
      setTarget,
      selected: selectedId,
      select,
    }),
    [
      mode,
      selectedId,
      selectedInstanceId,
      selectedComponent,
      content,
      collection,
      selectNode,
      selectInstance,
      returnToLibrary,
      registerNode,
      unregisterNode,
      setInsertHandler,
      executeInsert,
      target,
      select,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useComponentInspector() {
  const context = useContext(Context);
  if (!context) {
    throw new Error('组件编辑器必须放在 ComponentEditingProvider 中');
  }
  return context;
}

export function useOptionalComponentInspector() {
  return useContext(Context);
}

/** 侧栏切换独立于正文编辑模式；查看状态不会卸载或重建正文编辑器。 */
export function ComponentInspector({
  statusPanel,
  statusAttention = false,
  headerPrefix,
}: {
  statusPanel: ReactNode;
  statusAttention?: boolean;
  headerPrefix?: ReactNode;
}) {
  const state = useComponentInspector();
  const tabs: { mode: InspectorMode; label: string }[] = [
    { mode: 'article', label: '文章' },
    { mode: 'status', label: '状态' },
    { mode: 'library', label: '组件库' },
    { mode: 'component', label: '当前组件' },
  ];

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-notion-border bg-white dark:bg-[#0b0f17] bg-notion-bg">
        {headerPrefix}
        <div className="p-2 pt-1 lg:pt-2">
          <div
            className="grid grid-cols-4 gap-0.5 rounded-lg border border-notion-border bg-notion-bg p-1 shadow-2xs"
            role="tablist"
            aria-label="右栏属性面板切换"
          >
          {tabs.map((tab, index) => (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              id={`cms-inspector-tab-${tab.mode}`}
              aria-selected={state.mode === tab.mode}
              aria-controls={`cms-inspector-panel-${tab.mode}`}
              tabIndex={state.mode === tab.mode ? 0 : -1}
              onClick={() => state.setMode(tab.mode)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                state.setMode(tabs[next].mode);
                event.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>(`#cms-inspector-tab-${tabs[next].mode}`)
                  ?.focus();
              }}
              className={`relative flex min-h-8 items-center justify-center gap-1 rounded-md px-1 text-[11px] whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-notion-text ${state.mode === tab.mode ? 'bg-notion-hover font-semibold text-notion-text shadow-xs' : 'font-medium text-notion-muted hover:text-notion-text'}`}
            >
              {tab.label}
              {tab.mode === 'status' && statusAttention && (
                <span className="size-1.5 shrink-0 rounded-full bg-red-500">
                  <span className="sr-only">有待处理的操作提示</span>
                </span>
              )}
              {tab.mode === 'component' && Boolean(state.selectedComponent) && (
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      </div>
      </div>
      <div
        id="cms-inspector-panel-status"
        role="tabpanel"
        aria-labelledby="cms-inspector-tab-status"
        tabIndex={0}
        hidden={state.mode !== 'status'}
      >
        {statusPanel}
      </div>
      {
        <div
          hidden={state.mode !== 'library'}
          id="cms-inspector-panel-library"
          role="tabpanel"
          aria-labelledby="cms-inspector-tab-library"
          tabIndex={0}
          className="cms-library-panel"
        >
          {state.mode === 'library' && <ComponentLibrary />}
        </div>
      }
      {
        <div
          hidden={state.mode !== 'component'}
          id="cms-inspector-panel-component"
          role="tabpanel"
          aria-labelledby="cms-inspector-tab-component"
          tabIndex={0}
          className="cms-component-panel"
        >
          {state.mode === 'component' && <ComponentProperties onBack={state.returnToLibrary} />}
        </div>
      }
    </>
  );
}
