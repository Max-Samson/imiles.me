import type { JsxEditorProps } from '@mdxeditor/editor';
import { Boxes, FileText, Sliders } from 'lucide-react';
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

export type InspectorMode = 'article' | 'library' | 'component';

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
        name: mdastNode.name,
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

export function ComponentInspector() {
  const state = useComponentInspector();

  return (
    <div className="flex flex-col">
      {/* 3 Tabs Header: 文章 ｜ 组件库 ｜ 当前组件 */}
      <div className="p-2 border-b border-notion-border bg-notion-sidebar sticky top-0 z-10 backdrop-blur-md">
        <div
          className="grid grid-cols-3 p-1 rounded-lg bg-notion-bg border border-notion-border shadow-2xs gap-1"
          role="group"
          aria-label="右栏属性面板切换"
        >
          <button
            type="button"
            aria-pressed={state.mode === 'article'}
            onClick={() => state.setMode('article')}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-all cursor-pointer ${
              state.mode === 'article'
                ? 'bg-notion-hover text-notion-text font-semibold shadow-xs'
                : 'text-notion-muted hover:text-notion-text font-medium'
            }`}
          >
            <FileText className="h-3.5 w-3.5 opacity-75" />
            <span>文章</span>
          </button>
          <button
            type="button"
            aria-pressed={state.mode === 'library'}
            onClick={() => state.setMode('library')}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-all cursor-pointer ${
              state.mode === 'library'
                ? 'bg-notion-hover text-notion-text font-semibold shadow-xs'
                : 'text-notion-muted hover:text-notion-text font-medium'
            }`}
          >
            <Boxes className="h-3.5 w-3.5 opacity-75" />
            <span>组件库</span>
          </button>
          <button
            type="button"
            aria-pressed={state.mode === 'component'}
            onClick={() => state.setMode('component')}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-all cursor-pointer relative ${
              state.mode === 'component'
                ? 'bg-notion-hover text-notion-text font-semibold shadow-xs'
                : 'text-notion-muted hover:text-notion-text font-medium'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 opacity-75" />
            <span>当前组件</span>
            {Boolean(state.selectedComponent) && (
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Component Library Panel */}
      {state.mode === 'library' && (
        <div className="cms-library-panel">
          <ComponentLibrary />
        </div>
      )}

      {/* Current Component Parameters Panel */}
      {state.mode === 'component' && (
        <div className="cms-component-panel">
          <ComponentProperties onBack={state.returnToLibrary} />
        </div>
      )}
    </div>
  );
}
