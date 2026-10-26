import { ComponentEditingProvider } from '../../integration/components/InspectorContext';
import { fieldLabel } from '../../integration/labels';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { Filter, ChevronDown, Plus, Upload, ArrowUpDown, Check, X } from 'lucide-react';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { IGitService, GithubRepo, ProjectType } from '../types';
import { parseMarkdown } from '../utils/parsing';
import { useI18n } from '../i18n/I18nContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ViewListIcon } from './icons/ViewListIcon';
import { ViewGridIcon } from './icons/ViewGridIcon';
import { UploadIcon } from './icons/UploadIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ImageIcon } from './icons/ImageIcon';
import { EditIcon } from './icons/EditIcon';
import { EyeIcon } from './icons/EyeIcon';
import PostDetailView from './PostDetailView';
import PostUploadValidationModal from './PostUploadValidationModal';
import PostImageSelectionModal from './PostImageSelectionModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useCollectionStore } from '../features/collections/store';
import { DEFAULT_SETTINGS } from '../features/settings/types';
import { resolveImageSource } from '../utils/github';
import FilterBar, { matchesFilter, type FilterValue } from './FilterBar';
import { usePostActions, type PostData } from '../hooks/usePostActions';
import { cmsDocumentClient, type CmsDeletionResult, type CmsDraftSummary } from '../../../../src/lib/admin/cms-document-client';
import { parseSourceDocument } from '../../../../src/lib/content-source';
import { resolveNewContentTarget, resolveContentPublicPath } from '../../../../src/lib/content-routing';

// TD-09: Simplified props — PostList reads settings from CollectionStore (SSoT)
interface PostListProps {
  gitService: IGitService;
  repo: GithubRepo;
  onPostUpdate: () => void;
  onAction: () => void;
  onEditingChange?: (isEditing: boolean) => void;
}

type SortOption = string;

const SortDropdown: React.FC<{
  value: SortOption;
  onChange: (val: SortOption) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [isOpen]);

  const currentLabel = options.find((o) => o.value === value)?.label || '排序';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-notion-border bg-notion-bg text-xs font-medium text-notion-text shadow-2xs transition-all hover:bg-notion-hover focus:outline-none focus:ring-2 focus:ring-notion-blue/20 focus:border-notion-blue cursor-pointer"
        aria-expanded={isOpen}
      >
        <ArrowUpDown className="size-3 text-notion-muted shrink-0" />
        <span className="truncate max-w-[90px] sm:max-w-none">{currentLabel}</span>
        <ChevronDown
          className={`size-3 text-notion-muted shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-notion-border bg-notion-bg p-1 shadow-xl animate-in fade-in-0 zoom-in-95">
          <div className="py-1 px-2 text-[10px] font-semibold text-notion-muted/80 uppercase tracking-wider">
            排序方式
          </div>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value as SortOption);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                  isSelected
                    ? 'bg-notion-blue/10 text-notion-blue font-semibold'
                    : 'text-notion-text hover:bg-notion-hover'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="size-3.5 text-notion-blue shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Component to handle authenticated image loading for private repos
const ThumbnailWithAuth: React.FC<{ gitService: IGitService, imagePath: string, className?: string }> = ({ gitService, imagePath, className = "h-full w-full object-cover" }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!imagePath) {
            setIsLoading(false);
            return;
        }
        
        if (imagePath.startsWith('http')) {
            setImageUrl(imagePath);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        let objectUrl: string | null = null;

        const fetchBlob = async () => {
            setIsLoading(true);
            const fullPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
            try {
                const blob = await gitService.getFileAsBlob(fullPath);
                if (isMounted) {
                    objectUrl = URL.createObjectURL(blob);
                    setImageUrl(objectUrl);
                }
            } catch (e) {
                if (isMounted) setImageUrl(null);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchBlob();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [gitService, imagePath]);
    
    if (isLoading) {
        return <div className={`flex items-center justify-center bg-notion-sidebar/40 ${className}`}><SpinnerIcon className="w-3 h-3 animate-spin text-notion-muted" /></div>;
    }

    if (!imageUrl) {
        return <div className={`flex items-center justify-center bg-notion-sidebar/40 ${className}`}><ImageIcon className="text-notion-muted/40 w-1/2 h-1/2" /></div>;
    }

    return <img src={imageUrl} alt="Thumbnail" className={className} />;
};

const PostList: React.FC<PostListProps> = ({
  gitService,
  repo,
  onPostUpdate,
  onAction,
  onEditingChange
}) => {
  // TD-09: Read settings from CollectionStore (SSoT) instead of props
  const { workspace, getActiveCollection } = useCollectionStore();
  const activeCollection = getActiveCollection();
  const wsSettings = workspace?.settings || {};
  
  const path = activeCollection?.postsPath || '';
  const imagesPath = activeCollection?.imagesPath || '';
  const domainUrl = (wsSettings as any).domainUrl || '';
  const projectType: ProjectType = (wsSettings as any).projectType || DEFAULT_SETTINGS.projectType;
  const postFileTypes = (wsSettings as any).postFileTypes || DEFAULT_SETTINGS.postFileTypes;
  const imageFileTypes = (wsSettings as any).imageFileTypes || DEFAULT_SETTINGS.imageFileTypes;
  const updatePostCommitTemplate = (wsSettings as any).updatePostCommit || DEFAULT_SETTINGS.updatePostCommit;
  const { t, language } = useI18n();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 20;

  // WF-08: Filter state
  const [activeFilters, setActiveFilters] = useState<Record<string, FilterValue>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [openingPost, setOpeningPost] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newLang, setNewLang] = useState<'en' | 'zh'>('en');
  const [newSlug, setNewSlug] = useState('');
  const [newFormat, setNewFormat] = useState<'md' | 'mdx'>('mdx');
  useEffect(() => {
    onEditingChange?.(Boolean(selectedPost));
    return () => {
      onEditingChange?.(false);
    };
  }, [selectedPost, onEditingChange]);


  // TD-10: Post actions extracted to hook
  const {
    uploadPostInputRef,
    handleFileUpload,
    confirmUpload,
    uploadFile,
    isUploadModalOpen,
    setIsUploadModalOpen,
    setUploadFile,
    isUploading,
    updatePostFileInputRef,
    handleUpdatePostFile,
    confirmUpdatePostFile,
    handleUpdateImage,
    handleImageConfirm,
    isImageModalOpen,
    setIsImageModalOpen,
    postToUpdateImage,
    postToDelete,
    setPostToDelete,
    confirmDelete,
    isDeleting,
    deleteError,
    deleteNotice,
  } = usePostActions({
    gitService,
    path,
    imagesPath,
    updatePostCommitTemplate,
    onAction,
    fetchPosts: () => fetchPosts(),
    onImport: setSelectedPost,
    selectedPost,
    setSelectedPost,
  });

  // Columns Configuration (activeCollection already destructured above via TD-09)
  const activeTemplate = activeCollection?.template || null;
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ '__name__': 35 });

  // @para-doc [#csa-new-post-state]
  const handleCreateNewPost = useCallback(() => {
      const collection = path === 'content/stories' ? 'stories' : 'blog';
      let target;
      try {
        target = resolveNewContentTarget({ collection, lang: newLang, slug: newSlug.trim(), format: collection === 'stories' ? 'md' : newFormat });
      } catch (error) {
        setError(error instanceof Error ? error.message : '地址标识无效');
        return;
      }
      const defaultFrontmatter: Record<string, any> = {
          title: '',
          description: '',
          pubDate: new Date().toISOString().split('T')[0],
          tags: [],
          lang: newLang,
      };

      const source = `---\ntitle: ""\ndescription: ""\npubDate: "${defaultFrontmatter.pubDate}"\ntags: []\nlang: "${newLang}"\n---\n\n`;
      const mockNewPost: PostData = {
          name: target.path.split('/').pop() ?? '',
          path: target.path,
          sha: '',
          body: parseSourceDocument(source).body,
          rawContent: source,
          frontmatter: defaultFrontmatter,
          thumbnailUrl: null,
          html_url: '',
          newTarget: { collection, lang: newLang, slug: newSlug.trim(), format: target.format },
      };

      setSelectedPost(mockNewPost);
      setNewPostOpen(false);
  }, [path, newLang, newSlug, newFormat]);

  const openPost = async (post: PostData) => {
    if (!post.draft) {
      setSelectedPost(post);
      return;
    }
    setOpeningPost(true);
    setError(null);
    try {
      const draft = await cmsDocumentClient.get(post.draft.id);
      let fields: Record<string, unknown> = {};
      let body = draft.source;
      try {
        const parsed = parseSourceDocument(draft.source);
        fields = parsed.fields;
        body = parsed.body;
      } catch {
        // 未完成的 YAML 仍可作为草稿打开；编辑者可在源码区修正。
      }
      setSelectedPost({ ...post, draft, publication: draft.publication, rawContent: draft.source, frontmatter: fields, body });
    } catch (error) {
      setError(error instanceof Error ? error.message : '读取草稿失败');
    } finally {
      setOpeningPost(false);
    }
  };

  useEffect(() => {
    // 1. Prioritize active collection settings
    if (activeCollection) {
        // Use collection's tableColumns (or empty array if not set)
        setVisibleFields(activeCollection.tableColumns || []);
        setColumnWidths(activeCollection.columnWidths || { '__name__': 35 });
        return; // Skip fallback if collection exists
    }

    // 2. Fallback to repo-wide settings in localStorage (legacy support)
    const columnsKey = `postTableColumns_${repo.full_name}`;
    const widthsKey = `postTableColumnWidths_${repo.full_name}`;
    
    const savedColumnsStr = localStorage.getItem(columnsKey);
    const savedWidthsStr = localStorage.getItem(widthsKey);
    
    if (savedColumnsStr) {
         try {
             setVisibleFields(JSON.parse(savedColumnsStr));
         } catch {
             setVisibleFields([]);
         }
    } else {
        // No saved columns, use empty by default
        setVisibleFields([]);
    }

    if (savedWidthsStr) {
        try {
            setColumnWidths(JSON.parse(savedWidthsStr));
        } catch {
            setColumnWidths({ '__name__': 35 });
        }
    }
  }, [repo.full_name, activeCollection?.id, activeCollection?.tableColumns, activeCollection?.columnWidths]);

  const fetchPosts = async () => {
    if (!path) {
        setPosts([]);
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const files = await gitService.listFiles(path);
        const mdFiles = files.filter(f => f.type === 'file' && (f.name.endsWith('.md') || f.name.endsWith('.mdx')));
        
        const postDataPromises = mdFiles.map(async (file) => {
            try {
                const content = await gitService.getFileContent(file.path);
                const { frontmatter, thumbnailUrl } = parseMarkdown(content);
                let body = content;
                try { body = parseSourceDocument(content).body; }
                catch { body = parseMarkdown(content).body; }
                return {
                    frontmatter,
                    body,
                    rawContent: content,
                    name: file.name,
                    sha: file.sha || '',
                    path: file.path,
                    html_url: file.url || '',
                    thumbnailUrl
                } as PostData;
            } catch (e) {
                console.error(`Failed to parse ${file.name}`, e);
                return null;
            }
        });

        const [results, drafts, deletions, publications] = await Promise.all([
          Promise.all(postDataPromises),
          cmsDocumentClient.list(),
          cmsDocumentClient.pendingDeletions(),
          cmsDocumentClient.pendingPublications(),
        ]);
        const pubMap = new Map(publications.map(p => [p.targetPath, p]));
        const merged = new Map(results.filter((p): p is PostData => p !== null).map(post => [post.path, post]));
        for (const draft of drafts.filter((item: CmsDraftSummary) => item.targetPath.startsWith(`${path}/`))) {
          const existing = merged.get(draft.targetPath);
          const pendingPub = pubMap.get(draft.targetPath);
          if (existing) {
            // 列表主标题保留仓库版本；D1 草稿只增加状态，不冒充当前已发布内容。
            merged.set(draft.targetPath, { ...existing, draft, publication: pendingPub });
          } else {
            merged.set(draft.targetPath, {
              name: draft.targetPath.split('/').pop() ?? draft.slug,
              path: draft.targetPath,
              sha: '',
              body: '',
              rawContent: '',
              frontmatter: { title: draft.titleCache ?? draft.slug, lang: draft.lang },
              thumbnailUrl: null,
              html_url: '',
              draft,
              publication: pendingPub,
            });
          }
        }
        // Git 已删除但回执未知时仍保留一行，让管理员能沿原操作 ID 对账。
        for (const deletion of deletions.filter((item: CmsDeletionResult) => item.targetPath.startsWith(`${path}/`))) {
          const existing = merged.get(deletion.targetPath);
          if (existing) {
            merged.set(deletion.targetPath, { ...existing, deletion });
          } else {
            merged.set(deletion.targetPath, {
              name: deletion.targetPath.split('/').pop() ?? deletion.targetPath,
              path: deletion.targetPath,
              sha: deletion.expectedBlobSha,
              body: '',
              rawContent: '',
              frontmatter: { title: deletion.targetPath.split('/').pop() ?? deletion.targetPath },
              thumbnailUrl: null,
              html_url: '',
              deletion,
            });
          }
        }
        setPosts([...merged.values()]);
        onPostUpdate(); // Update stats
    } catch (err) {
        if (err instanceof Error && err.message.includes('404')) {
            setError(t('postList.error.dirNotFound', { path }));
        } else {
            setError(t('app.error.unknown'));
        }
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [path, gitService]);

  // WF-08: Filter handlers
  const handleFilterChange = (field: string, filter: FilterValue | null) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (filter === null) {
        delete next[field];
      } else {
        next[field] = filter;
      }
      return next;
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setCurrentPage(1);
  };

  // WF-08: Column header sort handler
  const handleColumnSort = (field: string) => {
    if (sortOption === `${field}-asc`) {
      setSortOption(`${field}-desc`);
    } else {
      setSortOption(`${field}-asc`);
    }
  };

  // WF-08: Get sort indicator for column header
  const getSortIndicator = (field: string): string | null => {
    if (sortOption === `${field}-asc`) return '▲';
    if (sortOption === `${field}-desc`) return '▼';
    return null;
  };

  // WF-08: Build dynamic sort options from template
  // @para-doc [#csa-postlist-sort-dedupe]
  const dynamicSortOptions = useMemo(() => {
    const baseOptions = [
      { value: 'date-desc', label: '日期从新到旧' },
      { value: 'date-asc', label: '日期从旧到新' },
      { value: 'title-asc', label: '标题升序' },
      { value: 'title-desc', label: '标题降序' },
      { value: 'status-asc', label: '状态优先' },
    ];
    if (activeTemplate?.fields) {
      const meaningfulSortFields = ['updatedDate'];
      const extraFields = activeTemplate.fields.filter((f) =>
        meaningfulSortFields.includes(f.name)
      );
      extraFields.forEach((f) => {
        baseOptions.push(
          { value: `${f.name}-desc`, label: `${fieldLabel(f.name)}从新到旧` },
          { value: `${f.name}-asc`, label: `${fieldLabel(f.name)}从旧到新` },
        );
      });
    }
    return baseOptions;
  }, [activeTemplate]);

  const filteredPosts = useMemo(() => {
      let result = posts;

      // Text search
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(p => 
              p.name.toLowerCase().includes(q) || 
              (p.frontmatter.title && String(p.frontmatter.title).toLowerCase().includes(q)) ||
              (p.frontmatter.author && String(p.frontmatter.author).toLowerCase().includes(q))
          );
      }

      // WF-08: Apply template-based filters
      for (const [field, filter] of Object.entries(activeFilters) as [string, FilterValue][]) {
        result = result.filter(post => matchesFilter(post.frontmatter[field], filter));
      }
      
      // Sort logic (supports dynamic field-based sorting)
      result = [...result].sort((a, b) => {
          const dateA = new Date(a.frontmatter.pubDate || a.frontmatter.date || a.frontmatter.publishDate || 0).getTime();
          const dateB = new Date(b.frontmatter.pubDate || b.frontmatter.date || b.frontmatter.publishDate || 0).getTime();
          const titleA = (a.frontmatter.title || a.name).toLowerCase();
          const titleB = (b.frontmatter.title || b.name).toLowerCase();

          if (sortOption === 'date-desc') return dateB - dateA;
          if (sortOption === 'date-asc') return dateA - dateB;
          if (sortOption === 'title-asc') return titleA.localeCompare(titleB);
          if (sortOption === 'title-desc') return titleB.localeCompare(titleA);

          if (sortOption === 'status-asc' || sortOption === 'status-desc') {
            const getStatusRank = (p: PostData) => {
              if (p.deletion) return 1;
              if (p.publication && ['prepared', 'in_flight', 'unknown'].includes(p.publication.status)) return 2;
              if (p.draft && !p.sha) return 3;
              if (p.draft) return 4;
              return 5;
            };
            const diff = getStatusRank(a) - getStatusRank(b);
            return sortOption === 'status-asc' ? diff : -diff;
          }

          // WF-08: Dynamic field sorting
          const match = sortOption.match(/^(.+)-(asc|desc)$/);
          if (match) {
            const [, field, direction] = match;
            const valA = a.frontmatter[field];
            const valB = b.frontmatter[field];
            let cmp = 0;
            if (valA === undefined || valA === null) cmp = 1;
            else if (valB === undefined || valB === null) cmp = -1;
            else if (typeof valA === 'number' && typeof valB === 'number') cmp = valA - valB;
            else if (valA instanceof Date || (typeof valA === 'string' && !isNaN(Date.parse(String(valA))))) {
              cmp = new Date(valA).getTime() - new Date(valB).getTime();
            } else {
              cmp = String(valA).localeCompare(String(valB));
            }
            return direction === 'desc' ? -cmp : cmp;
          }
          return 0;
      });

      return result;
  }, [posts, searchQuery, sortOption, activeFilters]);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const currentPosts = filteredPosts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE);



  // Helper to resolve image URLs for display
  const resolveImageUrl = (thumbnailUrl: string | null): string | null | 'needs-domain' => {
    if (!thumbnailUrl) return null;
    if (thumbnailUrl.startsWith('http') || thumbnailUrl.startsWith('data:')) return thumbnailUrl;
    
    // BUG-11: Use central utility for consistent image source resolution
    const resolved = resolveImageSource(thumbnailUrl, repo, projectType, domainUrl);
    
    if (!resolved && thumbnailUrl.startsWith('/') && !domainUrl && projectType === 'astro') {
        return 'needs-domain';
    }
    
    return resolved || null;
  };

  const renderDynamicCell = (post: PostData, field: string) => {
      // Date handling
      if (field.toLowerCase().includes('date')) {
          let dateVal = post.frontmatter[field];
          if (!dateVal && field === 'date') {
               // Fallback common date fields
               dateVal = post.frontmatter.publishDate || post.frontmatter.pubDate;
          }
          if (dateVal) {
             const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
             if (!isNaN(d.getTime())) {
                 const dateOptions: Intl.DateTimeFormatOptions = language === 'vi' 
                    ? { year: 'numeric', month: '2-digit', day: '2-digit' } 
                    : { year: 'numeric', month: 'short', day: 'numeric' };
                 return <span className="text-notion-text text-xs whitespace-nowrap">{d.toLocaleDateString('zh-CN', dateOptions)}</span>;
             }
             return <span className="text-notion-text text-xs whitespace-normal break-words">{String(dateVal)}</span>;
          }
          return <span className="text-gray-300 text-xs">-</span>;
      }

      const val = post.frontmatter[field];
      if (val === undefined || val === null || val === '') return <span className="text-gray-300 text-xs">-</span>;
      
      // Array (Tags) handling - Changed to text with commas
      if (Array.isArray(val) && val.length > 0) {
        return (
            <span className="text-notion-text text-xs whitespace-normal break-words leading-snug">
                {val.join(', ')}
            </span>
        );
      }
      
      if (typeof val === 'object' && val !== null) {
        return <span className="text-[10px] text-notion-muted italic">[Object]</span>
      }

      return <span className="text-notion-text text-xs block whitespace-normal break-words leading-snug line-clamp-2" title={String(val)}>{String(val)}</span>;
  };

  const tableFields = useMemo(() => {
    return visibleFields.filter(f => f !== 'draft');
  }, [visibleFields]);

  const tableColumnWeights = useMemo(() => {
    const name = Math.max(columnWidths['__name__'] || 35, 50);
    const fields = tableFields.map(field => columnWidths[field] || (field === 'lang' ? 10 : 18));
    const status = 14;
    const actions = 12;
    const total = name + fields.reduce((sum, width) => sum + width, 0) + status + actions;
    const percentage = (weight: number) => `${(weight / total) * 100}%`;
    return {
      name: percentage(name),
      fields: fields.map(percentage),
      status: percentage(status),
      actions: percentage(actions),
    };
  }, [columnWidths, tableFields]);

  const resolvePostPublicUrl = useCallback((post: PostData): string | null => {
    if (post.deletion) return null;
    if (post.draft?.publicPath) return post.draft.publicPath;
    const isStories = post.path.startsWith('content/stories/') || path === 'content/stories';
    const collection = isStories ? 'stories' : 'blog';
    const isZh = post.frontmatter.lang === 'zh' || post.name.endsWith('-zh.mdx') || post.name.endsWith('-zh.md');
    const lang = isZh ? 'zh' : 'en';
    const entryId = post.name.replace(/\.mdx?$/, '');
    try {
      return resolveContentPublicPath(collection, lang, entryId);
    } catch {
      return null;
    }
  }, [path]);

  const getPostStatus = (post: PostData): {
    label: string;
    variant: 'published' | 'pending' | 'warning' | 'danger';
    tooltip?: string;
    pulse?: boolean;
  } => {
    if (post.deletion) {
      return {
        label: '删除待对账',
        variant: 'danger',
        tooltip: `删除操作 (${post.deletion.operationId}) 待 Git 提交对账`,
      };
    }

    if (post.publication && ['prepared', 'in_flight', 'unknown'].includes(post.publication.status)) {
      return {
        label: '发布待对账',
        variant: 'warning',
        tooltip: '发布结果待对账，点击行可继续对账',
        pulse: true,
      };
    }

    if (post.draft) {
      if (!post.sha) {
        return {
          label: '未发布草稿',
          variant: 'warning',
          tooltip: '仅保存在 D1 工作草稿，尚未发布',
        };
      }
      return {
        label: '已发布 · 有工作草稿',
        variant: 'pending',
        tooltip: '线上已发布当前版本，本地有修改中的工作草稿',
      };
    }

    return {
      label: '已发布',
      variant: 'published',
      tooltip: '当前版本已发布并在线公开',
    };
  };

  const renderPostStatusBadge = (post: PostData, className = '') => {
    const status = getPostStatus(post);

    const variantStyles = {
      published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      pending: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      danger: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    };

    const dotStyles = {
      published: 'bg-emerald-500',
      warning: 'bg-amber-500',
      pending: 'bg-blue-500',
      danger: 'bg-red-500',
    };

    return (
      <span
        title={status.tooltip}
        className={`inline-flex min-h-5 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap select-none ${
          status.pulse
            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 animate-pulse'
            : variantStyles[status.variant]
        } ${className}`}
      >
        <span
          className={`size-1.5 rounded-full shrink-0 ${dotStyles[status.variant]} ${
            status.pulse ? 'animate-ping' : ''
          }`}
        />
        <span>{status.label}</span>
      </span>
    );
  };

  if (selectedPost) {
      return (
          <ComponentEditingProvider key={selectedPost.path}>
          {selectedPost.imported && <p role="status" className="p-3 text-sm text-notion-muted">已导入本地文件；请在编辑页确认文章语言和保存地址标识。保存草稿后可从列表重新打开。</p>}
          <PostDetailView
            post={selectedPost} 
            onBack={() => { setSelectedPost(null); void fetchPosts(); }}
            onDelete={(p) => setPostToDelete(p)}
            gitService={gitService}
            repo={repo}
            projectType={projectType}
            domainUrl={domainUrl}
            onUpdate={fetchPosts}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onAction={onAction}
          /></ComponentEditingProvider>
      );
  }

  return (
    <div className="space-y-4">
      <input type="file" ref={uploadPostInputRef} className="hidden" accept={postFileTypes} onChange={handleFileUpload} />
      <input type="file" ref={updatePostFileInputRef} className="hidden" accept={postFileTypes} onChange={confirmUpdatePostFile} />
      
      {isUploadModalOpen && uploadFile && (
          <PostUploadValidationModal localPreview collection={path === 'content/stories' ? 'stories' : 'blog'} busy={isUploading}
            file={uploadFile}
            gitService={gitService}
            repo={repo}
            onConfirm={confirmUpload}
            onCancel={() => { setIsUploadModalOpen(false); setUploadFile(null); }}
          />
      )}

      {isImageModalOpen && (
          <PostImageSelectionModal
            gitService={gitService}
            imagesPath={imagesPath}
            imageFileTypes={imageFileTypes}
            onClose={() => setIsImageModalOpen(false)}
            onConfirm={handleImageConfirm}
          />
      )}

      <ConfirmationModal 
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={confirmDelete}
        title={postToDelete?.draft ? '放弃工作草稿' : postToDelete?.deletion ? '核对删除结果' : '删除已发布文章'}
        description={`${postToDelete?.draft
          ? postToDelete.sha
            ? '只关闭 D1 工作草稿，仓库和线上文章继续保留。若要删除文章，请放弃草稿后再执行删除。'
            : '关闭 D1 工作草稿；尚未发布的文章会从列表消失。'
          : postToDelete?.deletion
            ? `沿用操作 ${postToDelete.deletion.operationId} 查询 Git 提交；不会再次删除文件。`
            : '将按当前 Git 文件版本删除文章；提交后等待部署，线上 URL 才会消失。图片不会自动删除。'}${deleteError ? ` ${deleteError}` : ''}`}
        confirmLabel={postToDelete?.draft ? '放弃草稿' : postToDelete?.deletion ? '查询结果' : '确认删除文章'}
        isProcessing={isDeleting}
      />

      {/* Toolbar */}
      {deleteNotice && <p role="status" className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-notion-text">{deleteNotice}</p>}
      <div className="relative z-10 mb-4 flex flex-col gap-2.5">
        <div className="relative w-full">
            <input
            type="text"
            placeholder={t('postList.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
            }}
            className="h-8 w-full rounded-lg border border-notion-border bg-notion-bg pl-8 pr-7 text-xs text-notion-text shadow-2xs transition-all placeholder-notion-muted/70 focus:border-notion-blue focus:outline-none focus:ring-2 focus:ring-notion-blue/20"
            />
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <SearchIcon className="h-3.5 w-3.5 text-notion-muted" />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-notion-muted hover:text-notion-text transition-colors cursor-pointer"
                title="清空搜索"
              >
                <X className="size-3.5" />
              </button>
            )}
        </div>
        
        <div className="flex w-full items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
            {/* Left action group: Sort + View Mode (+ Filter if active) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <SortDropdown
                value={sortOption}
                onChange={(val) => setSortOption(val)}
                options={dynamicSortOptions}
              />

              {activeTemplate && (
                <LiquidGlassButton
                  type="button"
                  size="sm"
                  shape="rounded"
                  variant={isFilterOpen || Object.keys(activeFilters).length > 0 ? 'blue' : 'default'}
                  glow={isFilterOpen || Object.keys(activeFilters).length > 0}
                  icon={<Filter className="size-3.5" />}
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  className="font-medium h-8"
                  title={isFilterOpen ? '收起筛选面板' : '展开筛选面板'}
                >
                  <span className="hidden sm:inline">筛选</span>
                  {Object.keys(activeFilters).length > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold bg-blue-500 text-white dark:bg-blue-400 dark:text-blue-950 shadow-2xs">
                      {Object.keys(activeFilters).length}
                    </span>
                  )}
                </LiquidGlassButton>
              )}

              <div className="flex h-8 items-center rounded-lg border border-notion-border bg-notion-sidebar p-0.5 shadow-2xs">
                  <button 
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`p-1 rounded-md transition-all ${viewMode === 'table' ? 'bg-notion-bg shadow-xs text-notion-text' : 'text-notion-muted hover:text-notion-text'}`}
                      title={t('postList.viewMode.table')}
                  >
                      <ViewListIcon className="w-3.5 h-3.5" />
                  </button>
                  <button 
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-1 rounded-md transition-all ${viewMode === 'grid' ? 'bg-notion-bg shadow-xs text-notion-text' : 'text-notion-muted hover:text-notion-text'}`}
                      title={t('postList.viewMode.grid')}
                  >
                      <ViewGridIcon className="w-3.5 h-3.5" />
                  </button>
              </div>
            </div>

            {/* Right action group: Import + Create new */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <LiquidGlassButton
                  type="button"
                  size="sm"
                  shape="rounded"
                  variant="blue"
                  onClick={() => uploadPostInputRef.current?.click()}
                  icon={<Upload className="size-3.5" />}
                  className="font-medium h-8"
                  title="导入本地 MD/MDX 文件，可保存到 D1 草稿；不会提交仓库"
              >
                  <span className="hidden sm:inline">导入文件</span>
                  <span className="sm:hidden">导入</span>
              </LiquidGlassButton>

              {/* @para-doc [#csa-post-creation-trigger] */}
              <LiquidGlassButton
                  type="button"
                  size="sm"
                  shape="rounded"
                  variant="default"
                  onClick={() => setNewPostOpen(value => !value)}
                  icon={<Plus className="size-3.5" />}
                  className="font-medium h-8"
                  title="新建工作草稿"
              >
                  <span className="hidden sm:inline">{t('postList.createButton')}</span>
                  <span className="sm:hidden">新建</span>
              </LiquidGlassButton>
            </div>
        </div>
      </div>

      {newPostOpen && (
        <form
          className="mb-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 rounded-xl border border-notion-border bg-notion-sidebar/40 p-3 sm:p-3.5 text-xs shadow-2xs transition-all animate-in fade-in-0 duration-150"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreateNewPost();
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-notion-text font-medium">
              <span className="text-notion-muted text-xs">语言</span>
              <div className="inline-flex rounded-lg border border-notion-border bg-notion-bg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setNewLang('zh')}
                  className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    newLang === 'zh'
                      ? 'bg-notion-sidebar text-notion-text font-semibold shadow-xs'
                      : 'text-notion-muted hover:text-notion-text'
                  }`}
                >
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => setNewLang('en')}
                  className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    newLang === 'en'
                      ? 'bg-notion-sidebar text-notion-text font-semibold shadow-xs'
                      : 'text-notion-muted hover:text-notion-text'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {path !== 'content/stories' && (
              <div className="flex items-center gap-1.5 text-notion-text font-medium">
                <span className="text-notion-muted text-xs">格式</span>
                <div className="inline-flex rounded-lg border border-notion-border bg-notion-bg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setNewFormat('mdx')}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      newFormat === 'mdx'
                        ? 'bg-notion-sidebar text-notion-text font-semibold shadow-xs'
                        : 'text-notion-muted hover:text-notion-text'
                    }`}
                  >
                    MDX
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewFormat('md')}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      newFormat === 'md'
                        ? 'bg-notion-sidebar text-notion-text font-semibold shadow-xs'
                        : 'text-notion-muted hover:text-notion-text'
                    }`}
                  >
                    Markdown
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="flex flex-1 min-w-[160px] items-center gap-2 text-notion-text font-medium">
            <span className="text-notion-muted whitespace-nowrap">标识</span>
            <input
              className="flex-1 rounded-lg border border-notion-border bg-notion-bg px-2.5 py-1 text-xs text-notion-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-notion-blue/20 font-mono"
              value={newSlug}
              onChange={(event) => setNewSlug(event.target.value)}
              placeholder="my-article"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>

          <div className="flex items-center gap-2 pt-0.5 sm:pt-0">
            <button
              type="submit"
              className="rounded-lg bg-notion-blue hover:opacity-90 px-3.5 py-1 text-xs font-semibold text-white shadow-2xs transition-all cursor-pointer"
            >
              进入编辑
            </button>
            <button
              type="button"
              onClick={() => setNewPostOpen(false)}
              className="rounded-lg border border-notion-border bg-notion-bg px-3 py-1 text-xs text-notion-muted hover:text-notion-text shadow-2xs transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
          <span className="text-notion-muted basis-full text-[11px] truncate">
            候选地址：/{newLang === 'zh' ? 'zh/' : ''}{path === 'content/stories' ? 'stories' : 'blog'}/{newSlug || '…'}；保存后才写入 D1。
          </span>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 text-xs text-notion-muted">
        <span>列表读取当前数据源；新建或发布文章后可刷新列表。</span>
        <button type="button" disabled={isLoading} onClick={() => fetchPosts()} className="inline-flex h-7 items-center rounded-md px-2 font-medium text-notion-muted transition-colors hover:bg-notion-hover hover:text-notion-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">刷新文件列表</button>
      </div>
      {/* WF-08: FilterBar */}
      {isFilterOpen && activeTemplate && (
        <FilterBar
          template={activeTemplate}
          posts={posts}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      )}

      {isLoading || openingPost ? (
          <div className="flex justify-center items-center h-64">
              <SpinnerIcon className="w-8 h-8 animate-spin text-notion-muted" />
              <span className="ml-3 text-notion-muted">{t('postList.loading')}</span>
          </div>
      ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs">
              {error}
          </div>
      ) : currentPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-notion-border rounded-xl bg-notion-sidebar/20">
              <DocumentIcon className="w-10 h-10 text-notion-muted mb-2 opacity-50" />
              <p className="text-notion-muted text-xs">{t('postList.noPosts')}</p>
          </div>
      ) : (
          <div>
              {/* Grid or Table View */}
              {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {currentPosts.map(post => (
                          <div 
                            key={post.path}
                            onClick={() => post.deletion ? setPostToDelete(post) : void openPost(post)}
                            className="bg-notion-sidebar/40 border border-notion-border rounded-xl hover:border-notion-blue/40 hover:shadow-xs transition-all cursor-pointer overflow-hidden flex flex-col h-full group"
                          >
                              <div className="h-32 bg-notion-sidebar overflow-hidden relative border-b border-notion-border">
                                {projectType === 'github' && repo.private && post.thumbnailUrl ? (
                                    <ThumbnailWithAuth gitService={gitService} imagePath={post.thumbnailUrl} className="w-full h-full object-cover" />
                                ) : (() => {
                                    const resolvedUrl = resolveImageUrl(post.thumbnailUrl);
                                    if (resolvedUrl && resolvedUrl !== 'needs-domain') {
                                        return <img src={resolvedUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => e.currentTarget.style.display = 'none'} />;
                                    } else {
                                        return (
                                            <div className="flex items-center justify-center w-full h-full text-notion-muted">
                                                <DocumentIcon className="w-8 h-8 opacity-40" />
                                            </div>
                                        );
                                    }
                                })()}
                              </div>
                              <div className="p-4 flex-grow">
                                  <h3 className="text-xs font-semibold text-notion-text mb-1 line-clamp-2 group-hover:text-notion-blue transition-colors flex items-center gap-1.5 flex-wrap">
                                      <span>{post.frontmatter.title || post.name}</span>
                                      {renderPostStatusBadge(post)}
                                  </h3>
                                  <div className="text-[11px] text-notion-muted line-clamp-3 leading-relaxed">
                                      {post.frontmatter.description || post.frontmatter.excerpt || (post.body ? post.body.substring(0, 100) : '')}
                                  </div>
                              </div>
                              <div className="px-4 py-2 border-t border-notion-border text-[10px] text-notion-muted flex justify-between items-center bg-notion-sidebar/50">
                                  <span>{post.frontmatter.date ? new Date(post.frontmatter.date).toLocaleDateString() : 'No Date'}</span>
                                  <span>{post.frontmatter.author}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <>
                    <div className="space-y-3 lg:hidden">
                      {currentPosts.map(post => {
                        const publicUrl = resolvePostPublicUrl(post);
                        const title = post.frontmatter.title || post.name;
                        const open = () => post.deletion ? setPostToDelete(post) : void openPost(post);
                        return (
                          <article key={post.path} className="rounded-xl border border-notion-border bg-notion-bg p-3.5 shadow-2xs">
                            <button type="button" onClick={open} className="flex w-full min-w-0 items-center gap-3 text-left">
                              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-notion-border bg-notion-sidebar">
                                {projectType === 'github' && repo.private && post.thumbnailUrl ? (
                                  <ThumbnailWithAuth gitService={gitService} imagePath={post.thumbnailUrl} className="size-full object-cover" />
                                ) : (() => {
                                  const url = resolveImageUrl(post.thumbnailUrl);
                                  return url && url !== 'needs-domain'
                                    ? <img src={url} alt="" className="size-full object-cover" />
                                    : <DocumentIcon className="size-4 text-notion-muted" />;
                                })()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block line-clamp-2 text-sm font-medium leading-5 text-notion-text">{title}</span>
                                <span className="mt-1 block text-[11px] text-notion-muted">
                                  {post.frontmatter.lang === 'en' ? 'English' : '中文'} · {post.frontmatter.pubDate ? renderDynamicCell(post, 'pubDate') : '未设置发布日期'}
                                </span>
                              </span>
                            </button>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-notion-border pt-3">
                              {renderPostStatusBadge(post)}
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={open} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-notion-text hover:bg-notion-hover" aria-label={`${post.deletion ? '核对删除' : '编辑'} ${title}`}>
                                  <EditIcon className="size-4" />{post.deletion ? '核对' : '编辑'}
                                </button>
                                {publicUrl && post.sha && (
                                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex size-9 items-center justify-center rounded-lg text-notion-muted hover:bg-notion-hover hover:text-notion-blue" aria-label={`查看线上文章 ${title}`}>
                                    <EyeIcon className="size-4" />
                                  </a>
                                )}
                                <button type="button" onClick={() => setPostToDelete(post)} className="inline-flex size-9 items-center justify-center rounded-lg text-notion-muted hover:bg-red-500/10 hover:text-red-500" aria-label={`${post.draft ? '放弃草稿' : post.deletion ? '核对删除' : '删除文章'} ${title}`}>
                                  <TrashIcon className="size-4" />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  <div className="hidden rounded-xl border border-notion-border bg-notion-bg shadow-2xs lg:block lg:overflow-x-auto">
                      <table className="w-full min-w-[1200px] divide-y divide-notion-border text-sm table-fixed">
                          <colgroup>
                              <col style={{ width: tableColumnWeights.name }} />
                              {tableFields.map((field, index) => (
                                  <col key={field} style={{ width: tableColumnWeights.fields[index] }} />
                              ))}
                              <col style={{ width: tableColumnWeights.status }} />
                              <col style={{ width: tableColumnWeights.actions }} />
                          </colgroup>
                          <thead className="bg-notion-sidebar/60 text-notion-muted font-medium">
                              <tr>
                                  <th
                                    className="px-4 py-2.5 text-left text-xs font-medium border-r border-notion-border select-none truncate cursor-pointer hover:bg-notion-hover transition-colors"
                                    onClick={() => handleColumnSort('title')}
                                  >
                                    <span className="inline-flex items-center gap-1 align-middle">
                                      文章
                                      {getSortIndicator('title') && <span className="text-notion-blue text-[10px]">{getSortIndicator('title')}</span>}
                                    </span>
                                  </th>
                                  {tableFields.map(field => (
                                      <th
                                        key={field}
                                        className="px-4 py-2.5 text-left text-xs font-medium border-r border-notion-border select-none truncate cursor-pointer hover:bg-notion-hover transition-colors"
                                        onClick={() => handleColumnSort(field)}
                                      >
                                        <span className="inline-flex items-center gap-1 align-middle">
                                          {fieldLabel(field)}
                                          {getSortIndicator(field) && <span className="text-notion-blue text-[10px]">{getSortIndicator(field)}</span>}
                                        </span>
                                      </th>
                                  ))}
                                  <th
                                    className="px-4 py-2.5 text-left text-xs font-medium border-r border-notion-border select-none truncate cursor-pointer hover:bg-notion-hover transition-colors"
                                    onClick={() => handleColumnSort('status')}
                                  >
                                    <span className="inline-flex items-center gap-1 align-middle">
                                      状态
                                      {getSortIndicator('status') && <span className="text-notion-blue text-[10px]">{getSortIndicator('status')}</span>}
                                    </span>
                                  </th>
                                  <th className="px-4 py-2.5 text-right text-xs font-medium select-none truncate">
                                    操作
                                  </th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-notion-border">
                              {currentPosts.map(post => {
                                  const publicUrl = resolvePostPublicUrl(post);
                                  return (
                                  <tr key={post.path} onClick={() => post.deletion ? setPostToDelete(post) : void openPost(post)} className="hover:bg-notion-hover/50 cursor-pointer group transition-colors">
                                      <td className="px-4 py-2.5 border-r border-notion-border align-middle overflow-hidden">
                                          <div className="flex min-w-0 items-center gap-3">
                                              {/* Mini Thumbnail */}
                                              <div className="flex size-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-notion-border bg-notion-sidebar">
                                                  {projectType === 'github' && repo.private && post.thumbnailUrl ? (
                                                      <ThumbnailWithAuth gitService={gitService} imagePath={post.thumbnailUrl} className="w-full h-full object-cover" />
                                                  ) : (() => {
                                                      const resolvedUrl = resolveImageUrl(post.thumbnailUrl);
                                                      return resolvedUrl && resolvedUrl !== 'needs-domain' ? (
                                                          <img src={resolvedUrl} alt="" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                      ) : (
                                                          <div className="flex items-center justify-center w-full h-full text-notion-muted">
                                                              <DocumentIcon className="w-4 h-4" />
                                                          </div>
                                                      );
                                                  })()}
                                              </div>
                                              
                                              <div className="flex min-w-0 flex-1 items-center">
                                                  <span className="block truncate font-medium leading-5 text-notion-text" title={post.frontmatter.title || post.name}>
                                                      {post.frontmatter.title || post.name}
                                                  </span>
                                              </div>
                                          </div>
                                      </td>
                                      
                                      {tableFields.map(field => (
                                          <td key={field} className="px-4 py-2.5 border-r border-notion-border align-middle overflow-hidden">
                                              {renderDynamicCell(post, field)}
                                          </td>
                                      ))}

                                      <td className="px-4 py-2.5 border-r border-notion-border align-middle whitespace-nowrap overflow-hidden">
                                          {renderPostStatusBadge(post)}
                                      </td>

                                      <td className="px-4 py-2.5 text-right align-middle whitespace-nowrap">
                                          <div className="flex items-center justify-end gap-1">
                                              <button
                                                  type="button"
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (post.deletion) setPostToDelete(post);
                                                      else void openPost(post);
                                                  }}
                                                  className="inline-flex size-8 items-center justify-center rounded-lg text-notion-muted transition-colors hover:bg-notion-hover hover:text-notion-text cursor-pointer"
                                                  aria-label={post.deletion ? '核对删除结果' : '编辑文章'}
                                                  title={post.deletion ? '核对删除结果' : '编辑文章'}
                                              >
                                                  <EditIcon className="w-3.5 h-3.5" />
                                              </button>
                                              {publicUrl && post.sha ? (
                                                  <a
                                                      href={publicUrl}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="inline-flex size-8 items-center justify-center rounded-lg text-notion-muted transition-colors hover:bg-notion-hover hover:text-notion-blue"
                                                      aria-label="在新标签页打开线上文章"
                                                      title="在新标签页打开线上文章"
                                                  >
                                                      <EyeIcon className="w-3.5 h-3.5" />
                                                  </a>
                                              ) : (
                                                  <button
                                                      type="button"
                                                      disabled
                                                      className="inline-flex size-8 items-center justify-center rounded-lg text-notion-muted/30 cursor-not-allowed"
                                                      aria-label="未发布到线上"
                                                      title="未发布到线上"
                                                  >
                                                      <EyeIcon className="w-3.5 h-3.5" />
                                                  </button>
                                              )}
                                              <button 
                                                  type="button"
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      setPostToDelete(post);
                                                  }}
                                                  className="inline-flex size-8 items-center justify-center rounded-lg text-notion-muted transition-colors hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                                                  aria-label={post.draft ? '放弃工作草稿' : post.deletion ? '核对删除结果' : '删除已发布文章'}
                                                  title={post.draft ? '放弃工作草稿' : post.deletion ? '核对删除结果' : '删除已发布文章'}
                                              >
                                                  <TrashIcon className="w-3.5 h-3.5" />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
                  </>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                  <div className="mt-4 flex justify-center items-center gap-2">
                      <button 
                        disabled={currentPage === 1} 
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-3 py-1 bg-notion-sidebar/60 border border-notion-border rounded-lg text-xs text-notion-text disabled:opacity-40 hover:bg-notion-hover transition-colors shadow-2xs cursor-pointer"
                      >
                          {t('postList.pagination.prev')}
                      </button>
                      <span className="text-xs flex items-center text-notion-muted font-mono">
                          {t('postList.pagination.pageInfo', { current: currentPage, total: totalPages })}
                      </span>
                      <button 
                        disabled={currentPage === totalPages} 
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-3 py-1 bg-notion-sidebar/60 border border-notion-border rounded-lg text-xs text-notion-text disabled:opacity-40 hover:bg-notion-hover transition-colors shadow-2xs cursor-pointer"
                      >
                          {t('postList.pagination.next')}
                      </button>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default PostList;
