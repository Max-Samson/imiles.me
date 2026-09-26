import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { UnauthorizedError } from '../../errors';
import type { AccessSecurityConfig } from './config';

const MAX_ACCESS_TOKEN_LENGTH = 16_384;

export type VerifiedAccessClaims = JWTPayload;

let remoteKeyCache: { issuer: string; key: JWTVerifyGetKey } | undefined;

function remoteKeyFor(issuer: string): JWTVerifyGetKey {
  if (remoteKeyCache?.issuer !== issuer) {
    // RemoteJWKSet 内部负责公钥缓存与刷新；这里只缓存公开证书解析器，不保存请求身份。
    remoteKeyCache = {
      issuer,
      key: createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
        timeoutDuration: 5000,
      }),
    };
  }
  return remoteKeyCache.key;
}

export async function verifyAccessToken(
  request: Request,
  config: AccessSecurityConfig,
  verificationKey?: JWTVerifyGetKey,
): Promise<VerifiedAccessClaims> {
  const { issuer, audience } = config;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > MAX_ACCESS_TOKEN_LENGTH) throw new UnauthorizedError();

  try {
    const { payload } = await jwtVerify(token, verificationKey ?? remoteKeyFor(issuer), {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub'],
    });
    return payload;
  } catch {
    throw new UnauthorizedError('管理员身份无效或已过期');
  }
}
