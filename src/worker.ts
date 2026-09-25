/**
 * Point d'entrée du Worker Cloudflare « ibrahima-faye » (voir wrangler.jsonc).
 *
 * Les pages publiques sont des fichiers générés au build, servis directement par Cloudflare : ce code
 * n'est appelé que pour les adresses SANS fichier.
 * - /admin et /admin/* → administration protégée (Cloudflare Access + vérification du jeton, src/worker/admin.ts) ;
 * - tout le reste → renvoyé tel quel au service de fichiers statiques : exactement la même réponse
 *   qu'avant l'ajout du Worker (404 vide, en-têtes de public/_headers), le site public ne change pas.
 */
import { handleAdmin } from './worker/admin';
import type { AccessEnv } from './worker/access';

export interface WorkerEnv extends AccessEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return handleAdmin(request, env);
    return env.ASSETS.fetch(request);
  },
};
