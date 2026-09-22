// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import localCms from './integrations/local-cms/index.mjs';

/**
 * URL publique du site (canonical, sitemap, Open Graph).
 * Définir SITE_URL dans l'hébergeur (ex. https://mon-domaine.com).
 * Les variables natives de Vercel / Netlify / Cloudflare Pages servent de repli.
 */
const site =
  process.env.SITE_URL ||
  process.env.URL || // Netlify
  process.env.CF_PAGES_URL || // Cloudflare Pages
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static', // 100 % statique : déployable tel quel sur Vercel, Netlify, Cloudflare Pages
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
