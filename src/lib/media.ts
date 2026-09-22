import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { defaultSpan, DEFAULT_ALIGN, parseRatio, type Align, type Span } from './gallery-layout';

/**
 * Détection automatique des médias d'un projet.
 *
 * Convention (voir docs/AJOUTER-UN-PROJET.md) :
 *   champ `cover`     → image principale choisie dans l'administration (n'importe quel fichier image)
 *   cover.*            → sinon, image principale par convention (exclue de la galerie)
 *   <nom>.mp4/.webm    → vidéo ; <nom>.jpg/png/webp/avif du MÊME nom = son affiche (poster)
 *   toute autre image  → galerie, triée par nom (image-01, image-02, …)
 *
 * Aucun recadrage : chaque média garde son ratio d'origine.
 */

type Project = CollectionEntry<'projects'>;

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
  /** Largeur dans la grille de 12 colonnes. */
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

/** Nom du dossier d'un projet, à partir du chemin de son project.md. */
export function projectFolder(project: Project): string {
  const parts = (project.filePath ?? '').split('/');
  return parts[parts.length - 2] ?? project.id;
}

const basename = (file: string) => file.replace(/\.[^.]+$/, '');
const filename = (path: string) => path.split('/').pop() ?? path;
const natural = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

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
  const chosen = project.data.cover ? images.get(project.data.cover) : undefined;
  if (chosen) return chosen;
  const cover = [...images.entries()].find(([file]) => basename(file).toLowerCase() === 'cover');
  if (cover) return cover[1];
  const first = [...images.keys()].sort(natural.compare)[0];
  return first ? images.get(first) : undefined;
}

/** Toute la galerie d'un projet, prête à afficher. */
export async function getProjectMedia(
  project: Project,
  labels: { imageAlt: (n: number) => string; videoAlt: (n: number) => string },
): Promise<Media[]> {
  const folder = projectFolder(project);
  const images = filesOf(imageModules, folder);
  const videos = filesOf(videoModules, folder);
  const settings = new Map(project.data.media.map((m) => [m.file, m]));

  const videoNames = new Set([...videos.keys()].map((f) => basename(f).toLowerCase()));
  const posters = new Map<string, ImageMetadata>();
  const galleryImages: [string, ImageMetadata][] = [];

  for (const [file, meta] of images) {
    const name = basename(file).toLowerCase();
    if (name === 'cover' && !settings.has(file)) continue; // sauf si l'administration l'a placé dans la galerie
    if (videoNames.has(name)) {
      posters.set(name, meta);
      continue;
    }
    galleryImages.push([file, meta]);
  }

  const files: string[] = [...galleryImages.map(([f]) => f), ...videos.keys()];
  // Fichiers cités dans `media:` d'abord (dans l'ordre donné), les autres ensuite, par nom.
  const listed = project.data.media.map((m) => m.file).filter((f) => files.includes(f));
  const rest = files.filter((f) => !listed.includes(f)).sort(natural.compare);
  const ordered = [...new Set([...listed, ...rest])].filter((f) => !settings.get(f)?.hidden);

  const result: Media[] = [];
  let index = 0;
  for (const file of ordered) {
    index += 1;
    const conf = settings.get(file);
    const image = images.get(file);
    const videoUrl = videos.get(file);

    if (videoUrl) {
      const poster = posters.get(basename(file).toLowerCase());
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
      result.push({
        type: 'video',
        file,
        src: videoUrl,
        poster: posterInfo,
        alt: conf?.alt ?? labels.videoAlt(index),
        caption: conf?.caption,
        ratio,
        span: conf?.span ?? defaultSpan('video', ratio),
        align: conf?.align ?? DEFAULT_ALIGN,
        ratioKnown: Boolean(declared || poster),
      });
    } else if (image) {
      const [full, thumb] = await Promise.all([
        getImage({ src: image, width: Math.min(image.width, 2560), format: 'webp', quality: 85 }),
        getImage({ src: image, width: 240, format: 'webp' }),
      ]);
      result.push({
        type: 'image',
        file,
        src: image,
        alt: conf?.alt ?? labels.imageAlt(index),
        caption: conf?.caption,
        ratio: image.width / image.height,
        span: conf?.span ?? defaultSpan('image', image.width / image.height),
        align: conf?.align ?? DEFAULT_ALIGN,
        fullSrc: full.src,
        fullWidth: Number(full.attributes.width) || image.width,
        fullHeight: Number(full.attributes.height) || image.height,
        thumbSrc: thumb.src,
      });
    }
  }
  return result;
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
    Object.entries(modules).find(([path]) => basename(filename(path)).toLowerCase() === slug)?.[1];
  return { image: find(domainImages), video: find(domainVideos) };
}
