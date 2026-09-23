/**
 * Réglages centralisés du site (Studio, Contenu du site) : src/settings/{theme,layout,navigation,animations,content}.json
 *
 *  - validés par les MÊMES schémas que le site (src/schemas/settings.ts, chargé par Vite) ;
 *  - un enregistrement sans changement n'écrit rien ;
 *  - la version précédente est copiée dans .cms/historique/reglages/ (au plus une copie toutes les 2 min,
 *    toujours quand on écrase une version modifiée ailleurs) ;
 *  - conflit (fichier modifié ailleurs depuis l'ouverture) → 409, sauf `force`.
 *
 * Identité (logo, favicon) : images déposées dans public/identite/ (SVG nettoyé).
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { HttpError } from './http.mjs';

const NAMES = ['theme', 'layout', 'navigation', 'animations', 'content'];
const HISTORY_EVERY_MS = 2 * 60 * 1000;
const IDENTITY_TYPES = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
};
const IDENTITY_MAX = 2 * 1024 * 1024;

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** SVG sans script, gestionnaires d'événements, ni contenu externe. */
function sanitizeSvg(text) {
  return text
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#|data:image\/)[^"]*"|'(?!#|data:image\/)[^']*')/gi, '');
}

/**
 * @param {string} root racine du projet
 * @param {{ load: (id: string) => Promise<any> }} options
 */
export function createSettings(root, { load }) {
  const dir = path.join(root, 'src/settings');
  const historyDir = path.join(root, '.cms/historique/reglages');
  const identityDir = path.join(root, 'public/identite');

  function assertName(name) {
    if (!NAMES.includes(name)) throw new HttpError(404, 'Réglage inconnu.');
    return name;
  }

  async function read(name) {
    const file = path.join(dir, `${assertName(name)}.json`);
    if (!existsSync(file)) return { name, data: { version: 1 }, updatedAt: 0 };
    const text = await readFile(file, 'utf8');
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new HttpError(500, `src/settings/${name}.json n’est pas un JSON valide.`);
    }
    return { name, data, updatedAt: Math.round((await stat(file)).mtimeMs) };
  }

  async function all() {
    const out = {};
    for (const name of NAMES) out[name] = await read(name);
    return out;
  }

  async function keepHistory(name, file, always) {
    await mkdir(historyDir, { recursive: true });
    const latest = (await readdir(historyDir))
      .filter((n) => n.startsWith(`${name}-`))
      .sort()
      .at(-1);
    if (
      !always &&
      latest &&
      Date.now() - (await stat(path.join(historyDir, latest))).mtimeMs < HISTORY_EVERY_MS
    )
      return;
    await writeFile(path.join(historyDir, `${name}-${stamp()}.json`), await readFile(file));
  }

  /**
   * @param {string} name
   * @param {{ data?: unknown; baseUpdatedAt?: number; force?: boolean; snapshot?: boolean }} [input]
   * `snapshot` : copie systématique de la version précédente (enregistrement manuel du Contenu du site).
   */
  async function save(name, { data, baseUpdatedAt, force = false, snapshot = false } = {}) {
    assertName(name);
    const { SETTINGS_SCHEMAS } = await load('/src/schemas/settings.ts');
    const parsed = SETTINGS_SCHEMAS[name].safeParse(data ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new HttpError(
        400,
        `Réglage invalide (${issue?.path?.join('.') || name}) : ${issue?.message}`,
      );
    }
    const next = { version: 1, ...parsed.data };
    const file = path.join(dir, `${name}.json`);
    const current = await read(name);
    if (isDeepStrictEqual(current.data, next))
      return { name, updatedAt: current.updatedAt, unchanged: true };
    if (existsSync(file)) {
      const modifiedElsewhere = baseUpdatedAt !== undefined && current.updatedAt !== baseUpdatedAt;
      if (modifiedElsewhere && !force)
        throw new HttpError(409, 'Ces réglages ont été modifiés ailleurs depuis leur ouverture.');
      await keepHistory(name, file, modifiedElsewhere || snapshot);
    }
    await mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.${name}.${randomBytes(4).toString('hex')}`);
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(tmp, file);
    return { name, updatedAt: Math.round((await stat(file)).mtimeMs) };
  }

  /** Versions précédentes gardées dans l'historique (plus récentes d'abord). */
  async function history(name) {
    assertName(name);
    if (!existsSync(historyDir)) return [];
    const files = (await readdir(historyDir)).filter(
      (n) => n.startsWith(`${name}-`) && n.endsWith('.json'),
    );
    const out = [];
    for (const id of files.sort().reverse().slice(0, 40)) {
      out.push({ id, savedAt: Math.round((await stat(path.join(historyDir, id))).mtimeMs) });
    }
    return out;
  }

  async function readHistory(name, id) {
    assertName(name);
    const valid =
      typeof id === 'string' && id.startsWith(`${name}-`) && /^[a-z]+-[0-9TZ-]+\.json$/.test(id);
    if (!valid) throw new HttpError(400, 'Version inconnue.');
    const file = path.join(historyDir, id);
    if (!existsSync(file)) throw new HttpError(404, 'Version introuvable.');
    return { id, data: JSON.parse(await readFile(file, 'utf8')) };
  }

  /** Image d'identité (logo, favicon…) → public/identite/<nom>. Renvoie son adresse publique. */
  async function saveIdentity(req, name) {
    const clean = String(name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const ext = path.extname(clean).slice(1);
    if (!clean || !IDENTITY_TYPES[ext])
      throw new HttpError(400, 'Formats acceptés : SVG, PNG, WebP, JPG, ICO.');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > IDENTITY_MAX) throw new HttpError(413, 'Image trop lourde (2 Mo au plus).');
      chunks.push(chunk);
    }
    let body = Buffer.concat(chunks);
    if (ext === 'svg') body = Buffer.from(sanitizeSvg(body.toString('utf8')), 'utf8');
    await mkdir(identityDir, { recursive: true });
    const base = clean.slice(0, clean.length - ext.length - 1) || 'image';
    let target = `${base}.${ext}`;
    // jamais d'écrasement : une nouvelle version reçoit un nouveau nom
    for (let i = 2; existsSync(path.join(identityDir, target)); i++) target = `${base}-${i}.${ext}`;
    await writeFile(path.join(identityDir, target), body);
    return { path: `/identite/${target}` };
  }

  return { names: NAMES, read, all, save, history, readHistory, saveIdentity };
}
