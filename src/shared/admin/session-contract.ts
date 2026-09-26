import type { AdminCapability } from './capabilities';

export type AdminSessionActor =
  | { kind: 'user'; id: string; email: string }
  | { kind: 'service'; id: string; clientId: string };

export interface AdminSession {
  actor: AdminSessionActor;
  capabilities: AdminCapability[];
}
