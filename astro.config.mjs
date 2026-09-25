// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import localCms from './integrations/local-cms/index.mjs';

/**
 * Adaptateur Cloudflare (Worker « ibrahima-faye », voir wrangler.jsonc) : même configuration que celle
 * qu'appliquait automatiquement le build Cloudflare, figée ici pour un déploiement reproductible.
 * Appliqué au build seulement : en développement (`astro dev`), le serveur reste celui d'aujourd'hui,
 * dont l'administration locale a besoin (elle charge le code du site dans Node).
 */
const isDev = process.argv.slice(2).includes('dev');

/**
 * URL publique du site (canonical, sitemap, Open Graph) : le domaine de production officiel.
 * La variable SITE_URL (chez l'hébergeur) le remplace si besoin, ex. pour un domaine de test.
 * (Le build Cloudflare Workers ne fournit aucune variable d'adresse : sans valeur par défaut,
 * canonical et sitemap pointaient vers http://localhost:4321.)
 */
const PRODUCTION_URL = 'https://ibrahimafye.com';
const site = process.env.SITE_URL || PRODUCTION_URL;

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static', // 100 % statique : les pages publiques sont générées au build
  adapter: isDev ? undefined : cloudflare(),
  trailingSlash: 'always',
  build: { format: 'directory' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // Le français est la langue par défaut, sans préfixe d'URL.
  // Pour ajouter l'anglais : voir docs/INTERNATIONALISATION.md
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr'],
    routing: { prefixDefaultLocale: false },
  },
  // localCms : administration /admin, UNIQUEMENT avec `npm run dev` (rien n'est ajouté au site publié)
  integrations: [sitemap(), localCms()],
  vite: {
    plugins: [tailwindcss()],
  },
});
