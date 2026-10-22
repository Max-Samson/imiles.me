// imiles integration patch: reuse Access identity; never clear shared browser storage.
import { useCallback, useEffect } from 'react';
import { adminApiRequest } from '../../../../src/lib/admin/api-client';
import type { AdminSession } from '../../../../src/shared/admin/session-contract';
import { ProxyGitAdapter } from '../services/proxyGitService';
import { useAuthStore } from '../features/auth/store';

export function useSessionRestore() {
  const init = useCallback(async () => {
    const store = useAuthStore.getState();
    store.setLoading(true);
    store.setError(null);
    try {
      const { session } = await adminApiRequest<{ session: AdminSession }>('/api/v1/admin/cms/session');
      const service = new ProxyGitAdapter();
      const repo = await service.getRepoDetails();
      const name = session.actor.kind === 'user' ? session.actor.email : session.actor.id;
      store.setUser({ login: name, name, avatar_url: '/favicon.ico', html_url: '/admin' });
      store.setRepo(repo);
      store.setGitService(service);
      store.setServiceType('github');
    } catch (error) {
      store.setError(error instanceof Error ? error.message : '无法连接 CMS');
    } finally { store.setLoading(false); }
  }, []);
  useEffect(() => { void init(); }, [init]);
  const performSimpleLogout = useCallback(() => { window.location.assign('/cdn-cgi/access/logout'); }, []);
  return { retryInit: init, handleLogin: init, performSimpleLogout };
}
