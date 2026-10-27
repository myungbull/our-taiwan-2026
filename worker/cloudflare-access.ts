// Standalone (non-Sites) deployments put Cloudflare Access in front of the Worker.
// The Worker re-verifies the Access JWT itself so a missing or bypassed Access
// policy fails closed, then maps the verified identity onto the same headers the
// Sites platform injects. Client-supplied identity headers are always dropped.

export const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';
const IDENTITY_HEADER_PREFIX = 'oai-authenticated-user-';
const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL_MS = 10 * 60_000;

export type AccessConfig = { teamDomain: string; audience: string };
export type AccessIdentity = { userId: string; email: string };
type Jwk = JsonWebKey & { kid?: string };
type VerifyOptions = { fetch?: typeof fetch; now?: () => number };

const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();

export function accessConfig(env: { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string }): AccessConfig | null {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim().toLowerCase() ?? '';
  const audience = env.ACCESS_AUD?.trim() ?? '';
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain) || !/^[A-Za-z0-9]{16,128}$/.test(audience)) return null;
  return { teamDomain, audience };
}

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('invalid-base64url');
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function base64UrlJson(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid-json');
  return parsed as Record<string, unknown>;
}

async function signingKeys(config: AccessConfig, options: VerifyOptions, force: boolean): Promise<Jwk[]> {
  const now = (options.now ?? Date.now)();
  const cached = jwksCache.get(config.teamDomain);
  if (cached && !force && now - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
  const response = await (options.fetch ?? fetch)('https://' + config.teamDomain + '/cdn-cgi/access/certs', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('jwks-unavailable');
  const body = await response.json() as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? body.keys.filter((key): key is Jwk => key !== null && typeof key === 'object' && (key as Jwk).kty === 'RSA') : [];
  jwksCache.set(config.teamDomain, { keys, fetchedAt: now });
  return keys;
}

export function clearAccessKeyCache(): void {
  jwksCache.clear();
}

export async function verifyAccessJwt(token: string | null, config: AccessConfig, options: VerifyOptions = {}): Promise<AccessIdentity | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = base64UrlJson(parts[0]);
    const payload = base64UrlJson(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    let jwk = (await signingKeys(config, options, false)).find(key => key.kid === header.kid);
    if (!jwk) jwk = (await signingKeys(config, options, true)).find(key => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlBytes(parts[2]), signed)) return null;

    const now = Math.floor((options.now ?? Date.now)() / 1000);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== 'https://' + config.teamDomain || !audiences.includes(config.audience)) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now - CLOCK_SKEW_SECONDS) return null;
    if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf > now + CLOCK_SKEW_SECONDS)) return null;
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || !payload.email.includes('@')) return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// Returns a request that carries only the verified identity, never client-supplied identity headers.
export function withVerifiedIdentity(request: Request, identity: AccessIdentity): Request {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.toLowerCase().startsWith(IDENTITY_HEADER_PREFIX)) headers.delete(name);
  headers.set(IDENTITY_HEADER_PREFIX + 'id', identity.userId);
  headers.set(IDENTITY_HEADER_PREFIX + 'email', identity.email);
  return new Request(request, { headers });
}

export async function gateWithCloudflareAccess(request: Request, env: { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string }, options: VerifyOptions = {}): Promise<Request | Response> {
  const noStore = { 'Cache-Control': 'private, no-store' };
  const config = accessConfig(env);
  if (!config) return new Response('Access configuration is missing.', { status: 503, headers: noStore });
  const identity = await verifyAccessJwt(request.headers.get(ACCESS_JWT_HEADER), config, options);
  if (!identity) return new Response('로그인이 필요합니다.', { status: 401, headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } });
  return withVerifiedIdentity(request, identity);
}
