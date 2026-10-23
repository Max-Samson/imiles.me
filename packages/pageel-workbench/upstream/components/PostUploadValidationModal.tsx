import { inspectImportedContent } from '../../integration/import-content';

import React, { useState, useEffect } from 'react';
import { GithubRepo, IGitService } from '../types';
import { parseMarkdown, extractImageUrls } from '../utils/parsing';
import { useI18n } from '../i18n/I18nContext';
import { useCollectionStore } from '../features/collections/store';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { CloseIcon } from './icons/CloseIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ImageIcon } from './icons/ImageIcon';

interface PostUploadValidationModalProps {
  file: File;
  localPreview?: boolean;
  collection?: 'blog' | 'stories';
  busy?: boolean;
  gitService: IGitService;
  repo: GithubRepo;
  onConfirm: () => void;
  onCancel: () => void;
}

type ValidationStatus = 'pending' | 'loading' | 'success' | 'warning' | 'error';

interface CheckItem {
  id: string;
  label: string;
  status: ValidationStatus;
  message?: string;
}

const PostUploadValidationModal: React.FC<PostUploadValidationModalProps> = ({ file, gitService, repo, onConfirm, onCancel, localPreview = false, collection = 'blog', busy = false }) => {
  const { t } = useI18n();
  const [content, setContent] = useState<string>('');
  
  // Checks State
  const [fmStatus, setFmStatus] = useState<CheckItem>({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'pending' });
  const [imageChecks, setImageChecks] = useState<CheckItem[]>([]);
  const [isCheckingImages, setIsCheckingImages] = useState(false);
  const [overallStatus, setOverallStatus] = useState<ValidationStatus>('loading');

  useEffect(() => {
    const readFile = () => {
      if (file.size > 1024 * 1024) { setFmStatus({ id: 'frontmatter', label: '文件大小', status: 'error', message: '文章不能超过 1 MiB' }); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setContent(text);
        validateContent(text);
      };
      reader.onerror = () => {
        setFmStatus(prev => ({ ...prev, status: 'error', message: t('uploadValidation.error.fileRead') }));
        setOverallStatus('error');
      };
      reader.readAsText(file);
    };
    readFile();
  }, [file]);

  const validateContent = async (markdown: string) => {
    if (localPreview) {
      try {
        const inspected = inspectImportedContent(file.name, markdown, collection);
        setFmStatus({ id: 'frontmatter', label: '文章属性', status: inspected.warnings.length ? 'warning' : 'success', message: inspected.warnings.length ? `可以导入，发布前需补充：${inspected.warnings.join('；')}` : '可以打开，导入后仍可编辑文章属性；不会自动保存或发布。' });
        setImageChecks(extractImageUrls(markdown).map(url => ({ id: url, label: url, status: 'warning', message: '保留原图片引用；导入不上传图片，请确认项目资源已存在。' })));
      } catch (error) {
        setFmStatus({ id: 'frontmatter', label: '文章校验', status: 'error', message: error instanceof Error ? error.message : '文件校验失败' });
      }
      return;
    }
    // 1. Validate Frontmatter
    try {
      const { frontmatter } = parseMarkdown(markdown);
      
      // Get template from collection store (single source of truth)
      const { getActiveCollection } = useCollectionStore.getState();
      const activeCollection = getActiveCollection();
      let template: Record<string, string> | null = null;
      
      if (activeCollection?.template) {
          // Convert CollectionTemplate to Record<string, string>
          template = {};
          activeCollection.template.fields.forEach(field => {
              template![field.name] = field.type;
          });
      }

      if (Object.keys(frontmatter).length === 0) {
           setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'error', message: t('uploadValidation.frontmatter.notFound') });
      } else if (template) {
           const missingFields = [];
           for (const key of Object.keys(template)) {
               if (frontmatter[key] === undefined) missingFields.push(key);
           }
           if (missingFields.length > 0) {
               setFmStatus({ 
                   id: 'frontmatter', 
                   label: t('uploadValidation.frontmatter.label'), 
                   status: 'warning', 
                   message: t('uploadValidation.frontmatter.missingFields', { fields: missingFields.join(', ') }) 
                });
           } else {
               setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'success', message: t('uploadValidation.frontmatter.valid') });
           }
      } else {
           setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'success', message: t('uploadValidation.frontmatter.validBasic') });
      }

    } catch (e) {
      setFmStatus({ id: 'frontmatter', label: t('uploadValidation.frontmatter.label'), status: 'error', message: t('uploadValidation.frontmatter.parseError') });
    }

    // 2. Validate Images
    setIsCheckingImages(true);
    const urls = extractImageUrls(markdown);
    
    if (urls.length === 0) {
        setImageChecks([]);
        setIsCheckingImages(false);
        setOverallStatus('success'); 
        return;
    }

    const checks: CheckItem[] = await Promise.all(urls.map(async (url) => {
        const item: CheckItem = { id: url, label: url, status: 'loading' };
        
        if (url.startsWith('http')) {
            const checkExternalImage = async (imgUrl: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                    img.src = imgUrl;
                });
            };

            try {
                const res = await fetch(url, { method: 'HEAD' });
                if (res.ok) {
                    item.status = 'success';
                    item.message = t('uploadValidation.images.externalValid');
                    return item;
                }
            } catch (e) { }

            const isAccessible = await checkExternalImage(url);
            
            if (isAccessible) {
                item.status = 'success';
                item.message = t('uploadValidation.images.externalValid');
            } else {
                item.status = 'error';
                item.message = t('uploadValidation.images.externalError');
            }
            return item;
        }

        let pathToCheck = url.startsWith('/') ? url.substring(1) : url;
        let found = false;

        if (await checkFileExists(pathToCheck)) found = true;
        if (!found && !pathToCheck.startsWith('public/')) {
            if (await checkFileExists(`public/${pathToCheck}`)) found = true;
        }
        
        if (found) {
            item.status = 'success';
            item.message = t('uploadValidation.images.foundRepo');
        } else {
            item.status = 'error';
            item.message = t('uploadValidation.images.notFoundRepo');
        }
        
        return item;
    }));

    setImageChecks(checks);
    setIsCheckingImages(false);
  };

  const checkFileExists = async (path: string): Promise<boolean> => {
      try {
          const sha = await gitService.getFileSha(path);
          return !!sha;
      } catch {
          return false;
      }
  }

  useEffect(() => {
     if (fmStatus.status === 'pending' || fmStatus.status === 'loading') { setOverallStatus('loading'); return; }
     if (fmStatus.status === 'error') {
         setOverallStatus('error');
         return;
     }
     
     if (isCheckingImages) {
         setOverallStatus('loading');
         return;
     }
     
     const hasImageError = imageChecks.some(c => c.status === 'error');
     if (hasImageError) {
         setOverallStatus('error');
         return;
     }

     if (fmStatus.status === 'warning' || imageChecks.some(c => c.status === 'warning')) {
         setOverallStatus('warning');
         return;
     }

     setOverallStatus('success');
  }, [fmStatus, imageChecks, isCheckingImages]);


  const renderStatusIcon = (status: ValidationStatus) => {
      switch(status) {
          case 'loading': return <SpinnerIcon className="w-4 h-4 animate-spin text-notion-blue shrink-0" />;
          case 'success': return <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
          case 'warning': return <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />;
          case 'error': return <CloseIcon className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />;
          default: return <div className="w-4 h-4 shrink-0" />;
      }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="bg-notion-bg text-notion-text rounded-2xl shadow-2xl border border-notion-border w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh] transition-all">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-notion-border flex justify-between items-start bg-notion-sidebar/40 shrink-0">
            <div>
                <h3 className="text-base font-semibold text-notion-text leading-snug">{localPreview ? '导入文章到编辑台' : t('uploadValidation.title')}</h3>
                <p className="text-xs text-notion-muted mt-1 leading-relaxed">{localPreview ? `打开“${file.name}”，导入后可编辑正文与文章属性` : t('uploadValidation.subtitle', { name: file.name })}</p>
            </div>
            <button
                type="button"
                onClick={onCancel}
                className="text-notion-muted hover:text-notion-text p-1.5 hover:bg-notion-hover rounded-lg transition-colors cursor-pointer shrink-0 ml-3"
                aria-label="关闭弹窗"
            >
                <CloseIcon className="w-4 h-4" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* Frontmatter Check */}
            <div>
                <div className="flex items-center gap-2 mb-2.5">
                    <DocumentIcon className="w-4 h-4 text-notion-muted shrink-0" />
                    <span className="text-xs font-semibold text-notion-muted">{localPreview ? '文章属性检查' : t('uploadValidation.frontmatter.section')}</span>
                </div>
                <div className="bg-notion-sidebar/40 border border-notion-border rounded-xl p-3.5 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">{renderStatusIcon(fmStatus.status)}</div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-notion-text">{fmStatus.label}</p>
                            {fmStatus.message && <p className="text-xs text-notion-muted mt-1 leading-relaxed">{fmStatus.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Images Check */}
            <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-notion-muted shrink-0" />
                        <span className="text-xs font-semibold text-notion-muted">{localPreview ? '图片引用' : t('uploadValidation.images.section')}</span>
                    </div>
                    {isCheckingImages && (
                        <span className="text-xs text-notion-blue flex items-center gap-1.5 shrink-0">
                            <SpinnerIcon className="w-3.5 h-3.5 animate-spin"/> {t('uploadValidation.images.scanning')}
                        </span>
                    )}
                </div>
                
                {imageChecks.length === 0 && !isCheckingImages ? (
                    <div className="p-3.5 bg-notion-sidebar/30 border border-dashed border-notion-border rounded-xl text-xs text-notion-muted">
                        {localPreview ? '正文没有图片引用。' : t('uploadValidation.images.noImages')}
                    </div>
                ) : (
                    <div className="border border-notion-border rounded-xl divide-y divide-notion-border bg-notion-bg overflow-hidden shadow-2xs">
                        {imageChecks.map((check) => (
                            <div key={check.id} className="p-3 flex items-start gap-3 hover:bg-notion-hover/40 transition-colors">
                                <div className="mt-0.5 shrink-0">{renderStatusIcon(check.status)}</div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-mono text-notion-text truncate font-medium" title={check.label}>{check.label}</p>
                                    <p className="text-xs text-notion-muted mt-0.5 leading-relaxed">{check.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-notion-border bg-notion-sidebar/50 flex justify-between items-center gap-4 shrink-0">
            <div className="text-xs min-w-0 flex-1">
                {overallStatus === 'error' && (
                    <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                        <CloseIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{localPreview ? '文件格式或语法有误，请修复后导入。' : t('uploadValidation.summary.error')}</span>
                    </span>
                )}
                {overallStatus === 'warning' && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{localPreview ? '可以导入，待补充项不会阻止打开。' : t('uploadValidation.summary.warning')}</span>
                    </span>
                )}
                {overallStatus === 'success' && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{localPreview ? '可以导入，尚未保存到仓库。' : t('uploadValidation.summary.success')}</span>
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
                <button 
                    type="button"
                    onClick={onCancel} 
                    className="px-3.5 py-1.5 bg-notion-sidebar/60 border border-notion-border rounded-lg text-notion-text text-xs font-medium hover:bg-notion-hover transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                >
                    {localPreview ? '取消' : t('uploadValidation.cancel')}
                </button>
                <button 
                    type="button"
                    onClick={onConfirm}
                    disabled={busy || overallStatus === 'loading' || overallStatus === 'error'}
                    className={`px-4 py-1.5 rounded-lg text-white text-xs font-medium shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${
                        overallStatus === 'loading' ? 'bg-notion-muted/50' :
                        overallStatus === 'error' ? 'bg-rose-500/50' :
                        overallStatus === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                        'bg-notion-blue hover:opacity-90'
                    }`}
                >
                    {busy && <SpinnerIcon className="w-3.5 h-3.5 animate-spin shrink-0" />}
                    <span>
                        {localPreview ? (busy ? '正在打开…' : '打开文件') : overallStatus === 'warning' ? t('uploadValidation.confirmWarning') : t('uploadValidation.confirm')}
                    </span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PostUploadValidationModal;
