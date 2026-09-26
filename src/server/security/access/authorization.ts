import type { AdminCapability } from '../../../shared/admin/capabilities';
import { ForbiddenError } from '../../errors';
import type { AdminActor } from './actor';
import type { AccessSecurityConfig } from './config';

const USER_CAPABILITIES: readonly AdminCapability[] = [
  'admin:read',
  'admin:write',
  'admin:maintenance',
];

export function capabilitiesFor(
  actor: AdminActor,
  config: AccessSecurityConfig,
): AdminCapability[] {
  if (actor.kind === 'user') return [...USER_CAPABILITIES];
  // Service Token 默认没有权限，必须在部署配置中为具体 clientId 显式授权。
  return [...(config.serviceCapabilities.get(actor.clientId) ?? [])];
}

export function requireCapability(
  actor: AdminActor,
  config: AccessSecurityConfig,
  capability: AdminCapability,
): void {
  if (!capabilitiesFor(actor, config).includes(capability))
    throw new ForbiddenError('当前身份无此操作权限');
}
