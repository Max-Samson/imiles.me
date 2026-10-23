import type {
  ContentInfo,
  IGitService,
  RepoInfo,
  RepoTreeInfo,
} from '../../../packages/pageel-workbench';
import { adminApiRequest } from './api-client';

/** 将 Pageel 仓库协议映射到同源管理 API；令牌与权限校验始终留在服务端。 */
export class PageelReadAdapter implements IGitService {
  private call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    return adminApiRequest<T>('/api/v1/admin/cms/repository', undefined, fetch, {
      method: 'POST',
      body: { action, params },
    });
  }
  getRepoContents(path: string) {
    return this.call<ContentInfo[]>('getRepoContents', { path });
  }
  listFiles(path: string) {
    return this.call<RepoTreeInfo[]>('listFiles', { path });
  }
  getFileContent(path: string) {
    return this.call<string>('getFileContent', { path });
  }
  getFileSha(path: string) {
    return this.call<string | null>('getFileSha', { path });
  }
  scanForContentDirectories() {
    return this.call<string[]>('scanForContentDirectories');
  }
  scanForImageDirectories() {
    return this.call<string[]>('scanForImageDirectories');
  }
  findProductionUrl() {
    return this.call<string | null>('findProductionUrl');
  }
  getRepoTree(path?: string) {
    return this.call<RepoTreeInfo[]>('getRepoTree', { path });
  }
  getRepoDetails() {
    return this.call<RepoInfo>('getRepoDetails');
  }
  private blocked(): never {
    throw new Error('当前为兼容性验证：修改只在编辑区中，不会保存或发布。');
  }
  async createFileFromString(): Promise<never> {
    return this.blocked();
  }
  async updateFileContent(): Promise<never> {
    return this.blocked();
  }
  async deleteFile(): Promise<never> {
    return this.blocked();
  }
  async uploadFile(): Promise<never> {
    return this.blocked();
  }
  async getFileAsBlob(): Promise<Blob> {
    return this.blocked();
  }
}
