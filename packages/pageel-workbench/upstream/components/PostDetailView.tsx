import { validatePublicationFields } from '../../integration/publication-validation';
import { ComponentInspector, useComponentInspector } from '../../integration/components/InspectorContext';
import { useWorkbench } from '../../integration/context';
import { composeDraftSource } from '../../integration/draft-source';
import { resolveImportedDraftTarget, suggestedImportSlug } from '../../integration/import-content';
import { cmsDocumentClient, type CmsDraftSummary, type CmsPublicationResult, type CmsSessionInfo } from '../../../../src/lib/admin/cms-document-client';
import { AdminApiError } from '../../../../src/lib/admin/api-error';
import { resolveNewContentTarget, resolveExistingContentTarget } from '../../../../src/lib/content-routing';
import { parseSourceDocument } from '../../../../src/lib/content-source';
import { fieldLabel } from '../../integration/labels';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { ArrowLeft, SlidersHorizontal, Save, Info, Send, Globe, Copy, Check, ExternalLink, GitBranch, ShieldCheck, AlertTriangle, Database } from 'lucide-react';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TrashIcon } from './icons/TrashIcon';
import { useI18n } from '../i18n/I18nContext';
import { useCollectionStore } from '../features/collections/store';
import { DocumentIcon } from './icons/DocumentIcon';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { ClockIcon } from './icons/ClockIcon';
import type { GithubRepo, IGitService } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ImageIcon } from './icons/ImageIcon';
import { updateFrontmatter } from '../utils/parsing';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { CheckIcon } from './icons/CheckIcon';
import { resolveImageSource } from '../utils/github';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { CloseIcon } from './icons/CloseIcon';
import { CodeIcon } from './icons/CodeIcon';
import { EyeIcon } from './icons/EyeIcon';
import PostImageSelectionModal from './PostImageSelectionModal';
import { SlotRenderer, createEditorGitService, usePluginConfig, isPluginFallback } from '../plugins';
import type { EditorProps } from '@pageel/plugin-types';
import { NativePlainEditor } from './editors/NativePlainEditor';



interface PostData {
  frontmatter: Record<string, any>;
  body: string;
  rawContent: string;
  name: string;
  sha: string;
  path: string;
  html_url: string;
  thumbnailUrl: string | null;
  imported?: boolean;
  draft?: CmsDraftSummary;
  publication?: CmsPublicationResult | null;
  newTarget?: { collection: 'blog' | 'stories'; lang: 'en' | 'zh'; slug: string; format: 'md' | 'mdx' };
}

interface PostDetailViewProps {
  post: PostData;
  onBack: () => void;
  onDelete: (post: PostData) => void;
  gitService: IGitService;
  repo: GithubRepo;
  projectType: 'astro' | 'github';
  domainUrl: string;
  onUpdate: () => void;
  imagesPath: string;
  imageFileTypes: string;
  onAction: () => void;
}

// --- Cover Image Component (Handles Auth/Lazy loading) ---
const CoverImage: React.FC<{ 
    thumbnailUrl: string | null, 
    gitService: IGitService, 
    repo: GithubRepo, 
    domainUrl: string, 
    projectType: 'astro' | 'github',
    className?: string
}> = ({ thumbnailUrl, gitService, repo, domainUrl, projectType, className }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
        if (!thumbnailUrl) {
            setImageUrl(null);
            return;
        }

        if (thumbnailUrl.startsWith('http')) {
            setImageUrl(thumbnailUrl);
            return;
        }
        const staged = /^\/images\/blog\/(cma_[a-f0-9]{32})\.(?:png|jpe?g|webp)$/.exec(thumbnailUrl);
        if (staged) {
            setImageUrl(`/api/v1/admin/cms/assets/${staged[1]}/preview`);
            return;
        }

        // Logic for relative paths
        const resolve = async () => {
            setIsLoading(true);
            try {
                if (projectType === 'github' && repo.private) {
                    const fullPath = thumbnailUrl.startsWith('/') ? thumbnailUrl.substring(1) : thumbnailUrl;
                    const blob = await gitService.getFileAsBlob(fullPath);
                    const url = URL.createObjectURL(blob);
                    setImageUrl(url);
                } else {
                    // BUG-11: Use central utility for consistent image source resolution
                    setImageUrl(resolveImageSource(thumbnailUrl, repo, projectType, domainUrl));
                }
            } catch (e) {
                console.error("Failed to load cover image", e);
                setImageUrl(null);
            } finally {
                setIsLoading(false);
            }
        };
        resolve();

        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [thumbnailUrl, repo, domainUrl, projectType, gitService]);

    if (!thumbnailUrl) return null;

    return (
        <div className={`relative overflow-hidden group bg-notion-sidebar/40 ${className}`}>
            {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-notion-sidebar">
                    <SpinnerIcon className="w-6 h-6 animate-spin text-notion-muted" />
                </div>
            ) : imageUrl && !imageFailed ? (
                <img src={imageUrl} onError={() => setImageFailed(true)} alt="文章封面" className="w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-notion-sidebar text-notion-muted">
                    <span className="text-xs px-4 text-center">图片加载失败，请检查图片地址</span>
                </div>
            )}
        </div>
    );
};

// --- Gallery Thumbnail Component (for gallery editor) ---
const GalleryThumbnail: React.FC<{
    src: string;
    label: string;
    gitService: IGitService;
    repo: GithubRepo;
    projectType: 'astro' | 'github';
    domainUrl: string;
}> = ({ src, label, gitService, repo, projectType, domainUrl }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!src) { setIsLoading(false); return; }

        // External URLs → use directly
        if (src.startsWith('http')) {
            setImageUrl(src);
            setIsLoading(false);
            return;
        }

        const loadImage = async () => {
            setIsLoading(true);
            try {
                if (projectType === 'github' && repo.private) {
                    // Private repo → load via blob API
                    const fullPath = src.startsWith('/') ? src.substring(1) : src;
                    // Try with public/ prefix for Astro projects
                    let pathToFetch = fullPath;
                    if (!fullPath.startsWith('public/') && !fullPath.startsWith('images/')) {
                        pathToFetch = 'public' + (fullPath.startsWith('/') ? fullPath : '/' + fullPath);
                    }
                    const blob = await gitService.getFileAsBlob(pathToFetch);
                    setImageUrl(URL.createObjectURL(blob));
                } else {
                    // Public repo → resolve URL
                    setImageUrl(resolveImageSource(src, repo, projectType, domainUrl));
                }
            } catch {
                // Fallback: try alternate path
                try {
                    const altPath = src.startsWith('/') ? 'public' + src : src;
                    const blob = await gitService.getFileAsBlob(altPath);
                    setImageUrl(URL.createObjectURL(blob));
                } catch {
                    setImageUrl(null);
                }
            } finally {
                setIsLoading(false);
            }
        };
        loadImage();

        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [src]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-notion-sidebar/50">
                <SpinnerIcon className="w-5 h-5 animate-spin text-notion-muted" />
            </div>
        );
    }

    if (imageUrl) {
        return <img src={imageUrl} alt={label} className="w-full h-full object-cover" />;
    }

    return (
        <div className="w-full h-full flex items-center justify-center bg-notion-sidebar/50">
            <div className="text-center px-2">
                <ImageIcon className="w-6 h-6 text-notion-muted/40 mx-auto mb-1" />
                <p className="text-[9px] text-notion-muted/60 truncate max-w-full">{src.split('/').pop()}</p>
            </div>
        </div>
    );
};

const PostDetailView: React.FC<PostDetailViewProps> = ({ post, onBack, onDelete, gitService, repo, projectType, domainUrl, onUpdate, imagesPath, imageFileTypes, onAction }) => {
  // @para-doc [#csa-new-post-editor-mode]
  const { t, language } = useI18n();
  const pluginConfig = usePluginConfig();
  // Stories 为纯文字排版；其他集合（如 Blog）在配置了插件时启用富文本可视化编辑器。
  const hasWysiwygPlugin = !isPluginFallback(pluginConfig.plugins?.editor) && !post.path.startsWith('content/stories/');
  const [activeTab, setActiveTab] = useState<'edit' | 'code' | 'preview'>(() =>
    !isPluginFallback(pluginConfig.plugins?.editor) && !post.path.startsWith('content/stories/') ? 'edit' : 'code'
  );

  const [externalMarkdownVersion, setExternalMarkdownVersion] = useState(0);
  const editorRef = useRef<any>(null);

  const handleTabChange = (newTab: 'edit' | 'code' | 'preview') => {
      if (activeTab === 'edit' && newTab !== 'edit') {
          const latestMd = editorRef.current?.getMarkdown();
          if (latestMd !== undefined) {
              setEditableBody(latestMd);
              if (latestMd !== savedBodyRef.current) {
                  setIsDirty(true);
              }
          }
      }
      if (activeTab !== 'edit' && newTab === 'edit') {
          setExternalMarkdownVersion(v => v + 1);
      }
      setActiveTab(newTab);
  };

  // --- Editable State ---
  const [editableFrontmatter, setEditableFrontmatter] = useState<Record<string, any>>(post.frontmatter);
  const [editableBody, setEditableBody] = useState<string>(post.body);
  const [importSlug, setImportSlug] = useState(() => suggestedImportSlug(post.name, post.frontmatter));
  const [importLang, setImportLang] = useState<'en' | 'zh'>(() =>
    post.frontmatter.lang === 'zh' || (post.frontmatter.lang !== 'en' && /[\u3400-\u9fff]/u.test(post.name)) ? 'zh' : 'en'
  );
  const [importError, setImportError] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // 新建和导入的文稿尚未写入 D1，即使未再次键入也不能静默丢弃。
  const [isDirty, setIsDirty] = useState(Boolean(post.newTarget || post.imported));
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [checkingDeployment, setCheckingDeployment] = useState(false);
  const [publishMode, setPublishMode] = useState<'loading' | 'snapshot' | 'github' | 'd1'>('loading');
  const [sessionInfo, setSessionInfo] = useState<CmsSessionInfo | null>(null);
  const isD1Mode = publishMode === 'd1' || sessionInfo?.mode === 'd1';
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [publication, setPublication] = useState<CmsPublicationResult | null>(post.publication ?? null);
  const [lastCommit, setLastCommit] = useState<CmsPublicationResult | null>(post.publication?.status === 'committed' ? post.publication : null);
  const operationRef = useRef<{ id: string; revision: number } | null>(post.publication ? { id: post.publication.operationId, revision: post.publication.draftRevision } : null);
  const draftRef = useRef<CmsDraftSummary | undefined>(post.draft);
  const publishedBaseRef = useRef<string | null>(post.sha || null);
  const sourceRef = useRef(post.rawContent);
  const savedFieldsRef = useRef<Record<string, any>>(post.frontmatter);
  const savedBodyRef = useRef(post.body);
  const editSerialRef = useRef(0);
  const { onDirtyChange, confirmLeave, registerSaveDraft } = useWorkbench();
  useEffect(() => {
    let active = true;
    cmsDocumentClient.session().then(value => {
      if (active) {
        setPublishMode(value.mode);
        setSessionInfo(value);
      }
    }).catch(() => {
      if (active) {
        setPublishMode('snapshot');
        setSessionInfo({
          mode: 'snapshot',
          repo: 'local/content-snapshot',
          branch: 'local',
          isProductionBranch: false,
          isTestBranch: false,
          isConfigured: false,
          writable: false,
        });
      }
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    // 页面刷新后按仓库文件身份找回最近一次发布操作；版本不一致则不能冒充当前文章的部署结果。
    if (!/^[a-f0-9]{40}$/i.test(post.sha)) return;
    let active = true;
    cmsDocumentClient.latestPublication(post.path)
      .then(result => {
        if (active && result?.resultBlobSha === post.sha) setLastCommit(result);
      })
      .catch(() => {
        // 查询失败不会阻止正文编辑；发布操作仍可通过其操作 ID 单独查询。
      });
    return () => { active = false; };
  }, [post.path, post.sha]);
  const componentInspector = useComponentInspector();
  // 将修改状态通知宿主；详情卸载时清除保护，不将正文写入额外缓存。
  useEffect(() => { onDirtyChange(isDirty || isSaving || publishing); }, [isDirty, isSaving, publishing, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // 同步正文与集合类型至组件检查器，驱动「本文已用」导航与插入限制
  useEffect(() => {
    componentInspector.setContent(editableBody);
  }, [editableBody, componentInspector.setContent]);

  useEffect(() => {
    const coll = post.path.includes('content/stories') ? 'stories' : 'blog';
    componentInspector.setCollection(coll);
  }, [post.path, componentInspector.setCollection]);
  
  const publicationIssues = useMemo(() => {
    const issues = validatePublicationFields(
      editableFrontmatter,
      post.path.includes('content/stories') ? 'stories' : 'blog',
    );
    if (post.imported && !draftRef.current && !importSlug.trim()) {
      return [{ field: 'slug', message: '请在文章属性中补充地址标识 (slug)' }, ...issues];
    }
    return issues;
  }, [editableFrontmatter, post.path, post.imported, importSlug]);
  const slugInputRef = useRef<HTMLInputElement>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const collection = post.path.startsWith('content/stories/') ? 'stories' : 'blog';
  const currentLang = String(editableFrontmatter.lang || importLang || 'zh');
  const resolvedPublicPath = draftRef.current
    ? draftRef.current.publicPath
    : post.imported
    ? `${currentLang === 'zh' ? '/zh' : ''}/${collection}/${importSlug.trim() || '...'}`
    : collection === 'blog'
    ? `${currentLang === 'zh' || post.name.endsWith('-zh.mdx') ? '/zh' : ''}/blog/${post.name.replace(/\.mdx?$/, '').replace(/-zh$/, '')}`
    : `/stories/${post.name.replace(/\.md$/, '')}`;
  // Updates specific to Detail View
  const updatePostFileInputRef = useRef<HTMLInputElement>(null);
  const sourceImageInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isEditorImageModalOpen, setIsEditorImageModalOpen] = useState(false);
  const [editorImageResolver, setEditorImageResolver] = useState<((url: string | null) => void) | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Memoize the editor git service to prevent infinite editor re-renders
  const editorGitService = useMemo(() => createEditorGitService(gitService, imagesPath), [gitService, imagesPath]);

  // Auto-resize title textarea
  useEffect(() => {
      if (titleTextareaRef.current) {
          titleTextareaRef.current.style.height = 'auto';
          titleTextareaRef.current.style.height = titleTextareaRef.current.scrollHeight + 'px';
      }
  }, [editableFrontmatter.title]);

  // Calculate missing fields on mount based on template
  useEffect(() => {
      const { getActiveCollection } = useCollectionStore.getState();
      const activeCollection = getActiveCollection();
      
      if (activeCollection?.template) {
          const templateKeys = activeCollection.template.fields.map(f => f.name);
          const currentKeys = Object.keys(editableFrontmatter);
          const missing = templateKeys.filter(key => !currentKeys.includes(key));
          setMissingFields(missing);
      }
  }, [editableFrontmatter]); // Re-calc if frontmatter changes (e.g. adding a field)

  // Scroll to top when component mounts
  useEffect(() => {
      const container = document.getElementById('post-detail-container');
      if (container) container.scrollTop = 0;
  }, [post.sha]);

  // Handle Input Changes
  const handleFrontmatterChange = (key: string, value: any) => {
      editSerialRef.current += 1;
      setPublication(previous => previous?.status === 'committed' ? null : previous);
      setEditableFrontmatter(prev => ({
          ...prev,
          [key]: value
      }));
      setIsDirty(true);
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      editSerialRef.current += 1;
      setPublication(previous => previous?.status === 'committed' ? null : previous);
      setEditableBody(e.target.value);
      setIsDirty(true);
  };

  const handleEditorChange = useCallback((markdown: string) => {
      editSerialRef.current += 1;
      setPublication(previous => previous?.status === 'committed' ? null : previous);
      setEditableBody(markdown);
      setIsDirty(true);
  }, []);

  const handleAddMissingField = (key: string) => {
      let defaultValue: any = "";
      if (key === 'date' || key === 'publishDate' || key === 'pubDate' || key === 'updatedDate') defaultValue = new Date().toISOString().split('T')[0];
      if (key === 'tags') defaultValue = [];
      if (key === 'draft') defaultValue = !publishedBaseRef.current;
      if (key === 'llms') defaultValue = false;
      if (key === 'lang') defaultValue = 'en';
      
      handleFrontmatterChange(key, defaultValue);
      setMissingFields(prev => prev.filter(k => k !== key));
  };

  const handleSave = useCallback(async (): Promise<CmsDraftSummary | undefined> => {
      if (isSaving || (Boolean(draftRef.current) && !isDirty)) return;
      setIsSaving(true);
      setSaveMessage('');
      setSaveError(false);
      const editSerial = editSerialRef.current;
      const submittedFields: Record<string, unknown> = { ...editableFrontmatter, ...(post.imported ? { lang: importLang } : {}) };
      try {
          let currentBody = editableBody;
          if (activeTab === 'edit' && hasWysiwygPlugin && editorRef.current) {
              const latestMd = editorRef.current.getMarkdown();
              if (latestMd !== undefined && latestMd !== currentBody) {
                  currentBody = latestMd;
                  setEditableBody(latestMd);
              }
          }
          let source: string;
          try {
              parseSourceDocument(sourceRef.current);
              source = composeDraftSource(
                  sourceRef.current,
                  savedFieldsRef.current,
                  submittedFields,
                  currentBody,
                  currentBody !== savedBodyRef.current,
              );
          } catch {
              // YAML 尚未写完时，正文编辑区承载完整源文；直接保存当前源码。
              if (Object.keys(submittedFields).some(key => JSON.stringify(submittedFields[key]) !== JSON.stringify(savedFieldsRef.current[key]))) {
                  throw new Error('请先在源码区修复 YAML 语法，再修改文章属性');
              }
              source = currentBody;
          }
          let draft = draftRef.current;
          if (draft) {
              draft = await cmsDocumentClient.save(draft.id, draft.revision, source);
          } else {
              const collection = post.newTarget?.collection ?? (post.path.startsWith('content/stories/') ? 'stories' : 'blog');
              const lang = post.newTarget?.lang ?? (post.imported ? importLang : submittedFields.lang === 'zh' || post.name.endsWith('-zh.mdx') || post.name.endsWith('-zh.md') || post.path.includes('/zh/') ? 'zh' : 'en');
              const name = post.name.replace(/\.mdx?$/, '');
              const slug = post.newTarget?.slug ?? (post.imported ? importSlug : collection === 'blog' && lang === 'zh' ? name.replace(/-zh$/, '') : name);
              if (post.imported && !slug.trim()) {
                  setPropertiesOpen(true);
                  componentInspector.setMode('article');
                  setTimeout(() => slugInputRef.current?.focus(), 50);
                  throw new Error('请在右侧文章属性中填写保存地址标识，例如 google-seo-guide');
              }
              const format = post.newTarget?.format ?? (post.path.endsWith('.mdx') ? 'mdx' : 'md');
              const isExisting = !post.newTarget && !post.imported && Boolean(post.path);
              const target = post.imported
                  ? resolveImportedDraftTarget(collection, lang, post.name, slug)
                  : isExisting
                  ? resolveExistingContentTarget(collection, lang, post.path)
                  : resolveNewContentTarget({ collection, lang, slug, format });
              draft = await cmsDocumentClient.create({
                  collection,
                  lang,
                  slug: target.slug,
                  format: target.format,
                  ...(isExisting ? { path: post.path, baseBlobSha: publishedBaseRef.current || post.sha || undefined } : {}),
                  source,
              });
          }
          draftRef.current = draft;
          sourceRef.current = source;
          savedFieldsRef.current = submittedFields;
          savedBodyRef.current = currentBody;
          if (post.imported) setEditableFrontmatter(submittedFields);
          if (editSerialRef.current === editSerial) setIsDirty(false);
          setSaveMessage(`草稿已保存 · 修订 ${draft.revision}`);
          return draft;
      } catch (error) {
          setSaveError(true);
          setSaveMessage(error instanceof AdminApiError && error.status === 409
              ? '草稿版本冲突：当前输入仍在编辑台，请重新打开并比较后保存。'
              : error instanceof Error ? error.message : '草稿保存失败');
      } finally {
          setIsSaving(false);
      }
  }, [isDirty, isSaving, post, editableFrontmatter, editableBody, activeTab, hasWysiwygPlugin, importSlug, importLang]);

  const handleCmsImageUpload = useCallback(async (file: File): Promise<string> => {
      if (post.path.startsWith('content/stories/')) throw new Error('Stories 不支持图片');
      const draft = draftRef.current ?? await handleSave();
      if (!draft) throw new Error('请先保存草稿，再上传图片');
      const asset = await cmsDocumentClient.uploadAsset(draft.id, file);
      setSaveMessage('图片已暂存；文章发布后公开地址才可匿名访问。');
      return asset.publicUrl;
  }, [post.path, handleSave]);

  const handleSourceImage = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
          setIsUploading(true);
          const url = await handleCmsImageUpload(file);
          // 源码模式不经过 MDXEditor 序列化，保留文稿原有 JSX 和空白。
          const alt = file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} -]/gu, '').trim() || '图片';
          handleEditorChange(`${editableBody.trimEnd()}\n\n![${alt}](${url})\n`);
      } catch (error) {
          setSaveMessage(error instanceof Error ? error.message : '图片上传失败');
      } finally {
          setIsUploading(false);
      }
  }, [handleCmsImageUpload, editableBody]);

  const handleCoverImage = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
          setIsUploading(true);
          const url = await handleCmsImageUpload(file);
          handleFrontmatterChange('heroImage', url);
      } catch (error) {
          setSaveMessage(error instanceof Error ? error.message : '封面上传失败');
      } finally {
          setIsUploading(false);
      }
  }, [handleCmsImageUpload]);

  useEffect(() => registerSaveDraft(async () => {
    const editSerial = editSerialRef.current;
    const draft = await handleSave();
    return Boolean(draft) && editSerialRef.current === editSerial;
  }), [handleSave, registerSaveDraft]);

  const executePublish = useCallback(async () => {
      setShowPublishConfirmModal(false);
      if (publishing || (publishMode !== 'github' && publishMode !== 'd1')) return;
      setPublishing(true);
      setPublishMessage('');
      try {
          // 请求丢失回执时仍沿用原操作 ID；先对账，避免第二次 Git 提交。
          const pending = Boolean(operationRef.current) && (!publication || ['prepared', 'in_flight', 'unknown'].includes(publication.status));
          const draft = pending ? draftRef.current : isDirty || !draftRef.current ? await handleSave() : draftRef.current;
          if (!draft) return;
          const operation = pending && operationRef.current
              ? operationRef.current
              : { id: crypto.randomUUID(), revision: draft.revision };
          operationRef.current = operation;
          const submittedSerial = editSerialRef.current;
          const result = await cmsDocumentClient.publish(draft.id, operation.revision, operation.id);
          setPublication(result.status === 'committed' && editSerialRef.current !== submittedSerial ? null : result);
          if (['committed', 'conflict', 'failed'].includes(result.status)) operationRef.current = null;
          if (result.status === 'committed') {
              setLastCommit(result);
              publishedBaseRef.current = result.resultBlobSha;
              if (draftRef.current?.revision === result.draftRevision) draftRef.current = undefined;
              if (editSerialRef.current === submittedSerial) setIsDirty(false);
              const branchText = sessionInfo?.branch ? `【${sessionInfo.branch}】` : '';
              if (sessionInfo?.mode === 'd1' || publishMode === 'd1') {
                  setPublishMessage('文章已成功发布至 D1 数据库！前台页面即时同步生效。');
              } else if (sessionInfo?.isTestBranch) {
                  setPublishMessage(`已安全提交至本地调试分支 ${branchText}；内容已隔离，不会触发线上生产部署。`);
              } else {
                  setPublishMessage(`Git 提交成功 ${branchText}；线上部署尚未核实。点击“检查部署”可核验上线状态。`);
              }
              onUpdate();
          }
          else if (result.status === 'conflict') setPublishMessage(`仓库版本或目标地址冲突${result.errorCode ? `（${result.errorCode}）` : ''}；草稿已保留，请比较后处理。`);
          else if (result.status === 'failed') setPublishMessage(`发布失败${result.errorCode ? `（${result.errorCode}）` : ''}；草稿仍在 D1，可修复后重新发起。`);
          else setPublishMessage(`提交结果待对账${result.errorCode ? `（${result.errorCode}）` : ''}；请使用同一操作 ID 再次查询，勿创建新发布。`);
      } catch (error) {
          const details = error instanceof AdminApiError && Array.isArray(error.details)
              ? `：${error.details.filter(item => typeof item === 'string').join('；')}` : '';
          setPublishMessage(`${error instanceof Error ? error.message : '发布失败'}${details}`);
      } finally {
          setPublishing(false);
      }
  }, [publishing, publishMode, publication, isDirty, handleSave, onUpdate, sessionInfo]);

  const handlePublishClick = useCallback(() => {
      if (publishing || (publishMode !== 'github' && publishMode !== 'd1')) return;
      const pending = Boolean(operationRef.current) && (!publication || ['prepared', 'in_flight', 'unknown'].includes(publication.status));
      if (pending) {
          void executePublish();
          return;
      }
      if (publicationIssues.length > 0) {
          setPropertiesOpen(true);
          componentInspector.setMode('article');
          setPublishMessage(`发布前请先修正文章属性：${publicationIssues.map(i => i.message).join('；')}`);
          return;
      }
      setShowPublishConfirmModal(true);
  }, [publishing, publishMode, publication, publicationIssues, componentInspector, executePublish]);

  const handleVerifyDeployment = useCallback(async () => {
      if (!lastCommit || checkingDeployment) return;
      setCheckingDeployment(true);
      try {
          const result = await cmsDocumentClient.verifyDeployment(lastCommit.operationId);
          setLastCommit(result);
          setPublishMessage({
              verified: 'Deploy 工作流成功，且部署提交包含这篇文章的已发布版本。',
              pending: 'Deploy 工作流尚在排队。',
              running: 'Deploy 工作流正在运行。',
              failed: '对应的 Deploy 工作流失败；Git 提交仍保留。',
              cancelled: '对应的 Deploy 工作流被取消；Git 提交仍保留。',
              unverified: '尚无足够证据确认此版本已部署。',
          }[result.deploymentStatus]);
      } catch (error) {
          setPublishMessage(error instanceof Error ? error.message : '部署核验失败');
      } finally {
          setCheckingDeployment(false);
      }
  }, [lastCommit, checkingDeployment]);

  // --- External Actions (Update File / Image) ---
  
  const handleUpdateFile = () => {
      updatePostFileInputRef.current?.click();
  }

  const confirmUpdateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              const content = ev.target?.result as string;
              const commitMsg = `fix(content): update post "${post.name}" content`;
              await gitService.updateFileContent(post.path, content, commitMsg, post.sha);
              
              onAction(); // Trigger sync
              
              // Instead of full refresh, maybe reload current post data?
              // For simplicity, we call onBack to list or trigger parent update.
              // Here we try to update local state to reflect new file content immediately
              onUpdate();
              onBack(); // Go back to list to see updated data
          };
          reader.readAsText(file);
      } catch (err) {
          alert("Update failed");
      } finally {
          setIsUploading(false);
          e.target.value = '';
      }
  };

  const handleUpdateImage = () => {
      setIsImageModalOpen(true);
  }

  const handleImageConfirm = async (result: { type: 'new' | 'existing', file?: File, path?: string }) => {
      setIsUploading(true);
      try {
          let imageUrl = '';
          // 1. Upload if new
          if (result.type === 'new' && result.file) {
              const commitMsg = `feat(assets): add image "${result.file.name}"`;
              const fullPath = imagesPath ? `${imagesPath}/${result.file.name}` : result.file.name;
              await gitService.uploadFile(fullPath, result.file, commitMsg);
              imageUrl = fullPath;
          } else if (result.type === 'existing' && result.path) {
              imageUrl = result.path;
          }

          if (imageUrl) {
              // Format URL based on project settings
              // Format URL based on project settings
              let finalUrl = imageUrl;
              
              // Standardize: if starting with public/, remove it for the MD/frontmatter reference
              // this makes the paths work in local Astro dev environments.
              if (finalUrl.startsWith('public/')) {
                  finalUrl = finalUrl.replace('public/', '/');
              } else if (!finalUrl.startsWith('http') && !finalUrl.startsWith('/')) {
                  finalUrl = '/' + finalUrl;
              }

              // 2. Update Frontmatter
              // Determine which field to update
              const fm = editableFrontmatter;
              let targetField = 'image';
              if (fm.cover) targetField = 'cover';
              else if (fm.thumbnail) targetField = 'thumbnail';
              else if (fm.heroImage) targetField = 'heroImage';

              // Update local state
              const updatedFM = { ...fm, [targetField]: finalUrl };
              const newContent = updateFrontmatter(editableBody, updatedFM);
              const commitMsg = `fix(content): update image for "${post.name}"`;
              
              await gitService.updateFileContent(post.path, newContent, commitMsg, post.sha);
              
              onAction(); // Trigger sync
              setEditableFrontmatter(updatedFM);
              // Force reload cover image if possible, usually requires re-mount or key change
              onUpdate();
          }
      } catch (e) {
          alert("Failed to update image");
          console.error(e);
      } finally {
          setIsUploading(false);
          setIsImageModalOpen(false);
      }
  };

  const handleRequestImage = (): Promise<string | null> => {
      setIsEditorImageModalOpen(true);
      return new Promise((resolve) => {
          setEditorImageResolver(() => resolve);
      });
  };

  const handleEditorImageConfirm = async (result: { type: 'new' | 'existing', file?: File, path?: string }) => {
      setIsEditorImageModalOpen(false);
      if (!editorImageResolver) return;

      setIsUploading(true);
      try {
          let imageUrl = '';
          if (result.type === 'new' && result.file) {
              const commitMsg = `feat(assets): add image "${result.file.name}"`;
              const fullPath = imagesPath ? `${imagesPath}/${result.file.name}` : result.file.name;
              await gitService.uploadFile(fullPath, result.file, commitMsg);
              imageUrl = fullPath;
              onAction(); // Trigger sync
          } else if (result.type === 'existing' && result.path) {
              imageUrl = result.path;
          }

          if (imageUrl) {
              let finalUrl = imageUrl;
              if (finalUrl.startsWith('public/')) {
                  finalUrl = finalUrl.replace('public/', '/');
              } else if (!finalUrl.startsWith('http') && !finalUrl.startsWith('/')) {
                  finalUrl = '/' + finalUrl;
              }
              editorImageResolver(finalUrl);
          } else {
              editorImageResolver(null);
          }
      } catch (e) {
          console.error('Error picking image for editor', e);
          editorImageResolver(null);
      } finally {
          setIsUploading(false);
          setEditorImageResolver(null);
      }
  };

  const handleEditorImageClose = () => {
      setIsEditorImageModalOpen(false);
      if (editorImageResolver) {
          editorImageResolver(null);
          setEditorImageResolver(null);
      }
  };

  const processContentImages = (content: string) => {
      if (!content) return '';
      
      const resolveUrl = (url: string) => {
          if (url.startsWith('http') || url.startsWith('https') || url.startsWith('data:')) return url;
          const staged = /^\/images\/blog\/(cma_[a-f0-9]{32})\.(?:png|jpe?g|webp)$/.exec(url);
          if (staged) return `/api/v1/admin/cms/assets/${staged[1]}/preview`;
          
          // BUG-11: Use central utility for consistent image source resolution in markdown/HTML preview
          return resolveImageSource(url, repo, projectType, domainUrl);
      };

      // 1. Replace Markdown images: ![alt](url "title")
      let processed = content.replace(/(!\[.*?\])\(([^)\s]+)(.*?)\)/g, (match, prefix, url, suffix) => {
          const newUrl = resolveUrl(url);
          return `${prefix}(${newUrl}${suffix})`;
      });

      // 2. Replace HTML images: <img src="url">
      processed = processed.replace(/(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, url, suffix) => {
          const newUrl = resolveUrl(url);
          return `${prefix}${newUrl}${suffix}`;
      });

      return processed;
  };

  const createMarkup = (markdownContent: string) => {
    const processedContent = processContentImages(markdownContent);
    const rawMarkup = marked.parse(processedContent) as string;
    const sanitizedMarkup = DOMPurify.sanitize(rawMarkup);
    return { __html: sanitizedMarkup };
  };
  
  // --- Field Edit Modal State ---
  const [fieldModalKey, setFieldModalKey] = useState<string | null>(null);
  const [fieldModalValue, setFieldModalValue] = useState<string>('');
  const [fieldModalIsComplex, setFieldModalIsComplex] = useState(false);
  // Gallery-specific state
  const [fieldModalGalleryItems, setFieldModalGalleryItems] = useState<Array<Record<string, any>>>([]);
  const [fieldModalIsGallery, setFieldModalIsGallery] = useState(false);
  const [galleryDragIndex, setGalleryDragIndex] = useState<number | null>(null);
  const [isGalleryPickerOpen, setIsGalleryPickerOpen] = useState(false);

  // Detect gallery-like array: [{src: "...", label?: "..."}, ...]
  const isGalleryArray = (value: any): boolean => {
      return Array.isArray(value) && value.length > 0 
          && typeof value[0] === 'object' && value[0] !== null 
          && ('src' in value[0] || 'image' in value[0] || 'url' in value[0]);
  };

  const getGalleryImageKey = (item: Record<string, any>): string => {
      if ('src' in item) return 'src';
      if ('image' in item) return 'image';
      if ('url' in item) return 'url';
      return 'src';
  };

  const openFieldModal = (key: string, value: any) => {
      setFieldModalKey(key);
      if (isGalleryArray(value)) {
          setFieldModalIsGallery(true);
          setFieldModalIsComplex(false);
          setFieldModalGalleryItems(value.map((item: any) => ({ ...item })));
          setFieldModalValue('');
      } else {
          setFieldModalIsGallery(false);
          const isComplex = (typeof value === 'object' && value !== null);
          setFieldModalIsComplex(isComplex);
          if (isComplex) {
              setFieldModalValue(JSON.stringify(value, null, 2));
          } else if (Array.isArray(value)) {
              setFieldModalValue(value.join(', '));
          } else {
              setFieldModalValue(String(value || ''));
          }
      }
  };

  const handleFieldModalSave = () => {
      if (!fieldModalKey) return;
      if (fieldModalIsGallery) {
          handleFrontmatterChange(fieldModalKey, fieldModalGalleryItems);
          setFieldModalKey(null);
          return;
      }
      let parsedValue: any;
      if (fieldModalIsComplex) {
          try { parsedValue = JSON.parse(fieldModalValue); }
          catch { alert('Invalid JSON format.'); return; }
      } else {
          const originalValue = editableFrontmatter[fieldModalKey];
          if (Array.isArray(originalValue)) {
              parsedValue = fieldModalValue.split(',').map((s: string) => s.trim()).filter((s: string) => s);
          } else {
              parsedValue = fieldModalValue;
          }
      }
      handleFrontmatterChange(fieldModalKey, parsedValue);
      setFieldModalKey(null);
  };

  // Gallery helpers
  const handleGalleryItemChange = (index: number, field: string, value: string) => {
      setFieldModalGalleryItems(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], [field]: value };
          return updated;
      });
  };

  const handleGalleryRemove = (index: number) => {
      setFieldModalGalleryItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleGalleryDragStart = (index: number) => { setGalleryDragIndex(index); };

  const handleGalleryDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (galleryDragIndex === null || galleryDragIndex === index) return;
      setFieldModalGalleryItems(prev => {
          const updated = [...prev];
          const [dragged] = updated.splice(galleryDragIndex, 1);
          updated.splice(index, 0, dragged);
          return updated;
      });
      setGalleryDragIndex(index);
  };

  const handleGalleryDragEnd = () => { setGalleryDragIndex(null); };

  const handleGalleryAddFromPicker = (result: { type: 'new' | 'existing', file?: File, path?: string }) => {
      if (result.path) {
          let finalPath = result.path;
          if (finalPath.startsWith('public/')) finalPath = finalPath.replace('public/', '/');
          else if (!finalPath.startsWith('http') && !finalPath.startsWith('/')) finalPath = '/' + finalPath;
          const imageKey = fieldModalGalleryItems.length > 0 ? getGalleryImageKey(fieldModalGalleryItems[0]) : 'src';
          const fileName = finalPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'New Image';
          setFieldModalGalleryItems(prev => [...prev, { [imageKey]: finalPath, label: fileName }]);
      }
      setIsGalleryPickerOpen(false);
  };

  // Helper: detect if value is array of objects
  const isArrayOfObjects = (value: any): boolean => {
      return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null;
  };

  // Helper: format complex value for inline display
  const formatComplexPreview = (value: any): string => {
      if (isArrayOfObjects(value)) {
          return `[${value.length} items]`;
      }
      if (Array.isArray(value)) {
          return value.join(', ');
      }
      if (typeof value === 'object' && value !== null) {
          const keys = Object.keys(value);
          return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}}`;
      }
      return String(value || '');
  };

  const renderInput = (key: string, value: any) => {
      const isDate = value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-') && value.length === 10);
      const isArray = Array.isArray(value);
      const isComplex = typeof value === 'object' && value !== null && !isArray;

      // Array of objects (gallery, etc.) — show preview + edit button
      if (isArrayOfObjects(value)) {
          const isGallery = isGalleryArray(value);
          return (
              <button
                onClick={() => openFieldModal(key, value)}
                className="w-full text-left flex items-center gap-1.5 px-1 py-0.5 text-sm text-notion-blue hover:bg-notion-hover/50 rounded-sm transition-colors group"
              >
                <span className="truncate text-xs">
                  {isGallery ? `🖼 ${value.length} images` : `[${value.length} items]`}
                </span>
                <EditIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
          );
      }

      // Simple arrays (tags, etc.) — inline edit + click to expand
      if (isArray) {
          return (
              <div className="flex items-center w-full gap-1.5">
                <input 
                  type="text" 
                  className="flex-grow bg-notion-bg border border-notion-border rounded-lg text-xs py-1.5 px-2.5 text-notion-text focus:outline-none focus:ring-2 focus:ring-notion-blue/20 focus:border-notion-blue transition-all min-w-0 shadow-2xs"
                  value={value.join(', ')}
                  placeholder="以逗号分隔，如 tag1, tag2"
                  onChange={(e) => handleFrontmatterChange(key, e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s))}
                />
                <button
                  type="button"
                  onClick={() => openFieldModal(key, value)}
                  className="p-1 text-notion-muted hover:text-notion-blue rounded-md border border-notion-border bg-notion-bg hover:bg-notion-hover transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
                  title="展开编辑标签列表"
                >
                  <EditIcon className="w-3.5 h-3.5" />
                </button>
              </div>
          );
      }

      // Boolean switch (draft, llms, etc.)
      if (typeof value === 'boolean') {
          return (
              <div className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={value}
                  onClick={() => handleFrontmatterChange(key, !value)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-notion-blue ${
                    value ? 'bg-notion-blue' : 'bg-notion-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      value ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs text-notion-muted font-medium select-none">
                  {value ? '开启 (true)' : '关闭 (false)'}
                </span>
              </div>
          );
      }

      if (isDate) {
          const dateStr = value instanceof Date ? value.toISOString().split('T')[0] : value;
          return (
              <input 
                type="date"
                className="w-full bg-notion-bg border border-notion-border rounded-lg text-xs py-1.5 px-2.5 text-notion-text focus:outline-none focus:ring-2 focus:ring-notion-blue/20 focus:border-notion-blue transition-all cursor-pointer shadow-2xs"
                value={dateStr}
                onChange={(e) => handleFrontmatterChange(key, e.target.value)}
                style={{ colorScheme: 'inherit' }}
              />
          );
      }

      // Complex objects (non-array) — show preview + edit button
      if (isComplex) {
          return (
              <button
                type="button"
                onClick={() => openFieldModal(key, value)}
                className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs text-notion-text bg-notion-bg border border-notion-border rounded-lg hover:border-notion-blue/40 transition-colors group shadow-2xs cursor-pointer"
              >
                <span className="truncate text-xs font-mono">{formatComplexPreview(value)}</span>
                <EditIcon className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 text-notion-blue transition-opacity flex-shrink-0" />
              </button>
          );
      }

      // String/number — inline edit + expand button for long values
      const isLongValue = typeof value === 'string' && value.length > 50;
      return (
        <div className="flex items-center w-full gap-1.5">
          <input 
              type="text" 
              className="flex-grow bg-notion-bg border border-notion-border rounded-lg text-xs py-1.5 px-2.5 text-notion-text focus:outline-none focus:ring-2 focus:ring-notion-blue/20 focus:border-notion-blue transition-all min-w-0 shadow-2xs"
              value={String(value || '')}
              onChange={(e) => handleFrontmatterChange(key, e.target.value)}
          />
          {isLongValue && (
            <button
              type="button"
              onClick={() => openFieldModal(key, value)}
              className="p-1 text-notion-muted hover:text-notion-blue rounded-md border border-notion-border bg-notion-bg hover:bg-notion-hover transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
              title="展开编辑"
            >
              <EditIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
  };

  const [propertiesOpen, setPropertiesOpen] = useState(true);
  // 选中组件或切换至组件库自动展开右栏；宿主只关心选中状态，节点更新仍在编辑器内部进行。
  useEffect(() => {
    if (componentInspector.selected || componentInspector.mode !== 'article') {
      setPropertiesOpen(true);
    }
  }, [componentInspector.selected, componentInspector.mode]);
  const hasCoverImage = !!(editableFrontmatter.image || editableFrontmatter.cover || editableFrontmatter.thumbnail || editableFrontmatter.heroImage || post.thumbnailUrl);

  return (
    <div className="cms-post-detail h-full flex flex-col bg-notion-bg animate-fade-in relative">
      <input type="file" ref={updatePostFileInputRef} className="hidden" accept=".md,.mdx" onChange={confirmUpdateFile} />
      <input type="file" ref={sourceImageInputRef} className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handleSourceImage} />
      <input type="file" ref={coverImageInputRef} className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handleCoverImage} />
      
      {isImageModalOpen && (
          <PostImageSelectionModal
            gitService={gitService}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onClose={() => setIsImageModalOpen(false)}
            onConfirm={handleImageConfirm}
          />
      )}

      {isEditorImageModalOpen && (
          <PostImageSelectionModal
            gitService={gitService}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onClose={handleEditorImageClose}
            onConfirm={handleEditorImageConfirm}
          />
      )}

      {/* Gallery Image Picker (reuse PostImageSelectionModal) */}
      {isGalleryPickerOpen && (
          <PostImageSelectionModal
            gitService={gitService}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onClose={() => setIsGalleryPickerOpen(false)}
            onConfirm={handleGalleryAddFromPicker}
          />
      )}

      {/* Frontmatter Field Edit Modal */}
      {fieldModalKey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`bg-notion-bg text-notion-text rounded-xl shadow-2xl w-full flex flex-col border border-notion-border overflow-hidden ${
            fieldModalIsGallery ? 'max-w-2xl max-h-[85vh]' : 'max-w-lg max-h-[80vh]'
          }`}>
            <header className="px-5 py-3.5 border-b border-notion-border flex items-center justify-between bg-notion-sidebar/40 flex-shrink-0">
              <div className="flex items-center gap-2">
                {fieldModalIsGallery 
                  ? <ImageIcon className="w-4 h-4 text-notion-muted" />
                  : <EditIcon className="w-4 h-4 text-notion-muted" />
                }
                <h3 className="text-sm font-semibold text-notion-text capitalize">{fieldModalKey}</h3>
                {fieldModalIsGallery ? (
                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full font-medium">
                    {fieldModalGalleryItems.length} images
                  </span>
                ) : fieldModalIsComplex ? (
                  <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full font-medium">JSON</span>
                ) : null}
              </div>
              <button onClick={() => setFieldModalKey(null)} className="text-notion-muted hover:text-notion-text p-1 hover:bg-notion-hover rounded-md transition-colors cursor-pointer">
                <CloseIcon className="w-4 h-4" />
              </button>
            </header>

            {fieldModalIsGallery ? (
              <>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                  {fieldModalGalleryItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-notion-muted">
                      <ImageIcon className="w-10 h-10 opacity-30 mb-3" />
                      <p className="text-sm">No images in gallery</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {fieldModalGalleryItems.map((item, index) => {
                        const imgKey = getGalleryImageKey(item);
                        const imgSrc = item[imgKey] || '';
                        const labelKey = 'label' in item ? 'label' : 'alt' in item ? 'alt' : 'title' in item ? 'title' : 'label';
                        const label = item[labelKey] || '';
                        return (
                          <div 
                            key={index}
                            draggable
                            onDragStart={() => handleGalleryDragStart(index)}
                            onDragOver={(e) => handleGalleryDragOver(e, index)}
                            onDragEnd={handleGalleryDragEnd}
                            className={`group/card relative rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                              galleryDragIndex === index 
                                ? 'border-notion-blue shadow-md ring-2 ring-blue-500/30 scale-[0.97]' 
                                : 'border-notion-border hover:border-notion-blue/40 hover:shadow-xs'
                            }`}
                          >
                            <div className="aspect-square bg-notion-sidebar/40 rounded-t-lg overflow-hidden relative">
                              <GalleryThumbnail 
                                src={imgSrc} 
                                label={label} 
                                gitService={gitService} 
                                repo={repo} 
                                projectType={projectType} 
                                domainUrl={domainUrl} 
                              />
                              <span className="absolute top-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full font-medium">
                                {index + 1}
                              </span>
                              <button
                                onClick={() => handleGalleryRemove(index)}
                                className="absolute top-1.5 right-1.5 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity cursor-pointer"
                                title="Remove"
                              >
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="p-2 space-y-1">
                              <input
                                type="text"
                                value={label}
                                onChange={(e) => handleGalleryItemChange(index, labelKey, e.target.value)}
                                placeholder="Label..."
                                className="w-full text-xs bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 py-0.5 px-0.5 text-notion-text placeholder-notion-muted/50 hover:bg-notion-hover/30 rounded-sm transition-colors"
                              />
                              <input
                                type="text"
                                value={imgSrc}
                                onChange={(e) => handleGalleryItemChange(index, imgKey, e.target.value)}
                                placeholder="/images/..."
                                className="w-full text-[10px] font-mono bg-transparent border-b border-transparent focus:border-notion-blue focus:ring-0 py-0.5 px-0.5 text-notion-muted placeholder-notion-muted/30 hover:bg-notion-hover/30 rounded-sm transition-colors truncate"
                              />
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setIsGalleryPickerOpen(true)}
                        className="aspect-square rounded-lg border-2 border-dashed border-notion-border hover:border-notion-blue/50 flex flex-col items-center justify-center gap-2 text-notion-muted hover:text-notion-blue transition-colors group/add cursor-pointer"
                      >
                        <PlusIcon className="w-6 h-6 opacity-40 group-hover/add:opacity-70 transition-opacity" />
                        <span className="text-[10px] font-medium">Add Image</span>
                      </button>
                    </div>
                  )}
                </div>
                <footer className="px-4 py-3 border-t border-notion-border flex items-center justify-between bg-notion-sidebar/30 flex-shrink-0">
                  <p className="text-[10px] text-notion-muted">💡 拖拽排序 · 点击 × 移除</p>
                  <div className="flex gap-2">
                    <button onClick={() => setFieldModalKey(null)} className="px-3 py-1.5 text-xs text-notion-text border border-notion-border rounded-md hover:bg-notion-hover transition-colors cursor-pointer">取消</button>
                    <button onClick={handleFieldModalSave} className="px-3.5 py-1.5 text-xs text-white bg-notion-blue rounded-md hover:opacity-90 transition-opacity font-medium cursor-pointer shadow-2xs">应用到当前页面</button>
                  </div>
                </footer>
              </>
            ) : (
              <>
                <div className="flex-grow p-4 overflow-y-auto">
                  <textarea
                    className={`w-full h-60 p-3 text-xs border border-notion-border rounded-lg focus:outline-none focus:ring-2 focus:ring-notion-blue/20 focus:border-notion-blue resize-y bg-notion-sidebar/30 text-notion-text ${
                      fieldModalIsComplex ? 'font-mono leading-relaxed' : 'leading-normal'
                    }`}
                    value={fieldModalValue}
                    onChange={(e) => setFieldModalValue(e.target.value)}
                    spellCheck={!fieldModalIsComplex}
                    placeholder={fieldModalIsComplex ? 'Edit JSON...' : 'Edit value...'}
                  />
                  {fieldModalIsComplex && (
                    <p className="text-[10px] text-notion-muted mt-2">💡 请以标准 JSON 格式编辑。</p>
                  )}
                </div>
                <footer className="px-4 py-3 border-t border-notion-border flex justify-end gap-2 bg-notion-sidebar/30 flex-shrink-0">
                  <button onClick={() => setFieldModalKey(null)} className="px-3 py-1.5 text-xs text-notion-text border border-notion-border rounded-md hover:bg-notion-hover transition-colors cursor-pointer">取消</button>
                  <button onClick={handleFieldModalSave} className="px-3.5 py-1.5 text-xs text-white bg-notion-blue rounded-md hover:opacity-90 transition-opacity font-medium cursor-pointer shadow-2xs">应用到当前页面</button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sticky Header - Aligned to System Console & LiquidGlass styling */}
      <header className="h-14 border-b border-notion-border bg-notion-bg/90 sticky top-0 z-30 flex-shrink-0 backdrop-blur-md">
        <div className="px-4 sm:px-6 h-full flex justify-between items-center w-full gap-4">
            {/* Left: Return + Breadcrumb Title (flex-1 min-w-0 for auto truncation) */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden justify-start">
                <LiquidGlassButton
                  type="button"
                  variant="default"
                  size="sm"
                  icon={<ArrowLeft className="w-3.5 h-3.5 shrink-0" />}
                  onClick={() => { void confirmLeave().then((allowed) => { if (allowed) onBack(); }); }}
                  className="gap-1.5 h-8 text-xs font-medium text-notion-text shrink-0 whitespace-nowrap select-none"
                >
                  <span className="whitespace-nowrap">返回列表</span>
                </LiquidGlassButton>
                <span className="text-notion-border text-xs font-light shrink-0 select-none">/</span>
                <div className="flex items-center min-w-0 truncate text-xs text-notion-muted">
                  <span
                    className="truncate font-semibold text-notion-text text-xs whitespace-nowrap min-w-0"
                    title={post.sha === "" && !post.imported ? t('postList.createButton') : (editableFrontmatter.title || post.name)}
                  >
                    {post.sha === "" && !post.imported ? t('postList.createButton') : (editableFrontmatter.title || post.name)}
                  </span>
                </div>
            </div>

            {/* Right: Fixed Action Controls & Tabs (Position fixed to right, unaffected by title changes) */}
            <div className="flex items-center justify-end gap-2 sm:gap-2.5 shrink-0">
                {/* View Switcher: Segmented Pill Control */}
                <div className="inline-flex items-center p-1 rounded-xl bg-notion-sidebar border border-notion-border shadow-2xs whitespace-nowrap shrink-0">
                    {hasWysiwygPlugin && (
                        <button
                            type="button"
                            onClick={() => handleTabChange('edit')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                activeTab === 'edit'
                                ? 'bg-notion-bg text-notion-text shadow-xs font-semibold'
                                : 'text-notion-muted hover:text-notion-text'
                            }`}
                        >
                            <EditIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">编辑</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => handleTabChange('code')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            activeTab === 'code'
                            ? 'bg-notion-bg text-notion-text shadow-xs font-semibold'
                            : 'text-notion-muted hover:text-notion-text'
                        }`}
                    >
                        <CodeIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">源码</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            activeTab === 'preview'
                            ? 'bg-notion-bg text-notion-text shadow-xs font-semibold'
                            : 'text-notion-muted hover:text-notion-text'
                        }`}
                    >
                        <EyeIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">{t('postPreview.tabPreview')}</span>
                    </button>
                </div>
                {!post.path.startsWith('content/stories/') && (activeTab === 'code' || !hasWysiwygPlugin) && (
                    <button type="button" disabled={isUploading || isSaving} onClick={() => sourceImageInputRef.current?.click()} className="rounded-lg border border-notion-border px-2.5 py-1.5 text-xs text-notion-text disabled:opacity-50">
                        {isUploading ? '上传中…' : '插入图片'}
                    </button>
                )}

                {isDirty ? (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0 select-none">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="whitespace-nowrap">有未保存修改</span>
                  </span>
                ) : draftRef.current ? (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0 select-none">
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="whitespace-nowrap">{`草稿已同步 · 修订 ${draftRef.current.revision}`}</span>
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-notion-border bg-notion-sidebar/60 px-2.5 py-1 text-[11px] font-medium text-notion-muted whitespace-nowrap shrink-0 select-none">
                    <span className="size-1.5 rounded-full bg-notion-muted/50 shrink-0" />
                    <span className="whitespace-nowrap">尚未保存为草稿</span>
                  </span>
                )}
                <LiquidGlassButton
                  type="button"
                  variant="default"
                  size="sm"
                  icon={<SlidersHorizontal className="w-3.5 h-3.5 text-notion-muted shrink-0" />}
                  aria-expanded={propertiesOpen}
                  aria-controls="cms-properties"
                  onClick={() => setPropertiesOpen(value => !value)}
                  className="gap-1.5 h-8 text-xs font-medium text-notion-text whitespace-nowrap shrink-0"
                >
                  <span className="whitespace-nowrap">{propertiesOpen ? '收起属性' : '文章属性'}</span>
                </LiquidGlassButton>
                <LiquidGlassButton
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isSaving || publishing || (Boolean(draftRef.current) && !isDirty)}
                  icon={<Save className="w-3.5 h-3.5 shrink-0" />}
                  onClick={() => void handleSave()}
                  title="保存到 D1 工作草稿"
                  className="gap-1.5 h-8 text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <span className="whitespace-nowrap">{isSaving ? '保存中…' : '保存草稿'}</span>
                </LiquidGlassButton>
                <LiquidGlassButton
                  type="button"
                  variant="blue"
                  size="sm"
                  disabled={
                    (publishMode !== 'github' && publishMode !== 'd1') ||
                    publishing ||
                    isSaving ||
                    (publication?.status === 'committed' && !isDirty && !draftRef.current)
                  }
                  onClick={() => void handlePublishClick()}
                  icon={<Send className="w-3.5 h-3.5 shrink-0" />}
                  title={
                    publishMode === 'snapshot'
                      ? '只读快照模式：当前未配置发布通道，无法直接发布'
                      : isD1Mode
                      ? publishedBaseRef.current || post.sha
                        ? '保存当前修改并即时更新全站文章'
                        : '保存当前输入并即时发布至全站'
                      : publication && ['prepared', 'in_flight', 'unknown'].includes(publication.status)
                      ? '使用当前操作 ID 对账 Git 提交状态'
                      : publishedBaseRef.current || post.sha
                      ? '保存当前修改并更新已发布文章'
                      : '保存当前输入并发布为新文章'
                  }
                  className="gap-1.5 h-8 text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <span>
                    {publishing
                      ? '发布中…'
                      : publication && ['prepared', 'in_flight', 'unknown'].includes(publication.status)
                      ? '对账'
                      : publishedBaseRef.current || post.sha
                      ? '更新发布'
                      : '发布'}
                  </span>
                </LiquidGlassButton>
            </div>
        </div>
      </header>
      {saveMessage && <p role={saveError ? 'alert' : 'status'} className={`border-b px-6 py-2 text-xs ${saveError ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400' : 'border-notion-border text-notion-muted'}`}>{saveMessage}</p>}
      {(publishMessage || lastCommit) && <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-notion-border px-6 py-2 text-xs text-notion-muted">
        {publishMessage && <span>{publishMessage}</span>}
        {lastCommit?.resultCommitSha && !lastCommit.resultCommitSha.startsWith('d1:') && <span className="font-mono">Git {lastCommit.resultCommitSha.slice(0, 12)}</span>}
        {lastCommit && !isD1Mode && <span>部署：{{ unverified: '未核实', pending: '排队中', running: '运行中', verified: '已核实', failed: '失败', cancelled: '已取消' }[lastCommit.deploymentStatus]}</span>}
        {lastCommit && !isD1Mode && <button type="button" disabled={checkingDeployment} onClick={() => void handleVerifyDeployment()} className="underline disabled:opacity-50">{checkingDeployment ? '检查中…' : '检查部署'}</button>}
        {lastCommit?.deploymentRef && /^\d+$/.test(lastCommit.deploymentRef) && /^[\w.-]+\/[\w.-]+$/.test(repo.full_name) && <a className="underline" href={`https://github.com/${repo.full_name}/actions/runs/${lastCommit.deploymentRef}`} target="_blank" rel="noopener noreferrer">查看 Deploy 记录</a>}
        {lastCommit && isD1Mode && <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ 已即时同步至全站</span>}
        {lastCommit && <a className="underline hover:text-notion-text" href={lastCommit.publicPath} target="_blank" rel="noopener noreferrer">查看当前线上版 ↗</a>}
      </div>}

      {/* Main Scrollable Content — 2-column WordPress-style layout */}
      <div id="post-detail-container" className="flex-grow overflow-y-auto bg-notion-bg custom-scrollbar">
            <div className="flex flex-col lg:flex-row w-full h-full">

              {/* LEFT COLUMN — Content Editor */}
              <div className="cms-writing-column flex-1 min-w-0 px-6 py-8" tabIndex={0} role="region" aria-label="文章正文编辑区">
                <div className="w-full max-w-[820px] mx-auto">
                  {/* Title - Auto Resizing Textarea */}
                  <textarea
                      ref={titleTextareaRef}
                      className="text-3xl lg:text-4xl font-bold text-notion-text mb-6 break-words leading-tight tracking-tight w-full border-none focus:ring-0 p-0 placeholder:text-notion-muted/40 resize-none overflow-hidden bg-transparent"
                      value={editableFrontmatter.title || ''}
                      onChange={(e) => {
                          handleFrontmatterChange('title', e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault(); }}
                      placeholder="未命名文章" aria-label="文章标题"
                      rows={1}
                  />

                  {/* JSX 文字与源码参数的分工提示，不宣称此视图是真实 Astro 预览。 */}
                  {activeTab === 'edit' && post.name.endsWith('.mdx') && (
                    <div className="cms-jsx-help flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-700 dark:text-sky-300 mb-6 leading-relaxed">
                      <Info className="w-4 h-4 shrink-0 text-sky-500" />
                      <span>文字可直接编辑；点击组件在右侧配置。复杂表达式使用源码编辑，组件库支持在正文光标处插入。</span>
                    </div>
                  )}
                  {/* Content Area */}
                  <div className="pb-20">
                    {importError && (
                      <div role="alert" className="p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                        可视化解析失败，已保留原文并切换源码：{importError}
                      </div>
                    )}
                {activeTab === 'edit' && hasWysiwygPlugin ? (
                    // @para-doc [#csa-native-fallback-settings-bypass]
                    <SlotRenderer
                        slot="editor"
                        pluginName={pluginConfig.plugins?.editor}
                        fallback={
                            <NativePlainEditor
                                value={editableBody}
                                onChange={handleEditorChange}
                            />
                        }
                        props={{
                            initialValue: editableBody,
                            onImportError: ({ error, source }) => { setImportError(error); setEditableBody(source); setActiveTab("code"); },
                            onChange: handleEditorChange,
                            frontmatter: editableFrontmatter,
                            gitService: editorGitService,
                            imagesPath,
                            locale: language,
                            readOnly: false,
                            imageBaseUrl: "/",
                            editorRef,
                            externalMarkdown: editableBody,
                            externalMarkdownVersion,
                            onRequestImage: handleRequestImage,
                            onUploadImage: handleCmsImageUpload,
                        } satisfies EditorProps as Record<string, unknown>}
                    />
                ) : activeTab === 'code' || (activeTab === 'edit' && !hasWysiwygPlugin) ? (
                    <NativePlainEditor
                        value={editableBody}
                        onChange={handleEditorChange}
                    />
                ) : (
                    <>
                    {post.name.endsWith('.mdx') && (
                      <p role="note" className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        这里是 Markdown 近似预览。MDX 组件与交互只在站点构建部署后按实际页面渲染；发布前请检查源码及组件属性。
                      </p>
                    )}
                    <div
                        className="prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none text-notion-text
                        prose-headings:font-semibold prose-headings:text-notion-text
                        prose-h1:text-4xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:mt-10 prose-h1:mb-6 prose-h1:pb-2 prose-h1:border-b prose-h1:border-notion-border
                        prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-notion-border
                        prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
                        prose-h4:text-lg prose-h4:font-semibold prose-h4:mt-4 prose-h4:mb-2
                        prose-h5:text-base prose-h5:font-semibold prose-h5:mt-4 prose-h5:mb-2
                        prose-h6:text-sm prose-h6:font-bold prose-h6:text-notion-muted prose-h6:uppercase prose-h6:mt-4 prose-h6:mb-2
                        prose-p:text-notion-text prose-p:leading-7 prose-p:my-4
                        prose-a:text-notion-blue prose-a:no-underline hover:prose-a:underline
                        prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4
                        prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-4
                        prose-li:my-1.5 prose-li:text-notion-text
                        prose-blockquote:border-l-4 prose-blockquote:border-notion-border prose-blockquote:text-notion-muted prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-6
                        prose-img:rounded-lg prose-img:shadow-sm prose-img:my-6
                        prose-code:text-xs prose-code:bg-notion-sidebar prose-code:text-notion-text prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                        prose-pre:bg-notion-sidebar prose-pre:border prose-pre:border-notion-border prose-pre:text-notion-text prose-pre:rounded-lg prose-pre:p-4 prose-pre:shadow-sm prose-pre:my-6
                        prose-hr:my-8 prose-hr:border-notion-border"
                        dangerouslySetInnerHTML={createMarkup(editableBody)}
                    />
                    </>
                )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN — Settings Panel (WordPress-style) */}
              <div id="cms-properties" role="region" aria-label="文章属性" tabIndex={0} hidden={!propertiesOpen} className="cms-properties w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-notion-border bg-notion-sidebar/30 overflow-y-auto">
                <ComponentInspector />
                <div hidden={componentInspector.mode !== 'article'} className="p-5 space-y-5">

                  <section aria-label="发布前属性检查" className={`rounded-xl border p-3.5 text-xs space-y-2 shadow-2xs transition-colors ${
                    publicationIssues.length
                      ? 'border-amber-500/30 bg-amber-500/[0.04]'
                      : 'border-notion-border bg-notion-sidebar/40'
                  }`}>
                    <h3 className="font-semibold text-notion-text flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${publicationIssues.length ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span>发布前属性检查</span>
                    </h3>
                    <p className="text-notion-muted text-xs leading-relaxed">这里的文章属性对应文件顶部的 YAML frontmatter。可先导入编辑，再补齐发布信息。</p>
                    {publicationIssues.length ? (
                      <ul className="list-disc pl-4 space-y-1 text-amber-600 dark:text-amber-400 font-medium">
                        {publicationIssues.map(issue => <li key={issue.field}>{issue.message}</li>)}
                      </ul>
                    ) : (
                      <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {isD1Mode
                            ? '文章属性检查通过；发布将由服务端校验正文有效性与关联图片。'
                            : '文章属性检查通过；发布还会由服务端检查正文、图片及仓库版本。'}
                        </span>
                      </p>
                    )}
                    {publishMode === 'snapshot' && !publicationIssues.length && (
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.04] p-2.5 text-xs space-y-1 text-notion-muted">
                        <p className="font-semibold text-notion-text flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>为什么“发布”按钮是灰色的？</span>
                        </p>
                        <p className="leading-relaxed text-[11px]">
                          当前运行在<strong>本地开发环境（快照模式）</strong>，尚未在 <code className="text-notion-text">.env</code> 中配置 GitHub 提交凭据（<code className="text-notion-text">CMS_GITHUB_TOKEN</code>）。
                        </p>
                        <p className="leading-relaxed text-[11px]">
                          你可以点击<strong>“保存草稿”</strong>将修改写入本地 D1 数据库；如需推送到 GitHub 真实发布，请配置环境变量后重启开发服务。
                        </p>
                      </div>
                    )}
                  </section>

                  {/* 发布目标与隔离环境指示卡片 */}
                  <section aria-label="发布目标环境" className="rounded-xl border border-notion-border bg-notion-sidebar/40 p-3.5 text-xs space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-notion-text flex items-center gap-1.5">
                        <GitBranch className="size-3.5 text-notion-muted" />
                        <span>发布目标环境</span>
                      </span>
                      {isD1Mode ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Database className="size-3 text-emerald-500" />
                          D1 数据库模式
                        </span>
                      ) : publishMode === 'snapshot' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                          本地快照只读
                        </span>
                      ) : sessionInfo?.isTestBranch ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="size-3 text-emerald-500" />
                          本地调试分支
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="size-3 text-rose-500" />
                          生产主分支
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-[11px] text-notion-muted">
                      <div className="flex justify-between items-center">
                        <span>存储后端：</span>
                        <span className="font-mono text-notion-text font-medium truncate max-w-[150px]" title={isD1Mode ? 'Cloudflare D1 生产数据库' : sessionInfo?.repo || 'D1'}>
                          {isD1Mode ? 'Cloudflare D1' : sessionInfo?.repo || (publishMode === 'snapshot' ? '本地快照' : '未配置')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>存储状态：</span>
                        <span className="font-mono font-semibold text-notion-text">
                          {isD1Mode ? '即时同步 · 毫秒生效' : sessionInfo?.branch || 'local'}
                        </span>
                      </div>
                    </div>
                    {isD1Mode ? (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed space-y-0.5">
                        <p className="font-semibold flex items-center gap-1">
                          <ShieldCheck className="size-3 shrink-0" />
                          <span>D1 原生存储运行正常</span>
                        </p>
                        <p>
                          文章发布直接写入生产数据库并即时同步全站前台，无需等待 Git 提交与远程构建。
                        </p>
                      </div>
                    ) : publishMode === 'snapshot' ? (
                      <p className="text-[11px] text-notion-muted leading-relaxed">
                        本地开发模式下未配置 GitHub 凭据，编辑只写入 D1 草稿，无法提交到远程仓库，绝不污染线上。
                      </p>
                    ) : sessionInfo?.isTestBranch ? (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed space-y-0.5">
                        <p className="font-semibold flex items-center gap-1">
                          <ShieldCheck className="size-3 shrink-0" />
                          <span>本地调试隔离保护已生效</span>
                        </p>
                        <p>
                          向此分支发布仅向 <code className="font-mono">{sessionInfo.branch}</code> 提交 Commit，GitHub Actions 部署工作流不会触发，本地调试内容与线上生产完全隔离。
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed space-y-0.5">
                        <p className="font-semibold flex items-center gap-1">
                          <AlertTriangle className="size-3 shrink-0" />
                          <span>生产分支警告</span>
                        </p>
                        <p>
                          当前配置为生产主分支。发布将直接推送到线上仓库并触发自动部署！若在本地调试，请在 <code className="font-mono">.env</code> 中配置 <code className="font-mono">CMS_GITHUB_BRANCH="cms-test"</code>。
                        </p>
                      </div>
                    )}
                  </section>
                  {/* 封面图片 Section */}
                  {!post.path.startsWith('content/stories/') && (
                    <div>
                      <p className="text-xs font-semibold text-notion-muted mb-2.5">封面图片</p>
                    {hasCoverImage ? (
                      <div className="relative group">
                        <CoverImage 
                            thumbnailUrl={editableFrontmatter.image || editableFrontmatter.cover || editableFrontmatter.thumbnail || editableFrontmatter.heroImage || post.thumbnailUrl} 
                            gitService={gitService} 
                            repo={repo} 
                            domainUrl={domainUrl} 
                            projectType={projectType}
                            className="w-full h-40 object-cover rounded-lg border border-notion-border"
                        />
                        <button
                          disabled={isUploading || isSaving} title="上传新封面到当前草稿" onClick={() => coverImageInputRef.current?.click()}
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center rounded-lg transition-all"
                        >
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-md transition-opacity">
                            更换图片
                          </span>
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={isUploading || isSaving} title="上传封面到当前草稿" onClick={() => coverImageInputRef.current?.click()}
                        className="w-full h-28 rounded-xl border border-dashed border-notion-border/80 hover:border-notion-blue/50 bg-notion-sidebar/20 hover:bg-notion-sidebar/40 flex flex-col items-center justify-center gap-2 text-notion-muted hover:text-notion-blue transition-colors group disabled:opacity-50"
                      >
                        <ImageIcon className="w-5 h-5 opacity-40 group-hover:opacity-70 transition-opacity" />
                        <span className="text-xs font-medium">{isUploading ? '上传中…' : '上传封面'}</span>
                      </button>
                    )}
                    </div>
                  )}

                  <div className="border-t border-notion-border"></div>

                  {/* Metadata Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-notion-muted">文章属性</p>
                      {post.imported && !draftRef.current && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          待设定地址标识
                        </span>
                      )}
                    </div>
                    <div className="space-y-0">
                      {/* 1. 地址标识 (Slug) / 访问路径 */}
                      {post.imported && !draftRef.current ? (
                        <div className="flex py-1.5 group items-start">
                          <div className="w-24 flex-shrink-0 flex items-center text-notion-muted pt-1">
                            <div className="flex items-center px-1 py-0.5 rounded-sm transition-colors cursor-default">
                              <Globe className="w-3 h-3 mr-1.5 opacity-60 flex-shrink-0 text-notion-blue" />
                              <span className="capitalize truncate text-[11px] font-medium text-notion-text">
                                地址标识
                                <span className="text-red-500 ml-0.5">*</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex-grow min-w-0 space-y-1">
                            <input
                              ref={slugInputRef}
                              type="text"
                              value={importSlug}
                              maxLength={100}
                              placeholder="例如 google-seo-guide"
                              autoCapitalize="off"
                              spellCheck={false}
                              onChange={(e) => {
                                editSerialRef.current += 1;
                                const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                setImportSlug(val);
                                setIsDirty(true);
                                setSaveMessage('');
                                setSaveError(false);
                              }}
                              className={`w-full bg-notion-bg border rounded-lg text-xs py-1.5 px-2.5 text-notion-text font-mono focus:outline-none focus:ring-2 focus:ring-notion-blue/20 transition-all shadow-2xs ${
                                saveError && !importSlug.trim()
                                  ? 'border-red-500 ring-2 ring-red-500/20'
                                  : 'border-notion-border focus:border-notion-blue'
                              }`}
                            />
                            <p className="text-[10px] text-notion-muted font-mono truncate" title={resolvedPublicPath}>
                              预览: <span className="text-notion-text font-medium">{resolvedPublicPath}</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex py-1.5 group items-start">
                          <div className="w-24 flex-shrink-0 flex items-center text-notion-muted pt-1">
                            <div className="flex items-center px-1 py-0.5 rounded-sm transition-colors cursor-default">
                              <Globe className="w-3 h-3 mr-1.5 opacity-60 flex-shrink-0" />
                              <span className="capitalize truncate text-[11px] font-medium">访问路径</span>
                            </div>
                          </div>
                          <div className="flex-grow min-w-0 flex items-center gap-1.5">
                            <span className="text-xs font-mono text-notion-text/90 truncate bg-notion-sidebar/60 px-2 py-1 rounded-md border border-notion-border flex-grow min-w-0" title={resolvedPublicPath}>
                              {resolvedPublicPath}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.clipboard) {
                                  void navigator.clipboard.writeText(resolvedPublicPath);
                                  setCopiedPath(true);
                                  setTimeout(() => setCopiedPath(false), 2000);
                                }
                              }}
                              className="p-1 rounded-md border border-notion-border text-notion-muted hover:text-notion-text hover:bg-notion-sidebar transition-colors cursor-pointer shrink-0"
                              title="复制路径"
                            >
                              {copiedPath ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                            </button>
                            {post.sha && lastCommit?.publicPath && (
                              <a
                                href={lastCommit.publicPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-md border border-notion-border text-notion-muted hover:text-notion-text hover:bg-notion-sidebar transition-colors cursor-pointer shrink-0"
                                title="查看线上版"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 2. 语言 (Language) */}
                      <div className="flex py-1.5 group items-start">
                        <div className="w-24 flex-shrink-0 flex items-center text-notion-muted pt-1">
                          <div className="flex items-center px-1 py-0.5 rounded-sm transition-colors cursor-default">
                            <svg viewBox="0 0 16 16" className="w-3 h-3 mr-1.5 fill-current opacity-50 flex-shrink-0"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                            <span className="capitalize truncate text-[11px] font-medium">语言</span>
                          </div>
                        </div>
                        <div className="flex-grow min-w-0 flex items-center">
                          <select
                            value={String(editableFrontmatter.lang || importLang || 'zh')}
                            onChange={(e) => {
                              const newLang = e.target.value as 'en' | 'zh';
                              handleFrontmatterChange('lang', newLang);
                              if (post.imported) setImportLang(newLang);
                            }}
                            className="w-full bg-notion-bg border border-notion-border rounded-lg text-xs py-1.5 px-2.5 text-notion-text focus:outline-none focus:ring-2 focus:ring-notion-blue/20 focus:border-notion-blue transition-all cursor-pointer shadow-2xs"
                          >
                            <option value="zh">中文 (zh)</option>
                            <option value="en">English (en)</option>
                          </select>
                        </div>
                      </div>

                      {/* 3. 其它 frontmatter 属性 */}
                      {Object.entries(editableFrontmatter).filter(([k]) => k !== 'title' && k !== 'lang' && k !== 'slug').map(([key, value]) => (
                          <div key={key} className="flex py-1.5 group items-start">
                              <div className="w-24 flex-shrink-0 flex items-center text-notion-muted pt-1">
                                  <div className="flex items-center px-1 py-0.5 rounded-sm transition-colors cursor-default">
                                      <svg viewBox="0 0 16 16" className="w-3 h-3 mr-1.5 fill-current opacity-50 flex-shrink-0"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                                      <span className="capitalize truncate text-[11px] font-medium">{fieldLabel(key)}</span>
                                  </div>
                              </div>
                              <div className="flex-grow min-w-0 flex items-center">
                                  {renderInput(key, value)}
                              </div>
                          </div>
                      ))}
                    </div>
                  </div>

                  {/* Missing Fields Suggestions */}
                  {missingFields.length > 0 && (
                      <>
                        <div className="border-t border-dashed border-notion-border"></div>
                        <div>
                          <p className="text-xs font-semibold text-notion-muted mb-2">可补充属性</p>
                          {missingFields.filter(f => f !== 'title' && f !== 'lang' && f !== 'slug').map(field => (
                              <div key={field} className="flex py-1.5 group items-center opacity-70 hover:opacity-100 transition-opacity">
                                  <div className="w-24 flex-shrink-0 flex items-center text-notion-muted">
                                      <div className="flex items-center px-1 py-0.5 rounded-sm">
                                          <svg viewBox="0 0 16 16" className="w-3 h-3 mr-1.5 fill-current opacity-50"><path d="M1.5 6.5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z" opacity="0.6"/><path d="M1.5 2.5a1 1 0 011-1h11a1 1 0 011 1v2a1 1 0 01-1 1h-11a1 1 0 01-1-1v-2z"/></svg>
                                          <span className="capitalize truncate text-[11px] font-medium">{fieldLabel(field)}</span>
                                      </div>
                                  </div>
                                  <div className="flex-grow">
                                      <button 
                                          onClick={() => handleAddMissingField(field)}
                                          className="text-xs text-notion-blue hover:underline flex items-center"
                                      >
                                          <PlusIcon className="w-3 h-3 mr-1" />
                                          添加
                                      </button>
                                  </div>
                              </div>
                          ))}
                        </div>
                      </>
                  )}

                  <div className="border-t border-notion-border"></div>

                  {/* File Info Spec Box */}
                  <div>
                    <p className="text-xs font-semibold text-notion-muted mb-2">文件信息</p>
                    <div className="space-y-1.5 rounded-lg border border-notion-border bg-notion-sidebar/40 p-2.5 text-xs text-notion-muted shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-notion-muted">文件名</span>
                        <span className="font-mono text-[11px] text-notion-text truncate max-w-[170px]" title={draftRef.current?.targetPath.split('/').pop() ?? post.name}>{draftRef.current?.targetPath.split('/').pop() ?? post.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-notion-muted">路径</span>
                        <span className="font-mono text-[11px] text-notion-text truncate max-w-[170px]" title={draftRef.current?.targetPath ?? post.path}>{draftRef.current?.targetPath ?? post.path}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
      </div>

      {/* 发布目标与分支确认弹窗（防线上混淆） */}
      {showPublishConfirmModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-notion-border bg-notion-bg p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              {isD1Mode ? (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Globe className="size-6" />
                </div>
              ) : sessionInfo?.isProductionBranch ? (
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                  <AlertTriangle className="size-6" />
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <ShieldCheck className="size-6" />
                </div>
              )}
              <div className="space-y-1">
                <h3 className="text-base font-bold text-notion-text">
                  {isD1Mode
                    ? '🚀 文章发布上线确认'
                    : sessionInfo?.isProductionBranch
                    ? '⚠️ 生产环境发布确认'
                    : '🌿 提交到本地调试分支确认'}
                </h3>
                <p className="text-xs text-notion-muted leading-relaxed">
                  {isD1Mode
                    ? '发布后文章将直接写入 Cloudflare D1 生产数据库，并即时同步全站前台，读者可直接访问阅读。'
                    : sessionInfo?.isProductionBranch
                    ? '您当前配置为生产主分支。发布后将直接向远程主库提交，并触发线上网站自动构建上线。'
                    : `您当前配置为本地调试分支（${sessionInfo?.branch || 'dev-content'}）。提交仅推送到调试分支，不会触发生产构建部署，与线上生产完全隔离。`}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-notion-border bg-notion-sidebar/40 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-notion-muted">
                <span>{isD1Mode ? '存储后端：' : '目标仓库：'}</span>
                <span className="font-mono text-notion-text font-medium">
                  {isD1Mode ? 'Cloudflare D1 (生产数据库)' : sessionInfo?.repo || '未知仓库'}
                </span>
              </div>
              <div className="flex justify-between items-center text-notion-muted">
                <span>{isD1Mode ? '发布模式：' : '目标分支：'}</span>
                <span className="font-mono font-semibold text-notion-text">
                  {isD1Mode ? '即时发布 · 毫秒级全站生效' : sessionInfo?.branch || 'snapshot'}
                </span>
              </div>
              <div className="flex justify-between items-center text-notion-muted">
                <span>{isD1Mode ? '同步状态：' : '隔离状态：'}</span>
                {isD1Mode ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    已连接数据库 · 即时全站生效
                  </span>
                ) : sessionInfo?.isProductionBranch ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                    生产主分支（将触发全站部署上线）
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    本地调试分支（已隔离 · 不会触发上线）
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-notion-muted">
                <span>目标文件：</span>
                <span className="font-mono text-notion-text truncate max-w-[240px]" title={draftRef.current?.targetPath ?? post.path}>
                  {draftRef.current?.targetPath ?? post.path}
                </span>
              </div>
            </div>

            {isD1Mode ? (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Info className="size-3.5 shrink-0" />
                  <span>发布提示</span>
                </p>
                <p>
                  发布后文章将立即在前台博客/故事列表及详情页上线；后续如需更新或下线，可随时在后台继续编辑保存或撤回。
                </p>
              </div>
            ) : sessionInfo?.isProductionBranch ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Info className="size-3.5 shrink-0" />
                  <span>本地开发调试提示</span>
                </p>
                <p>
                  如果仅用于本地开发调试，请在项目根目录的 <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">.env</code> 中配置 <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">CMS_GITHUB_BRANCH="dev-content"</code>，避免调试内容混入线上生产环境。
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishConfirmModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-notion-border text-xs font-medium text-notion-muted hover:text-notion-text hover:bg-notion-sidebar transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void executePublish()}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer ${
                  isD1Mode
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : sessionInfo?.isProductionBranch
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isD1Mode
                  ? '确认发布并上线'
                  : sessionInfo?.isProductionBranch
                  ? '确认发布并上线'
                  : `确认提交到 ${sessionInfo?.branch || 'dev-content'} 分支`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostDetailView;
