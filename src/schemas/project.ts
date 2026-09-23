/**
 * Schéma d'un projet (frontmatter de src/content/projects/<slug>/project.md).
 * Partagé par la collection de contenu (src/content.config.ts), l'API locale de /admin et les tests.
 *
 * Tous les champs historiques sont inchangés ; `blocks` et `unplaced` sont facultatifs :
 * sans eux, la galerie s'affiche exactement comme avant (composition « historique » de `media:`).
 */
import { z } from 'astro/zod';
import { domainSlugs } from '@/data/domains';
import { entitySlugs, projectStatuses } from '@/data/entities';
import { ALIGNS, isSpan, type Span } from '@/lib/gallery-layout';
import { blocksSchema, unplacedSchema } from './blocks';

/** « 16:9 », « 4/3 », « 1.5:1 »… */
export const ratioPattern = /^\d+(\.\d+)?\s*[:/]\s*\d+(\.\d+)?$/;

/** Réglages d'un fichier (texte alternatif, légende, ratio) + sa place dans la composition historique. */
export const mediaEntrySchema = z.object({
  file: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  /** Ratio d'une vidéo (inconnu au build) : « 16:9 » (défaut), « 9:16 »… */
  ratio: z.string().regex(ratioPattern).optional(),
  hidden: z.boolean().default(false),
  /** Composition historique : largeur dans la grille de 12 colonnes (3, 4, 6, 8, 9, 12). */
  span: z.custom<Span>(isSpan, 'span : 3, 4, 6, 8, 9 ou 12').optional(),
  align: z.enum(ALIGNS).optional(),
});

export const projectSchema = z.object({
  // — Obligatoire —
  title: z.string().min(1),
  category: z.enum(domainSlugs),

  // — Recommandé —
  /** Phrase d'accroche (carte + SEO). Ne rien inventer : laisser vide plutôt qu'improviser. */
  summary: z.string().max(240).optional(),
  /**
   * Marque(s) : `clicgraph`, `jeefsys` ou `personal`.
   * Un projet commun s'écrit avec une liste : `entity: [clicgraph, jeefsys]`.
   * (Toujours lu comme une liste par le reste du site.)
   */
  entity: z
    .union([z.enum(entitySlugs), z.array(z.enum(entitySlugs)).min(1)])
    .default('personal')
    .transform((value) => (Array.isArray(value) ? value : [value])),
  year: z.number().int().min(2000).max(2100).optional(),
  technologies: z.array(z.string()).default([]),

  // — Optionnel —
  /** Remplace le nom du dossier dans l'URL (/projets/<slug>/). */
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug : minuscules, chiffres et tirets uniquement')
    .optional(),
  status: z.enum(projectStatuses).optional(),
  /** À renseigner uniquement si c'est vrai. */
  client: z.string().optional(),
  /** Mon rôle sur le projet (ex. « Conception 3D et modélisation »). Uniquement si c'est vrai. */
  role: z.string().optional(),
  /** Contexte : d'où vient le projet, quel besoin. Uniquement si c'est vrai. */
  context: z.string().optional(),
  /** Résultat obtenu. Uniquement si c'est vrai et vérifiable. */
  result: z.string().optional(),
  /**
   * Image de couverture : nom d'un fichier image du dossier (ex. `01-facade.jpg`).
   * Sans ce champ : le fichier `cover.*`, sinon la première image.
   */
  cover: z.string().optional(),
  /** Texte alternatif de l'image principale. */
  coverAlt: z.string().optional(),
  /** Mis en avant sur la page d'accueil. */
  featured: z.boolean().default(false),
  /** Brouillon : visible en développement uniquement, jamais dans le site publié. */
  draft: z.boolean().default(false),
  /** Ordre manuel (plus petit = plus haut). Sans valeur : tri par année décroissante. */
  order: z.number().optional(),
  links: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
  /**
   * Réglages PAR FICHIER (écrits par /admin, modifiables à la main).
   * Sans `blocks`, c'est aussi la composition de la galerie : les fichiers listés passent en premier,
   * dans cet ordre ; les autres suivent par nom.
   */
  media: z.array(mediaEntrySchema).default([]),
  /**
   * Mise en page en blocs (facultatif) — voir src/schemas/blocks.ts et docs/MODELE-DE-DONNEES.md.
   * Absent : composition historique ci-dessus, rendu inchangé.
   */
  blocks: blocksSchema.optional(),
  /** Fichiers placés dans aucun bloc : `append` (affichés à la fin, par défaut) ou `hide`. */
  unplaced: unplacedSchema.optional(),
});

export type ProjectFrontmatter = z.input<typeof projectSchema>;
export type ProjectData = z.output<typeof projectSchema>;
