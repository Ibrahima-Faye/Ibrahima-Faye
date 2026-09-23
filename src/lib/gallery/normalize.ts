/**
 * Galerie d'un projet → liste de blocs prêts à afficher (sans Astro ni navigateur : testable et partagé).
 *
 *  - Sans `blocks:` : UN bloc « historique » = exactement la composition actuelle
 *    (ordre de `media:`, spans de la grille de 12 colonnes, fichiers non listés triés par nom).
 *  - Avec `blocks:` : les blocs dans l'ordre du fichier, puis les fichiers placés nulle part (`unplaced: append`).
 *
 * Aucune perte : un bloc de type inconnu ou incohérent est affiché comme une grille (avec un avertissement
 * en développement), un fichier introuvable est seulement ignoré à l'affichage, et rien n'est jamais retiré
 * du fichier project.md.
 */
import type { Align, Span } from '@/lib/gallery-layout';
import { galleryEntries, type FileRef, type MediaKind } from '@/lib/media-rules';
import {
  isKnownBlockType,
  LEGACY_COLUMNS,
  validateBlocks,
  type Block,
  type BlockIssue,
  type BlockItem,
  type Device,
  type PerDevice,
} from '@/schemas/blocks';

export type Columns = Record<Device, number>;

export interface NormalizedItem {
  id: string;
  file: string;
  kind: MediaKind;
  /** Grille historique : span déclaré dans `media:` (sinon calculé d'après le ratio au rendu). */
  legacySpan?: Span;
  /** Grille : colonnes occupées sur chaque appareil (déjà bornées au nombre de colonnes). */
  span: Columns;
  align?: Align;
  /** Légende propre à cet emplacement. */
  caption?: string;
  poster?: string;
  video?: BlockItem['video'];
}

export interface NormalizedBlock {
  id: string;
  /** `legacy` : grille historique de 12 colonnes (rendu identique à l'ancien) · `grid` : grille par appareil. */
  layout: 'legacy' | 'grid';
  /** Type déclaré : single, grid, carousel, compare, un type inconnu, ou `legacy` / `unplaced`. */
  type: string;
  title?: string;
  caption?: string;
  width: 'content' | 'wide' | 'full';
  columns: Columns;
  gap: 'none' | 'sm' | 'md' | 'lg';
  align?: Align;
  items: NormalizedItem[];
  /** Repli appliqué (affiché en développement uniquement). */
  notice?: string;
  /** Réglages propres au type (carrousel, avant/après), conservés pour leur futur rendu. */
  options: Record<string, unknown>;
}

export interface GalleryInput {
  files: readonly FileRef[];
  media?: readonly { file: string; hidden?: boolean; span?: Span; align?: Align }[];
  blocks?: readonly Block[];
  unplaced?: 'append' | 'hide';
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/** `3` ou `{ desktop: 3 }` → valeurs pour les trois appareils (tablette ≤ 2 et mobile = 1 par défaut). */
export function resolveColumns(value: PerDevice<number> | undefined, fallback = 3): Columns {
  const o = typeof value === 'number' ? { desktop: value } : (value ?? {});
  const desktop = clamp(o.desktop ?? fallback, 1, LEGACY_COLUMNS);
  const tablet = clamp(o.tablet ?? Math.min(desktop, 2), 1, LEGACY_COLUMNS);
  const mobile = clamp(o.mobile ?? 1, 1, LEGACY_COLUMNS);
  return { desktop, tablet, mobile };
}

/** Span d'un élément, borné aux colonnes de chaque appareil (jamais plus large que la grille). */
export function resolveSpan(value: PerDevice<number> | undefined, columns: Columns): Columns {
  const o =
    typeof value === 'number' ? { desktop: value, tablet: value, mobile: value } : (value ?? {});
  return {
    desktop: clamp(o.desktop ?? 1, 1, columns.desktop),
    tablet: clamp(o.tablet ?? o.desktop ?? 1, 1, columns.tablet),
    mobile: clamp(o.mobile ?? 1, 1, columns.mobile),
  };
}

const PROVISIONAL: Record<string, string> = {
  carousel:
    'Carrousel : affiché en grille pour l’instant (le carrousel interactif viendra avec l’éditeur de blocs).',
  compare:
    'Avant / après : affiché en grille pour l’instant (le curseur viendra avec l’éditeur de blocs).',
};

function legacyBlock(
  id: string,
  type: string,
  entries: ReturnType<typeof galleryEntries>,
  media: NonNullable<GalleryInput['media']>,
): NormalizedBlock {
  const settings = new Map(media.map((m) => [m.file, m]));
  const full = { desktop: LEGACY_COLUMNS, tablet: LEGACY_COLUMNS, mobile: 1 };
  return {
    id,
    layout: 'legacy',
    type,
    width: 'wide',
    columns: full,
    gap: 'md',
    options: {},
    items: entries.map((e) => ({
      id: `${id}:${e.file}`,
      file: e.file,
      kind: e.kind,
      legacySpan: settings.get(e.file)?.span,
      span: full,
      align: settings.get(e.file)?.align,
    })),
  };
}

export function normalizeGallery(input: GalleryInput): {
  blocks: NormalizedBlock[];
  issues: BlockIssue[];
} {
  const media = input.media ?? [];
  const entries = galleryEntries(input.files, media).filter((e) => !e.hidden);

  // — composition historique : rendu identique à l'ancien —
  if (!Array.isArray(input.blocks)) {
    return {
      blocks: entries.length ? [legacyBlock('galerie', 'legacy', entries, media)] : [],
      issues: [],
    };
  }

  const kinds = new Map(input.files.map((f) => [f.name, f.kind]));
  const issues = validateBlocks(input.blocks, kinds);
  const placed = new Set<string>();
  const blocks: NormalizedBlock[] = [];

  input.blocks.forEach((block, index) => {
    const id = block.id ?? `bloc-${index + 1}`;
    const declared: BlockItem[] = block.items ?? [];
    declared.forEach((item) => placed.add(item.file)); // même masqué ou de type inconnu : le fichier est « placé »
    if (block.hidden) return;

    const items = declared.filter((item) => kinds.has(item.file));
    if (!items.length) return;

    let notice: string | undefined;
    let columns: Columns;
    const n = items.length;
    const imagesOnly = items.every((i) => kinds.get(i.file) === 'image');

    if (!isKnownBlockType(block.type)) {
      notice = `Type de bloc inconnu « ${block.type} » : affiché comme une grille, rien n’est perdu.`;
      columns = resolveColumns(block.columns);
    } else if (block.type === 'single') {
      if (n === 1) columns = { desktop: 1, tablet: 1, mobile: 1 };
      else {
        notice = `« Média seul » avec ${n} médias : affiché comme une grille, rien n’est masqué.`;
        columns = resolveColumns(block.columns);
      }
    } else if (block.type === 'grid') {
      columns = resolveColumns(block.columns);
    } else if (block.type === 'carousel') {
      notice = PROVISIONAL.carousel;
      columns = resolveColumns({ desktop: Math.min(n, 3), tablet: Math.min(n, 2), mobile: 1 });
    } else {
      notice =
        n === 2 && imagesOnly
          ? PROVISIONAL.compare
          : 'Avant / après : il faut exactement 2 images — affiché comme une grille, rien n’est perdu.';
      columns = resolveColumns({ desktop: Math.min(n, 2), tablet: Math.min(n, 2), mobile: 1 });
    }

    const {
      id: _id,
      type,
      title,
      caption,
      width,
      hidden: _hidden,
      items: _items,
      columns: _c,
      gap,
      align,
      ...options
    } = block;
    blocks.push({
      id,
      layout: 'grid',
      type,
      title,
      caption,
      width: width ?? 'wide',
      columns,
      gap: gap ?? 'md',
      align,
      notice,
      options,
      items: items.map((item, j) => ({
        id: item.id ?? `${id}-${j + 1}`,
        file: item.file,
        kind: kinds.get(item.file)!,
        span: resolveSpan(item.span, columns),
        align: item.align,
        caption: item.caption,
        poster: item.poster,
        video: item.video,
      })),
    });
  });

  // — fichiers placés dans aucun bloc : affichés à la fin (sauf `unplaced: hide`) —
  if (input.unplaced !== 'hide') {
    const rest = entries.filter((e) => !placed.has(e.file));
    if (rest.length) blocks.push(legacyBlock('non-places', 'unplaced', rest, media));
  }
  return { blocks, issues };
}
