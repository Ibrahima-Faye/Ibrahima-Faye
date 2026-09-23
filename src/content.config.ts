import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { projectSchema } from '@/schemas/project';

/**
 * Un projet = un dossier dans src/content/projects/<slug>/ contenant :
 *   project.md   ← schéma : src/schemas/project.ts (frontmatter) + description en Markdown
 *   cover.jpg    ← image principale (détectée automatiquement)
 *   *.jpg/png/webp/avif/mp4/webm ← galerie (détectée automatiquement ; formats : src/schemas/media.ts)
 *
 * Voir docs/AJOUTER-UN-PROJET.md et docs/MODELE-DE-DONNEES.md.
 */
const projects = defineCollection({
  loader: glob({
    pattern: '*/project.md',
    base: './src/content/projects',
    // Slug = champ `slug` s'il existe, sinon nom du dossier.
    generateId: ({ entry, data }) =>
      typeof data.slug === 'string' && data.slug ? data.slug : entry.split('/')[0],
  }),
  schema: projectSchema,
});

export const collections = { projects };
