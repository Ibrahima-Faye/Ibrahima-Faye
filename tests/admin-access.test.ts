import { beforeAll, describe, expect, it } from 'vitest';
import { readAccessConfig, verifyAccessJwt, type AccessConfig, type KeyProvider } from '@/worker/access';
import { handleAdmin } from '@/worker/admin';
import worker from '@/worker';

/** Valeurs FICTIVES de test (aucune vraie équipe, aucune vraie adresse). */
const ENV = {
  CF_ACCESS_TEAM_DOMAIN: 'https://equipe-test.cloudflareaccess.com',
  CF_ACCESS_AUD: 'a'.repeat(64),
  CMS_ALLOWED_EMAILS: 'Admin@Exemple.test',
};
const config = readAccessConfig(ENV) as AccessConfig;
const NOW = 1_800_000_000;

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let getKey: KeyProvider;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encode = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

async function sign(payload: Record<string, unknown>, options: { key?: CryptoKey; header?: Record<string, unknown> } = {}) {
  const head = encode(options.header ?? { alg: 'RS256', kid: 'cle-1', typ: 'JWT' });
  const body = encode(payload);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', options.key ?? signingKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

const claims = (extra: Record<string, unknown> = {}) => ({
  iss: config.issuer,
  aud: [config.audience],
  email: 'admin@exemple.test',
  type: 'app',
  iat: NOW - 60,
  nbf: NOW - 60,
  exp: NOW + 3600,
  ...extra,
});

async function generate() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
}

beforeAll(async () => {
  const pair = await generate();
  signingKey = pair.privateKey;
  otherKey = (await generate()).privateKey;
  getKey = async (issuer, kid) => (issuer === config.issuer && kid === 'cle-1' ? pair.publicKey : null);
});

describe('readAccessConfig', () => {
  it('lit une configuration complète', () => {
    expect(config).toEqual({
      issuer: 'https://equipe-test.cloudflareaccess.com',
      audience: 'a'.repeat(64),
      allowedEmails: ['admin@exemple.test'],
    });
    expect(readAccessConfig({ ...ENV, CF_ACCESS_TEAM_DOMAIN: 'equipe-test.cloudflareaccess.com' })?.issuer).toBe(config.issuer);
  });

  it('ferme l’administration si un réglage manque ou est invalide', () => {
    expect(readAccessConfig({})).toBeNull();
    expect(readAccessConfig({ ...ENV, CF_ACCESS_TEAM_DOMAIN: undefined })).toBeNull();
    expect(readAccessConfig({ ...ENV, CF_ACCESS_TEAM_DOMAIN: 'https://pirate.example.com' })).toBeNull();
    expect(readAccessConfig({ ...ENV, CF_ACCESS_TEAM_DOMAIN: 'https://x.cloudflareaccess.com.pirate.com' })).toBeNull();
    expect(readAccessConfig({ ...ENV, CF_ACCESS_AUD: '' })).toBeNull();
    expect(readAccessConfig({ ...ENV, CMS_ALLOWED_EMAILS: '' })).toBeNull();
    expect(readAccessConfig({ ...ENV, CMS_ALLOWED_EMAILS: ' , ' })).toBeNull();
    expect(readAccessConfig({ ...ENV, CMS_ALLOWED_EMAILS: 'pas-une-adresse' })).toBeNull();
  });
});

describe('verifyAccessJwt', () => {
  const verify = (token: string | null) => verifyAccessJwt(token, config, getKey, NOW);

  it('accepte un jeton valide de l’adresse autorisée', async () => {
    expect(await verify(await sign(claims()))).toEqual({ ok: true, email: 'admin@exemple.test' });
    expect(await verify(await sign(claims({ aud: config.audience, email: 'ADMIN@exemple.test' })))).toMatchObject({ ok: true });
  });

  it.each([
    ['sans jeton', null],
    ['jeton vide', ''],
    ['jeton mal formé', 'abc.def'],
    ['jeton illisible', 'a.b.c'],
  ])('refuse : %s', async (_label, token) => {
    expect((await verify(token)).ok).toBe(false);
  });

  it('refuse une signature d’une autre clé ou falsifiée', async () => {
    expect(await verify(await sign(claims(), { key: otherKey }))).toMatchObject({ ok: false, reason: 'signature invalide' });
    const [h, , s] = (await sign(claims())).split('.');
    const forged = `${h}.${encode(claims({ email: 'intrus@exemple.test' }))}.${s}`;
    expect(await verify(forged)).toMatchObject({ ok: false, reason: 'signature invalide' });
  });

  it('refuse les algorithmes autres que RS256 et les clés inconnues', async () => {
    expect(await verify(await sign(claims(), { header: { alg: 'none', kid: 'cle-1' } }))).toMatchObject({ ok: false });
    expect(await verify(await sign(claims(), { header: { alg: 'HS256', kid: 'cle-1' } }))).toMatchObject({ ok: false });
    expect(await verify(await sign(claims(), { header: { alg: 'RS256', kid: 'autre' } }))).toMatchObject({ reason: 'clé inconnue' });
  });

  it.each([
    ['autre émetteur', { iss: 'https://autre.cloudflareaccess.com' }, 'émetteur inattendu'],
    ['autre application', { aud: ['b'.repeat(64)] }, 'audience inattendue'],
    ['jeton d’organisation', { type: 'org' }, 'type de jeton refusé'],
    ['expiré', { exp: NOW - 120 }, 'jeton expiré'],
    ['sans expiration', { exp: undefined }, 'jeton expiré'],
    ['pas encore valide', { nbf: NOW + 600 }, 'jeton pas encore valide'],
    ['daté du futur', { iat: NOW + 600 }, 'jeton daté du futur'],
    ['adresse non autorisée', { email: 'intrus@exemple.test' }, 'adresse non autorisée'],
    ['jeton de service sans adresse', { email: undefined, common_name: 'service' }, 'adresse non autorisée'],
  ])('refuse : %s', async (_label, extra, reason) => {
    expect(await verify(await sign(claims(extra)))).toEqual({ ok: false, reason });
  });
});

describe('handleAdmin', () => {
  const request = (path: string, token?: string, method = 'GET') =>
    new Request(`https://ibrahimafye.com${path}`, {
      method,
      headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {},
    });
  const liveToken = () => sign(claims({ iat: undefined, nbf: undefined, exp: Math.floor(Date.now() / 1000) + 3600 }));

  it('reste fermée (503) sans configuration', async () => {
    const response = await handleAdmin(request('/admin/', await liveToken()), {}, getKey);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuse (403) sans jeton ou avec un mauvais jeton, sans rien révéler', async () => {
    for (const token of [undefined, 'a.b.c', await sign(claims({ email: 'intrus@exemple.test', exp: NOW * 2 }))]) {
      const response = await handleAdmin(request('/admin/api/session', token), ENV, getKey);
      expect(response.status).toBe(403);
      expect(await response.text()).toBe('Accès refusé.');
    }
  });

  it('refuse avant tout routage, même pour une méthode ou une page inexistante', async () => {
    expect((await handleAdmin(request('/admin/', undefined, 'POST'), ENV, getKey)).status).toBe(403);
    expect((await handleAdmin(request('/admin/nimporte-quoi'), ENV, getKey)).status).toBe(403);
  });

  it('sert la page de contrôle et la session à l’adresse autorisée', async () => {
    const token = await liveToken();
    const page = await handleAdmin(request('/admin/', token), ENV, getKey);
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Type')).toContain('text/html');
    expect(page.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(page.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(await page.text()).toContain('admin@exemple.test');

    const session = await handleAdmin(request('/admin/api/session', token), ENV, getKey);
    expect(await session.json()).toEqual({ email: 'admin@exemple.test' });

    const redirect = await handleAdmin(request('/admin', token), ENV, getKey);
    expect([redirect.status, redirect.headers.get('Location')]).toEqual([308, '/admin/']);
    expect((await handleAdmin(request('/admin/inconnu', token), ENV, getKey)).status).toBe(404);
    expect((await handleAdmin(request('/admin/', token, 'POST'), ENV, getKey)).status).toBe(405);
  });
});

describe('point d’entrée du Worker', () => {
  const assets = { fetch: async (req: Request) => new Response(`fichiers:${new URL(req.url).pathname}`, { status: 404 }) };
  const call = (path: string) => worker.fetch(new Request(`https://ibrahimafye.com${path}`), { ...ENV, ASSETS: assets });

  it('renvoie tout ce qui n’est pas /admin au service de fichiers, sans rien changer', async () => {
    for (const path of ['/', '/n-existe-pas/', '/adminx', '/administration/', '/ADMIN/', '/%61dmin/', '/__cms/api/projects']) {
      expect(await (await call(path)).text()).toBe(`fichiers:${path}`);
    }
  });

  it('protège /admin et /admin/* (403 sans jeton Access)', async () => {
    for (const path of ['/admin', '/admin/', '/admin/api/session', '/admin/x/y']) {
      expect((await call(path)).status).toBe(403);
    }
  });
});
