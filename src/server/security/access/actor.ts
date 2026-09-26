import type { JWTPayload } from 'jose';
import type { AdminSessionActor } from '../../../shared/admin/session-contract';
import { ForbiddenError } from '../../errors';
import type { AccessSecurityConfig } from './config';

export type AdminActor = AdminSessionActor;

export function mapAccessClaimsToAdminActor(
  claims: JWTPayload,
  config: AccessSecurityConfig,
): AdminActor {
  if (typeof claims.email === 'string') {
    const email = claims.email.trim().toLowerCase();
    if (config.adminEmails.has(email)) return { kind: 'user', id: `user:${email}`, email };
  }

  if (
    claims.sub === '' &&
    typeof claims.common_name === 'string' &&
    config.serviceClientIds.has(claims.common_name)
  ) {
    return {
      kind: 'service',
      id: `service:${claims.common_name}`,
      clientId: claims.common_name,
    };
  }

  throw new ForbiddenError();
}
