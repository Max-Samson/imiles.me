import { HttpAdminDataSource } from './http';
import type { AdminDataSource } from './types';

export async function createAdminDataSource(): Promise<AdminDataSource> {
  if (import.meta.env.DEV) {
    const { FixtureAdminDataSource } = await import('./fixture');
    return new FixtureAdminDataSource();
  }
  return new HttpAdminDataSource();
}
