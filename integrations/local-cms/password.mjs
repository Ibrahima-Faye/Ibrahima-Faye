/**
 * Mot de passe de l'administration : seule son EMPREINTE scrypt est conservée (variable d'environnement
 * CMS_ADMIN_PASSWORD_HASH, dans .env — ignoré par git). Le mot de passe lui-même n'est écrit nulle part.
 *
 * Format : scrypt:<N>:<r>:<p>:<sel base64>:<empreinte base64>
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 128 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 10;

/** @param {string} password */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH)
    throw new Error(`Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères au moins).`);
  const salt = randomBytes(16);
  const key = /** @type {Buffer} */ (
    await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM })
  );
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64')}:${key.toString('base64')}`;
}

/** Vérification en temps constant. `false` pour une empreinte mal formée. */
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.trim().split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0) || n > 2 ** 20) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (!salt.length || expected.length < 32) return false;
  const key = /** @type {Buffer} */ (
    await scrypt(password.slice(0, 1024), salt, expected.length, { N: n, r, p, maxmem: MAXMEM })
  );
  return timingSafeEqual(key, expected);
}

/** Empreinte bien formée (sans la vérifier). */
export function isPasswordHash(value) {
  return (
    typeof value === 'string' &&
    /^scrypt:\d+:\d+:\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(value.trim())
  );
}
