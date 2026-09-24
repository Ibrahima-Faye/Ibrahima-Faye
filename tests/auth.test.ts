import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from '../integrations/local-cms/password.mjs';
import { COOKIE, createAuth, readEnv } from '../integrations/local-cms/auth.mjs';
import { createApi } from '../integrations/local-cms/api.mjs';

const PASSWORD = 'motdepasse-de-test';
const hash = await hashPassword(PASSWORD);

/** Requête simulée (depuis cette machine). */
function request(method: string, url: string, { cookie = '', body = '' } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []) as Readable & Record<string, unknown>;
  Object.assign(req, {
    method,
    url,
    headers: { host: 'localhost:4321', 'x-cms': '1', cookie, 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
  });
  return req as never;
}

function response() {
  const res = {
    status: 0,
    headers: {} as Record<string, unknown>,
    body: '',
    headersSent: false,
    setHeader(name: string, value: unknown) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status: number, headers: Record<string, unknown> = {}) {
      this.status = status;
      Object.assign(this.headers, headers);
      this.headersSent = true;
    },
    end(body?: string) {
      this.body = body ?? '';
    },
    destroy() {},
  };
  return res;
}

const cookieFrom = (setCookie: string) => setCookie.split(';')[0]!;

describe('mot de passe (empreinte scrypt)', () => {
  it('empreinte vérifiable, jamais le mot de passe en clair', async () => {
    expect(isPasswordHash(hash)).toBe(true);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('autre-mot-de-passe', hash)).toBe(false);
    expect(await verifyPassword(PASSWORD, 'n’importe quoi')).toBe(false);
    await expect(hashPassword('court')).rejects.toThrow();
    expect(await hashPassword(PASSWORD)).not.toBe(hash); // sel aléatoire
  });
});

describe('sessions', () => {
  it('connexion, session valide, déconnexion côté serveur', async () => {
    const auth = createAuth({ passwordHash: hash });
    const bad = await auth.login(request('POST', '/'), 'faux');
    expect(bad).toMatchObject({ ok: false, status: 401 });
    const ok = await auth.login(request('POST', '/'), PASSWORD);
    expect(ok.ok).toBe(true);
    const setCookie = (ok as { cookie: string }).cookie;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    const cookie = cookieFrom(setCookie);
    expect(auth.check(request('GET', '/', { cookie }))).toBe(true);
    expect(auth.check(request('GET', '/', { cookie: `${COOKIE}=inventé` }))).toBe(false);
    auth.logout(request('POST', '/', { cookie }));
    expect(auth.check(request('GET', '/', { cookie }))).toBe(false);
  });

  it('expiration : inactivité et durée maximale', async () => {
    let t = 1_000_000;
    const auth = createAuth({ passwordHash: hash, idleMinutes: 30, sessionHours: 1, now: () => t });
    const ok = (await auth.login(request('POST', '/'), PASSWORD)) as { cookie: string };
    const cookie = cookieFrom(ok.cookie);
    t += 25 * 60_000;
    expect(auth.check(request('GET', '/', { cookie }))).toBe(true); // activité : prolongée
    t += 25 * 60_000;
    expect(auth.check(request('GET', '/', { cookie }))).toBe(true);
    t += 31 * 60_000;
    expect(auth.check(request('GET', '/', { cookie }))).toBe(false); // inactif trop longtemps
    const again = (await auth.login(request('POST', '/'), PASSWORD)) as { cookie: string };
    for (let i = 0; i < 4; i++) {
      t += 20 * 60_000;
      auth.check(request('GET', '/', { cookie: cookieFrom(again.cookie) }));
    }
    expect(auth.check(request('GET', '/', { cookie: cookieFrom(again.cookie) }))).toBe(false); // > 1 h
  });

  it('trop d’essais : pause', async () => {
    const auth = createAuth({ passwordHash: hash });
    for (let i = 0; i < 5; i++) await auth.login(request('POST', '/'), 'faux');
    expect(await auth.login(request('POST', '/'), PASSWORD)).toMatchObject({
      ok: false,
      status: 429,
    });
  });

  it('sans mot de passe configuré : fermé ; CMS_AUTH=off : ouvert', async () => {
    const closed = createAuth({});
    expect(closed.check(request('GET', '/'))).toBe(false);
    expect(await closed.login(request('POST', '/'), PASSWORD)).toMatchObject({
      ok: false,
      status: 503,
    });
    expect(createAuth({ disabled: true }).check(request('GET', '/'))).toBe(true);
  });

  it('configuration lue dans .env sans toucher process.env', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'auth-'));
    await writeFile(path.join(root, '.env'), `CMS_ADMIN_PASSWORD_HASH=${hash}\nAUTRE=1\n`);
    expect(readEnv(root).CMS_ADMIN_PASSWORD_HASH).toBe(hash);
    expect(process.env.CMS_ADMIN_PASSWORD_HASH).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });
});

describe('API /__cms protégée', () => {
  const store = { ready: async () => {}, listProjects: async () => [] };
  const settings = { all: async () => ({}) };

  it('toutes les routes (lecture, écriture, fichiers) exigent une session', async () => {
    const auth = createAuth({ passwordHash: hash });
    const api = createApi(store, settings, auth);
    for (const [method, url] of [
      ['GET', '/api/projects'],
      ['POST', '/api/projects'],
      ['PUT', '/api/settings/theme'],
      ['GET', '/api/settings'],
      ['GET', '/file/wonderpark/sed4.png'],
      ['GET', '/thumb/wonderpark/sed4.png'],
      ['DELETE', '/api/projects/wonderpark'],
    ]) {
      const res = response();
      await api(request(method, url), res as never);
      expect(res.status, `${method} ${url}`).toBe(401);
      expect(JSON.parse(res.body).code).toBe('auth');
    }
  });

  it('connexion par l’API → cookie → accès ; déconnexion → refus', async () => {
    const auth = createAuth({ passwordHash: hash });
    const api = createApi(store, settings, auth);
    const status = response();
    await api(request('GET', '/auth/session'), status as never);
    expect(JSON.parse(status.body)).toMatchObject({
      enabled: true,
      configured: true,
      authenticated: false,
    });

    const login = response();
    await api(
      request('POST', '/auth/login', { body: JSON.stringify({ password: PASSWORD }) }),
      login as never,
    );
    expect(login.status).toBe(200);
    const cookie = cookieFrom(String(login.headers['set-cookie']));

    const list = response();
    await api(request('GET', '/api/projects', { cookie }), list as never);
    expect(list.status).toBe(200);

    await api(request('POST', '/auth/logout', { cookie }), response() as never);
    const after = response();
    await api(request('GET', '/api/projects', { cookie }), after as never);
    expect(after.status).toBe(401);
  });
});
