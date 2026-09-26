import type { CloudflareEnv } from '../../../env.d';
import { ADMIN_CAPABILITIES, type AdminCapability } from '../../../shared/admin/capabilities';
import { requireBinding } from '../../env';
import { InternalServerError } from '../../errors';

export interface AccessSecurityConfig {
  issuer: string;
  audience: string;
  adminEmails: ReadonlySet<string>;
  serviceClientIds: ReadonlySet<string>;
  serviceCapabilities: ReadonlyMap<string, readonly AdminCapability[]>;
}

function parseServiceCapabilities(
  value: string | undefined,
  allowedClientIds: ReadonlySet<string>,
): ReadonlyMap<string, readonly AdminCapability[]> {
  if (!value) return new Map();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    const result = new Map<string, readonly AdminCapability[]>();
    for (const [clientId, capabilities] of Object.entries(parsed)) {
      if (
        !allowedClientIds.has(clientId) ||
        !Array.isArray(capabilities) ||
        capabilities.some(
          (capability) =>
            typeof capability !== 'string' ||
            !ADMIN_CAPABILITIES.includes(capability as AdminCapability),
        )
      ) {
        throw new Error();
      }
      const validCapabilities = capabilities as AdminCapability[];
      result.set(clientId, [...new Set(validCapabilities)]);
    }
    return result;
  } catch {
    throw new InternalServerError('Service Token 权限配置无效');
  }
}

function commaSeparatedSet(value: string | undefined, normalize = false): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => (normalize ? entry.toLowerCase() : entry)),
  );
}

export function getAccessSecurityConfig(env: CloudflareEnv): AccessSecurityConfig {
  const issuer = requireBinding(env, 'ACCESS_ISSUER');
  const audience = requireBinding(env, 'ACCESS_AUD');
  const adminEmails = commaSeparatedSet(requireBinding(env, 'ADMIN_EMAILS'), true);
  const serviceClientIds = commaSeparatedSet(env.ADMIN_SERVICE_TOKEN_IDS);

  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !adminEmails.size) {
    throw new InternalServerError('Access 配置无效');
  }

  return {
    issuer,
    audience,
    adminEmails,
    serviceClientIds,
    serviceCapabilities: parseServiceCapabilities(
      env.ADMIN_SERVICE_TOKEN_CAPABILITIES,
      serviceClientIds,
    ),
  };
}
