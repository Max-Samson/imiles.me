export const ADMIN_CAPABILITIES = ['admin:read', 'admin:write', 'admin:maintenance'] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];
