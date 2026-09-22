import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { domainSlugs } from '@/data/domains';
import { entitySlugs, projectStatuses } from '@/data/entities';
import { ALIGNS, isSpan, type Span } from '@/lib/gallery-layout';

/** « 16:9 », « 4/3 », « 1.5:1 »… */
const ratioPattern = /^\d+(\.\d+)?\s*[:/]\s*\d+(\.\d+)?$/;

/**
 * Un projet = un dossier dans src/content/projects/<slug>/ contenant :
 *   project.md   ← ce schéma (frontmatter) + description en Markdown
 *   cover.jpg    ← image principale (détectée automatiquement)
 *   *.jpg/png/webp/avif/mp4/webm ← galerie (détectée automatiquement)
 *
 * Voir docs/AJOUTER-UN-PROJET.md.
 */
const projects = defineCollection({
  loader: glob({
    pattern: '*/project.md',
    base: './src/content/projects',
    // Slug = champ `slug` s'il existe, sinon nom du dossier.
    generateId: ({ entry, data }) =>
      typeof data.slug === 'string' && data.slug ? data.slug : entry.split('/')[0],
  }),
  schema: z.object({
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
     * Composition de la galerie (écrite par l'administration /admin, modifiable à la main).
     * Les fichiers listés ici passent en premier, dans cet ordre ; les autres suivent par nom.
     * `span` : largeur dans la grille de 12 colonnes (3 = 1/4, 4 = 1/3, 6 = 1/2, 8 = 2/3, 9 = 3/4, 12 = pleine largeur).
     * `align` : alignement vertical quand les médias d'une ligne n'ont pas la même hauteur.
     */
    media: z
      .array(
        z.object({
          file: z.string(),
          alt: z.string().optional(),
          caption: z.string().optional(),
          /** Ratio d'une vidéo (inconnu au build) : « 16:9 » (défaut), « 9:16 »… */
          ratio: z.string().regex(ratioPattern).optional(),
          hidden: z.boolean().default(false),
          span: z.custom<Span>(isSpan, 'span : 3, 4, 6, 8, 9 ou 12').optional(),
          align: z.enum(ALIGNS).optional(),
        }),
      )
      .default([]),
  }),
});

export const collections = { projects };
