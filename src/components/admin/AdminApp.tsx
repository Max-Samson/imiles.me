import { useCallback, useEffect, useState } from 'react';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { createAdminDataSource } from './data-source';
import { SessionBoundary, type SessionState } from './SessionBoundary';

export default function AdminApp() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const retry = useCallback(() => {
    setState({ status: 'loading' });
  }, []);

  useEffect(() => {
    if (state.status !== 'loading') return;
    const controller = new AbortController();
    void createAdminDataSource()
      .then((source) => source.getSession(controller.signal))
      .then((session) => setState({ status: 'ready', session }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [state.status]);

  return (
    <AdminErrorBoundary>
      <SessionBoundary state={state} onRetry={retry} />
    </AdminErrorBoundary>
  );
}
