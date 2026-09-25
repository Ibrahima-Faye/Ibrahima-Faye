/**
 * Route /admin/* rendue à la demande, ajoutée AU BUILD SEULEMENT par astro.config.mjs (en développement,
 * /admin reste l'administration locale, integrations/local-cms).
 *
 * Sa présence fait générer un vrai Worker par l'adaptateur Cloudflare (sans aucune route à la demande,
 * il ne publie que des fichiers statiques). En production, src/worker.ts traite /admin avant Astro ;
 * cette route applique la même vérification si jamais elle était atteinte.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { handleAdmin } from './admin';
import type { AccessEnv } from './access';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => handleAdmin(request, env as AccessEnv);
