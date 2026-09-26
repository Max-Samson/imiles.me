import type { AdminSession } from '../../../shared/admin/session-contract';

export interface AdminDataSource {
  getSession(signal?: AbortSignal): Promise<AdminSession>;
}
