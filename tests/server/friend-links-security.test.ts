import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { getServerEnv } from '../../src/server/env';
import { verifyTurnstile } from '../../src/server/friend-links/protection';
import { authorizeAdminMutation, getAdminAccess } from '../../src/server/security/access';
import { requireSameOrigin } from '../../src/server/security/origin';

test('Access 验证签名/issuer/audience/过期/邮箱；忽略裸邮箱头', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test';
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const env = {
    ACCESS_ISSUER: 'https://imiles.cloudflareaccess.com',
    ACCESS_AUD: 'app',
    ADMIN_EMAILS: 'owner@real.net',
  };
  const token = async (
    aud = 'app',
    email = 'owner@real.net',
    exp = Math.floor(Date.now() / 1000) + 60,
  ) =>
    new SignJWT({ email })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(env.ACCESS_ISSUER)
      .setAudience(aud)
      .setSubject('owner')
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(privateKey);
  const request = (jwt: string) =>
    new Request('https://imiles.me/api/v1/admin/friend-links', {
      headers: { 'Cf-Access-Jwt-Assertion': jwt },
    });
  assert.equal(
    (await getAdminAccess(request(await token()), env, resolver)).actor.id,
    'user:owner@real.net',
  );
  await assert.rejects(getAdminAccess(request(await token('other')), env, resolver), {
    statusCode: 401,
  });
  await assert.rejects(
    getAdminAccess(request(await token('app', 'owner@real.net', 1)), env, resolver),
    { statusCode: 401 },
  );
  await assert.rejects(
    getAdminAccess(request(await token('app', 'other@real.net')), env, resolver),
    {
      statusCode: 403,
    },
  );
  await assert.rejects(getAdminAccess(request('forged'), env, resolver), { statusCode: 401 });
  const serviceToken = await new SignJWT({ common_name: 'review-tool.access' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(env.ACCESS_ISSUER)
    .setAudience(env.ACCESS_AUD)
    .setSubject('')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
  const serviceEnv = {
    ...env,
    ADMIN_SERVICE_TOKEN_IDS: 'review-tool.access',
    ADMIN_SERVICE_TOKEN_CAPABILITIES: JSON.stringify({
      'review-tool.access': ['admin:read', 'admin:write'],
    }),
  };
  assert.equal(
    (await getAdminAccess(request(serviceToken), serviceEnv, resolver)).actor.id,
    'service:review-tool.access',
  );
  assert.equal(
    (await authorizeAdminMutation(request(serviceToken), serviceEnv, 'admin:write', resolver)).id,
    'service:review-tool.access',
  );
  await assert.rejects(
    authorizeAdminMutation(
      new Request('https://imiles.me', {
        headers: { 'Cf-Access-Jwt-Assertion': serviceToken, Origin: 'https://evil.net' },
      }),
      serviceEnv,
      'admin:write',
      resolver,
    ),
    { statusCode: 403 },
  );
  await assert.rejects(
    authorizeAdminMutation(request(await token()), env, 'admin:write', resolver),
    {
      statusCode: 403,
    },
  );
  assert.equal(
    (
      await authorizeAdminMutation(
        new Request('https://imiles.me', {
          headers: { 'Cf-Access-Jwt-Assertion': await token(), Origin: 'https://imiles.me' },
        }),
        env,
        'admin:write',
        resolver,
      )
    ).id,
    'user:owner@real.net',
  );
  await assert.rejects(getAdminAccess(request(serviceToken), env, resolver), { statusCode: 403 });
  await assert.rejects(
    getAdminAccess(
      request(serviceToken),
      { ...env, ADMIN_SERVICE_TOKEN_IDS: 'other-tool.access' },
      resolver,
    ),
    { statusCode: 403 },
  );
  await assert.rejects(
    getAdminAccess(
      new Request('https://imiles.me', {
        headers: { 'Cf-Access-Authenticated-User-Email': 'owner@real.net' },
      }),
      env,
      resolver,
    ),
    { statusCode: 401 },
  );
  assert.throws(
    () =>
      requireSameOrigin(
        new Request('https://imiles.me', { headers: { Origin: 'https://evil.net' } }),
        { SITE_URL: 'https://imiles.me' },
      ),
    { statusCode: 403 },
  );
});

test('Turnstile 校验 action/hostname 和服务异常均失败关闭', async () => {
  const env = {
    TURNSTILE_SECRET_KEY: 'test',
  };
  const good = { success: true, hostname: 'imiles.me', action: 'friend_link_submit' };
  await verifyTurnstile('token', env, async () => Response.json(good));
  for (const result of [
    { ...good, success: false },
    { ...good, hostname: 'evil.net' },
    { ...good, action: 'other' },
  ])
    await assert.rejects(
      verifyTurnstile('token', env, async () => Response.json(result)),
      { statusCode: 400 },
    );
  await assert.rejects(
    verifyTurnstile('token', env, async () => {
      throw new Error('timeout');
    }),
    { statusCode: 500 },
  );
});

test('站点默认值与环境覆盖统一驱动同源和验证码 hostname 校验', async () => {
  const { appConfig } = await import('../../src/config/app');
  const { getSiteUrl } = await import('../../src/server/config');
  const defaultEnv = getServerEnv({ runtime: { env: {} } } as Partial<App.Locals>);
  assert.equal(defaultEnv.SITE_URL, appConfig.siteUrl);
  assert.equal('TURNSTILE_HOSTNAME' in defaultEnv, false);
  assert.equal('TURNSTILE_ACTION' in defaultEnv, false);
  requireSameOrigin(
    new Request('https://imiles.me', { headers: { Origin: appConfig.siteUrl } }),
    {},
  );
  // 不能用请求 Host / Origin 自行扩大允许的域名。
  assert.throws(
    () =>
      requireSameOrigin(
        new Request('https://evil.net', {
          headers: { Origin: 'https://evil.net', Host: 'evil.net' },
        }),
        {},
      ),
    { statusCode: 403 },
  );
  const localEnv = { SITE_URL: 'http://localhost:4321', TURNSTILE_SECRET_KEY: 'test' };
  requireSameOrigin(
    new Request('http://localhost:4321', { headers: { Origin: localEnv.SITE_URL } }),
    localEnv,
  );
  await verifyTurnstile('token', localEnv, async () =>
    Response.json({
      success: true,
      hostname: 'localhost',
      action: appConfig.turnstile.actions.friendLinkSubmit,
    }),
  );
  await assert.rejects(
    verifyTurnstile('token', localEnv, async () =>
      Response.json({
        success: true,
        hostname: 'imiles.me',
        action: appConfig.turnstile.actions.friendLinkSubmit,
      }),
    ),
    { statusCode: 400 },
  );
  for (const SITE_URL of [
    'https://user:password@imiles.me',
    'https://imiles.me/path',
    'file:///tmp',
    'https://imiles.me?x=1',
  ])
    assert.throws(() => getSiteUrl({ SITE_URL }), { statusCode: 500 });
});
