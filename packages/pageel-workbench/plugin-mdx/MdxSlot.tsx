import { $getSelection, $isRangeSelection } from 'lexical';
import { useWorkbench } from '../integration/context';
import { translateEditor } from '../integration/zh';
/**
 * MdxEditorSlot — Bridge EditorProps → MDXEditor
 *
 * Features:
 * - Immediate onChange — retain edits when switching tabs
 * - B2: CSS isolation — prevent Tailwind reset from affecting editor
 * - Image upload via host draft API (legacy EditorGitService fallback)
 * - Full toolbar: headings, bold, italic, lists, links, images, code
 */

import {
  MDXEditor,
  tablePlugin,
  codeMirrorPlugin,
  CodeMirrorEditor,
  linkDialogPlugin,
  jsxPlugin,
  InsertTable,
  InsertCodeBlock,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  imagePlugin,
  codeBlockPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  UndoRedo,
  type MDXEditorMethods,
  realmPlugin,
  insertJsx$,
  activeEditor$,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import './editor.css';
import { EmptyImageDialog, useCmsImageTools } from './CmsImageTools';
import { cmsImagePreviewUrl } from '../../../src/lib/content-images';
import { jsxComponentDescriptors } from '../integration/jsx-descriptors';
import { useOptionalComponentInspector } from '../integration/components/InspectorContext';
import {
  type JsxInsertPayload,
} from '../integration/insertion';
import type { EditorProps } from '@pageel/plugin-types';
import { useMemo, useCallback, useRef, useEffect, useState, type ForwardRefExoticComponent, type RefAttributes } from 'react';

// 固定 3.20.0 的声明将无 props 写成 Record<string, never>，误伤公开 ref；运行实现是 forwardRef 按钮。
// 仅收窄这处声明，不改变官方按钮行为或屏蔽其他类型检查。
const ImageToolbarButton = InsertImage as ForwardRefExoticComponent<RefAttributes<HTMLButtonElement>>;

// @para-doc [#csa-safe-props-protection]
// ── Editor Component ──
export function MdxEditorSlot(props: EditorProps = {} as EditorProps) {
  const {
    initialValue = '',
    onChange,
    gitService,
    onUploadImage,
    imageDocumentKey = 'document',
    onImagePendingChange,
    externalMarkdown,
    externalMarkdownVersion,
    editorRef,
    readOnly = false,
    onImportError,
  } = props || {};

  const { dark } = useWorkbench();
  const internalRef = useRef<MDXEditorMethods>(null);
  const activeRef = editorRef || internalRef;
  const [initialMarkdown] = useState(initialValue || '');
  const initializingRef = useRef(true);
  const ignoreNextExternalRef = useRef(false);
  const lastMarkdownRef = useRef(initialMarkdown);

  // 原生按钮仅有悬浮提示；通过公开 ref 补齐可访问名称，键盘与辅助技术也能定位唯一入口。
  const imageButtonRef = useCallback((button: HTMLButtonElement | null) => {
    button?.setAttribute('aria-label', '插入图片');
    button?.setAttribute('title', '插入图片');
  }, []);
  const safeOnChange = onChange || (() => {});

  const handleMdxChange = useCallback((markdown: string) => {
    // 首次挂载时 MDXEditor 会派发初始归一化后的内容，不能误判为用户修改触发离开确认
    if (initializingRef.current) {
      lastMarkdownRef.current = markdown;
      return;
    }
    // 外部源码模式同步切回时，忽略由 setMarkdown 引起的重新派发
    if (ignoreNextExternalRef.current) {
      ignoreNextExternalRef.current = false;
      if (markdown === lastMarkdownRef.current) return;
    }
    // 内容未实质变动时不触发修改状态
    if (markdown === lastMarkdownRef.current) {
      return;
    }
    lastMarkdownRef.current = markdown;
    safeOnChange(markdown);
  }, [safeOnChange]);

  // 图片上传仅由本桥接事务消费；原生插件负责图片节点、导入导出与撤销。
  const imageTools = useCmsImageTools({
    documentKey: imageDocumentKey,
    readOnly,
    upload: async (file, signal) => {
      if (onUploadImage) return onUploadImage(file, signal);
      if (!gitService) throw new Error('图片上传尚未配置');
      return gitService.uploadImage(file);
    },
    onPending: (pending) => onImagePendingChange?.(pending),
    onReady: () => { initializingRef.current = false; },
    onCommitted: () => {
      const markdown = activeRef.current?.getMarkdown();
      if (markdown !== undefined) handleMdxChange(markdown);
    },
  });
  const imagePluginConfig = useMemo(() => imagePlugin({
    // 不再让原生文件上传回调插入第二次；按钮、粘贴与拖拽由同一事务处理。
    ImageDialog: EmptyImageDialog,
    imagePreviewHandler: async (src) => cmsImagePreviewUrl(src)
      ?? (/^https?:\/\//i.test(src) || src.startsWith('/') ? src : `/${src.replace(/^public\//, '')}`),
  }), []);

  // L1 fix: sync external markdown when Source tab edits happen
  useEffect(() => {
    if (externalMarkdownVersion && externalMarkdown !== undefined) {
      ignoreNextExternalRef.current = true;
      lastMarkdownRef.current = externalMarkdown;
      activeRef.current?.setMarkdown(externalMarkdown);
    }
  }, [externalMarkdownVersion, externalMarkdown, activeRef]);

  const inspector = useOptionalComponentInspector();
  const setInsertHandler = inspector?.setInsertHandler;
  const insertDispatchRef = useRef<((payload: JsxInsertPayload) => void) | null>(null);

  // 仅当前挂载的编辑器接收侧栏插入命令；卸载时撤销入口，避免跨文章插入。
  useEffect(() => {
    if (setInsertHandler) {
      setInsertHandler((payload) => {
        if (insertDispatchRef.current) {
          insertDispatchRef.current(payload);
        }
      });
      return () => {
        setInsertHandler(null);
      };
    }
  }, [setInsertHandler]);

  // 通过官方 realm 插入；仅接受当前编辑器有效的折叠光标，不模拟带格式选区包裹。
  const insertionPlugin = useMemo(() => {
    return realmPlugin({
      init(realm) {
        insertDispatchRef.current = (payload: any) => {
          const editor = realm.getValue(activeEditor$);
          if (!editor || !editor.getRootElement()?.isConnected) throw new Error('请先在当前正文中定位插入位置');
          const valid = editor.getEditorState().read(() => {
            const selection = $getSelection();
            return $isRangeSelection(selection) && selection.isCollapsed() && selection.anchor.getNode().isAttached();
          });
          if (!valid) throw new Error('请在正文中点击确定光标位置；暂不支持替换选区');
          realm.pub(insertJsx$, payload);
        };
      },
      update(realm) {
        insertDispatchRef.current = (payload: any) => {
          const editor = realm.getValue(activeEditor$);
          if (!editor || !editor.getRootElement()?.isConnected) throw new Error('请先在当前正文中定位插入位置');
          const valid = editor.getEditorState().read(() => {
            const selection = $getSelection();
            return $isRangeSelection(selection) && selection.isCollapsed() && selection.anchor.getNode().isAttached();
          });
          if (!valid) throw new Error('请在正文中点击确定光标位置；暂不支持替换选区');
          realm.pub(insertJsx$, payload);
        };
      },
    })();
  }, []);

  // B3: Memoize plugins to prevent infinite re-mounts of MDXEditor
  const memoizedPlugins = useMemo(() => [
    headingsPlugin(),
    tablePlugin(),
    linkDialogPlugin(),
    jsxPlugin({ jsxComponentDescriptors }),
    insertionPlugin,
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    imageTools.plugin,
    imagePluginConfig,
    codeBlockPlugin({
      defaultCodeBlockLanguage: '',
      // 3.20 的默认描述器只匹配已列语言且不带 meta；复用官方编辑器兜底，不改写原语法。
      codeBlockEditorDescriptors: [{ priority: -10, match: () => true, Editor: CodeMirrorEditor }],
    }),
    codeMirrorPlugin({
      // 只扩充语言选项；语法高亮仍由已有 CodeMirror 按需加载，不新增解析器或执行代码。
      codeBlockLanguages: {
        ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TypeScript (React)',
        js: 'JavaScript', javascript: 'JavaScript', jsx: 'JavaScript (React)',
        html: 'HTML', css: 'CSS', astro: 'Astro', vue: 'Vue',
        json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', sql: 'SQL',
        bash: 'Shell', sh: 'Shell', shell: 'Shell', python: 'Python', py: 'Python',
        markdown: 'Markdown', md: 'Markdown', mermaid: 'Mermaid（代码）',
        txt: 'Plain text', plain: 'Plain text', text: 'Text', '': 'Plain text',
      },
    }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarContents: () => (
        <>
          <UndoRedo />
          <BlockTypeSelect />
          <BoldItalicUnderlineToggles />
          <ListsToggle />
          <CreateLink />
          <ImageToolbarButton ref={imageButtonRef} />
          <InsertTable />
          <InsertCodeBlock />
        </>
      ),
    }),
  ], [imagePluginConfig, insertionPlugin, imageTools.plugin, imageButtonRef]);

  return (
    // B2: CSS isolation — prevent Tailwind preflight from affecting editor
    <div className="pageel-editor-slot">
      <MDXEditor
        ref={activeRef}
        className={dark ? 'dark-theme' : undefined}
        translation={translateEditor}
        contentEditableClassName="cms-prose"
        markdown={initialMarkdown}
        onChange={handleMdxChange}
        onError={onImportError}
        readOnly={readOnly || imageTools.locked}
        plugins={memoizedPlugins}
      />
      {imageTools.dialog}
      {imageTools.notice}
    </div>
  );
}
