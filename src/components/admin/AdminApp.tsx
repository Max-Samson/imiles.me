import { useCallback, useEffect, useState } from 'react';
import { adminApiRequest } from '../../lib/admin/api-client';
import type { AdminSession } from '../../shared/admin/session-contract';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { SessionBoundary, type SessionState } from './SessionBoundary';

export default function AdminApp({
  section = 'dashboard',
  friendLinkId,
}: {
  section?: 'dashboard' | 'friend-links';
  friendLinkId?: string;
}) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const retry = useCallback(() => {
    setState({ status: 'loading' });
  }, []);

  useEffect(() => {
    if (state.status !== 'loading') return;
    const controller = new AbortController();
    void adminApiRequest<AdminSession>('/api/v1/admin/session', controller.signal)
      .then((session) => setState({ status: 'ready', session }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [state.status]);

  return (
    <AdminErrorBoundary>
      <SessionBoundary
        state={state}
        onRetry={retry}
        section={section}
        friendLinkId={friendLinkId}
      />
    </AdminErrorBoundary>
  );
}
