import assert from 'node:assert/strict';
import test from 'node:test';
import { accessConfig, clearAccessKeyCache, gateWithCloudflareAccess, verifyAccessJwt } from '../worker/cloudflare-access.ts';

const TEAM = 'example-team.cloudflareaccess.com';
const AUD = 'a'.repeat(64);
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const NOW = Date.parse('2026-11-18T01:00:00Z');
const seconds = Math.floor(NOW / 1000);

const keyPair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const otherPair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const publicJwk = { ...(await crypto.subtle.exportKey('jwk', keyPair.publicKey)), kid: 'kid-1' };

const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
async function sign(payload, { kid = 'kid-1', alg = 'RS256', key = keyPair.privateKey } = {}) {
  const head = encode({ alg, kid, typ: 'JWT' }) + '.' + encode(payload);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head));
  return head + '.' + Buffer.from(signature).toString('base64url');
}
const claims = (overrides = {}) => ({ iss: 'https://' + TEAM, aud: [AUD], sub: 'user-1', email: 'traveler@example.com', iat: seconds - 10, nbf: seconds - 10, exp: seconds + 3600, ...overrides });

function jwksFetch() {
  const calls = [];
  const fetch = async url => { calls.push(String(url)); return Response.json({ keys: [publicJwk] }); };
  return { fetch, calls };
}
const options = () => ({ fetch: jwksFetch().fetch, now: () => NOW });

test.beforeEach(() => clearAccessKeyCache());

test('config must be a cloudflareaccess.com team domain and a plausible AUD tag', () => {
  assert.deepEqual(accessConfig(env), { teamDomain: TEAM, audience: AUD });
  assert.equal(accessConfig({ ACCESS_TEAM_DOMAIN: 'evil.example.com', ACCESS_AUD: AUD }), null);
  assert.equal(accessConfig({ ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: '' }), null);
  assert.equal(accessConfig({}), null);
});

test('a valid Access JWT yields the verified email and fetches keys from the team domain', async () => {
  const mock = jwksFetch();
  const identity = await verifyAccessJwt(await sign(claims()), accessConfig(env), { fetch: mock.fetch, now: () => NOW });
  assert.deepEqual(identity, { userId: 'user-1', email: 'traveler@example.com' });
  assert.deepEqual(mock.calls, ['https://' + TEAM + '/cdn-cgi/access/certs']);
});

test('tokens with a wrong signer, audience, issuer, algorithm or expiry are rejected', async () => {
  const config = accessConfig(env);
  const rejected = [
    await sign(claims(), { key: otherPair.privateKey }),
    await sign(claims({ aud: ['b'.repeat(64)] })),
    await sign(claims({ iss: 'https://other-team.cloudflareaccess.com' })),
    await sign(claims({ exp: seconds - 120 })),
    await sign(claims({ nbf: seconds + 600 })),
    await sign(claims({ email: undefined })),
    await sign(claims(), { alg: 'none' }),
    await sign(claims(), { kid: 'unknown' }),
    'not-a-jwt', '', null,
  ];
  for (const token of rejected) assert.equal(await verifyAccessJwt(token, config, options()), null, String(token).slice(0, 40));
});

test('the gate fails closed: missing config is 503 and a missing token is 401', async () => {
  const request = new Request('https://trip.example.workers.dev/api/state');
  assert.equal((await gateWithCloudflareAccess(request, {}, options())).status, 503);
  assert.equal((await gateWithCloudflareAccess(request, env, options())).status, 401);
});

test('forged Sites identity headers are dropped and replaced by the verified identity', async () => {
  const forged = new Request('https://trip.example.workers.dev/api/state', {
    headers: { 'oai-authenticated-user-email': 'intruder@example.com', 'OAI-Authenticated-User-Id': 'intruder', 'oai-authenticated-user-full-name': 'x' },
  });
  assert.equal((await gateWithCloudflareAccess(forged, env, options())).status, 401);

  const signedIn = new Request(forged, { headers: { ...Object.fromEntries(forged.headers), 'cf-access-jwt-assertion': await sign(claims()) } });
  const gated = await gateWithCloudflareAccess(signedIn, env, options());
  assert.ok(gated instanceof Request);
  assert.equal(gated.headers.get('oai-authenticated-user-email'), 'traveler@example.com');
  assert.equal(gated.headers.get('oai-authenticated-user-id'), 'user-1');
  assert.equal(gated.headers.get('oai-authenticated-user-full-name'), null);
});
