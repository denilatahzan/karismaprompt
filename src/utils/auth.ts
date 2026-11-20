import crypto from 'node:crypto';

export interface AuthUserRecord {
  username: string;
  password: string;
  role: 'admin' | 'member';
}

export interface SessionPayload {
  username: string;
  role: 'admin' | 'member';
  iat: number;
  exp: number;
}

export const DEFAULT_STARTER_USERNAME = 'admin';
export const DEFAULT_STARTER_PASSWORD = 'studio123';
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Parses configured accounts from environment variables:
 * 1. APP_USERS="user1:pass1,user2:pass2" (supports multiple accounts)
 * 2. APP_USERNAME + APP_PASSWORD (single custom account)
 * 3. Starter fallback (admin / studio123) when no Secrets are configured yet.
 */
export function parseConfiguredUsers(env: Record<string, string | undefined>): {
  users: AuthUserRecord[];
  usingDefaultCredentials: boolean;
} {
  const users: AuthUserRecord[] = [];
  const seen = new Set<string>();

  const multiRaw = (env.APP_USERS || '').trim();
  if (multiRaw) {
    for (const pair of multiRaw.split(',')) {
      const idx = pair.indexOf(':');
      if (idx <= 0) continue;
      const username = pair.slice(0, idx).trim();
      const password = pair.slice(idx + 1).trim();
      if (!username || !password) continue;
      const key = username.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        users.push({
          username,
          password,
          role: users.length === 0 ? 'admin' : 'member',
        });
      }
    }
  }

  const singleUser = (env.APP_USERNAME || '').trim();
  const singlePass = (env.APP_PASSWORD || '').trim();
  if (
    singleUser &&
    singlePass &&
    singlePass !== 'CHANGE_ME_PASSWORD' &&
    !seen.has(singleUser.toLowerCase())
  ) {
    seen.add(singleUser.toLowerCase());
    users.unshift({
      username: singleUser,
      password: singlePass,
      role: 'admin',
    });
  }

  if (users.length === 0) {
    return {
      users: [
        {
          username: DEFAULT_STARTER_USERNAME,
          password: DEFAULT_STARTER_PASSWORD,
          role: 'admin',
        },
      ],
      usingDefaultCredentials: true,
    };
  }

  return { users, usingDefaultCredentials: false };
}

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = sha256Buffer(a);
  const hashB = sha256Buffer(b);
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Verifies username (case-insensitive) and password (case-sensitive, timing-safe).
 */
export function verifyUserCredentials(
  username: string,
  password: string,
  users: AuthUserRecord[]
): AuthUserRecord | null {
  const normalizedUser = username.trim().toLowerCase();
  if (!normalizedUser || !password) return null;

  for (const record of users) {
    if (record.username.toLowerCase() === normalizedUser) {
      if (timingSafeEqualString(password, record.password)) {
        return record;
      }
      return null;
    }
  }
  return null;
}

/**
 * Derives a deterministic server signing secret from AUTH_SECRET (or fallback env values)
 * so stateless tokens remain valid across Cloud Run restarts when Secrets are configured.
 */
export function resolveSigningSecret(env: Record<string, string | undefined>): string {
  const explicit = (env.AUTH_SECRET || '').trim();
  if (explicit && explicit !== 'CHANGE_ME_RANDOM_SECRET') {
    return explicit;
  }
  const seed = [
    env.GEMINI_API_KEY || '',
    env.APP_USERNAME || DEFAULT_STARTER_USERNAME,
    env.APP_PASSWORD || DEFAULT_STARTER_PASSWORD,
    env.APP_USERS || '',
    'prompt-studio-banner-session-v1',
  ].join('|');
  return crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
}

export function signSessionToken(
  user: Pick<AuthUserRecord, 'username' | 'role'>,
  secret: string,
  ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
  nowMs = Date.now()
): string {
  const iat = Math.floor(nowMs / 1000);
  const payload: SessionPayload = {
    username: user.username,
    role: user.role,
    iat,
    exp: iat + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  nowMs = Date.now()
): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const bufProvided = Buffer.from(providedSig, 'utf8');
  const bufExpected = Buffer.from(expectedSig, 'utf8');
  if (
    bufProvided.length !== bufExpected.length ||
    !crypto.timingSafeEqual(bufProvided, bufExpected)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (
      !decoded ||
      typeof decoded.username !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }
    const nowSec = Math.floor(nowMs / 1000);
    if (decoded.exp <= nowSec) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
