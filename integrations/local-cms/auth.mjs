/**
 * Authentification de l'administration (/admin et API /__cms).
 *
 * Configuration (variables d'environnement, fichier .env à la racine — ignoré par git) :
 *   CMS_ADMIN_PASSWORD_HASH   empreinte scrypt du mot de passe (créée par `npm run admin:mot-de-passe`)
 *   CMS_SESSION_HOURS         durée maximale d'une session (défaut 12 h)
 *   CMS_SESSION_IDLE_MINUTES  déconnexion après inactivité (défaut 120 min)
 *   CMS_AUTH=off              désactive la protection (déconseillé ; l'administration reste réservée à cette machine)
 *
 * Protection active par défaut : sans mot de passe configuré, l'administration reste fermée
 * (la page de connexion explique comment en créer un).
 *
 * Sessions : identifiant aléatoire (256 bits) dans un cookie HttpOnly, SameSite=Strict ; le serveur ne garde
 * que son empreinte SHA-256, en mémoire. Déconnexion = session supprimée côté serveur. Un redémarrage du
 * serveur de développement ferme toutes les sessions.
 *
 * Architecture évolutive : `createAuth` expose une interface unique (status / check / login / logout)
 * derrière laquelle un autre fournisseur (comptes multiples, OAuth…) pourra être branché.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { isPasswordHash, verifyPassword } from './password.mjs';

export const COOKIE = 'cms_session';

/**
 * Variables .env / .env.local (sans modifier process.env) ; process.env reste prioritaire.
 * @param {string} root
 * @returns {Record<string, string | undefined>}
 */
export function readEnv(root) {
  /** @type {Record<string, string | undefined>} */
  const env = {};
  for (const name of ['.env', '.env.local']) {
    const file = path.join(root, name);
    if (existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, 'utf8')));
  }
  return {
    ...env,
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('CMS_'))),
  };
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const digest = (token) => createHash('sha256').update(token).digest('hex');

/**
 * @param {{ passwordHash?: string; disabled?: boolean; sessionHours?: number; idleMinutes?: number; now?: () => number }} options
 */
export function createAuth(options = {}) {
  const now = options.now ?? Date.now;
  const disabled = options.disabled === true;
  const passwordHash = isPasswordHash(options.passwordHash) ? options.passwordHash.trim() : '';
  const maxAge = Math.max(0.25, options.sessionHours ?? 12) * 3600_000;
  const idle = Math.max(5, options.idleMinutes ?? 120) * 60_000;
  /** empreinte → { created, seen } */
  const sessions = new Map();
  /** limitation des essais : ip → { count, until } */
  const attempts = new Map();

  const configured = Boolean(passwordHash);
  const enabled = !disabled;

  function sessionOf(req) {
    const token = cookies(req)[COOKIE];
    if (!token || token.length > 200) return null;
    const key = digest(token);
    const session = sessions.get(key);
    if (!session) return null;
    const t = now();
    if (t - session.created > maxAge || t - session.seen > idle) {
      sessions.delete(key);
      return null;
    }
    return { key, session };
  }

  const cookieHeader = (value, seconds) =>
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;

  return {
    enabled,
    configured,

    /** Session valide (l'activité la prolonge, dans la limite de la durée maximale). */
    check(req) {
      if (!enabled) return true;
      const found = sessionOf(req);
      if (!found) return false;
      found.session.seen = now();
      return true;
    },

    status(req) {
      const found = enabled ? sessionOf(req) : null;
      return {
        enabled,
        configured,
        authenticated: !enabled || Boolean(found),
        expiresAt: found
          ? Math.min(found.session.created + maxAge, found.session.seen + idle)
          : null,
      };
    },

    /** @returns {Promise<{ ok: true, cookie: string } | { ok: false, status: number, error: string }>} */
    async login(req, password) {
      if (!enabled)
        return { ok: false, status: 400, error: 'Authentification désactivée (CMS_AUTH=off).' };
      if (!configured)
        return {
          ok: false,
          status: 503,
          error: 'Aucun mot de passe configuré : lancer « npm run admin:mot-de-passe ».',
        };
      const ip = req.socket.remoteAddress ?? '?';
      const record = attempts.get(ip) ?? { count: 0, until: 0 };
      if (record.until > now()) {
        const wait = Math.ceil((record.until - now()) / 1000);
        return { ok: false, status: 429, error: `Trop d’essais. Réessaie dans ${wait} s.` };
      }
      const valid = await verifyPassword(String(password ?? ''), passwordHash);
      if (!valid) {
        record.count += 1;
        // 5 erreurs → pause d'une minute, puis de plus en plus longue
        if (record.count >= 5) record.until = now() + 60_000 * 2 ** Math.min(4, record.count - 5);
        attempts.set(ip, record);
        return { ok: false, status: 401, error: 'Mot de passe incorrect.' };
      }
      attempts.delete(ip);
      const token = randomBytes(32).toString('base64url');
      const t = now();
      sessions.set(digest(token), { created: t, seen: t });
      return { ok: true, cookie: cookieHeader(token, Math.round(maxAge / 1000)) };
    },

    logout(req) {
      const found = sessionOf(req);
      if (found) sessions.delete(found.key);
      return cookieHeader('', 0);
    },
  };
}

/** Configuration lue dans l'environnement. */
export function authFromEnv(root) {
  const env = readEnv(root);
  return createAuth({
    passwordHash: env.CMS_ADMIN_PASSWORD_HASH,
    disabled: String(env.CMS_AUTH ?? '').toLowerCase() === 'off',
    sessionHours: env.CMS_SESSION_HOURS ? Number(env.CMS_SESSION_HOURS) : undefined,
    idleMinutes: env.CMS_SESSION_IDLE_MINUTES ? Number(env.CMS_SESSION_IDLE_MINUTES) : undefined,
  });
}
