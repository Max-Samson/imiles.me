import { adminApiRequest } from '../../../lib/admin/api-client';
import type { AdminSession } from '../../../shared/admin/session-contract';
import type { AdminDataSource } from './types';

export class HttpAdminDataSource implements AdminDataSource {
  getSession(signal?: AbortSignal): Promise<AdminSession> {
    return adminApiRequest('/api/v1/admin/session', signal);
  }
}
