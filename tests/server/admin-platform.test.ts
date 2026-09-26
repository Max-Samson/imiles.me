import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  authorizeAdmin,
  authorizeAdminMutation,
  getAdminAccess,
} from '../../src/server/security/access';
import type { AdminCapability } from '../../src/shared/admin/capabilities';

async function accessFixture() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'admin-test';
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const env = {
    ACCESS_ISSUER: 'https://imiles.cloudflareaccess.com',
    ACCESS_AUD: 'admin-app',
    ADMIN_EMAILS: 'owner@example.com',
    ADMIN_SERVICE_TOKEN_IDS: 'automation.access',
    ADMIN_SERVICE_TOKEN_CAPABILITIES: JSON.stringify({
      'automation.access': ['admin:read', 'admin:write'],
    }),
    SITE_URL: 'https://imiles.me',
  };
  const sign = (claims: Record<string, unknown>, subject: string) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'admin-test' })
      .setIssuer(env.ACCESS_ISSUER)
      .setAudience(env.ACCESS_AUD)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  return { env, resolver, sign };
}

test('Access claims are mapped to stable user and service actors', async () => {
  const { env, resolver, sign } = await accessFixture();
  const userToken = await sign({ email: 'OWNER@EXAMPLE.COM' }, 'access-user-id');
  const serviceToken = await sign({ common_name: 'automation.access' }, '');
  const request = (token: string, origin?: string) =>
    new Request('https://imiles.me/api/v1/admin/session', {
      headers: {
        'Cf-Access-Jwt-Assertion': token,
        ...(origin ? { Origin: origin } : {}),
      },
    });

  assert.deepEqual((await getAdminAccess(request(userToken), env, resolver)).actor, {
    kind: 'user',
    id: 'user:owner@example.com',
    email: 'owner@example.com',
  });
  assert.deepEqual((await getAdminAccess(request(serviceToken), env, resolver)).actor, {
    kind: 'service',
    id: 'service:automation.access',
    clientId: 'automation.access',
  });
  await assert.rejects(authorizeAdminMutation(request(userToken), env, 'admin:write', resolver), {
    statusCode: 403,
  });
  assert.equal(
    (await authorizeAdminMutation(request(userToken, env.SITE_URL), env, 'admin:write', resolver))
      .id,
    'user:owner@example.com',
  );
  await assert.rejects(authorizeAdmin(request(serviceToken), env, 'admin:maintenance', resolver), {
    statusCode: 403,
  });
});

test('capability enforcement fails closed and session response exposes only its contract', async () => {
  const { env, resolver, sign } = await accessFixture();
  const token = await sign({ email: 'owner@example.com' }, 'access-user-id');
  const request = new Request('https://imiles.me/api/v1/admin/session', {
    headers: { 'Cf-Access-Jwt-Assertion': token },
  });
  await assert.rejects(authorizeAdmin(request, env, 'admin:unknown' as AdminCapability, resolver), {
    statusCode: 403,
  });

  const session = await getAdminAccess(request, env, resolver);
  assert.deepEqual(Object.keys(session).sort(), ['actor', 'capabilities']);
  assert.deepEqual(Object.keys(session.actor).sort(), ['email', 'id', 'kind']);
  const serialized = JSON.stringify(session);
  for (const forbidden of ['jwt', 'issuer', 'audience', 'cookie', 'claims']) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
});

test('Service Token 权限配置严格校验并默认拒绝', async () => {
  const { env, resolver, sign } = await accessFixture();
  const token = await sign({ common_name: 'automation.access' }, '');
  const request = new Request('https://imiles.me/api/v1/admin/session', {
    headers: { 'Cf-Access-Jwt-Assertion': token },
  });

  await assert.rejects(
    authorizeAdmin(
      request,
      { ...env, ADMIN_SERVICE_TOKEN_CAPABILITIES: undefined },
      'admin:read',
      resolver,
    ),
    { statusCode: 403 },
  );
  for (const invalid of [
    '{',
    JSON.stringify({ 'unknown.access': ['admin:read'] }),
    JSON.stringify({ 'automation.access': ['admin:unknown'] }),
  ]) {
    await assert.rejects(
      getAdminAccess(request, { ...env, ADMIN_SERVICE_TOKEN_CAPABILITIES: invalid }, resolver),
      { statusCode: 500 },
    );
  }
});
