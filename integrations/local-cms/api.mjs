/**
 * Routeur de l'API locale de l'administration (montée sur /__cms par index.mjs).
 *
 *   GET    /api/projects                        liste
 *   POST   /api/projects                        création
 *   GET    /api/projects/:slug                  détail (fiche + fichiers)
 *   PUT    /api/projects/:slug                  enregistrement (fiche, composition de galerie)
 *   DELETE /api/projects/:slug                  suppression → .trash/
 *   POST   /api/projects/:slug/rename           changement d'adresse
 *   POST   /api/projects/:slug/media?name=…     envoi d'un média (corps = fichier brut) [&poster=<vidéo>]
 *   DELETE /api/projects/:slug/media/:file      suppression d'un média → .trash/
 *   GET    /api/projects/:slug/optimize             état du pipeline médias (tâches en cours)
 *   POST   /api/projects/:slug/optimize             lancer l'optimisation { files?, force? }
 *   GET    /thumb/:slug/:file?w=480             miniature (depuis la version web si besoin : HEIC, vidéo)
 *   GET    /web/:slug/:file/:output             version web (vidéo MP4, affiche…)
 *   GET    /file/:slug/:file                    fichier d'origine (Range accepté)
 *   GET    /api/settings                        réglages du site (Studio) : thème, sections, navigation, animations
 *   GET    /api/settings/:name                  un réglage
 *   PUT    /api/settings/:name                  enregistrement { data, baseUpdatedAt?, force?, snapshot? }
 *   GET    /api/settings/:name/history          versions précédentes (.cms/historique/reglages/)
 *   GET    /api/settings/:name/history/:id      une version précédente
 *   POST   /api/identity?name=logo.svg          image d'identité → public/identite/ (corps = fichier brut)
 */
import { HttpError, guard, readJson, sendJson, serveFile } from './http.mjs';

const seg = (s) => decodeURIComponent(s);

export function createApi(store, settings) {
  return async function handle(req, res) {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = req.method ?? 'GET';
      const parts = url.pathname.split('/').filter(Boolean).map(seg);
      const mutating = !['GET', 'HEAD'].includes(method);
      guard(req, { mutating });
      await store.ready(); // règles et schémas partagés avec le site (à jour à chaque requête)

      // ---------- versions web (pipeline médias) ----------
      if (parts[0] === 'web' && parts.length === 4 && !mutating) {
        const media = store.webPath(parts[1], parts[2], parts[3]);
        return serveFile(req, res, media.path, media.mime);
      }

      // ---------- fichiers (images, vidéos, miniatures) ----------
      if ((parts[0] === 'thumb' || parts[0] === 'file') && parts.length === 3 && !mutating) {
        const [kind, slug, file] = parts;
        if (kind === 'thumb') {
          const out = await store.thumbnail(slug, file, Number(url.searchParams.get('w')) || 480);
          return serveFile(req, res, out, 'image/webp', {
            'Cache-Control': 'private, max-age=31536000, immutable',
          });
        }
        const media = store.mediaPath(slug, file);
        return serveFile(req, res, media.path, media.mime);
      }

      // ---------- réglages du site (Studio) ----------
      if (parts[0] === 'api' && parts[1] === 'settings') {
        if (parts.length === 2 && method === 'GET') return sendJson(res, 200, await settings.all());
        if (parts.length === 3 && method === 'GET')
          return sendJson(res, 200, await settings.read(parts[2]));
        if (parts.length === 3 && method === 'PUT')
          return sendJson(res, 200, await settings.save(parts[2], await readJson(req)));
        if (parts.length === 4 && parts[3] === 'history' && method === 'GET')
          return sendJson(res, 200, await settings.history(parts[2]));
        if (parts.length === 5 && parts[3] === 'history' && method === 'GET')
          return sendJson(res, 200, await settings.readHistory(parts[2], parts[4]));
        throw new HttpError(405, 'Méthode non autorisée.');
      }
      if (parts[0] === 'api' && parts[1] === 'identity' && parts.length === 2 && method === 'POST')
        return sendJson(res, 201, await settings.saveIdentity(req, url.searchParams.get('name')));

      // ---------- API JSON ----------
      if (parts[0] !== 'api' || parts[1] !== 'projects')
        throw new HttpError(404, 'Route inconnue.');
      const slug = parts[2];
      const sub = parts[3];

      if (parts.length === 2) {
        if (method === 'GET') return sendJson(res, 200, await store.listProjects());
        if (method === 'POST')
          return sendJson(res, 201, await store.createProject(await readJson(req)));
      } else if (parts.length === 3) {
        if (method === 'GET') return sendJson(res, 200, await store.getProject(slug));
        if (method === 'PUT')
          return sendJson(res, 200, await store.saveProject(slug, await readJson(req)));
        if (method === 'DELETE') return sendJson(res, 200, await store.trashProject(slug));
      } else if (sub === 'rename' && parts.length === 4 && method === 'POST') {
        const body = await readJson(req);
        return sendJson(res, 200, await store.renameProject(slug, body.slug));
      } else if (sub === 'optimize' && parts.length === 4) {
        if (method === 'GET') return sendJson(res, 200, store.optimizeStatus(slug));
        if (method === 'POST')
          return sendJson(res, 202, await store.optimize(slug, await readJson(req)));
      } else if (sub === 'media') {
        if (parts.length === 4 && method === 'POST') {
          const file = await store.saveUpload(slug, req, {
            name: url.searchParams.get('name'),
            poster: url.searchParams.get('poster'),
          });
          return sendJson(res, 201, file);
        }
        if (parts.length === 5 && method === 'DELETE')
          return sendJson(res, 200, await store.deleteMedia(slug, parts[4]));
      }
      throw new HttpError(405, 'Méthode non autorisée.');
    } catch (error) {
      const status =
        error instanceof HttpError ? error.status : error?.code === 'ENOENT' ? 404 : 500;
      if (status === 500) console.error('[cms]', error);
      if (!res.headersSent) sendJson(res, status, { error: error?.message ?? 'Erreur inconnue.' });
      else res.destroy();
    }
  };
}
