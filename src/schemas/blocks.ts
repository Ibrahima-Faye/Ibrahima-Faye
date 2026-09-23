/**
 * Blocs de mise en page de la galerie d'un projet (champ facultatif `blocks:` de project.md).
 * Documentation complète et exemples : docs/MODELE-DE-DONNEES.md
 *
 *   single    un média seul (image ou vidéo)
 *   grid      groupe / grille, images et vidéos mélangées
 *   carousel  carrousel
 *   compare   avant / après (2 images)
 *
 * Principes (ne jamais les affaiblir) :
 *  - AUCUN recadrage : chaque média garde son ratio, quels que soient colonnes et spans ;
 *  - rien ne disparaît : un type inconnu ou un bloc incohérent est conservé tel quel dans le fichier
 *    et affiché comme une grille ; un fichier présent mais placé nulle part s'affiche à la fin (`unplaced: append`) ;
 *  - les `id` (blocs et éléments) sont stables : l'éditeur s'appuie dessus ;
 *  - les champs inconnus sont conservés (objets « loose ») : une version future ne perd pas ses réglages.
 */
import { z } from 'astro/zod';
import { ALIGNS } from '@/lib/gallery-layout';

export const DEVICES = ['desktop', 'tablet', 'mobile'] as const;
export type Device = (typeof DEVICES)[number];

export const BLOCK_TYPES = ['single', 'grid', 'carousel', 'compare'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_WIDTHS = ['content', 'wide', 'full'] as const;
export const BLOCK_GAPS = ['none', 'sm', 'md', 'lg'] as const;
export const CAROUSEL_CONTROLS = ['arrows', 'dots', 'thumbs'] as const;

/** Colonnes proposées dans l'éditeur (12 = grille historique, réservée à la conversion des anciens projets). */
export const MAX_COLUMNS = 6;
export const LEGACY_COLUMNS = 12;

/** Une valeur, ou une valeur par appareil : `3` ou `{ desktop: 3, tablet: 2, mobile: 1 }`. */
const perDevice = <T extends z.ZodType>(value: T) =>
  z.union([
    value,
    z.looseObject({
      desktop: value.optional(),
      tablet: value.optional(),
      mobile: value.optional(),
    }),
  ]);

const count = z.number().int().min(1).max(LEGACY_COLUMNS);

export const blockItemSchema = z.looseObject({
  id: z.string().min(1).optional(),
  /** Nom du fichier dans le dossier du projet = identifiant du média (ne change jamais). */
  file: z.string().min(1),
  /** Colonnes occupées (grille). */
  span: perDevice(count).optional(),
  align: z.enum(ALIGNS).optional(),
  /** Légende pour CET emplacement (sinon celle de `media:`). */
  caption: z.string().optional(),
  /** Affiche choisie pour cette vidéo (sinon automatique). */
  poster: z.string().optional(),
  video: z
    .looseObject({
      autoplay: z.boolean().optional(),
      loop: z.boolean().optional(),
      muted: z.boolean().optional(),
      controls: z.boolean().optional(),
    })
    .optional(),
});

export const blockSchema = z.looseObject({
  id: z.string().min(1).optional(),
  /** Un des BLOCK_TYPES — un type inconnu est accepté et conservé (affiché comme une grille). */
  type: z.string().min(1),
  title: z.string().optional(),
  caption: z.string().optional(),
  width: z.enum(BLOCK_WIDTHS).optional(),
  hidden: z.boolean().optional(),
  items: z.array(blockItemSchema).optional(),
  // grille
  columns: perDevice(count).optional(),
  gap: z.enum(BLOCK_GAPS).optional(),
  align: z.enum(ALIGNS).optional(),
  // carrousel
  perView: perDevice(z.number().min(1).max(MAX_COLUMNS)).optional(),
  loop: z.boolean().optional(),
  /** Secondes entre deux diapositives ; 0 = pas de défilement automatique. */
  autoplay: z.number().min(0).max(60).optional(),
  controls: z.array(z.enum(CAROUSEL_CONTROLS)).optional(),
  // avant / après
  start: z.number().min(0).max(100).optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  labels: z.tuple([z.string(), z.string()]).optional(),
  /** Réservé à l'Animation Studio (identifiant de preset). */
  motion: z.string().optional(),
});

export const blocksSchema = z.array(blockSchema);
export const unplacedSchema = z.enum(['append', 'hide']);

export type BlockItem = z.infer<typeof blockItemSchema>;
export type Block = z.infer<typeof blockSchema>;
export type PerDevice<T> = T | { desktop?: T; tablet?: T; mobile?: T };

export const isKnownBlockType = (type: unknown): type is BlockType =>
  (BLOCK_TYPES as readonly string[]).includes(type as string);

export interface BlockIssue {
  /** `error` : refusé à l'enregistrement dans /admin. `warning` : accepté, affiché avec un repli sans perte. */
  level: 'error' | 'warning';
  blockId?: string;
  message: string;
}

/**
 * Cohérence des blocs (au-delà de la forme vérifiée par le schéma).
 * `files` : fichiers du dossier (pour signaler un fichier introuvable) ; `kinds` : type de chaque fichier.
 */
export function validateBlocks(
  blocks: readonly Block[],
  files?: ReadonlyMap<string, 'image' | 'video'>,
): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const blockIds = new Set<string>();
  const itemIds = new Set<string>();

  blocks.forEach((block, index) => {
    const label = `Bloc ${index + 1}${block.id ? ` (« ${block.id} »)` : ''}`;
    const warn = (message: string) =>
      issues.push({ level: 'warning', blockId: block.id, message: `${label} : ${message}` });

    if (block.id) {
      if (blockIds.has(block.id))
        issues.push({
          level: 'error',
          blockId: block.id,
          message: `${label} : identifiant déjà utilisé par un autre bloc.`,
        });
      blockIds.add(block.id);
    }
    const items = block.items ?? [];
    for (const item of items) {
      if (item.id) {
        if (itemIds.has(item.id))
          issues.push({
            level: 'error',
            blockId: block.id,
            message: `${label} : l'élément « ${item.id} » a un identifiant déjà utilisé.`,
          });
        itemIds.add(item.id);
      }
      if (files && !files.has(item.file))
        warn(
          `le fichier « ${item.file} » est introuvable dans le dossier du projet (ignoré à l'affichage).`,
        );
    }

    if (!isKnownBlockType(block.type)) {
      warn(`type inconnu « ${block.type} » : conservé tel quel, affiché comme une grille.`);
      return;
    }
    if (block.type === 'single' && items.length !== 1)
      warn(
        items.length
          ? `un bloc « média seul » contient ${items.length} médias : affiché comme une grille (rien n'est masqué).`
          : 'bloc « média seul » vide.',
      );
    if (block.type === 'carousel' && items.length < 2)
      warn('un carrousel a besoin d’au moins 2 médias.');
    if (block.type === 'compare') {
      const videos = files ? items.filter((i) => files.get(i.file) === 'video') : [];
      if (items.length !== 2 || videos.length)
        warn('un avant / après compare exactement 2 images : affiché comme une grille.');
    }
  });
  return issues;
}
