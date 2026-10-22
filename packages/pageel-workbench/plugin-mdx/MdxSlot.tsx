import { useWorkbench } from '../integration/context';
import { translateEditor } from '../integration/zh';
/**
 * MdxEditorSlot — Bridge EditorProps → MDXEditor
 *
 * Features:
 * - Immediate onChange — retain edits when switching tabs
 * - B2: CSS isolation — prevent Tailwind reset from affecting editor
 * - Image upload via EditorGitService (restricted API)
 * - Full toolbar: headings, bold, italic, lists, links, images, code
 */

import {
  MDXEditor,
  tablePlugin,
  codeMirrorPlugin,
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
  type ImageUploadHandler,
  type MDXEditorMethods,
  realmPlugin,
  insertJsx$,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { jsxComponentDescriptors } from '../integration/jsx-descriptors';
import { useOptionalComponentInspector } from '../integration/component-editing/InspectorContext';
import {
  saveEditorSelection,
  restoreEditorSelection,
  type JsxInsertPayload,
} from '../integration/component-editing/insertion';
import type { EditorProps } from '@pageel/plugin-types';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';

// @para-doc [#csa-safe-props-protection]
// ── Editor Component ──
export function MdxEditorSlot(props: EditorProps = {} as EditorProps) {
  const {
    initialValue = '',
    onChange,
    gitService,
    imageBaseUrl,
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

  const safeOnChange = onChange || (() => {});
  // Report synchronously: upstream debounce can lose the final keystroke on tab switch.
  

  // Image upload handler via restricted EditorGitService with safe fallback
  const imageUploadHandler: ImageUploadHandler = useCallback(
    async (image: File) => {
      if (!gitService || typeof gitService.uploadImage !== 'function') return '';
      const url = await gitService.uploadImage(image);
      return url;
    },
    [gitService]
  );

  // imagePlugin custom: resolve relative paths
  const imagePluginConfig = useMemo(() => imagePlugin({
    imageUploadHandler,
    // Transform image src for display
    imagePreviewHandler: async (src) => {
      if (src.startsWith('http')) return src;
      return src.startsWith('/') ? src : `/${src.replace(/^public\//, '')}`;
    },
  }), [imageUploadHandler, imageBaseUrl]);

  // L1 fix: sync external markdown when Source tab edits happen
  useEffect(() => {
    if (externalMarkdownVersion && externalMarkdown !== undefined) {
      activeRef.current?.setMarkdown(externalMarkdown);
    }
  }, [externalMarkdownVersion, externalMarkdown, activeRef]);

  const inspector = useOptionalComponentInspector();
  const setInsertHandler = inspector?.setInsertHandler;
  const insertDispatchRef = useRef<((payload: JsxInsertPayload) => void) | null>(null);

  // Selection tracking: preserve editor selection range on change
  useEffect(() => {
    const handleSelectionChange = () => {
      saveEditorSelection();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Register insertion dispatcher to inspector context
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

  // Plugin to connect MDXEditor realm with external insert signal
  const insertionPlugin = useMemo(() => {
    return realmPlugin({
      init(realm) {
        insertDispatchRef.current = (payload: any) => {
          restoreEditorSelection();
          realm.pub(insertJsx$, payload);
        };
      },
      update(realm) {
        insertDispatchRef.current = (payload: any) => {
          restoreEditorSelection();
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
    imagePluginConfig,
    codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
    codeMirrorPlugin({ codeBlockLanguages: { ts: "TypeScript", typescript: "TypeScript", txt: "Plain text", plain: "Plain text", js: "JavaScript", bash: "Shell", json: "JSON", astro: "Astro", vue: "Vue", sql: "SQL", text: "Text", "": "Plain text" } }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarContents: () => (
        <>
          <UndoRedo />
          <BlockTypeSelect />
          <BoldItalicUnderlineToggles />
          <ListsToggle />
          <CreateLink />
          <InsertImage />
          <InsertTable />
          <InsertCodeBlock />
        </>
      ),
    }),
  ], [imagePluginConfig, insertionPlugin]);

  return (
    // B2: CSS isolation — prevent Tailwind preflight from affecting editor
    <div className="pageel-editor-slot">
      <MDXEditor
        ref={activeRef}
        className={dark ? 'dark-theme' : undefined}
        translation={translateEditor}
        contentEditableClassName="cms-prose"
        markdown={initialMarkdown}
        onChange={(markdown, initialNormalize) => {
          // 初次导入的格式归一化不代表用户修改，避免刚打开文章就触发离开确认。
          if (!initialNormalize) safeOnChange(markdown);
        }}
        onError={onImportError}
        readOnly={readOnly}
        plugins={memoizedPlugins}
      />
    </div>
  );
}
