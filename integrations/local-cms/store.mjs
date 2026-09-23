/**
 * Accès aux fichiers des projets : src/content/projects/<slug>/{project.md, médias…}
 *
 * L'administration lit et écrit EXACTEMENT les mêmes fichiers que ceux utilisés par le site :
 * aucune base de données, le site reste statique. Les suppressions vont dans `.trash/` (récupérables).
 *
 * Règles et vocabulaire : les MÊMES modules que le site (chargés par Vite via `load`) —
 * formats et règles des médias (src/lib/media-rules.ts), blocs (src/schemas/blocks.ts),
 * catégories / marques / statuts (src/data), grille (src/lib/gallery-layout.ts).
 *
 * Sécurité des données :
 *  - un enregistrement sans changement réel n'écrit rien (le fichier reste identique à l'octet près) ;
 *  - avant toute réécriture, la version précédente de project.md est copiée dans .cms/historique/<slug>/ ;
 *  - les commentaires et la mise en forme du frontmatter sont conservés ; seules les valeurs modifiées changent ;
 *  - les blocs ne sont jamais retirés implicitement ; les champs inconnus sont conservés.
 */
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import YAML from 'yaml';
import sharp from 'sharp';
import { HttpError } from './http.mjs';

const MAX_UPLOAD = 2 * 1024 * 1024 * 1024; // 2 Go
const HISTORY_EVERY_MS = 2 * 60 * 1000; // au plus une copie d'historique toutes les 2 min par projet
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
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
  'blocks',
  'unplaced',
  'draft',
];

const extOf = (name) => path.extname(name).slice(1);
const baseOf = (name) => name.slice(0, name.length - path.extname(name).length);

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

/** Comparaison de données YAML sans tenir compte de l'ordre des clés. */
const sameValue = (a, b) => isDeepStrictEqual(canonical(a), canonical(b));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  }
  return value;
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * @param {string} root racine du projet
 * @param {{ load: (id: string) => Promise<any> }} options `load` charge un module du site (Vite `ssrLoadModule`)
 */
export function createStore(root, { load }) {
  const projectsDir = path.join(root, 'src/content/projects');
  const trashDir = path.join(root, '.trash');
  const historyDir = path.join(root, '.cms/historique');
  const cacheDir = path.join(root, 'node_modules/.cache/local-cms');
  const metaCache = new Map();

  /* ------------------------------------------------------------------ modules partagés avec le site */
  /** @type {{ rules: any, blocks: any, project: any, layout: any, domains: any, entities: any }} */
  let m;
  /** À appeler avant toute opération (l'API le fait à chaque requête ; Vite met les modules en cache). */
  async function ready() {
    const [rules, blocks, project, layout, domains, entities] = await Promise.all([
      load('/src/lib/media-rules.ts'),
      load('/src/schemas/blocks.ts'),
      load('/src/schemas/project.ts'),
      load('/src/lib/gallery-layout.ts'),
      load('/src/data/domains.ts'),
      load('/src/data/entities.ts'),
    ]);
    m = { rules, blocks, project, layout, domains, entities };
  }

  const kindOf = (name) => m.rules.kindOf(name);
  const allowed = () => ({
    categories: [...m.domains.domainSlugs],
    entities: [...m.entities.entitySlugs],
    statuses: [...m.entities.projectStatuses],
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

  const orderedKeys = (data) => [
    ...KEY_ORDER.filter((k) => data[k] !== undefined),
    ...Object.keys(data).filter((k) => !KEY_ORDER.includes(k) && data[k] !== undefined),
  ];
  const rank = (key) => {
    const i = KEY_ORDER.indexOf(key);
    return i === -1 ? KEY_ORDER.length : i;
  };

  /** Nouveau fichier : frontmatter dans l'ordre canonique. */
  function serializeFresh(data, body) {
    const ordered = {};
    for (const key of orderedKeys(data)) ordered[key] = data[key];
    const doc = new YAML.Document(ordered);
    doc.commentBefore =
      ' Fiche gérée par l’administration locale (/admin). Modifiable aussi à la main : le site lit ce fichier tel quel.';
    const yaml = doc.toString({ lineWidth: 0 });
    const text = body.trim();
    return `---\n${yaml}---\n${text ? `\n${text}\n` : ''}`;
  }

  /**
   * Fichier existant : on modifie le document YAML d'origine, clé par clé.
   * Commentaires, guillemets, lignes vides et ordre des champs non modifiés restent tels quels.
   */
  function serializeProject(data, body, original) {
    const match = original?.match(FRONTMATTER);
    if (!match) return serializeFresh(data, body);
    const doc = YAML.parseDocument(match[1]);
    if (!YAML.isMap(doc.contents)) return serializeFresh(data, body);
    const current = doc.toJS() ?? {};

    for (const key of Object.keys(current)) if (data[key] === undefined) doc.delete(key);
    for (const key of orderedKeys(data)) {
      const value = data[key];
      if (key in current && sameValue(current[key], value)) continue;
      const node = doc.get(key, true);
      if (YAML.isScalar(node) && (value === null || typeof value !== 'object')) {
        node.value = value; // garde le style (guillemets…) et le commentaire de fin de ligne
      } else if (doc.has(key)) {
        doc.set(key, doc.createNode(value));
      } else {
        // nouveau champ : à sa place dans l'ordre canonique
        const items = doc.contents.items;
        const at = items.findIndex((pair) => rank(String(pair.key?.value ?? pair.key)) > rank(key));
        items.splice(at === -1 ? items.length : at, 0, doc.createPair(key, value));
      }
    }
    const yaml = doc.toString({ lineWidth: 0, flowCollectionPadding: false });
    const text = body.trim();
    const originalBody = match[2];
    const bodyPart =
      originalBody.replace(/^\r?\n+/, '').trim() === text
        ? originalBody
        : text
          ? `\n${text}\n`
          : '';
    return `---\n${yaml}---\n${bodyPart}`;
  }

  /* ------------------------------------------------------------------ validation */
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  /** Identifiant court et unique (blocs et éléments sans `id`). */
  function makeId(prefix, used) {
    let id;
    do id = `${prefix}-${randomBytes(3).toString('hex')}`;
    while (used.has(id));
    used.add(id);
    return id;
  }

  /** Blocs : forme (schéma partagé) + cohérence ; les `id` manquants sont attribués (puis stables). */
  function cleanBlocks(blocks, bad) {
    const parsed = m.blocks.blocksSchema.safeParse(blocks);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      bad(
        `Blocs invalides (${(first?.path ?? []).join(' › ') || 'blocks'}) : ${first?.message ?? 'forme incorrecte'}.`,
      );
    }
    const errors = m.blocks.validateBlocks(blocks).filter((i) => i.level === 'error');
    if (errors.length) bad(errors.map((e) => e.message).join(' '));
    const used = new Set();
    for (const b of blocks) {
      if (b.id) used.add(b.id);
      for (const i of Array.isArray(b.items) ? b.items : []) if (i?.id) used.add(i.id);
    }
    // les objets d'origine sont conservés tels quels (champs inconnus compris) ; seuls les `id` absents sont ajoutés
    return blocks.map((b) => ({
      ...(b.id ? {} : { id: makeId('b', used) }),
      ...b,
      ...(Array.isArray(b.items)
        ? { items: b.items.map((i) => (i.id ? i : { id: makeId('i', used), ...i })) }
        : {}),
    }));
  }

  function cleanData(input, existing = {}) {
    const lists = allowed();
    const { SPANS, ALIGNS } = m.layout;
    const RATIO = m.project.ratioPattern;
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
    for (const entry of Array.isArray(input.media) ? input.media : []) {
      const file = assertFileName(entry?.file);
      if (seen.has(file)) continue;
      seen.add(file);
      const item = { file };
      if (entry.span !== undefined && entry.span !== null) {
        if (!SPANS.includes(entry.span)) bad(`Taille de galerie invalide : ${entry.span}.`);
        item.span = entry.span;
      }
      if (entry.align && entry.align !== 'center') {
        if (!ALIGNS.includes(entry.align)) bad('Alignement invalide.');
        item.align = entry.align;
      }
      if (str(entry.alt)) item.alt = str(entry.alt);
      if (str(entry.caption)) item.caption = str(entry.caption);
      if (str(entry.ratio)) {
        if (!RATIO.test(entry.ratio.trim())) bad(`Ratio invalide : « ${entry.ratio} ».`);
        item.ratio = entry.ratio.trim();
      }
      if (entry.hidden === true) item.hidden = true;
      media.push(item);
    }
    if (media.length) out.media = media;

    // Blocs : jamais retirés implicitement. Absent de la requête = inchangé ; `null` = retrait demandé.
    const blocks = input.blocks === undefined ? existing.blocks : input.blocks;
    if (blocks !== undefined && blocks !== null) {
      if (!Array.isArray(blocks)) bad('Blocs invalides : une liste est attendue.');
      out.blocks = cleanBlocks(blocks, bad);
    }
    const unplaced = input.unplaced === undefined ? existing.unplaced : input.unplaced;
    if (unplaced !== undefined && unplaced !== null) {
      if (!['append', 'hide'].includes(unplaced)) bad('Réglage « unplaced » invalide.');
      out.unplaced = unplaced;
    }

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
      const meta = await sharp(file, { failOn: 'none' }).metadata();
      const swap = (meta.orientation ?? 1) >= 5;
      size = { width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height };
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
    // une image portant le même nom qu'une vidéo est son affiche (poster) — règle partagée avec le site
    const { posterOf, posterFor } = m.rules.posterPairs(infos);
    for (const info of infos) {
      if (posterFor.has(info.name)) info.posterFor = posterFor.get(info.name);
      if (posterOf.has(info.name)) info.poster = posterOf.get(info.name);
    }
    return infos.sort((a, b) => natural.compare(a.name, b.name));
  }

  /* ------------------------------------------------------------------ projets */
  async function readProject(slug) {
    const file = mdOf(slug);
    if (!existsSync(file)) throw new HttpError(404, `Projet introuvable : ${slug}`);
    const text = await readFile(file, 'utf8');
    return { file, text, ...parseProject(text) };
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
          const files = m.rules.mediaFiles(names);
          const { posterFor } = m.rules.posterPairs(files);
          const cover = m.rules.effectiveCover(data.cover, files);
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
            mediaCount: files.filter((f) => !posterFor.has(f.name)).length,
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
    await writeFile(mdOf(slug), serializeFresh(data, ''), 'utf8');
    return getProject(slug);
  }

  /** Copie la version actuelle de project.md dans .cms/historique/<slug>/ avant de la remplacer. */
  /**
   * L'enregistrement automatique écrit souvent (une fois par geste) : on garde une copie avant la première
   * modification, puis au plus une toutes les HISTORY_EVERY_MS pendant une séance d'édition.
   * L'état d'avant chaque séance reste donc toujours récupérable, sans accumuler des centaines de fichiers.
   * `always` : copie systématique (ex. écraser une version modifiée ailleurs : elle doit rester récupérable).
   */
  async function keepHistory(slug, file, always = false) {
    const dir = path.join(historyDir, slug);
    await mkdir(dir, { recursive: true });
    const latest = (await readdir(dir))
      .filter((n) => n.endsWith('.md'))
      .sort()
      .at(-1);
    if (
      !always &&
      latest &&
      Date.now() - (await stat(path.join(dir, latest))).mtimeMs < HISTORY_EVERY_MS
    )
      return;
    // lecture + écriture (et non copyFile, qui garde la date du fichier d'origine sous Windows)
    await writeFile(path.join(dir, `${stamp()}.md`), await readFile(file));
  }

  async function saveProject(slug, input) {
    const { file, text, data: existing, body: existingBody } = await readProject(slug);
    const data = cleanData(input.data ?? {}, existing);
    const body = typeof input.body === 'string' ? input.body : existingBody;
    const current = Math.round((await stat(file)).mtimeMs);

    // Rien n'a changé : on n'écrit pas (le fichier reste identique à l'octet près).
    if (sameValue(data, existing) && body.trim() === existingBody.trim()) {
      return { slug, updatedAt: current, unchanged: true };
    }
    // Le fichier a été modifié depuis son ouverture (autre onglet, édition à la main) : on ne l'écrase pas
    // sans l'accord explicite de l'utilisateur (`force`). Même forcé, l'autre version est gardée dans l'historique.
    if (
      typeof input.baseUpdatedAt === 'number' &&
      input.baseUpdatedAt !== current &&
      input.force !== true
    ) {
      throw new HttpError(
        409,
        'Ce projet a été modifié ailleurs (autre onglet ou fichier édité à la main) depuis son ouverture.',
      );
    }
    await keepHistory(slug, file, input.force === true);
    await writeFile(file, serializeProject(data, body, text), 'utf8');
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
    const dest = path.join(trashDir, `${stamp()}-${slug}`);
    await rename(dirOf(slug), dest);
    return { trashed: path.relative(root, dest).replace(/\\/g, '/') };
  }

  /* ------------------------------------------------------------------ envoi / suppression de médias */
  async function trashFile(slug, name) {
    const from = path.join(dirOf(slug), name);
    if (!existsSync(from)) return;
    const dir = path.join(trashDir, `${slug}-medias`);
    await mkdir(dir, { recursive: true });
    await rename(from, path.join(dir, `${stamp()}-${name}`));
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
        `Format non pris en charge. Utilise ${m.rules.formatLabels('image')}, ${m.rules.formatLabels('video')}.`,
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
    return { path: p, mime: m.rules.mimeOf(name), kind: kindOf(name) };
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
    ready,
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
