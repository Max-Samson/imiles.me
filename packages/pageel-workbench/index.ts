/** 宿主统一从此处接入，避免依赖上游组件内部目录结构。 */
export { default } from './integration/components/EmbeddedWorkbench';
export type { EmbeddedWorkbenchProps } from './integration/components/EmbeddedWorkbench';
export type { ContentInfo, IGitService, RepoInfo, RepoTreeInfo } from './upstream/types';
