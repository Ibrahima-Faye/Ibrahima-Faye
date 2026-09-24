/**
 * Administration locale (« mini CMS ») — intégration Astro RÉSERVÉE AU DÉVELOPPEMENT.
 *
 * - `npm run dev`   → /admin est disponible ; l'API écrit dans src/content/projects/ (fichiers du projet).
 * - `npm run build` → cette intégration ne fait STRICTEMENT RIEN : ni page /admin, ni API dans le site publié.
 *   Le site reste 100 % statique et gratuit à héberger.
 *
 * Interface : src/cms/  ·  Serveur : integrations/local-cms/
 * Accès : protégé par mot de passe (auth.mjs) — page /admin/connexion, API /__cms réservée aux sessions.
 */
import { fileURLToPath } from 'node:url';
import { createApi } from './api.mjs';
import { createStore } from './store.mjs';
import { createSettings } from './settings.mjs';
import { authFromEnv } from './auth.mjs';
import { createJobs } from './media/jobs.mjs';
import { formatOf, listOriginals, readManifest, staleFiles } from './media/pipeline.mjs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { adminBrowserDeps, routerBrowserDeps } from './admin-deps.mjs';

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
        injectRoute({ pattern: '/admin/connexion', entrypoint: './src/cms/login.astro' });
        // la corbeille, les sauvegardes et les originaux (plusieurs Go) ne sont pas surveillés : aucun rechargement
        updateConfig({
          // /admin ET /admin/ fonctionnent. Développement uniquement : le site publié garde `trailingSlash: 'always'`.
          trailingSlash: 'ignore',
          vite: {
            // sortablejs (glisser-déposer, utilisé SEULEMENT par /admin) est un module ES natif sans dépendance :
            // on le sert tel quel, hors de l'optimiseur de Vite. Optimisé, il recevait un numéro de version qui
            // devenait « périmé » dès que Vite recompilait ses dépendances en cours de séance (barre d'outils Astro,
            // cache vidé…) → réponse 504 « Outdated Optimize Dep » → tout le JavaScript de /admin bloqué, page noire.
            // Toutes les autres bibliothèques du navigateur utilisées par /admin (lues dans ses imports, ex. astro/zod)
            // et les modules du routeur d'Astro sont pré-compilées DÈS LE DÉMARRAGE (voir admin-deps.mjs) : aucune
            // découverte tardive, donc aucune recompilation en cours de séance qui laisserait /admin en 504.
            optimizeDeps: {
              exclude: ['sortablejs'],
              include: [
                ...adminBrowserDeps(root).filter((dep) => dep !== 'sortablejs'),
                ...routerBrowserDeps(root),
              ],
            },
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
      'astro:server:setup': ({ server, logger }) => {
        // pipeline médias : versions web générées en tâche de fond (un fichier à la fois) ;
        // l'API charge les MÊMES modules que le site (règles des médias, schémas, listes) via Vite
        const projectsDir = path.join(root, 'src/content/projects');
        const jobs = createJobs(projectsDir);
        const load = (id) => server.ssrLoadModule(id);
        // authentification : mot de passe (empreinte) et réglages lus dans .env au démarrage du serveur
        const auth = authFromEnv(root);
        const api = createApi(
          createStore(root, { load, jobs }),
          createSettings(root, { load }),
          auth,
        );
        server.middlewares.use('/__cms', (req, res) => void api(req, res));
        // page /admin : sans session valide → page de connexion (l'ancre #/… est conservée par le navigateur)
        server.middlewares.use((req, res, next) => {
          const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
          const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
          if (!isAdmin || pathname.startsWith('/admin/connexion') || auth.check(req)) return next();
          res.writeHead(302, { Location: '/admin/connexion', 'Cache-Control': 'no-store' });
          res.end();
        });
        if (!auth.enabled) logger.warn('Administration SANS mot de passe (CMS_AUTH=off).');
        else if (!auth.configured)
          logger.warn(
            'Administration fermée : aucun mot de passe. Lancer « npm run admin:mot-de-passe ».',
          );

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
