/**
 * Administration locale — point d'entrée.
 * Interface en TypeScript, sans framework ; routage par « # » (une seule page : /admin).
 *
 *   #/                       Tableau de bord
 *   #/projets                Liste
 *   #/projets/nouveau        Création
 *   #/projets/<slug>         Éditeur → Informations
 *   #/projets/<slug>/galerie Éditeur → Galerie
 *   #/projets/<slug>/apercu  Éditeur → Prévisualisation
 *   #/studio/<onglet>        Studio : theme | animations | sections | navigation
 */
import type { Meta, Route, View } from './types';
import { h, icon } from './ui';
import { mountDashboard } from './views/dashboard';
import { mountEditor } from './views/editor';
import { mountNewProject } from './views/new-project';
import { mountProjects } from './views/projects';
import { mountStudio } from './views/studio';
import type { StudioTab } from './types';

const STUDIO_TABS: StudioTab[] = ['theme', 'animations', 'sections', 'navigation'];

/*
  Le serveur de développement recharge TOUTES les pages quand un fichier du site change (nouveau média,
  project.md…). L'administration écrit justement ces fichiers : sans cette garde, chaque envoi ou chaque
  enregistrement rechargerait /admin en plein travail. (Lever l'exception annule le rechargement.)
  Les pages du site, elles, se rechargent normalement — c'est ce qui met à jour l'aperçu.
*/
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', () => {
    throw new Error('[admin] rechargement automatique évité');
  });
  // cette exception est voulue : on l'empêche de s'afficher comme une erreur dans la console
  window.addEventListener('error', (event) => {
    if (String(event.message).includes('[admin] rechargement')) event.preventDefault();
  });
}

const meta = JSON.parse(document.getElementById('cms-meta')!.textContent ?? '{}') as Meta;

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'studio') {
    const tab = STUDIO_TABS.find((t) => t === parts[1]) ?? 'theme';
    return { name: 'studio', tab };
  }
  if (parts[0] !== 'projets') return { name: 'dashboard' };
  if (!parts[1]) return { name: 'projects' };
  if (parts[1] === 'nouveau') return { name: 'new' };
  const tab = parts[2] === 'galerie' ? 'galerie' : parts[2] === 'apercu' ? 'apercu' : 'infos';
  return { name: 'edit', slug: parts[1], tab };
}

/* ---------- coque : barre latérale + zone principale ---------- */
const nav = h('nav', { class: 'cms-nav', 'aria-label': 'Navigation' });
const main = h('main', { class: 'cms-main', id: 'cms-main' });

const NAV = [
  { id: 'dashboard', label: 'Tableau de bord', href: '#/', icon: 'dashboard' as const },
  { id: 'projects', label: 'Projets', href: '#/projets', icon: 'folder' as const },
  { id: 'new', label: 'Nouveau projet', href: '#/projets/nouveau', icon: 'plus' as const },
  { id: 'studio', label: 'Studio', href: '#/studio/theme', icon: 'layout' as const },
];

function renderNav(route: Route) {
  const active = route.name === 'edit' ? 'projects' : route.name;
  nav.replaceChildren(
    ...NAV.map((item) =>
      h(
        'a',
        {
          class: `cms-nav-link${item.id === active ? ' is-on' : ''}`,
          href: item.href,
          'aria-current': item.id === active ? 'page' : undefined,
        },
        icon(item.icon, 18),
        item.label,
      ),
    ),
  );
}

document
  .getElementById('cms-root')!
  .append(
    h(
      'div',
      { class: 'cms-shell' },
      h(
        'aside',
        { class: 'cms-side' },
        h(
          'a',
          { class: 'cms-brand', href: '#/' },
          h('span', { class: 'cms-monogram' }, 'IF'),
          h('span', null, h('strong', null, 'Administration'), h('small', null, 'Ibrahima Faye')),
        ),
        nav,
        h(
          'div',
          { class: 'cms-side-foot' },
          h(
            'a',
            { class: 'cms-nav-link', href: '/', target: '_blank', rel: 'noopener' },
            icon('globe', 18),
            'Voir le site',
          ),
          h(
            'a',
            { class: 'cms-nav-link', href: '/projets/', target: '_blank', rel: 'noopener' },
            icon('external', 18),
            'Page Projets',
          ),
          h('p', { class: 'cms-local' }, h('i'), 'Mode local — jamais publié'),
        ),
      ),
      main,
    ),
    h('div', { id: 'cms-toasts', 'aria-live': 'polite' }),
  );

/* ---------- routeur ---------- */
let current: { route: Route; view: View } | undefined;
let token = 0;

async function navigate() {
  const route = parseRoute(location.hash);
  const id = ++token;

  // même projet, autre onglet : la vue se met à jour sans recharger ses données
  if (current?.view.update?.(route)) {
    current.route = route;
    renderNav(route);
    return;
  }

  await current?.view.dispose();
  current = undefined;
  renderNav(route);
  main.scrollTo({ top: 0 });
  window.scrollTo({ top: 0 });

  const view =
    route.name === 'dashboard'
      ? await mountDashboard(main, meta)
      : route.name === 'projects'
        ? await mountProjects(main, meta)
        : route.name === 'new'
          ? mountNewProject(main, meta)
          : route.name === 'studio'
            ? await mountStudio(main, route, meta)
            : await mountEditor(main, route, meta);

  if (id !== token) {
    await view.dispose(); // une navigation plus récente a pris le relais
    return;
  }
  current = { route, view };
  document.title =
    route.name === 'edit'
      ? `${route.slug} — Administration`
      : route.name === 'studio'
        ? 'Studio — Administration'
        : 'Administration — Ibrahima Faye';
}

window.addEventListener('hashchange', () => void navigate());
void navigate();
