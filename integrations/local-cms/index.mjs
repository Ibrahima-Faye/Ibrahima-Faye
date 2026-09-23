/**
 * Administration locale (« mini CMS ») — intégration Astro RÉSERVÉE AU DÉVELOPPEMENT.
 *
 * - `npm run dev`   → /admin est disponible ; l'API écrit dans src/content/projects/ (fichiers du projet).
 * - `npm run build` → cette intégration ne fait STRICTEMENT RIEN : ni page /admin, ni API dans le site publié.
 *   Le site reste 100 % statique et gratuit à héberger.
 *
 * Interface : src/cms/  ·  Serveur : integrations/local-cms/
 */
import { fileURLToPath } from 'node:url';
import { createApi } from './api.mjs';
import { createStore } from './store.mjs';

export default function localCms() {
  /** @type {string} */
  let root = process.cwd();
  return {
    name: 'local-cms',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute, updateConfig, logger }) => {
        if (command !== 'dev') return;
        root = fileURLToPath(config.root);
        injectRoute({ pattern: '/admin', entrypoint: './src/cms/admin.astro' });
        // la corbeille, les sauvegardes et les originaux (plusieurs Go) ne sont pas surveillés : aucun rechargement
        updateConfig({
          // /admin ET /admin/ fonctionnent. Développement uniquement : le site publié garde `trailingSlash: 'always'`.
          trailingSlash: 'ignore',
          vite: {
            server: {
              watch: {
                ignored: [
                  '**/.trash/**',
                  `${root.replace(/\\/g, '/')}/backups/**`,
                  `${root.replace(/\\/g, '/')}/media/**`,
                ],
              },
            },
          },
        });
        logger.info('Administration locale : http://localhost:4321/admin/');
      },
      'astro:server:setup': ({ server }) => {
        // l'API charge les MÊMES modules que le site (règles des médias, schémas, listes) via Vite
        const api = createApi(createStore(root, { load: (id) => server.ssrLoadModule(id) }));
        server.middlewares.use('/__cms', (req, res) => void api(req, res));
      },
    },
  };
}
