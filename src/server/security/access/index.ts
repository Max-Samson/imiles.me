import type { JWTVerifyGetKey } from 'jose';
import type { CloudflareEnv } from '../../../env.d';
import type { AdminCapability } from '../../../shared/admin/capabilities';
import type { AdminSession } from '../../../shared/admin/session-contract';
import { getRuntimeConfig } from '../../config';
import { ForbiddenError } from '../../errors';
import { requireSameOrigin } from '../origin';
import { type AdminActor, mapAccessClaimsToAdminActor } from './actor';
import { capabilitiesFor, requireCapability } from './authorization';
import { getAccessSecurityConfig } from './config';
import { verifyAccessToken } from './verifier';

export type { AdminActor } from './actor';
export { capabilitiesFor, requireCapability } from './authorization';
export { getAccessSecurityConfig } from './config';
export { type VerifiedAccessClaims, verifyAccessToken } from './verifier';

const LOCAL_ADMIN_SESSION: AdminSession = {
  actor: { kind: 'user', id: 'user:local-admin@example.com', email: 'local-admin@example.com' },
  capabilities: ['admin:read', 'admin:write', 'admin:maintenance'],
};

function localDevelopmentSession(request: Request, env: CloudflareEnv): AdminSession | null {
  const runtime = getRuntimeConfig(env);
  if (runtime.services.adminAuth !== 'local-development') return null;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== runtime.siteUrl.origin) return null;
  return LOCAL_ADMIN_SESSION;
}

async function resolveAdminAccess(
  request: Request,
  env: CloudflareEnv,
  verificationKey?: JWTVerifyGetKey,
) {
  const config = getAccessSecurityConfig(env);
  const actor = mapAccessClaimsToAdminActor(
    await verifyAccessToken(request, config, verificationKey),
    config,
  );
  return { actor, config, capabilities: capabilitiesFor(actor, config) };
}

export async function getAdminAccess(
  request: Request,
  env: CloudflareEnv,
  verificationKey?: JWTVerifyGetKey,
): Promise<AdminSession> {
  const localSession = localDevelopmentSession(request, env);
  if (localSession) return localSession;
  const { actor, capabilities } = await resolveAdminAccess(request, env, verificationKey);
  return { actor, capabilities };
}

export async function authorizeAdmin(
  request: Request,
  env: CloudflareEnv,
  capability: AdminCapability,
  verificationKey?: JWTVerifyGetKey,
): Promise<AdminActor> {
  const localSession = localDevelopmentSession(request, env);
  if (localSession) {
    if (!localSession.capabilities.includes(capability)) throw new ForbiddenError();
    return localSession.actor;
  }
  const { actor, config } = await resolveAdminAccess(request, env, verificationKey);
  requireCapability(actor, config, capability);
  return actor;
}

export async function authorizeAdminMutation(
  request: Request,
  env: CloudflareEnv,
  capability: Extract<AdminCapability, 'admin:write' | 'admin:maintenance'>,
  verificationKey?: JWTVerifyGetKey,
): Promise<AdminActor> {
  // 浏览器跨源请求先拒绝，避免继续执行远程公钥验证。
  if (request.headers.has('Origin')) requireSameOrigin(request, env);
  const actor = await authorizeAdmin(request, env, capability, verificationKey);
  // 只有已验证的机器身份可以省略 Origin；用户写操作必须来自站点页面。
  if (actor.kind !== 'service' && !request.headers.has('Origin')) requireSameOrigin(request, env);
  return actor;
}
