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
import { createJobs } from './media/jobs.mjs';
import { formatOf, listOriginals, readManifest, staleFiles } from './media/pipeline.mjs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

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
                  '**/_web/.tmp-*/**', // versions web en cours de génération (pipeline médias)
                ],
              },
            },
          },
        });
        logger.info('Administration locale : http://localhost:4321/admin/');
      },
      'astro:server:setup': ({ server }) => {
        // pipeline médias : versions web générées en tâche de fond (un fichier à la fois) ;
        // l'API charge les MÊMES modules que le site (règles des médias, schémas, listes) via Vite
        const projectsDir = path.join(root, 'src/content/projects');
        const jobs = createJobs(projectsDir);
        const api = createApi(createStore(root, { load: (id) => server.ssrLoadModule(id), jobs }));
        server.middlewares.use('/__cms', (req, res) => void api(req, res));

        // En local, tout média sans version web à jour (déposé à la main, copié, modifié…) est traité
        // automatiquement : au démarrage, puis à chaque fichier ajouté ou modifié dans un dossier de projet.
        const scan = async (slug) => {
          const dir = path.join(projectsDir, slug);
          const { stale } = await staleFiles(
            dir,
            await readManifest(dir),
            await listOriginals(dir),
          );
          if (stale.length) jobs.enqueue(slug, stale);
        };
        const pending = new Map();
        const onFile = (file) => {
          const parts = path.relative(projectsDir, file).split(path.sep);
          if (parts.length !== 2 || parts[1].startsWith('.') || !formatOf(parts[1])) return;
          clearTimeout(pending.get(parts[0]));
          pending.set(
            parts[0],
            setTimeout(() => void scan(parts[0]).catch(() => {}), 1500),
          );
        };
        server.watcher.on('add', onFile);
        server.watcher.on('change', onFile);
        setTimeout(async () => {
          for (const d of await readdir(projectsDir, { withFileTypes: true }).catch(() => [])) {
            if (d.isDirectory()) await scan(d.name).catch(() => {});
          }
        }, 3000);
      },
    },
  };
}
