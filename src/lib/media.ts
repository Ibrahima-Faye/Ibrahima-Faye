import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { defaultSpan, DEFAULT_ALIGN, parseRatio, type Align, type Span } from './gallery-layout';
import { effectiveCover, mediaFiles } from './media-rules';
import { resolveOutputUrl, type MediaStorage } from './media-storage';
import { normalizeGallery, type NormalizedBlock, type NormalizedItem } from './gallery/normalize';

/**
 * Détection automatique des médias d'un projet.
 *
 * Convention (voir docs/AJOUTER-UN-PROJET.md — règles : src/lib/media-rules.ts) :
 *   champ `cover`     → image principale choisie dans l'administration (n'importe quel fichier image)
 *   cover.*            → sinon, image principale par convention (exclue de la galerie)
 *   <nom>.mp4/.webm    → vidéo ; <nom>.jpg/png/webp/avif du MÊME nom = son affiche (poster)
 *   toute autre image  → galerie, triée par nom (image-01, image-02, …)
 *   `blocks:`          → mise en page en blocs (src/schemas/blocks.ts) ; sans lui, composition historique
 *
 * Aucun recadrage : chaque média garde son ratio d'origine.
 */

type Project = CollectionEntry<'projects'>;

/*
  Le site n'utilise QUE les versions web produites par le pipeline médias (integrations/local-cms/media/),
  décrites dans <projet>/media.json : les originaux (HEIC, MOV 4K, PNG de 20 Mo…) restent sur la machine
  et ne peuvent jamais se retrouver dans le site publié.
*/
interface WebEntry {
  status: 'ok' | 'error';
  kind: 'image' | 'video';
  width: number;
  height: number;
  ratio?: number;
  vector?: boolean;
  animated?: boolean;
  outputs: { image?: string; thumb?: string; video?: string; mobile?: string; poster?: string };
  /** Versions de plus de 25 Mio : 'remote' (stockage externe, hors git et hors build). */
  storage?: Partial<Record<keyof WebEntry['outputs'], MediaStorage>>;
}

/** URL publique du stockage externe (Cloudflare R2…) — voir .env.example et docs/MEDIAS.md. */
const REMOTE_BASE = String(import.meta.env.PUBLIC_MEDIA_BASE_URL ?? '').trim();

const manifests = import.meta.glob<{ items: Record<string, WebEntry> }>(
  '/src/content/projects/*/media.json',
  { eager: true, import: 'default' },
);
/** Images maîtresses et affiches (le site en tire AVIF / WebP / tailles responsive). */
const webImages = import.meta.glob<ImageMetadata>(
  '/src/content/projects/*/_web/*/{image,poster}.{jpg,webp}',
  { eager: true, import: 'default' },
);
/** Vidéos web et SVG nettoyés (servis tels quels). Les versions de `distant/` n'y sont pas : jamais dans le build. */
const webUrls = import.meta.glob<string>(
  '/src/content/projects/*/_web/*/{video,mobile,image}.{mp4,svg}',
  { eager: true, import: 'default', query: '?url' },
);

export interface ImageMedia {
  type: 'image';
  file: string;
  /** Image matricielle (Astro en tire AVIF / WebP / tailles responsive). */
  src?: ImageMetadata;
  /** Image vectorielle (SVG nettoyé) : URL servie telle quelle. */
  svg?: string;
  alt: string;
  caption?: string;
  /** largeur / hauteur */
  ratio: number;
  /** Largeur dans la grille historique de 12 colonnes. */
  span: Span;
  align: Align;
  /** URL d'une version grand format (visionneuse), optimisée. */
  fullSrc: string;
  /** Dimensions réelles de cette version (réservent la place avant chargement : pas de saut). */
  fullWidth: number;
  fullHeight: number;
  /** Miniature (bande de navigation de la visionneuse). */
  thumbSrc: string;
}

export interface VideoMedia {
  type: 'video';
  file: string;
  /** URL de la vidéo web (MP4 H.264). */
  src: string;
  /** Version plus légère pour les petits écrans (si l'original est grand). */
  mobileSrc?: string;
  /** GIF animé converti en vidéo : lecture automatique, muette, en boucle. */
  animated?: boolean;
  poster?: { src: ImageMetadata; url: string; thumb: string };
  alt: string;
  caption?: string;
  ratio: number;
  span: Span;
  align: Align;
  /** false = ratio deviné (16:9) puis corrigé côté navigateur après lecture des métadonnées. */
  ratioKnown: boolean;
}

export type Media = ImageMedia | VideoMedia;

/** Élément de galerie prêt à afficher : sa place dans le bloc + le média résolu. */
export interface GalleryItem extends NormalizedItem {
  media: Media;
}

export interface GalleryBlock extends Omit<NormalizedBlock, 'items'> {
  items: GalleryItem[];
}

/** Nom du dossier d'un projet, à partir du chemin de son project.md. */
export function projectFolder(project: Project): string {
  const parts = (project.filePath ?? '').split('/');
  return parts[parts.length - 2] ?? project.id;
}

/** Versions web prêtes d'un projet (manifeste), et accès à leurs fichiers. */
function webAssets(folder: string) {
  const base = `/src/content/projects/${folder}/`;
  const items = manifests[`${base}media.json`]?.items ?? {};
  const ready = new Map(Object.entries(items).filter(([, e]) => e.status === 'ok'));
  return {
    ready,
    /** Fichiers d'origine ayant une version web (même nom : identifiant stable du média). */
    files: mediaFiles(ready.keys()),
    image: (rel?: string) => (rel ? webImages[base + rel] : undefined),
    url: (rel?: string) => (rel ? webUrls[base + rel] : undefined),
    /** URL d'une version vidéo, locale ou distante (undefined : indisponible dans ce contexte). */
    video: (file: string, entry: WebEntry, key: 'video' | 'mobile') => {
      const output = entry.outputs[key];
      if (!output) return undefined;
      return resolveOutputUrl({
        storage: entry.storage?.[key],
        folder,
        file,
        output,
        base: REMOTE_BASE,
        dev: import.meta.env.DEV,
        localUrl: webUrls[base + output],
      });
    },
  };
}

/** Image de couverture : champ `cover`, sinon `cover.*`, sinon la première image du dossier (version web). */
export function getCover(project: Project): ImageMetadata | undefined {
  const web = webAssets(projectFolder(project));
  const images = mediaFiles(
    [...web.ready].filter(([, e]) => e.kind === 'image' && !e.vector).map(([n]) => n),
  );
  const file = effectiveCover(project.data.cover, images);
  return file ? web.image(web.ready.get(file)?.outputs.image) : undefined;
}

/**
 * Galerie d'un projet, en blocs prêts à afficher.
 * Sans `blocks:` : un seul bloc « historique », identique à l'ancienne galerie.
 */
export async function getProjectGallery(
  project: Project,
  labels: { imageAlt: (n: number) => string; videoAlt: (n: number) => string },
): Promise<{ blocks: GalleryBlock[]; count: number }> {
  const folder = projectFolder(project);
  const web = webAssets(folder);
  const files = web.files;
  const settings = new Map(project.data.media.map((m) => [m.file, m]));

  // fichiers cités par la fiche mais sans version web : signalés (`npm run medias` les génère)
  const cited = [
    ...project.data.media.map((m) => m.file),
    ...(project.data.blocks ?? []).flatMap((b) => (b.items ?? []).map((i) => i.file)),
  ];
  const missing = [...new Set(cited)].filter((f) => !web.ready.has(f));
  if (missing.length)
    console.warn(
      `[médias] ${folder} — sans version web (lancer « npm run medias ») : ${missing.join(', ')}`,
    );

  const { blocks, issues } = normalizeGallery({
    files,
    media: project.data.media,
    blocks: project.data.blocks,
    unplaced: project.data.unplaced,
  });
  for (const issue of issues) {
    console.warn(`[galerie] ${folder} — ${issue.message}`);
  }

  // Un média est résolu une seule fois, même s'il apparaît dans plusieurs blocs.
  // Numérotation des textes alternatifs par défaut : ordre de première apparition (identique à l'ancien).
  const resolved = new Map<string, Promise<Media | undefined>>();
  let index = 0;
  const resolve = (file: string, legacySpan?: Span) => {
    if (!resolved.has(file)) {
      index += 1;
      resolved.set(file, resolveMedia(file, index, legacySpan));
    }
    return resolved.get(file)!;
  };

  async function resolveMedia(
    file: string,
    n: number,
    legacySpan?: Span,
  ): Promise<Media | undefined> {
    const conf = settings.get(file);
    const entry = web.ready.get(file);
    if (!entry) return undefined;

    if (entry.kind === 'video') {
      const videoUrl = web.video(file, entry, 'video');
      const mobileUrl = web.video(file, entry, 'mobile');
      const poster = web.image(entry.outputs.poster);
      if (!videoUrl) {
        // version principale sur le stockage externe, non configuré : repli sur la version mobile
        // (publiée avec le site), sinon sur l'affiche — le média reste visible
        console.warn(
          `[médias] ${folder} — ${file} : vidéo sur stockage distant (PUBLIC_MEDIA_BASE_URL non défini) → ${mobileUrl ? 'version mobile' : poster ? 'affiche seule' : 'non affichée'}`,
        );
        if (!mobileUrl) return poster ? imageMedia(file, poster, n, legacySpan) : undefined;
      }
      const declared = parseRatio(conf?.ratio);
      const ratio = declared ?? entry.ratio ?? entry.width / entry.height;
      let posterInfo: VideoMedia['poster'];
      if (poster) {
        const [optimized, thumb] = await Promise.all([
          getImage({ src: poster, width: Math.min(poster.width, 1920), format: 'webp' }),
          getImage({ src: poster, width: 240, format: 'webp' }),
        ]);
        posterInfo = { src: poster, url: optimized.src, thumb: thumb.src };
      }
      return {
        type: 'video',
        file,
        src: (videoUrl ?? mobileUrl)!,
        mobileSrc: videoUrl ? mobileUrl : undefined,
        animated: entry.animated,
        poster: posterInfo,
        alt: conf?.alt ?? labels.videoAlt(n),
        caption: conf?.caption,
        ratio,
        span: legacySpan ?? defaultSpan('video', ratio),
        align: conf?.align ?? DEFAULT_ALIGN,
        ratioKnown: true, // dimensions mesurées par le pipeline
      };
    }
    if (entry.vector) {
      const svg = web.url(entry.outputs.image);
      if (!svg) return undefined;
      const ratio = entry.ratio ?? entry.width / entry.height;
      return {
        type: 'image',
        file,
        svg,
        alt: conf?.alt ?? labels.imageAlt(n),
        caption: conf?.caption,
        ratio,
        span: legacySpan ?? defaultSpan('image', ratio),
        align: conf?.align ?? DEFAULT_ALIGN,
        fullSrc: svg,
        fullWidth: entry.width,
        fullHeight: entry.height,
        thumbSrc: svg,
      };
    }
    const image = web.image(entry.outputs.image);
    return image ? imageMedia(file, image, n, legacySpan) : undefined;
  }

  /** Image matricielle prête à afficher (grille + visionneuse). */
  async function imageMedia(
    file: string,
    image: ImageMetadata,
    n: number,
    legacySpan?: Span,
  ): Promise<ImageMedia> {
    const conf = settings.get(file);
    const [full, thumb] = await Promise.all([
      // visionneuse : jusqu'à 3840 px (écrans 4K), en WebP
      getImage({ src: image, width: Math.min(image.width, 3840), format: 'webp', quality: 85 }),
      getImage({ src: image, width: 240, format: 'webp' }),
    ]);
    return {
      type: 'image',
      file,
      src: image,
      alt: conf?.alt ?? labels.imageAlt(n),
      caption: conf?.caption,
      ratio: image.width / image.height,
      span: legacySpan ?? defaultSpan('image', image.width / image.height),
      align: conf?.align ?? DEFAULT_ALIGN,
      fullSrc: full.src,
      fullWidth: Number(full.attributes.width) || image.width,
      fullHeight: Number(full.attributes.height) || image.height,
      thumbSrc: thumb.src,
    };
  }

  // Résolution dans l'ordre d'affichage (numérotation stable), puis attente groupée.
  const pending = blocks.map((block) =>
    block.items.map((item) => ({ item, media: resolve(item.file, item.legacySpan) })),
  );
  const out: GalleryBlock[] = [];
  let count = 0;
  for (const [i, block] of blocks.entries()) {
    const items: GalleryItem[] = [];
    for (const { item, media } of pending[i]!) {
      const m = await media;
      if (!m) continue;
      // Légende propre à l'emplacement (blocs) ; sinon celle de `media:`.
      items.push({ ...item, media: item.caption ? { ...m, caption: item.caption } : m });
    }
    if (!items.length) continue;
    count += items.length;
    out.push({ ...block, items });
  }
  return { blocks: out, count };
}
