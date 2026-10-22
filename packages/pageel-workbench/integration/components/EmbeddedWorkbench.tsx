import { useEffect, useState } from 'react';
import Dashboard from '../../upstream/components/Dashboard';
import { I18nProvider } from '../../upstream/i18n/I18nContext';
import type { GithubRepo, GithubUser, IGitService } from '../../upstream/types';
import { WorkbenchContext, type WorkbenchContextValue } from '../context';
import '../tailwind.css';
import '../workbench.css';

export interface EmbeddedWorkbenchProps extends WorkbenchContextValue {
  user: GithubUser;
  gitService: IGitService;
}

/** 包的公共入口：复用上游内容工作区，不运行上游 App 的登录和 body 样式副作用。 */
export default function EmbeddedWorkbench({ user, gitService, dark, onDirtyChange, confirmLeave }: EmbeddedWorkbenchProps) {
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // 忽略卸载后的异步响应，避免快速切换后台模块时回写旧工作区。
    let active = true;
    setError('');
    setRepo(null);
    gitService.getRepoDetails().then(value => { if (active) setRepo(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '读取配置失败'); });
    return () => { active = false; };
  }, [gitService, attempt]);
  return (
    <div className="pageel-host h-full min-h-0">
      <WorkbenchContext.Provider value={{ dark, onDirtyChange, confirmLeave }}>
        {error ? <div role="alert" className="p-6">{error}<button className="ml-3 underline" onClick={() => setAttempt(value => value + 1)}>重试</button></div>
          : repo ? <I18nProvider><Dashboard embedded gitService={gitService} repo={repo} user={user} serviceType="github" onLogout={() => {}} /></I18nProvider>
          : <p role="status" className="p-6">正在读取文章工作台…</p>}
      </WorkbenchContext.Provider>
    </div>
  );
}
