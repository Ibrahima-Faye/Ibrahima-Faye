/**
 * Règles des médias d'un projet — UNE seule implémentation, utilisée par :
 *   le site (src/lib/media.ts) · l'administration (src/cms) · l'API locale (integrations/local-cms) · les tests.
 *
 *   formats      → src/schemas/media.ts
 *   affiche      → une image portant le même nom qu'une vidéo (demo.mp4 + demo.jpg) est son affiche (poster)
 *   couverture   → champ `cover`, sinon `cover.*`, sinon la première image (ordre naturel des noms)
 *   ordre        → fichiers listés dans `media:` d'abord (dans cet ordre), puis les autres par nom
 *   `cover.*`    → hors galerie, sauf s'il est listé dans `media:`
 *
 * Aucune dépendance à Astro ni au navigateur : ce module se charge partout.
 */
import { MEDIA_FORMATS, type MediaFormat, type MediaKind } from '@/schemas/media';

export type { MediaKind };

export const naturalCollator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
export const naturalCompare = (a: string, b: string) => naturalCollator.compare(a, b);

/** Extension telle qu'écrite (« JPG », « jpg »), sans le point. */
export const extOf = (name: string) => /\.([^./\\]+)$/.exec(name)?.[1] ?? '';
/** Nom sans extension. */
export const baseOf = (name: string) => name.replace(/\.[^./\\]+$/, '');

const byExt = new Map<string, MediaFormat>(MEDIA_FORMATS.map((f) => [f.ext, f]));

/**
 * Format d'un fichier. Comme les motifs du site, seules les extensions entièrement en minuscules
 * ou en MAJUSCULES sont reconnues (« .jpg », « .JPG », mais pas « .Jpg »).
 */
export function formatOf(name: string): MediaFormat | undefined {
  const ext = extOf(name);
  if (!ext || (ext !== ext.toLowerCase() && ext !== ext.toUpperCase())) return undefined;
  return byExt.get(ext.toLowerCase());
}

/** Type d'un fichier pris en charge (`null` : ce n'est pas un média). */
export function kindOf(name: string): MediaKind | null {
  return formatOf(name)?.kind ?? null;
}

/**
 * Formats qu'un navigateur affiche tels quels, sans conversion : le site peut s'en servir en repli, en local,
 * tant que le pipeline n'a pas produit la version web (HEIC, MOV, SVG, GIF… attendent leur version web).
 */
const BROWSER_READY = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'mp4', 'webm']);
export const isBrowserReady = (name: string) => BROWSER_READY.has(formatOf(name)?.ext ?? '');

export const mimeOf = (name: string) => formatOf(name)?.mime ?? 'application/octet-stream';

export const supportedFormats = (kind?: MediaKind): MediaFormat[] =>
  MEDIA_FORMATS.filter((f) => !kind || f.kind === kind);

/** Valeur de l'attribut `accept` d'un champ fichier. */
export const acceptAttribute = (kind?: MediaKind) =>
  [...new Set(supportedFormats(kind).flatMap((f) => [f.mime, `.${f.ext}`]))].join(',');

/** « JPG, PNG, WebP, AVIF » — pour les messages. */
export const formatLabels = (kind?: MediaKind) =>
  supportedFormats(kind)
    .filter((f) => f.ext !== 'jpeg' && f.ext !== 'heif')
    .map((f) => f.label)
    .join(', ');

export const isCoverName = (name: string) => baseOf(name).toLowerCase() === 'cover';

/** Un fichier du dossier d'un projet, réduit à ce dont les règles ont besoin. */
export interface FileRef {
  name: string;
  kind: MediaKind;
}

/** Fichiers pris en charge parmi une liste de noms. */
export function mediaFiles(names: Iterable<string>): FileRef[] {
  const out: FileRef[] = [];
  for (const name of names) {
    const kind = kindOf(name);
    if (kind) out.push({ name, kind });
  }
  return out;
}

/** Affiches : image du même nom (sans tenir compte de la casse) qu'une vidéo. */
export function posterPairs(files: readonly FileRef[]) {
  const videos = new Map(
    files.filter((f) => f.kind === 'video').map((v) => [baseOf(v.name).toLowerCase(), v.name]),
  );
  /** vidéo → son affiche */
  const posterOf = new Map<string, string>();
  /** affiche → sa vidéo */
  const posterFor = new Map<string, string>();
  for (const file of files) {
    if (file.kind !== 'image') continue;
    const video = videos.get(baseOf(file.name).toLowerCase());
    if (video) {
      posterOf.set(video, file.name);
      posterFor.set(file.name, video);
    }
  }
  return { posterOf, posterFor };
}

/** Couverture effective : champ `cover` (s'il existe), sinon `cover.*`, sinon la première image par nom. */
export function effectiveCover(cover: string | undefined, files: readonly FileRef[]) {
  const images = files
    .filter((f) => f.kind === 'image')
    .map((f) => f.name)
    .sort(naturalCompare);
  if (cover && images.includes(cover)) return cover;
  return images.find(isCoverName) ?? images[0];
}

export interface GalleryEntry {
  file: string;
  kind: MediaKind;
  /** Masqué : `hidden: true` dans `media:`, ou `cover.*` non listé. Le site ne l'affiche pas ; /admin le montre grisé. */
  hidden: boolean;
  /** Présent dans `media:`. */
  listed: boolean;
}

/**
 * Médias de galerie d'un projet, dans l'ordre (affiches exclues).
 * C'est la composition « historique » (sans blocs) : elle doit rester strictement identique.
 */
export function galleryEntries(
  files: readonly FileRef[],
  media: readonly { file: string; hidden?: boolean }[] = [],
): GalleryEntry[] {
  const { posterFor } = posterPairs(files);
  const usable = files.filter((f) => !posterFor.has(f.name));
  const byName = new Map(usable.map((f) => [f.name, f]));
  const settings = new Map(media.map((m) => [m.file, m]));

  const listed = [...new Set(media.map((m) => m.file))].filter((f) => byName.has(f));
  const listedSet = new Set(listed);
  const rest = usable
    .map((f) => f.name)
    .filter((f) => !listedSet.has(f))
    .sort(naturalCompare);

  return [...listed, ...rest].map((file) => {
    const conf = settings.get(file);
    return {
      file,
      kind: byName.get(file)!.kind,
      hidden: conf?.hidden === true || (!conf && isCoverName(file)),
      listed: Boolean(conf),
    };
  });
}
