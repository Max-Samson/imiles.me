import type { JWTVerifyGetKey } from 'jose';
import type { CloudflareEnv } from '../../../env.d';
import type { AdminCapability } from '../../../shared/admin/capabilities';
import type { AdminSession } from '../../../shared/admin/session-contract';
import { requireSameOrigin } from '../origin';
import { type AdminActor, mapAccessClaimsToAdminActor } from './actor';
import { capabilitiesFor, requireCapability } from './authorization';
import { getAccessSecurityConfig } from './config';
import { verifyAccessToken } from './verifier';

export type { AdminActor } from './actor';
export { capabilitiesFor, requireCapability } from './authorization';
export { getAccessSecurityConfig } from './config';
export { type VerifiedAccessClaims, verifyAccessToken } from './verifier';

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
  const { actor, capabilities } = await resolveAdminAccess(request, env, verificationKey);
  return { actor, capabilities };
}

export async function authorizeAdmin(
  request: Request,
  env: CloudflareEnv,
  capability: AdminCapability,
  verificationKey?: JWTVerifyGetKey,
): Promise<AdminActor> {
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
