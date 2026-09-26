import type { AdminSession } from '../../../shared/admin/session-contract';
import type { AdminDataSource } from './types';

const fixtureSession: AdminSession = {
  actor: { kind: 'user', id: 'user:local-admin@example.com', email: 'local-admin@example.com' },
  capabilities: ['admin:read', 'admin:write', 'admin:maintenance'],
};

export class FixtureAdminDataSource implements AdminDataSource {
  async getSession(signal?: AbortSignal): Promise<AdminSession> {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 180);
      signal?.addEventListener(
        'abort',
        () => {
          window.clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
    return fixtureSession;
  }
}
