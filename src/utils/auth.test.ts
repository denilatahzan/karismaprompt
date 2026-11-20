import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STARTER_PASSWORD,
  DEFAULT_STARTER_USERNAME,
  extractBearerToken,
  parseConfiguredUsers,
  resolveSigningSecret,
  signSessionToken,
  verifySessionToken,
  verifyUserCredentials,
} from './auth';

test('parseConfiguredUsers falls back to starter account when env vars are unset', () => {
  const res = parseConfiguredUsers({});
  assert.equal(res.usingDefaultCredentials, true);
  assert.equal(res.users.length, 1);
  assert.equal(res.users[0].username, DEFAULT_STARTER_USERNAME);
  assert.equal(res.users[0].password, DEFAULT_STARTER_PASSWORD);
});

test('parseConfiguredUsers supports APP_USERNAME/APP_PASSWORD and multi-user APP_USERS', () => {
  const single = parseConfiguredUsers({
    APP_USERNAME: 'agun',
    APP_PASSWORD: 'MyStrongPassword!99',
  });
  assert.equal(single.usingDefaultCredentials, false);
  assert.equal(single.users.length, 1);
  assert.equal(single.users[0].username, 'agun');

  const multi = parseConfiguredUsers({
    APP_USERS: 'owner:pass123, staff1:desain456, staff2:kaos789',
  });
  assert.equal(multi.usingDefaultCredentials, false);
  assert.equal(multi.users.length, 3);
  assert.equal(multi.users[0].role, 'admin');
  assert.equal(multi.users[1].role, 'member');
});

test('verifyUserCredentials matches case-insensitive username and exact case-sensitive password', () => {
  const { users } = parseConfiguredUsers({
    APP_USERS: 'AgunDesain:Secret#2026',
  });

  const ok = verifyUserCredentials('agundesain', 'Secret#2026', users);
  assert.ok(ok);
  assert.equal(ok.username, 'AgunDesain');

  assert.equal(verifyUserCredentials('agundesain', 'secret#2026', users), null);
  assert.equal(verifyUserCredentials('unknown', 'Secret#2026', users), null);
  assert.equal(verifyUserCredentials('', 'Secret#2026', users), null);
});

test('signSessionToken and verifySessionToken round-trip and reject tampering or expiry', () => {
  const secret = resolveSigningSecret({ AUTH_SECRET: 'unit-test-secret-key' });
  const now = 1_700_000_000_000;
  const token = signSessionToken({ username: 'agun', role: 'admin' }, secret, 3600, now);

  const verified = verifySessionToken(token, secret, now + 1000);
  assert.ok(verified);
  assert.equal(verified.username, 'agun');
  assert.equal(verified.role, 'admin');

  // Expired token
  assert.equal(verifySessionToken(token, secret, now + 3601 * 1000), null);

  // Tampered signature
  assert.equal(verifySessionToken(`${token}x`, secret, now + 1000), null);

  // Wrong secret
  assert.equal(verifySessionToken(token, 'different-secret', now + 1000), null);
});

test('extractBearerToken extracts bearer token cleanly', () => {
  assert.equal(extractBearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(extractBearerToken('bearer xyz.123'), 'xyz.123');
  assert.equal(extractBearerToken('Basic abc'), null);
  assert.equal(extractBearerToken(undefined), null);
});
