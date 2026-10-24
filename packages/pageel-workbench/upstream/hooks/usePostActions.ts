import { inspectImportedContent } from '../../integration/import-content';
/**
 * usePostActions Hook
 * 
 * TD-10: Extracted from PostList.tsx.
 * Handles all post CRUD actions:
 * - Upload new post file
 * - Update post file content
 * - Update post image (via frontmatter)
 * - Delete post
 */

import React, { useState, useRef, useEffect } from 'react';
import type { IGitService } from '../types';
import { updateFrontmatter } from '../utils/parsing';
import type { CmsDeletionResult, CmsDraftSummary, CmsPublicationResult } from '../../../../src/lib/admin/cms-document-client';
import { cmsDocumentClient } from '../../../../src/lib/admin/cms-document-client';

export interface PostData {
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
  deletion?: CmsDeletionResult | null;
  newTarget?: { collection: 'blog' | 'stories'; lang: 'en' | 'zh'; slug: string; format: 'md' | 'mdx' };
}

interface UsePostActionsParams {
  gitService: IGitService;
  path: string;
  imagesPath: string;
  updatePostCommitTemplate: string;
  onAction: () => void;
  fetchPosts: () => void;
  onImport?: (post: PostData) => void;
  selectedPost: PostData | null;
  setSelectedPost: (post: PostData | null) => void;
}

interface UsePostActionsReturn {
  // Upload
  uploadPostInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  confirmUpload: () => Promise<void>;
  uploadFile: File | null;
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (v: boolean) => void;
  setUploadFile: (f: File | null) => void;
  isUploading: boolean;

  // Update post file
  updatePostFileInputRef: React.RefObject<HTMLInputElement>;
  handleUpdatePostFile: (post: PostData) => void;
  confirmUpdatePostFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;

  // Update post image
  handleUpdateImage: (post: PostData) => void;
  handleImageConfirm: (result: { type: 'new' | 'existing'; file?: File; path?: string }) => Promise<void>;
  isImageModalOpen: boolean;
  setIsImageModalOpen: (v: boolean) => void;
  postToUpdateImage: PostData | null;

  // Delete
  postToDelete: PostData | null;
  setPostToDelete: (post: PostData | null) => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  deleteError: string;
  deleteNotice: string;
}

export function usePostActions({
  gitService,
  path,
  imagesPath,
  updatePostCommitTemplate,
  onAction,
  fetchPosts,
  onImport,
  selectedPost,
  setSelectedPost,
}: UsePostActionsParams): UsePostActionsReturn {
  // Upload state
  const uploadPostInputRef = useRef<HTMLInputElement>(null!);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Update post file state
  const updatePostFileInputRef = useRef<HTMLInputElement>(null!);
  const [postToUpdateFile, setPostToUpdateFile] = useState<PostData | null>(null);

  // Update post image state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [postToUpdateImage, setPostToUpdateImage] = useState<PostData | null>(null);

  // Delete state
  const [postToDelete, setPostToDelete] = useState<PostData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');
  useEffect(() => setDeleteError(''), [postToDelete]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setIsUploadModalOpen(true);
      e.target.value = '';
    }
  };

  const confirmUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      if (uploadFile.size > 1024 * 1024) throw new Error('文章文件不能超过 1 MiB');
      // 等待读取完成后再更新 loading；异步读取/校验错误统一落入下方 catch。
      const content = await uploadFile.text();
      const parsed = inspectImportedContent(uploadFile.name, content, path === 'content/stories' ? 'stories' : 'blog');
      const filePath = `${path}/${uploadFile.name}`;
      // 宿主提供 onImport 时只打开本地编辑态；不能顺便调用 Git 创建或覆盖文件。
      if (onImport) {
        onImport({ ...parsed, name: uploadFile.name, path: filePath, sha: '', html_url: '', thumbnailUrl: null, imported: true });
      } else {
        await gitService.createFileFromString(filePath, content, `feat(content): add post "${uploadFile.name}"`);
        onAction();
        fetchPosts();
      }
      setIsUploadModalOpen(false);
      setUploadFile(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : '导入失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdatePostFile = (post: PostData) => {
    setPostToUpdateFile(post);
    updatePostFileInputRef.current?.click();
  };

  const confirmUpdatePostFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !postToUpdateFile) return;

    setIsUploading(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('文章文件不能超过 1 MiB');
      const content = await file.text();
      inspectImportedContent(file.name, content, path === 'content/stories' ? 'stories' : 'blog');
      const commitMsg = updatePostCommitTemplate.replace('{filename}', postToUpdateFile.name);
      await gitService.updateFileContent(postToUpdateFile.path, content, commitMsg, postToUpdateFile.sha);
      onAction();
      fetchPosts();
      setPostToUpdateFile(null);
    } catch (err) {
      alert("Update failed");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleUpdateImage = (post: PostData) => {
    setPostToUpdateImage(post);
    setIsImageModalOpen(true);
  };

  const handleImageConfirm = async (result: { type: 'new' | 'existing'; file?: File; path?: string }) => {
    if (!postToUpdateImage) return;
    setIsUploading(true);
    try {
      let imageUrl = '';
      if (result.type === 'new' && result.file) {
        const commitMsg = `feat(assets): add image "${result.file.name}"`;
        const fullPath = imagesPath ? `${imagesPath}/${result.file.name}` : result.file.name;
        await gitService.uploadFile(fullPath, result.file, commitMsg);
        imageUrl = fullPath;
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

        const fm = postToUpdateImage.frontmatter;
        let targetField = 'heroImage';
        if (fm.cover) targetField = 'cover';
        else if (fm.thumbnail) targetField = 'thumbnail';
        else if (fm.heroImage) targetField = 'heroImage';

        const newContent = updateFrontmatter(postToUpdateImage.rawContent, { [targetField]: finalUrl });
        const commitMsg = `fix(content): update image for "${postToUpdateImage.name}"`;

        await gitService.updateFileContent(postToUpdateImage.path, newContent, commitMsg, postToUpdateImage.sha);
        onAction();
        fetchPosts();
      }
    } catch (e) {
      alert("Failed to update image");
      console.error(e);
    } finally {
      setIsUploading(false);
      setIsImageModalOpen(false);
      setPostToUpdateImage(null);
    }
  };

  const confirmDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    setDeleteNotice('');
    try {
      if (postToDelete.draft) {
        await cmsDocumentClient.discard(postToDelete.draft.id, postToDelete.draft.revision);
        setDeleteNotice('D1 工作草稿已废弃；已有 Git 文章与线上页面未变。');
      } else {
        if (!/^[a-f0-9]{40}$/i.test(postToDelete.sha))
          throw new Error('请先刷新仓库文件版本；本地快照不支持删除已发布文章');
        const pending = await cmsDocumentClient.pendingDeletion(postToDelete.path);
        if (pending && pending.expectedBlobSha !== postToDelete.sha)
          throw new Error('已有旧版本删除待对账，请刷新文章状态');
        const operationId = pending?.operationId ?? crypto.randomUUID();
        const result = await cmsDocumentClient.deleteArticle(
          postToDelete.path,
          postToDelete.sha,
          operationId,
        );
        if (result.status !== 'committed') {
          setDeleteError(result.status === 'unknown' || result.status === 'in_flight'
            ? `Git 删除结果待对账，操作 ID：${operationId}。再次确认会沿用该操作。`
            : result.status === 'conflict'
              ? '仓库文章已变化，请刷新后比较版本。'
              : '删除失败，仓库文章保持原状。');
          return;
        }
        setDeleteNotice(`Git 删除已提交（${result.resultCommitSha?.slice(0, 12) ?? operationId}）；线上部署尚未核实。`);
      }
      onAction();
      fetchPosts();
      if (selectedPost?.path === postToDelete.path) setSelectedPost(null);
      setPostToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return {
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
  };
}
