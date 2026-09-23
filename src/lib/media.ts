import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { defaultSpan, DEFAULT_ALIGN, parseRatio, type Align, type Span } from './gallery-layout';
import { baseOf, effectiveCover, mediaFiles, posterPairs } from './media-rules';
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

// Formats activés dans src/schemas/media.ts (un test vérifie que ces motifs correspondent).
const imageModules = import.meta.glob<ImageMetadata>(
  '/src/content/projects/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' },
);

const videoModules = import.meta.glob<string>('/src/content/projects/*/*.{mp4,webm,MP4,WEBM}', {
  eager: true,
  import: 'default',
  query: '?url',
});

export interface ImageMedia {
  type: 'image';
  file: string;
  src: ImageMetadata;
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
  /** URL du fichier vidéo. */
  src: string;
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

const filename = (path: string) => path.split('/').pop() ?? path;

function filesOf<T>(modules: Record<string, T>, folder: string): Map<string, T> {
  const prefix = `/src/content/projects/${folder}/`;
  const files = new Map<string, T>();
  for (const [path, value] of Object.entries(modules)) {
    if (path.startsWith(prefix)) files.set(filename(path), value);
  }
  return files;
}

/** Image de couverture : champ `cover`, sinon `cover.*`, sinon la première image du dossier. */
export function getCover(project: Project): ImageMetadata | undefined {
  const images = filesOf(imageModules, projectFolder(project));
  const file = effectiveCover(project.data.cover, mediaFiles(images.keys()));
  return file ? images.get(file) : undefined;
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
  const images = filesOf(imageModules, folder);
  const videos = filesOf(videoModules, folder);
  const files = mediaFiles([...images.keys(), ...videos.keys()]);
  const { posterOf } = posterPairs(files);
  const settings = new Map(project.data.media.map((m) => [m.file, m]));

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
    const image = images.get(file);
    const videoUrl = videos.get(file);

    if (videoUrl) {
      const posterName = posterOf.get(file);
      const poster = posterName ? images.get(posterName) : undefined;
      const declared = parseRatio(conf?.ratio);
      const ratio = declared ?? (poster ? poster.width / poster.height : 16 / 9);
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
        src: videoUrl,
        poster: posterInfo,
        alt: conf?.alt ?? labels.videoAlt(n),
        caption: conf?.caption,
        ratio,
        span: legacySpan ?? defaultSpan('video', ratio),
        align: conf?.align ?? DEFAULT_ALIGN,
        ratioKnown: Boolean(declared || poster),
      };
    }
    if (image) {
      const [full, thumb] = await Promise.all([
        getImage({ src: image, width: Math.min(image.width, 2560), format: 'webp', quality: 85 }),
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
    return undefined;
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

/* ------------------------------------------------------------------ *
 * Visuel d'un domaine (section « Expertises »)
 * Déposer  src/assets/domaines/<slug-du-domaine>.jpg  (ou .png/.webp/.avif)
 * et/ou    src/assets/domaines/<slug-du-domaine>.mp4  (ou .webm)
 * Sans fichier, une illustration technique (étiquetée comme telle) s'affiche.
 * ------------------------------------------------------------------ */
const domainImages = import.meta.glob<ImageMetadata>(
  '/src/assets/domaines/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' },
);
const domainVideos = import.meta.glob<string>('/src/assets/domaines/*.{mp4,webm,MP4,WEBM}', {
  eager: true,
  import: 'default',
  query: '?url',
});

export interface DomainMedia {
  image?: ImageMetadata;
  video?: string;
}

export function getDomainMedia(slug: string): DomainMedia {
  const find = <T>(modules: Record<string, T>) =>
    Object.entries(modules).find(([path]) => baseOf(filename(path)).toLowerCase() === slug)?.[1];
  return { image: find(domainImages), video: find(domainVideos) };
}
