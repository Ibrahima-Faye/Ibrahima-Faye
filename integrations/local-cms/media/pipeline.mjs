/**
 * Pipeline médias — versions web des médias d'un projet, SANS jamais toucher à l'original.
 *
 *   src/content/projects/<projet>/
 *   ├── s7.png                 ORIGINAL (lu seulement ; exclu de git)
 *   ├── img-5685.mp4           ORIGINAL
 *   ├── media.json             manifeste : pour chaque original → ses versions web, dimensions, statut
 *   └── _web/                  versions web (générées, versionnées)
 *       ├── s7.png/image.jpg   image maîtresse ≤ 3840 px (le site en tire AVIF / WebP / tailles responsive)
 *       ├── s7.png/thumb.webp  miniature (médiathèque)
 *       └── img-5685.mp4/      video.mp4 (H.264, ≤ 1920 px) · mobile.mp4 (≤ 1280 px) · poster.jpg · thumb.webp
 *           └── distant/       versions web de plus de 25 Mio : HORS git et hors build, prévues pour un
 *                              stockage externe (Cloudflare R2…) — media.json : storage[clé] = 'remote'
 *
 * Formats : JPG, JPEG, PNG, WebP, AVIF, GIF (animé → vidéo en boucle), SVG (nettoyé), HEIC/HEIF (libheif),
 *           MP4, WebM, MOV, M4V (FFmpeg : remux sans perte si déjà compatible, sinon H.264 ; HDR → SDR).
 * Aucun recadrage : les redimensionnements gardent toujours le ratio (fit « inside »).
 *
 * Utilisé par l'administration (tâches de fond, integrations/local-cms/media/jobs.mjs)
 * et en ligne de commande (npm run medias).
 */
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename as fsRename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { ffmpegTools, probe, runFfmpeg } from './tools.mjs';

const require = createRequire(import.meta.url);

export const WEB_DIR = '_web';
export const MANIFEST = 'media.json';
/** À augmenter quand les réglages changent : tout est régénéré au prochain passage. */
export const PIPELINE_VERSION = 1;

const IMAGE_MAX = 3840; // version haute résolution (visionneuse, écrans 4K)
const THUMB_MAX = 480;
const VIDEO_MAX = 1920; // grand côté de la vidéo web principale
const MOBILE_MAX = 1280; // grand côté de la version mobile
const POSTER_MAX = 1920;
const COPY_MAX_BITRATE = 5_000_000; // au-delà, un fichier déjà H.264 est ré-encodé (plus léger)
/**
 * Stockage des versions web : au-delà de 25 Mio (limite par fichier de Cloudflare Pages, la plus stricte
 * des hébergeurs visés), une version web n'est ni versionnée ni publiée avec le site : elle est rangée
 * dans `_web/<original>/distant/` (exclu de git et du build) et marquée « remote » dans media.json,
 * prête à être envoyée vers un stockage externe (Cloudflare R2…). Aucune compression supplémentaire.
 */
export const LOCAL_MAX_BYTES = 25 * 1024 * 1024;
export const REMOTE_DIR = 'distant';

/* ------------------------------------------------------------------ formats (même source que le site) */
const FORMATS = JSON.parse(
  readFileSync(new URL('../../../src/schemas/media-formats.json', import.meta.url), 'utf8'),
);
const byExt = new Map(FORMATS.map((f) => [f.ext, f]));
export function formatOf(name) {
  const ext = path.extname(name).slice(1);
  if (!ext || (ext !== ext.toLowerCase() && ext !== ext.toUpperCase())) return undefined;
  return byExt.get(ext.toLowerCase());
}
const baseLower = (name) => name.slice(0, name.length - path.extname(name).length).toLowerCase();

/* ------------------------------------------------------------------ manifeste */
export async function readManifest(dir) {
  try {
    const data = JSON.parse(await readFile(path.join(dir, MANIFEST), 'utf8'));
    return { version: 1, items: {}, ...data };
  } catch {
    return { version: 1, items: {} };
  }
}

/** Écriture atomique (fichier temporaire puis renommage), clés triées : diff git lisible. */
export async function writeManifest(dir, manifest) {
  const items = Object.fromEntries(
    Object.keys(manifest.items)
      .sort()
      .map((k) => [k, manifest.items[k]]),
  );
  const tmp = path.join(dir, `.${MANIFEST}.${randomBytes(4).toString('hex')}`);
  await writeFile(tmp, `${JSON.stringify({ version: 1, items }, null, 2)}\n`, 'utf8');
  await rename(tmp, path.join(dir, MANIFEST));
}

/* ------------------------------------------------------------------ utilitaires */

/**
 * Renommage tolérant sous Windows : un antivirus, l'indexeur ou l'observateur de fichiers
 * peut tenir un dossier fraîchement écrit quelques instants (EPERM / EBUSY / EACCES).
 */
async function rename(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fsRename(from, to);
    } catch (error) {
      if (attempt >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(error?.code)) throw error;
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
}
function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

const rel = (...parts) => [WEB_DIR, ...parts].join('/');
const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const ratioOf = (w, h) => (w && h ? Number((w / h).toFixed(4)) : undefined);

/** Taille « dans » un carré max×max, jamais agrandie : le ratio ne change pas. */
function fitInside(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Chemin d'une version web à l'intérieur de son dossier `_web/<original>/`. */
const inFolder = (output) => output.split('/').slice(2).join('/');

/**
 * Range chaque version web selon son poids : à la racine de `_web/<original>/` (locale : versionnée,
 * publiée avec le site) ou dans `distant/` (plus de 25 Mio). `folder` = dossier des versions de cet original.
 */
async function placeOutputs(folder, name, outputs) {
  const next = {};
  const sizes = {};
  const storage = {};
  for (const [key, output] of Object.entries(outputs)) {
    const current = path.join(folder, inFolder(output));
    const size = (await stat(current)).size;
    const remote = size > LOCAL_MAX_BYTES;
    const base = path.posix.basename(output);
    const wanted = remote ? path.join(folder, REMOTE_DIR, base) : path.join(folder, base);
    if (path.resolve(current) !== path.resolve(wanted)) {
      await mkdir(path.dirname(wanted), { recursive: true });
      await rename(current, wanted);
    }
    next[key] = remote ? rel(name, REMOTE_DIR, base) : rel(name, base);
    sizes[key] = size;
    storage[key] = remote ? 'remote' : 'local';
  }
  return { outputs: next, sizes, storage };
}

/**
 * Entrées produites avant l'apparition du champ `storage` : rangement local / distant appliqué
 * aux fichiers existants (simple déplacement, rien n'est ré-encodé). Renvoie vrai si le manifeste a changé.
 */
export async function migrateStorage(dir, manifest) {
  let changed = false;
  for (const [name, entry] of Object.entries(manifest.items)) {
    if (entry.status !== 'ok' || entry.storage || !entry.outputs) continue;
    const folder = path.join(dir, WEB_DIR, name);
    if (!Object.values(entry.outputs).every((o) => existsSync(path.join(folder, inFolder(o))))) continue;
    Object.assign(entry, await placeOutputs(folder, name, entry.outputs));
    changed = true;
  }
  return changed;
}

/* ------------------------------------------------------------------ images */
/** Vrai si au moins un pixel n'est pas totalement opaque. */
async function hasRealAlpha(input) {
  const { data, info } = await sharp(input.buffer ?? input.file, input.options)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < info.width * info.height; i++) if (data[i] < 255) return true;
  return false;
}

/**
 * Image maîtresse (≤ 3840 px, ratio conservé) + miniature. Métadonnées retirées des versions web
 * (position GPS…) : elles restent dans l'original.
 */
async function imageOutputs(input, tmpDir, name) {
  const src = () => sharp(input.buffer ?? input.file, { failOn: 'none', limitInputPixels: false, ...input.options });
  const meta = await src().metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  const alpha = meta.hasAlpha ? await hasRealAlpha(input) : false;

  const master = src().rotate().resize({ width: IMAGE_MAX, height: IMAGE_MAX, fit: 'inside', withoutEnlargement: true });
  const image = alpha ? 'image.webp' : 'image.jpg';
  if (alpha) await master.webp({ quality: 92, alphaQuality: 100, effort: 5 }).toFile(path.join(tmpDir, image));
  else
    await master
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toFile(path.join(tmpDir, image));
  await src()
    .rotate()
    .resize({ width: THUMB_MAX, height: THUMB_MAX * 2, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(tmpDir, 'thumb.webp'));

  const out = fitInside(width, height, IMAGE_MAX);
  return {
    kind: 'image',
    width: out.width,
    height: out.height,
    ratio: ratioOf(width, height),
    source: { width, height, format: meta.format, alpha },
    outputs: { image: rel(name, image), thumb: rel(name, 'thumb.webp') },
  };
}

/** HEIC / HEIF : décodage par libheif (WebAssembly), image principale, rotations appliquées. */
async function decodeHeic(file) {
  const libheif = require('libheif-js/wasm-bundle');
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(await readFile(file));
  if (!images?.length) throw new Error('HEIC illisible (aucune image trouvée).');
  const primary = images.find((i) => i.is_primary?.()) ?? images[0];
  const width = primary.get_width();
  const height = primary.get_height();
  const data = await new Promise((resolve, reject) =>
    primary.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (d) =>
      d ? resolve(d.data) : reject(new Error('HEIC : décodage impossible.')),
    ),
  );
  images.forEach((i) => i.free?.());
  return { buffer: Buffer.from(data.buffer), options: { raw: { width, height, channels: 4 } } };
}

/** SVG : copie nettoyée (scripts, gestionnaires d'événements, liens externes retirés). */
function sanitizeSvg(text) {
  return text
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#|data:image\/)[^"]*"|'(?!#|data:image\/)[^']*')/gi, '');
}

async function svgOutputs(file, tmpDir, name) {
  const clean = sanitizeSvg(await readFile(file, 'utf8'));
  await writeFile(path.join(tmpDir, 'image.svg'), clean, 'utf8');
  const meta = await sharp(Buffer.from(clean), { density: 144 }).metadata();
  await sharp(Buffer.from(clean), { density: 144 })
    .resize({ width: THUMB_MAX, height: THUMB_MAX * 2, fit: 'inside' })
    .webp({ quality: 80 })
    .toFile(path.join(tmpDir, 'thumb.webp'));
  // dimensions « naturelles » du dessin (densité 72) : seules le ratio compte pour la mise en page
  const width = Math.round((meta.width ?? 0) / 2);
  const height = Math.round((meta.height ?? 0) / 2);
  return {
    kind: 'image',
    vector: true,
    width,
    height,
    ratio: ratioOf(width, height),
    source: { width, height, format: 'svg', sanitized: true },
    outputs: { image: rel(name, 'image.svg'), thumb: rel(name, 'thumb.webp') },
  };
}

/* ------------------------------------------------------------------ vidéos */
const EVEN_SCALE = (max) =>
  `scale='if(gte(iw,ih),min(${max},trunc(iw/2)*2),-2)':'if(gte(iw,ih),-2,min(${max},trunc(ih/2)*2))'`;
const HDR_TO_SDR =
  'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

function describeVideo(info) {
  const v = info.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error('Aucune piste vidéo.');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const rotation = Number(
    v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0,
  );
  const swap = Math.abs(rotation) % 180 === 90;
  const [num, den] = String(v.avg_frame_rate || v.r_frame_rate || '30/1').split('/').map(Number);
  return {
    codec: v.codec_name,
    pixFmt: v.pix_fmt,
    width: swap ? v.height : v.width,
    height: swap ? v.width : v.height,
    rotation,
    fps: den ? num / den : num,
    duration: Number(info.format.duration) || Number(v.duration) || 0,
    bitrate: Number(v.bit_rate || info.format.bit_rate) || 0,
    hdr: ['smpte2084', 'arib-std-b67'].includes(v.color_transfer),
    audio: a ? a.codec_name : null,
  };
}

/** `maxrate` en kbit/s. */
function h264Args(input, output, d, { max, crf, maxrate }) {
  const filters = [d.hdr ? HDR_TO_SDR : null, EVEN_SCALE(max), d.fps > 31 ? 'fps=30' : null]
    .filter(Boolean)
    .join(',');
  return [
    '-i', input,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', filters,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf),
    '-maxrate', `${maxrate}k`, '-bufsize', `${maxrate * 2}k`,
    '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-movflags', '+faststart',
    output,
  ];
}

async function videoOutputs(file, tmpDir, name, { posterFile, onProgress, animated }) {
  const d = describeVideo(await probe(file));
  const longEdge = Math.max(d.width, d.height);
  const canCopy =
    !animated &&
    d.codec === 'h264' &&
    d.pixFmt === 'yuv420p' &&
    longEdge <= VIDEO_MAX &&
    d.fps <= 31 &&
    d.bitrate <= COPY_MAX_BITRATE &&
    !d.hdr &&
    (!d.audio || d.audio === 'aac');
  const video = path.join(tmpDir, 'video.mp4');
  const needsMobile = !animated && longEdge > MOBILE_MAX;
  const share = needsMobile ? 0.8 : 0.95;

  if (canCopy) {
    // déjà compatible web : copie sans perte des pistes, index en tête (lecture immédiate)
    await runFfmpeg(['-i', file, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', video], {
      duration: d.duration,
      onProgress: (r) => onProgress?.(r * share),
    });
  } else {
    await runFfmpeg(
      animated
        ? ['-i', file, '-vf', EVEN_SCALE(VIDEO_MAX), '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', video]
        : h264Args(file, video, d, { max: VIDEO_MAX, crf: 23, maxrate: 5000 }),
      { duration: d.duration, onProgress: (r) => onProgress?.(r * share) },
    );
  }
  const outputs = { video: rel(name, 'video.mp4') };

  if (needsMobile) {
    await runFfmpeg(h264Args(file, path.join(tmpDir, 'mobile.mp4'), d, { max: MOBILE_MAX, crf: 26, maxrate: 2500 }), {
      duration: d.duration,
      onProgress: (r) => onProgress?.(share + r * 0.15),
    });
    outputs.mobile = rel(name, 'mobile.mp4');
  }

  // affiche : l'image du même nom si elle existe (choix de l'utilisateur), sinon une image à 10 % de la durée
  const poster = path.join(tmpDir, 'poster.jpg');
  if (posterFile) {
    await sharp(posterFile.buffer ?? posterFile.file, { failOn: 'none', limitInputPixels: false, ...posterFile.options })
      .rotate()
      .resize({ width: POSTER_MAX, height: POSTER_MAX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#000000' })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(poster);
  } else {
    const at = Math.min(1, (d.duration || 1) * 0.1);
    await runFfmpeg(['-ss', String(at), '-i', video, '-frames:v', '1', '-vf', EVEN_SCALE(POSTER_MAX), '-q:v', '3', poster]);
  }
  await sharp(poster)
    .resize({ width: THUMB_MAX, height: THUMB_MAX * 2, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(tmpDir, 'thumb.webp'));
  outputs.poster = rel(name, 'poster.jpg');
  outputs.thumb = rel(name, 'thumb.webp');

  // dimensions de la vidéo web (et non de l'affiche, qui peut venir d'une image plus grande)
  const scale = canCopy ? 1 : Math.min(1, VIDEO_MAX / longEdge);
  onProgress?.(1);
  return {
    kind: 'video',
    ...(animated ? { animated: true, loop: true, muted: true } : {}),
    width: canCopy ? d.width : even(d.width * scale),
    height: canCopy ? d.height : even(d.height * scale),
    ratio: ratioOf(d.width, d.height),
    duration: Number(d.duration.toFixed(2)),
    audio: !animated && Boolean(d.audio),
    transcode: canCopy ? 'copie (déjà compatible)' : 'H.264',
    source: {
      width: d.width,
      height: d.height,
      codec: d.codec,
      fps: Number(d.fps.toFixed(2)),
      bitrate: d.bitrate,
      hdr: d.hdr,
      rotation: d.rotation,
    },
    outputs,
  };
}

/* ------------------------------------------------------------------ un fichier */
/**
 * Produit les versions web d'UN original. Écrit d'abord dans un dossier temporaire, puis remplace
 * les anciennes versions web d'un coup (jamais de version à moitié écrite). L'original n'est que lu.
 */
export async function processFile(dir, name, { posterName, onProgress } = {}) {
  const format = formatOf(name);
  if (!format) throw new Error(`Format non pris en charge : ${name}`);
  const file = path.join(dir, name);
  const st = await stat(file);
  const webRoot = path.join(dir, WEB_DIR);
  const tmpDir = path.join(webRoot, `.tmp-${randomBytes(4).toString('hex')}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    let result;
    const ext = format.ext;
    if (ext === 'svg') result = await svgOutputs(file, tmpDir, name);
    else if (ext === 'heic' || ext === 'heif') result = await imageOutputs(await decodeHeic(file), tmpDir, name);
    else if (ext === 'gif') {
      const pages = (await sharp(file, { failOn: 'none' }).metadata()).pages ?? 1;
      result =
        pages > 1
          ? await videoOutputs(file, tmpDir, name, {
              animated: true,
              posterFile: { file, options: { pages: 1 } },
              onProgress,
            })
          : await imageOutputs({ file }, tmpDir, name);
    } else if (format.kind === 'image') result = await imageOutputs({ file }, tmpDir, name);
    else {
      let posterFile;
      if (posterName) {
        const p = path.join(dir, posterName);
        const pf = formatOf(posterName);
        posterFile = pf?.ext === 'heic' || pf?.ext === 'heif' ? await decodeHeic(p) : { file: p };
      }
      result = await videoOutputs(file, tmpDir, name, { posterFile, onProgress });
    }

    const placed = await placeOutputs(tmpDir, name, result.outputs);
    const target = path.join(webRoot, name);
    await rm(target, { recursive: true, force: true }); // anciennes versions WEB (générées) seulement
    await rename(tmpDir, target);
    const tools = format.kind === 'video' || ext === 'gif' ? await ffmpegTools() : null;
    return {
      status: 'ok',
      pipeline: PIPELINE_VERSION,
      format: format.label,
      ...result,
      source: {
        ...result.source,
        size: st.size,
        mtime: Math.round(st.mtimeMs),
        sha256: await sha256(file),
        ...(posterName ? { poster: posterName } : {}),
      },
      ...placed, // outputs (chemins), sizes (octets), storage (local | remote)
      generator: tools ? `sharp ${sharp.versions.sharp} · FFmpeg ${tools.version}` : `sharp ${sharp.versions.sharp}`,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await rm(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

/* ------------------------------------------------------------------ un projet */
/** Originaux pris en charge d'un dossier de projet (hors _web, manifeste, fichiers cachés). */
export async function listOriginals(dir) {
  return (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isFile() && !e.name.startsWith('.') && formatOf(e.name))
    .map((e) => e.name);
}

/** Affiche choisie pour chaque vidéo : image du même nom (même règle que le site). */
function posters(names) {
  const images = new Map(
    names.filter((n) => formatOf(n)?.kind === 'image').map((n) => [baseLower(n), n]),
  );
  return new Map(
    names
      .filter((n) => formatOf(n)?.kind === 'video')
      .filter((v) => images.has(baseLower(v)))
      .map((v) => [v, images.get(baseLower(v))]),
  );
}

/** À (re)générer : absent du manifeste, original modifié, affiche changée, réglages du pipeline changés, ou en erreur. */
export async function staleFiles(dir, manifest, names) {
  const posterOf = posters(names);
  const stale = [];
  for (const name of names) {
    const entry = manifest.items[name];
    const st = await stat(path.join(dir, name));
    const outputsPresent =
      entry?.outputs && Object.values(entry.outputs).every((f) => existsSync(path.join(dir, f)));
    const posterName = posterOf.get(name);
    let posterChanged = false;
    if (posterName) {
      const ps = await stat(path.join(dir, posterName));
      posterChanged = entry?.source?.poster !== posterName || (entry?.generatedAt && ps.mtimeMs > Date.parse(entry.generatedAt));
    } else posterChanged = Boolean(entry?.source?.poster);
    if (
      !entry ||
      entry.status !== 'ok' ||
      entry.pipeline !== PIPELINE_VERSION ||
      entry.source?.size !== st.size ||
      entry.source?.mtime !== Math.round(st.mtimeMs) ||
      !outputsPresent ||
      posterChanged
    )
      stale.push(name);
  }
  return { stale, posterOf };
}

/**
 * Traite les originaux d'un projet (un par un : les vidéos sont lourdes).
 * `only` : limiter à certains fichiers ; `force` : tout régénérer ; `onEvent` : suivi (début, progression, fin).
 * Le manifeste est enregistré après CHAQUE fichier : un arrêt en cours de route ne perd rien.
 */
export async function processProject(dir, { only, force = false, onEvent } = {}) {
  // verrou : jamais deux traitements du même projet en même temps (administration + npm run medias)
  const release = await lock(dir);
  if (!release) {
    onEvent?.({ type: 'busy' });
    return { done: [], failed: [], skipped: 0, busy: true };
  }
  try {
    return await processUnlocked(dir, { only, force, onEvent });
  } finally {
    await release();
  }
}

const LOCK_STALE_MS = 30 * 60 * 1000;
/** Verrou fichier `_web/.lock` (un verrou de plus de 30 min est considéré comme abandonné). */
async function lock(dir) {
  const file = path.join(dir, WEB_DIR, '.lock');
  await mkdir(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await writeFile(file, String(process.pid), { flag: 'wx' });
      return () => rm(file, { force: true });
    } catch {
      const age = Date.now() - (await stat(file).catch(() => ({ mtimeMs: Date.now() }))).mtimeMs;
      if (age < LOCK_STALE_MS) return null;
      await rm(file, { force: true });
    }
  }
  return null;
}

async function processUnlocked(dir, { only, force, onEvent }) {
  const names = await listOriginals(dir);
  const manifest = await readManifest(dir);
  if (await migrateStorage(dir, manifest)) {
    await writeManifest(dir, manifest);
    onEvent?.({ type: 'migrated' });
  }
  const { stale, posterOf } = await staleFiles(dir, manifest, names);
  const todo = (force ? names : stale).filter((n) => !only || only.includes(n));
  const report = { done: [], failed: [], skipped: names.length - todo.length };
  for (const name of todo) {
    onEvent?.({ type: 'start', file: name });
    try {
      manifest.items[name] = await processFile(dir, name, {
        posterName: posterOf.get(name),
        onProgress: (progress) => onEvent?.({ type: 'progress', file: name, progress }),
      });
      report.done.push(name);
      onEvent?.({ type: 'done', file: name, entry: manifest.items[name] });
    } catch (error) {
      const st = await stat(path.join(dir, name)).catch(() => undefined);
      manifest.items[name] = {
        status: 'error',
        pipeline: PIPELINE_VERSION,
        error: String(error?.message ?? error),
        source: st ? { size: st.size, mtime: Math.round(st.mtimeMs) } : undefined,
      };
      report.failed.push({ file: name, error: manifest.items[name].error });
      onEvent?.({ type: 'error', file: name, error: manifest.items[name].error });
    }
    await writeManifest(dir, manifest);
  }
  return report;
}

/**
 * Un original a été retiré (déplacé dans la corbeille par l'administration) : ses versions web
 * le suivent dans la corbeille et son entrée quitte le manifeste. Rien n'est supprimé.
 */
export async function retireOutputs(dir, name, trashDir) {
  const manifest = await readManifest(dir);
  const web = path.join(dir, WEB_DIR, name);
  if (existsSync(web)) {
    await mkdir(trashDir, { recursive: true });
    await rename(web, path.join(trashDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${name}-web`));
  }
  if (manifest.items[name]) {
    delete manifest.items[name];
    await writeManifest(dir, manifest);
  }
}
