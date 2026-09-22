/**
 * Accès aux fichiers des projets : src/content/projects/<slug>/{project.md, médias…}
 *
 * L'administration lit et écrit EXACTEMENT les mêmes fichiers que ceux utilisés par le site :
 * aucune base de données, le site reste statique. Les suppressions vont dans `.trash/` (récupérables).
 */
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import YAML from 'yaml';
import sharp from 'sharp';
import { HttpError, MIME } from './http.mjs';

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);
const VIDEO_EXT = new Set(['mp4', 'webm']);
const SPANS = [3, 4, 6, 8, 9, 12];
const ALIGNS = ['start', 'center', 'end'];
const MAX_UPLOAD = 2 * 1024 * 1024 * 1024; // 2 Go
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RATIO = /^\d+(\.\d+)?\s*[:/]\s*\d+(\.\d+)?$/;
const natural = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/** Ordre canonique des champs dans project.md (les champs inconnus suivent, intacts). */
const KEY_ORDER = [
  'title',
  'category',
  'entity',
  'summary',
  'year',
  'status',
  'technologies',
  'role',
  'context',
  'result',
  'client',
  'featured',
  'order',
  'cover',
  'coverAlt',
  'links',
  'media',
  'draft',
];

const extOf = (name) => path.extname(name).slice(1);
const baseOf = (name) => name.slice(0, name.length - path.extname(name).length);
const isLowerOrUpper = (ext) => ext === ext.toLowerCase() || ext === ext.toUpperCase();

function kindOf(name) {
  const ext = extOf(name);
  if (!isLowerOrUpper(ext)) return null; // le site ne détecte que .jpg ou .JPG (pas .Jpg)
  const e = ext.toLowerCase();
  return IMAGE_EXT.has(e) ? 'image' : VIDEO_EXT.has(e) ? 'video' : null;
}

export const slugify = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Nom de fichier sûr : minuscules, sans accents ni espaces. */
export function safeFileName(original) {
  const ext = extOf(original).toLowerCase();
  let base = slugify(baseOf(path.basename(original))) || 'media';
  if (base === 'cover') base = 'couverture'; // `cover.*` est réservé à la convention de couverture
  return `${base}.${ext}`;
}

export function createStore(root) {
  const projectsDir = path.join(root, 'src/content/projects');
  const trashDir = path.join(root, '.trash');
  const cacheDir = path.join(root, 'node_modules/.cache/local-cms');
  const metaCache = new Map();

  /* ------------------------------------------------------------------ valeurs autorisées */
  function readList(file, name) {
    const text = readFileSync(path.join(root, file), 'utf8');
    const match = text.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`));
    if (!match) throw new Error(`Liste « ${name} » introuvable dans ${file}`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
  const allowed = () => ({
    categories: readList('src/data/domains.ts', 'domainSlugs'),
    entities: readList('src/data/entities.ts', 'entitySlugs'),
    statuses: readList('src/data/entities.ts', 'projectStatuses'),
  });

  /* ------------------------------------------------------------------ chemins */
  function assertSlug(slug) {
    if (typeof slug !== 'string' || !SLUG.test(slug))
      throw new HttpError(400, `Adresse invalide : « ${slug} ».`);
    return slug;
  }
  function assertFileName(name) {
    if (typeof name !== 'string' || !name || name !== path.basename(name) || name.startsWith('.')) {
      throw new HttpError(400, 'Nom de fichier invalide.');
    }
    return name;
  }
  const dirOf = (slug) => path.join(projectsDir, assertSlug(slug));
  const mdOf = (slug) => path.join(dirOf(slug), 'project.md');

  /* ------------------------------------------------------------------ frontmatter */
  const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

  function parseProject(text) {
    const match = text.match(FRONTMATTER);
    if (!match) throw new Error('Bloc d’en-tête (---) introuvable.');
    const data = YAML.parse(match[1]) ?? {};
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('En-tête invalide.');
    return { data, body: match[2].replace(/^\r?\n+/, '') };
  }

  function serializeProject(data, body) {
    const ordered = {};
    for (const key of KEY_ORDER) if (data[key] !== undefined) ordered[key] = data[key];
    for (const key of Object.keys(data))
      if (!(key in ordered) && data[key] !== undefined) ordered[key] = data[key];
    const doc = new YAML.Document(ordered);
    doc.commentBefore =
      ' Fiche gérée par l’administration locale (/admin). Modifiable aussi à la main : le site lit ce fichier tel quel.';
    const yaml = doc.toString({ lineWidth: 0 });
    const text = body.trim();
    return `---\n${yaml}---\n${text ? `\n${text}\n` : ''}`;
  }

  /* ------------------------------------------------------------------ validation */
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  function cleanData(input, existing = {}) {
    const lists = allowed();
    const bad = (message) => {
      throw new HttpError(400, message);
    };
    const out = {};

    out.title = str(input.title) ?? bad('Le titre est obligatoire.');
    out.category = lists.categories.includes(input.category)
      ? input.category
      : bad('Catégorie invalide.');

    const brands = [...new Set([].concat(input.entity ?? ['personal']))].filter(Boolean);
    if (!brands.length) brands.push('personal');
    for (const b of brands) if (!lists.entities.includes(b)) bad(`Marque inconnue : « ${b} ».`);
    out.entity = brands.length === 1 ? brands[0] : brands;

    const summary = str(input.summary);
    if (summary && summary.length > 240) bad('La description courte est limitée à 240 caractères.');
    if (summary) out.summary = summary;

    if (input.year !== undefined && input.year !== null && input.year !== '') {
      const year = Number(input.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100)
        bad('Année invalide (2000 à 2100).');
      out.year = year;
    }
    if (input.status) {
      if (!lists.statuses.includes(input.status)) bad('Statut invalide.');
      out.status = input.status;
    }
    const techs = (Array.isArray(input.technologies) ? input.technologies : [])
      .map(str)
      .filter(Boolean);
    if (techs.length) out.technologies = techs;

    for (const key of ['role', 'context', 'result', 'client', 'coverAlt']) {
      const v = str(input[key]);
      if (v) out[key] = v;
    }
    if (input.featured === true) out.featured = true;
    if (input.order !== undefined && input.order !== null && input.order !== '') {
      const order = Number(input.order);
      if (!Number.isFinite(order)) bad('Ordre invalide.');
      out.order = order;
    }
    const cover = str(input.cover);
    if (cover) out.cover = assertFileName(cover);

    const links = (Array.isArray(input.links) ? input.links : [])
      .map((l) => ({ label: str(l?.label), href: str(l?.href) }))
      .filter((l) => l.label || l.href);
    for (const l of links) {
      if (!l.label || !l.href) bad('Chaque lien doit avoir un libellé et une adresse.');
      try {
        new URL(l.href);
      } catch {
        bad(`Adresse de lien invalide : « ${l.href} ».`);
      }
    }
    if (links.length) out.links = links;

    const media = [];
    const seen = new Set();
    for (const m of Array.isArray(input.media) ? input.media : []) {
      const file = assertFileName(m?.file);
      if (seen.has(file)) continue;
      seen.add(file);
      const entry = { file };
      if (m.span !== undefined && m.span !== null) {
        if (!SPANS.includes(m.span)) bad(`Taille de galerie invalide : ${m.span}.`);
        entry.span = m.span;
      }
      if (m.align && m.align !== 'center') {
        if (!ALIGNS.includes(m.align)) bad('Alignement invalide.');
        entry.align = m.align;
      }
      if (str(m.alt)) entry.alt = str(m.alt);
      if (str(m.caption)) entry.caption = str(m.caption);
      if (str(m.ratio)) {
        if (!RATIO.test(m.ratio.trim())) bad(`Ratio invalide : « ${m.ratio} ».`);
        entry.ratio = m.ratio.trim();
      }
      if (m.hidden === true) entry.hidden = true;
      media.push(entry);
    }
    if (media.length) out.media = media;

    out.draft = input.draft === false ? false : true;

    // Champs inconnus de l'administration (ex. écrits à la main) : conservés tels quels.
    for (const key of Object.keys(existing)) if (!KEY_ORDER.includes(key)) out[key] = existing[key];
    return out;
  }

  /* ------------------------------------------------------------------ médias */
  async function imageSize(file, st) {
    const key = `${file}:${st.mtimeMs}:${st.size}`;
    if (metaCache.has(key)) return metaCache.get(key);
    let size = {};
    try {
      const m = await sharp(file, { failOn: 'none' }).metadata();
      const swap = (m.orientation ?? 1) >= 5;
      size = { width: swap ? m.height : m.width, height: swap ? m.width : m.height };
    } catch {
      /* image illisible : dimensions inconnues */
    }
    metaCache.set(key, size);
    return size;
  }

  async function listFiles(slug) {
    const dir = dirOf(slug);
    const names = (await readdir(dir)).filter((n) => !n.startsWith('.') && kindOf(n));
    const infos = await Promise.all(
      names.map(async (name) => {
        const file = path.join(dir, name);
        const st = await stat(file);
        const kind = kindOf(name);
        return {
          name,
          kind,
          size: st.size,
          mtime: Math.round(st.mtimeMs),
          ...(kind === 'image' ? await imageSize(file, st) : {}),
        };
      }),
    );
    // une image portant le même nom qu'une vidéo est son affiche (poster)
    const videos = new Map(
      infos.filter((i) => i.kind === 'video').map((v) => [baseOf(v.name).toLowerCase(), v]),
    );
    for (const info of infos) {
      if (info.kind !== 'image') continue;
      const video = videos.get(baseOf(info.name).toLowerCase());
      if (video) {
        info.posterFor = video.name;
        video.poster = info.name;
      }
    }
    return infos.sort((a, b) => natural.compare(a.name, b.name));
  }

  /** Nom du fichier de couverture effectif (même règle que le site). */
  function effectiveCover(data, files) {
    const images = files.filter((f) => f.kind === 'image');
    if (data.cover && images.some((f) => f.name === data.cover)) return data.cover;
    const byName = images.find((f) => baseOf(f.name).toLowerCase() === 'cover');
    return (byName ?? images[0])?.name;
  }

  /* ------------------------------------------------------------------ projets */
  async function readProject(slug) {
    const file = mdOf(slug);
    if (!existsSync(file)) throw new HttpError(404, `Projet introuvable : ${slug}`);
    return { file, ...parseProject(await readFile(file, 'utf8')) };
  }

  async function getProject(slug) {
    const { file, data, body } = await readProject(slug);
    const files = await listFiles(slug);
    return { slug, data, body, files, updatedAt: Math.round((await stat(file)).mtimeMs) };
  }

  async function listProjects() {
    await mkdir(projectsDir, { recursive: true });
    const dirs = (await readdir(projectsDir, { withFileTypes: true })).filter((d) =>
      d.isDirectory(),
    );
    const list = await Promise.all(
      dirs.map(async (d) => {
        const slug = d.name;
        const file = path.join(projectsDir, slug, 'project.md');
        if (!existsSync(file)) return null;
        const st = await stat(file);
        try {
          const { data } = parseProject(await readFile(file, 'utf8'));
          const names = (await readdir(path.join(projectsDir, slug))).filter(
            (n) => !n.startsWith('.') && kindOf(n),
          );
          const files = names.map((name) => ({ name, kind: kindOf(name) }));
          const videoBases = new Set(
            files.filter((f) => f.kind === 'video').map((f) => baseOf(f.name).toLowerCase()),
          );
          const media = files.filter(
            (f) => f.kind === 'video' || !videoBases.has(baseOf(f.name).toLowerCase()),
          );
          const cover = effectiveCover(data, files);
          return {
            slug,
            title: data.title ?? slug,
            category: data.category,
            entity: [].concat(data.entity ?? ['personal']),
            year: data.year,
            status: data.status,
            draft: data.draft === true,
            featured: data.featured === true,
            order: data.order,
            hasSummary: Boolean(data.summary),
            cover,
            coverV: cover
              ? Math.round((await stat(path.join(projectsDir, slug, cover))).mtimeMs)
              : undefined,
            mediaCount: media.length,
            updatedAt: Math.round(st.mtimeMs),
          };
        } catch (error) {
          return {
            slug,
            title: slug,
            error: String(error.message ?? error),
            draft: true,
            mediaCount: 0,
            updatedAt: Math.round(st.mtimeMs),
          };
        }
      }),
    );
    return list.filter(Boolean);
  }

  async function createProject(input) {
    const title =
      str(input.title) ??
      (() => {
        throw new HttpError(400, 'Le titre est obligatoire.');
      })();
    let slug = str(input.slug) ? assertSlug(input.slug) : slugify(title);
    if (!SLUG.test(slug)) slug = `projet-${randomBytes(3).toString('hex')}`;
    let unique = slug;
    for (let n = 2; existsSync(path.join(projectsDir, unique)); n++) unique = `${slug}-${n}`;
    slug = unique;

    const data = cleanData({ ...input, title, draft: true });
    await mkdir(dirOf(slug), { recursive: true });
    await writeFile(mdOf(slug), serializeProject(data, ''), 'utf8');
    return getProject(slug);
  }

  async function saveProject(slug, input) {
    const { file, data: existing } = await readProject(slug);
    const data = cleanData(input.data ?? {}, existing);
    await writeFile(
      file,
      serializeProject(data, typeof input.body === 'string' ? input.body : ''),
      'utf8',
    );
    return { slug, updatedAt: Math.round((await stat(file)).mtimeMs) };
  }

  async function renameProject(slug, next) {
    const target = assertSlug(next);
    if (target === slug) return { slug };
    if (existsSync(dirOf(target)))
      throw new HttpError(409, `L’adresse « ${target} » est déjà utilisée.`);
    await readProject(slug);
    await rename(dirOf(slug), dirOf(target));
    return { slug: target };
  }

  async function trashProject(slug) {
    await readProject(slug);
    await mkdir(trashDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(trashDir, `${stamp}-${slug}`);
    await rename(dirOf(slug), dest);
    return { trashed: path.relative(root, dest).replace(/\\/g, '/') };
  }

  /* ------------------------------------------------------------------ envoi / suppression de médias */
  async function trashFile(slug, name) {
    const from = path.join(dirOf(slug), name);
    if (!existsSync(from)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(trashDir, `${slug}-medias`);
    await mkdir(dir, { recursive: true });
    await rename(from, path.join(dir, `${stamp}-${name}`));
  }

  async function saveUpload(slug, req, { name, poster }) {
    const dir = dirOf(slug);
    if (!existsSync(dir)) throw new HttpError(404, `Projet introuvable : ${slug}`);
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > MAX_UPLOAD) throw new HttpError(413, 'Fichier trop volumineux (2 Go maximum).');

    const cleaned = safeFileName(assertFileName(String(name ?? '')));
    const kind = kindOf(cleaned);
    if (!kind)
      throw new HttpError(
        415,
        'Format non pris en charge. Utilise JPG, PNG, WebP, AVIF, MP4 ou WebM.',
      );

    let target = cleaned;
    if (poster) {
      // affiche d'une vidéo : même nom que la vidéo, extension d'image
      const video = assertFileName(String(poster));
      if (kindOf(video) !== 'video' || !existsSync(path.join(dir, video))) {
        throw new HttpError(400, 'Vidéo introuvable pour cette affiche.');
      }
      if (kind !== 'image') throw new HttpError(415, 'L’affiche doit être une image.');
      target = `${baseOf(video)}.${extOf(cleaned)}`;
      for (const existing of await readdir(dir)) {
        if (
          kindOf(existing) === 'image' &&
          baseOf(existing).toLowerCase() === baseOf(video).toLowerCase()
        ) {
          await trashFile(slug, existing);
        }
      }
    } else {
      const stem = baseOf(cleaned);
      for (let n = 2; existsSync(path.join(dir, target)); n++)
        target = `${stem}-${n}${path.extname(cleaned)}`;
    }

    await mkdir(trashDir, { recursive: true });
    const tmp = path.join(trashDir, `.upload-${randomBytes(6).toString('hex')}`);
    try {
      await pipeline(req, createWriteStream(tmp));
      const size = (await stat(tmp)).size;
      if (!size) throw new HttpError(400, 'Fichier vide.');
      if (size > MAX_UPLOAD) throw new HttpError(413, 'Fichier trop volumineux (2 Go maximum).');
      await rename(tmp, path.join(dir, target));
    } catch (error) {
      await unlink(tmp).catch(() => {});
      throw error;
    }
    const files = await listFiles(slug);
    return files.find((f) => f.name === target);
  }

  async function deleteMedia(slug, file) {
    const name = assertFileName(file);
    const dir = dirOf(slug);
    if (!existsSync(path.join(dir, name))) throw new HttpError(404, 'Fichier introuvable.');
    const removed = [name];
    await trashFile(slug, name);
    if (kindOf(name) === 'video') {
      for (const other of await readdir(dir)) {
        if (
          kindOf(other) === 'image' &&
          baseOf(other).toLowerCase() === baseOf(name).toLowerCase()
        ) {
          await trashFile(slug, other);
          removed.push(other);
        }
      }
    }
    return { removed };
  }

  /* ------------------------------------------------------------------ lecture des fichiers */
  function mediaPath(slug, file) {
    const name = assertFileName(file);
    const p = path.join(dirOf(slug), name);
    if (!existsSync(p) || !kindOf(name)) throw new HttpError(404, 'Fichier introuvable.');
    return {
      path: p,
      mime: MIME[extOf(name).toLowerCase()] ?? 'application/octet-stream',
      kind: kindOf(name),
    };
  }

  /** Miniature WebP mise en cache (les originaux peuvent peser plusieurs dizaines de Mo). */
  async function thumbnail(slug, file, width) {
    const src = mediaPath(slug, file);
    if (src.kind !== 'image') throw new HttpError(400, 'Pas une image.');
    const w = Math.min(2400, Math.max(64, Math.round(width) || 480));
    const st = await stat(src.path);
    const key = createHash('sha1')
      .update(`${src.path}:${st.mtimeMs}:${st.size}:${w}`)
      .digest('hex');
    const out = path.join(cacheDir, `${key}.webp`);
    if (!existsSync(out)) {
      await mkdir(cacheDir, { recursive: true });
      const buf = await sharp(src.path, { failOn: 'none' })
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      await writeFile(out, buf);
    }
    return out;
  }

  return {
    allowed,
    listProjects,
    getProject,
    createProject,
    saveProject,
    renameProject,
    trashProject,
    saveUpload,
    deleteMedia,
    mediaPath,
    thumbnail,
  };
}
