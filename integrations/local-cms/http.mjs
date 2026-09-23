/**
 * Utilitaires HTTP de l'administration locale.
 * ⚠️ Tout ce code ne tourne QUE dans `astro dev` (voir index.mjs) : jamais dans le site publié.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

export class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Protège l'API : uniquement depuis cette machine, uniquement vers localhost,
 * et — pour toute modification — uniquement depuis l'interface /admin elle-même
 * (en-tête personnalisé : un autre site web ne peut pas l'envoyer sans autorisation).
 */
export function guard(req, { mutating }) {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) {
    throw new HttpError(403, 'Administration réservée à cette machine.');
  }
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(host)) throw new HttpError(403, 'Adresse non autorisée.');
  if (mutating) {
    if (req.headers['x-cms'] !== '1') throw new HttpError(403, 'Requête non autorisée.');
    const origin = req.headers.origin;
    if (origin) {
      const originHost = new URL(origin).host;
      if (originHost !== req.headers.host) throw new HttpError(403, 'Origine non autorisée.');
    }
  }
}

export async function readJson(req, limit = 5 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Requête trop volumineuse.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'JSON invalide.');
  }
}

/** Envoie un fichier avec prise en charge des « Range » (indispensable pour lire / avancer dans une vidéo). */
export async function serveFile(req, res, file, mime, extraHeaders = {}) {
  const info = await stat(file);
  const total = info.size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  const headers = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=0, must-revalidate',
    ...extraHeaders,
  };

  let start = 0;
  let end = total - 1;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), total - 1);
    } else {
      start = Math.max(0, total - Number(range[2])); // « bytes=-500 » : les 500 derniers octets
    }
    if (start > end || start >= total) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      return res.end();
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': end - start + 1,
    });
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': total });
  }

  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file, { start, end });
  res.on('close', () => stream.destroy());
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
