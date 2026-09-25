/**
 * Vérification du jeton Cloudflare Access (en-tête `Cf-Access-Jwt-Assertion`), côté Worker.
 *
 * Cloudflare Access protège /admin avant même d'atteindre le Worker ; cette vérification est la
 * seconde barrière : si Access était mal configuré, désactivé, ou contourné (adresse workers.dev,
 * URL de prévisualisation…), le Worker refuse quand même toute requête sans jeton valide.
 *
 * Tout est vérifié : signature RS256 (clés publiques de l'équipe Zero Trust), audience (AUD de
 * l'application Access), émetteur, expiration, adresse e-mail autorisée. En cas de doute : refus.
 * Aucun secret ici : les valeurs viennent des secrets du Worker (voir readAccessConfig).
 */

export interface AccessConfig {
  /** ex. https://mon-equipe.cloudflareaccess.com (émetteur attendu des jetons) */
  issuer: string;
  /** « Application Audience (AUD) Tag » de l'application Access */
  audience: string;
  /** adresses autorisées, en minuscules */
  allowedEmails: string[];
}

/** Noms des secrets du Worker (les valeurs sont dans Cloudflare, jamais dans Git). */
export interface AccessEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CMS_ALLOWED_EMAILS?: string;
}

const TEAM_DOMAIN = /^(?:https:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.cloudflareaccess\.com\/?$/;
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** Configuration lue dans l'environnement du Worker, ou null si incomplète / invalide (→ admin fermée). */
export function readAccessConfig(env: AccessEnv): AccessConfig | null {
  const team = TEAM_DOMAIN.exec((env.CF_ACCESS_TEAM_DOMAIN ?? '').trim().toLowerCase());
  const audience = (env.CF_ACCESS_AUD ?? '').trim();
  const allowedEmails = (env.CMS_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!team || !/^[a-f0-9]{16,128}$/i.test(audience)) return null;
  if (allowedEmails.length === 0 || !allowedEmails.every((email) => EMAIL.test(email))) return null;
  return { issuer: `https://${team[1]}.cloudflareaccess.com`, audience, allowedEmails };
}

export type AccessResult =
  | { ok: true; email: string }
  | { ok: false; reason: string };

export type KeyProvider = (issuer: string, kid: string) => Promise<CryptoKey | null>;

/** Tolérance d'horloge (secondes) sur exp / nbf / iat. */
const CLOCK_SKEW = 30;

export async function verifyAccessJwt(
  token: string | null,
  config: AccessConfig,
  getKey: KeyProvider = fetchAccessKey,
  now: number = Math.floor(Date.now() / 1000),
): Promise<AccessResult> {
  if (!token) return { ok: false, reason: 'jeton absent' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    return { ok: false, reason: 'jeton mal formé' };
  }
  const [rawHeader, rawPayload, rawSignature] = parts as [string, string, string];

  const header = decodeJson(rawHeader);
  const payload = decodeJson(rawPayload);
  if (!header || !payload) return { ok: false, reason: 'jeton illisible' };
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, reason: 'algorithme refusé' };

  const key = await getKey(config.issuer, header.kid);
  if (!key) return { ok: false, reason: 'clé inconnue' };
  const signature = base64UrlToBytes(rawSignature);
  const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
  const valid = signature && (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed));
  if (!valid) return { ok: false, reason: 'signature invalide' };

  if (payload.iss !== config.issuer) return { ok: false, reason: 'émetteur inattendu' };
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) return { ok: false, reason: 'audience inattendue' };
  if (payload.type !== undefined && payload.type !== 'app') return { ok: false, reason: 'type de jeton refusé' };
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW < now) return { ok: false, reason: 'jeton expiré' };
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW > now) return { ok: false, reason: 'jeton pas encore valide' };
  if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW > now) return { ok: false, reason: 'jeton daté du futur' };

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || !config.allowedEmails.includes(email)) return { ok: false, reason: 'adresse non autorisée' };
  return { ok: true, email };
}

/* ------------------------------------------------------------------ clés publiques Access */

const KEYS_TTL_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;
const keyCache = new Map<string, { fetchedAt: number; keys: Map<string, CryptoKey> }>();

/** Clés publiques de l'équipe (https://<équipe>.cloudflareaccess.com/cdn-cgi/access/certs), en cache. */
export async function fetchAccessKey(issuer: string, kid: string): Promise<CryptoKey | null> {
  const cached = keyCache.get(issuer);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  // rotation des clés : un kid inconnu provoque un rechargement (au plus une fois par minute)
  if (cached && (age < KEYS_TTL_MS && (cached.keys.has(kid) || age < MIN_REFRESH_MS))) {
    return cached.keys.get(kid) ?? null;
  }
  try {
    const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
    if (!response.ok) return cached?.keys.get(kid) ?? null;
    const body = (await response.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
    const keys = new Map<string, CryptoKey>();
    for (const jwk of body.keys ?? []) {
      if (jwk.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
      const { kty, n, e } = jwk;
      keys.set(
        jwk.kid,
        await crypto.subtle.importKey('jwk', { kty, n, e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']),
      );
    }
    keyCache.set(issuer, { fetchedAt: Date.now(), keys });
    return keys.get(kid) ?? null;
  } catch {
    return cached?.keys.get(kid) ?? null;
  }
}

/* ------------------------------------------------------------------ utilitaires */

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeJson(value: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(value);
  if (!bytes) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
