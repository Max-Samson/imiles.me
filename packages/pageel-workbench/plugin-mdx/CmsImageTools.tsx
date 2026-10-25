import {
  $createImageNode,
  $isImageNode,
  activeEditor$,
  closeImageDialog$,
  createActiveEditorSubscription$,
  imageDialogState$,
  realmPlugin,
} from '@mdxeditor/editor';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  PASTE_COMMAND,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';
import { Dialog } from 'radix-ui';
import {
  AlertCircle,
  Globe,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createImageRequestGate,
  isInsertableImageUrl,
  validateArticleImageFile,
} from '../../../src/lib/admin/image-insertion';
import { cmsImagePreviewUrl, isSafeImagePreviewUrl } from '../../../src/lib/content-images';

type DialogState =
  | { type: 'new' }
  | {
      type: 'editing';
      nodeKey: string;
      initialValues: { src?: string; altText?: string; title?: string };
    };
interface ImageRequest {
  editor: LexicalEditor;
  selection: RangeSelection | null;
  state: DialogState;
  close: () => void;
  file?: File;
  documentKey: string;
}
interface Options {
  documentKey: string;
  readOnly: boolean;
  upload: (file: File, signal: AbortSignal) => Promise<string>;
  onPending: (pending: boolean) => void;
  onCommitted: () => void;
  onReady: () => void;
}
interface Bridge {
  open: (request: Omit<ImageRequest, 'documentKey'>) => void;
  error: (message: string) => void;
}
const selections = new WeakMap<LexicalEditor, RangeSelection>();
function capture(editor: LexicalEditor) {
  try {
    return editor.getEditorState().read(() => {
      const current = $getSelection();
      const selection = $isRangeSelection(current) ? current : selections.get(editor);
      if (!selection?.isCollapsed() || !selection.anchor.getNode().isAttached()) return null;
      return selection.clone();
    });
  } catch {
    return null;
  }
}

/** 保留原生图片节点/撤销；默认插件不再负责异步上传后的第二次插入。 */
export const EmptyImageDialog = () => null;

export function useCmsImageTools(options: Options) {
  const current = useRef(options);
  current.current = options;
  const gate = useRef(createImageRequestGate());
  const mounted = useRef(true);
  const active = useRef<ImageRequest | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [request, setRequest] = useState<ImageRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const bridge = useRef<Bridge>({ open: () => {}, error: () => {} });
  bridge.current = {
    error: setMessage,
    open(value) {
      if (current.current.readOnly || active.current) return;
      if (
        !value.editor.getRootElement()?.isConnected ||
        (value.state.type === 'new' && !value.selection)
      ) {
        setMessage('请先在正文中点击定位光标；暂不支持替换选中文字。');
        value.close();
        return;
      }
      const next = { ...value, documentKey: current.current.documentKey };
      active.current = next;
      gate.current.cancel();
      setMessage('');
      setRequest(next);
      current.current.onPending(true);
    },
  };
  const cancel = useCallback(() => {
    const old = active.current;
    active.current = null;
    gate.current.cancel();
    abort.current?.abort();
    abort.current = null;
    old?.close();
    current.current.onPending(false);
    if (mounted.current) {
      setRequest(null);
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      gate.current.cancel();
      abort.current?.abort();
      active.current = null;
      current.current.onPending(false);
    };
  }, []);
  useEffect(() => {
    if (active.current && active.current.documentKey !== options.documentKey) cancel();
  }, [options.documentKey, cancel]);

  const plugin = useMemo(
    () =>
      realmPlugin({
        init(realm) {
          realm.pub(createActiveEditorSubscription$, (editor) => {
            const remember = editor.registerUpdateListener(({ editorState }) => {
              editorState.read(() => {
                const s = $getSelection();
                if ($isRangeSelection(s)) selections.set(editor, s.clone());
              });
              // 安装版本的 onChange 没有“初始归一化”参数；由初次编辑器提交结束初始化阶段。
              current.current.onReady();
            });
            const openFiles = (files: File[], selection: RangeSelection | null) => {
              if (files.length !== 1) {
                bridge.current.error('请一次插入一张图片。');
                return;
              }
              try {
                validateArticleImageFile(files[0]);
              } catch (error) {
                bridge.current.error(error instanceof Error ? error.message : '图片无效');
                return;
              }
              bridge.current.open({
                editor,
                selection,
                state: { type: 'new' },
                close: () => realm.pub(closeImageDialog$),
                file: files[0],
              });
            };
            const paste = editor.registerCommand(
              PASTE_COMMAND,
              (event) => {
                if (!(event instanceof ClipboardEvent)) return false;
                const files = Array.from(event.clipboardData?.files ?? []);
                if (!files.length) return false;
                event?.preventDefault();
                openFiles(files, capture(editor));
                return true;
              },
              COMMAND_PRIORITY_CRITICAL,
            );
            const drag = editor.registerCommand(
              DRAGOVER_COMMAND,
              (event) => {
                if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return false;
                event.preventDefault();
                return true;
              },
              COMMAND_PRIORITY_CRITICAL,
            );
            const drop = editor.registerCommand(
              DROP_COMMAND,
              (event) => {
                const files = Array.from(event.dataTransfer?.files ?? []);
                if (!files.length) return false;
                event.preventDefault();
                let selection: RangeSelection | null = null;
                // 使用真实落点，不借用上传结束时可能移动的全局光标。
                const doc = editor.getRootElement()?.ownerDocument;
                const range = doc?.caretRangeFromPoint(event.clientX, event.clientY);
                if (range && editor.getRootElement()?.contains(range.startContainer)) {
                  selection = $createRangeSelection();
                  selection.applyDOMRange(range);
                }
                openFiles(files, selection);
                return true;
              },
              COMMAND_PRIORITY_CRITICAL,
            );
            return () => {
              remember();
              paste();
              drag();
              drop();
              selections.delete(editor);
            };
          });
          // imageDialogState 的惰性初始化会注册原生 paste；先注册本事务，避免默认处理器抢先吞掉文件。
          realm.sub(imageDialogState$, (state) => {
            if (state.type === 'inactive') return;
            const editor = realm.getValue(activeEditor$);
            if (!editor) return;
            bridge.current.open({
              editor,
              selection: capture(editor),
              state,
              close: () => realm.pub(closeImageDialog$),
            });
          });
        },
      })(),
    [],
  );

  const submit = useCallback(
    async (file: File | null, url: string, alt: string, title: string) => {
      const target = active.current;
      if (!target || abort.current) return;
      const ticket = gate.current.begin(target.documentKey);
      const controller = new AbortController();
      abort.current = controller;
      setBusy(true);
      setMessage('');
      const valid = () =>
        mounted.current &&
        active.current === target &&
        gate.current.isCurrent(ticket, current.current.documentKey);
      try {
        let src = url.trim();
        if (file) {
          validateArticleImageFile(file);
          src = await current.current.upload(file, controller.signal);
        }
        const unchanged = target.state.type === 'editing' && src === target.state.initialValues.src;
        if (!isInsertableImageUrl(src) && !unchanged)
          throw new Error('请上传图片，或填写已允许的 /images/ 站内图片路径。');
        if (!valid()) return;
        if (!target.editor.getRootElement()?.isConnected)
          throw new Error('编辑器已关闭，请重新定位。');
        let insertedKey: string | null = null;
        await new Promise<void>((resolve, reject) => {
          target.editor.update(
            () => {
              try {
                if (target.state.type === 'editing') {
                  const node = $getNodeByKey(target.state.nodeKey);
                  if (!$isImageNode(node)) throw new Error('原图片已不存在，请重新打开文章。');
                  node.setSrc(src);
                  node.setAltText(alt);
                  node.setTitle(title);
                  insertedKey = node.getKey();
                } else {
                  const selection = target.selection?.clone();
                  if (
                    !selection ||
                    !selection.anchor.getNode().isAttached() ||
                    !selection.focus.getNode().isAttached()
                  )
                    throw new Error('插入位置已失效，请重新定位后重试。');
                  $setSelection(selection);
                  const node = $createImageNode({ src, altText: alt, title });
                  $insertNodes([node]);
                  if ($isRootOrShadowRoot(node.getParentOrThrow())) {
                    const paragraph = $createParagraphNode();
                    node.replace(paragraph);
                    paragraph.append(node);
                    paragraph.selectEnd();
                  }
                  insertedKey = node.getKey();
                }
              } catch (error) {
                reject(error);
              }
            },
            { tag: 'history-push', discrete: true, onUpdate: resolve },
          );
        });
        // 等待插件完成 Markdown 导出，再解除宿主保存/发布限制，不能发布上传前的快照。
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (!valid()) return;
        current.current.onCommitted();
        cancel();
        target.editor.focus();
        if (insertedKey)
          target.editor.getElementByKey(insertedKey)?.scrollIntoView({ block: 'nearest' });
      } catch (error) {
        if (valid()) setMessage(error instanceof Error ? error.message : '图片插入失败，请重试。');
      } finally {
        if (abort.current === controller) abort.current = null;
        if (valid()) setBusy(false);
      }
    },
    [cancel],
  );

  return {
    plugin,
    locked: request !== null,
    dialog: (
      <CmsImageDialog
        request={request}
        busy={busy}
        message={message}
        cancel={cancel}
        submit={submit}
      />
    ),
    notice:
      !request && message ? (
        <p role="alert" className="p-3 text-sm text-amber-700">
          {message}
        </p>
      ) : null,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function CmsImageDialog({
  request,
  busy,
  message,
  cancel,
  submit,
}: {
  request: ImageRequest | null;
  busy: boolean;
  message: string;
  cancel: () => void;
  submit: (file: File | null, url: string, alt: string, title: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [title, setTitle] = useState('');
  const [localPreview, setLocalPreview] = useState('');
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const values = request?.state.type === 'editing' ? request.state.initialValues : {};
    const reqFile = request?.file ?? null;
    setFile(reqFile);
    const initialUrl = values.src ?? '';
    setUrl(initialUrl);
    setAlt(values.altText ?? reqFile?.name.replace(/\.[^.]+$/, '') ?? '');
    setTitle(values.title ?? '');

    if (reqFile) {
      setMode('file');
    } else if (values.src) {
      setMode('url');
    } else {
      setMode('file');
    }
  }, [request]);

  useEffect(() => {
    if (!file) {
      setLocalPreview('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (busy) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setMode('file');
      if (!alt.trim()) setAlt(dropped.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 预览必须与本次提交来源一致，不能在切到站内路径后继续显示旧文件。
  const preview = mode === 'file' ? localPreview : cmsImagePreviewUrl(url) || url;
  const isEditing = request?.state.type === 'editing';
  const canSubmit =
    !busy &&
    ((mode === 'file' && Boolean(file)) || (mode === 'url' && Boolean(url.trim())));

  return (
    <Dialog.Root
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <Dialog.Portal
        container={request?.editor.getRootElement()?.closest('.pageel-editor-slot') ?? undefined}
      >
        <Dialog.Overlay className="cms-image-dialogOverlay" />
        <Dialog.Content
          className="cms-image-dialogContent"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {/* 1. Header Bar */}
          <div className="cms-image-header">
            <div className="cms-image-header-title">
              <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <Dialog.Title>{isEditing ? '编辑图片属性' : '插入图片'}</Dialog.Title>
            </div>
            <button
              type="button"
              onClick={cancel}
              className="cms-image-close-btn"
              title="关闭 (Esc)"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Dialog.Description className="cms-image-description">
            在当前正文光标处插入图片；支持本地文件上传（≤ 2MB）或引用站内已有路径。
          </Dialog.Description>

          {/* 2. Source Selector Tabs */}
          <div className="cms-image-tabs">
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode('file')}
              className={`cms-image-tab ${mode === 'file' ? 'cms-image-tab-active' : ''}`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>本地上传</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode('url')}
              className={`cms-image-tab ${mode === 'url' ? 'cms-image-tab-active' : ''}`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>站内路径</span>
            </button>
          </div>

          <form
            className="cms-image-multiFieldForm"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) {
                const finalFile = mode === 'file' ? file : null;
                const finalUrl = mode === 'url' ? url.trim() : '';
                void submit(finalFile, finalUrl, alt.trim(), title.trim());
              }
            }}
          >
            {/* 3. Image Source Field */}
            {mode === 'file' ? (
              <div className="cms-image-formField">
                <label htmlFor="cms-image-file">上传本地图片 (PNG / JPEG / WebP，不超过 2 MiB)</label>
                {!file ? (
                  <div
                    className={`cms-image-dropzone ${isDragging ? 'cms-image-dropzone-active' : ''} ${busy ? 'cms-image-dropzone-disabled' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !busy && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      id="cms-image-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={busy}
                      className="sr-only"
                      onChange={(event) => {
                        const selected = event.target.files?.[0] ?? null;
                        setFile(selected);
                        if (selected && !alt.trim()) {
                          setAlt(selected.name.replace(/\.[^.]+$/, ''));
                        }
                      }}
                    />
                    <div className="cms-image-dropzone-icon">
                      <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="cms-image-dropzone-text">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        点击选择图片，或拖拽图片到此处
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        支持 PNG、JPEG、WebP 格式，单个文件不超过 2 MiB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="cms-image-filecard">
                    {localPreview ? (
                      <img src={localPreview} alt="已选图片缩略图" className="cms-image-filecard-thumb" />
                    ) : (
                      <div className="cms-image-filecard-thumb-placeholder">
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="cms-image-filecard-info">
                      <p className="cms-image-filecard-name" title={file.name}>
                        {file.name}
                      </p>
                      <p className="cms-image-filecard-size">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleClearFile}
                      className="cms-image-filecard-remove"
                      title="移除并重新选择"
                      aria-label="移除文件"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="cms-image-formField">
                <label htmlFor="cms-image-url">已有站内静态图片路径</label>
                <div className="cms-image-input-wrap">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="cms-image-url"
                    type="text"
                    value={url}
                    disabled={busy}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="/images/blog/..."
                    className="cms-image-input-with-icon"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  新图片请使用 <code>/images/</code> 开头的站内路径；已有外链图片可保持原地址编辑属性。
                </p>
              </div>
            )}

            {/* 4. Real-time Preview */}
            {((mode === 'file' && localPreview) || isSafeImagePreviewUrl(preview)) && (
              <div className="cms-image-preview-box">
                <div className="cms-image-preview-header">
                  <span>图片预览</span>
                </div>
                <div className="cms-image-preview-canvas">
                  <img src={preview} alt="待插入图片预览" className="cms-image-preview-img" />
                </div>
              </div>
            )}

            {/* 5. Metadata (Alt & Title) */}
            <div className="cms-image-grid-fields">
              <div className="cms-image-formField">
                <label htmlFor="cms-image-alt">
                  图片替代文本 (Alt)
                  <span className="text-xs text-slate-400 font-normal ml-1">推荐</span>
                </label>
                <input
                  id="cms-image-alt"
                  type="text"
                  value={alt}
                  disabled={busy}
                  placeholder="简要说明图片内容（无障碍与 SEO）"
                  onChange={(event) => setAlt(event.target.value)}
                />
              </div>
              <div className="cms-image-formField">
                <label htmlFor="cms-image-title">
                  悬停标题 (Title)
                  <span className="text-xs text-slate-400 font-normal ml-1">可选</span>
                </label>
                <input
                  id="cms-image-title"
                  type="text"
                  value={title}
                  disabled={busy}
                  placeholder="鼠标悬停提示气泡文案"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
            </div>

            {/* 6. Alert & Status Feedback */}
            {message && (
              <div role="alert" className="cms-image-alert-error">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{message}</span>
              </div>
            )}
            {busy && (
              <div role="status" className="cms-image-alert-busy">
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                <span>正在上传并插入图片，请稍候…</span>
              </div>
            )}

            {/* 7. Action Footer */}
            <div className="cms-image-footer">
              <button
                type="button"
                className="cms-image-btn-secondary"
                onClick={cancel}
              >
                取消
              </button>
              <button
                type="submit"
                className="cms-image-btn-primary"
                disabled={!canSubmit}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>处理中…</span>
                  </>
                ) : isEditing ? (
                  '保存修改'
                ) : (
                  '确认插入'
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
