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
 *   #/contenu/<catégorie>    Contenu du site : accueil | expertises | projets | ecosysteme | a-propos | contact | footer | navigation
 */
import type { Meta, Route, View } from './types';
import { authSession, logout, sessionExpired } from './api';
import { h, icon } from './ui';
import { mountDashboard } from './views/dashboard';
import { mountEditor } from './views/editor';
import { mountNewProject } from './views/new-project';
import { mountProjects } from './views/projects';
import { mountStudio } from './views/studio';
import { mountContent } from './views/content';
import type { ContentTab, StudioTab } from './types';

const CONTENT_TABS: ContentTab[] = [
  'accueil',
  'identite',
  'expertises',
  'projets',
  'ecosysteme',
  'a-propos',
  'contact',
  'footer',
  'navigation',
];

const STUDIO_TABS: StudioTab[] = ['theme', 'animations', 'sections', 'navigation'];

/*
  Le serveur de développement recharge TOUTES les pages quand un fichier du site change (nouveau média,
  project.md…). L'administration écrit justement ces fichiers : sans cette garde, chaque envoi ou chaque
  enregistrement rechargerait /admin en plein travail.
  Vite ne recharge pas une page quand l'avis de rechargement désigne une AUTRE page HTML : l'avis reçu
  par /admin est donc redirigé vers une page qui n'existe pas. (Auparavant, une exception annulait le
  rechargement, mais Vite la signalait comme une erreur dans le terminal.)
  Les pages du site, elles, se rechargent normalement — c'est ce qui met à jour l'aperçu.
*/
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', (payload: { path?: string }) => {
    payload.path = '/__admin-sans-rechargement.html';
  });
}

const meta = JSON.parse(document.getElementById('cms-meta')!.textContent ?? '{}') as Meta;

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'contenu') {
    const tab = CONTENT_TABS.find((t) => t === parts[1]) ?? 'accueil';
    return { name: 'content', tab };
  }
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
const authBox = h(
  'button',
  { type: 'button', class: 'cms-nav-link cms-logout', onclick: () => void logout() },
  icon('logout', 18),
  h('span', null, 'Se déconnecter'),
);
const nav = h('nav', { class: 'cms-nav', 'aria-label': 'Navigation principale' });
const main = h('main', { class: 'cms-main', id: 'cms-main' });

const NAV = [
  { id: 'dashboard', label: 'Tableau de bord', href: '#/', icon: 'dashboard' as const, group: 0 },
  { id: 'projects', label: 'Projets', href: '#/projets', icon: 'folder' as const, group: 0 },
  {
    id: 'new',
    label: 'Nouveau projet',
    href: '#/projets/nouveau',
    icon: 'plus' as const,
    group: 0,
  },
  {
    id: 'content',
    label: 'Contenu du site',
    href: '#/contenu/accueil',
    icon: 'fileText' as const,
    group: 1,
  },
  { id: 'studio', label: 'Studio', href: '#/studio/theme', icon: 'sliders' as const, group: 1 },
];
const NAV_GROUPS = ['Espace de travail', 'Site'];

/* navigation mobile : la barre latérale devient un panneau ouvert par le bouton « Menu » */
const side = h('aside', { class: 'cms-side', id: 'cms-side', 'aria-label': 'Administration' });
const menuButton = h(
  'button',
  {
    type: 'button',
    class: 'cms-menu-btn',
    'aria-controls': 'cms-side',
    'aria-expanded': 'false',
    'aria-label': 'Ouvrir le menu',
  },
  icon('menu', 20),
);
const topbarSection = h('span', { class: 'cms-topbar-section' });
const setMenu = (open: boolean) => {
  document.body.classList.toggle('cms-menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
};
menuButton.addEventListener('click', () =>
  setMenu(!document.body.classList.contains('cms-menu-open')),
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('cms-menu-open')) {
    setMenu(false);
    menuButton.focus();
  }
});

function renderNav(route: Route) {
  const active = route.name === 'edit' ? 'projects' : route.name;
  topbarSection.textContent = NAV.find((item) => item.id === active)?.label ?? '';
  setMenu(false);
  nav.replaceChildren(
    ...NAV_GROUPS.map((label, group) =>
      h(
        'div',
        { class: 'cms-nav-group' },
        h('p', { class: 'cms-nav-label' }, label),
        ...NAV.filter((item) => item.group === group).map((item) =>
          h(
            'a',
            {
              class: `cms-nav-link${item.id === active ? ' is-on' : ''}`,
              href: item.href,
              'aria-current': item.id === active ? 'page' : undefined,
            },
            icon(item.icon, 18),
            h('span', null, item.label),
          ),
        ),
      ),
    ),
  );
}

side.append(
  h(
    'a',
    { class: 'cms-brand', href: '#/' },
    h('span', { class: 'cms-monogram' }, 'IF'),
    h(
      'span',
      { class: 'cms-brand-text' },
      h('strong', null, 'Ibrahima Faye'),
      h('small', null, 'Administration'),
    ),
  ),
  nav,
  h(
    'div',
    { class: 'cms-side-foot' },
    h('p', { class: 'cms-nav-label' }, 'Système'),
    h(
      'a',
      { class: 'cms-nav-link', href: '/', target: '_blank', rel: 'noopener' },
      icon('globe', 18),
      h('span', null, 'Voir le site'),
      icon('external', 14),
    ),
    h(
      'a',
      { class: 'cms-nav-link', href: '/projets/', target: '_blank', rel: 'noopener' },
      icon('folder', 18),
      h('span', null, 'Page Projets'),
      icon('external', 14),
    ),
    h('p', { class: 'cms-local' }, h('i'), 'Mode local — jamais publié'),
    authBox,
  ),
);

document
  .getElementById('cms-root')!
  .append(
    h(
      'div',
      { class: 'cms-shell' },
      h(
        'header',
        { class: 'cms-topbar' },
        menuButton,
        h(
          'a',
          { class: 'cms-brand is-compact', href: '#/' },
          h('span', { class: 'cms-monogram' }, 'IF'),
          h('strong', null, 'Administration'),
        ),
        topbarSection,
      ),
      side,
      h('div', { class: 'cms-scrim', onclick: () => setMenu(false), 'aria-hidden': 'true' }),
      main,
    ),
    h('div', { id: 'cms-toasts', 'aria-live': 'polite' }),
  );

/* ---------- session : déconnexion, expiration ---------- */
function watchSession() {
  const check = async () => {
    try {
      const s = await authSession();
      if (!s.authenticated) sessionExpired();
      else if (!s.enabled)
        authBox.replaceChildren(
          h('p', { class: 'cms-auth-off' }, 'Sans mot de passe (CMS_AUTH=off)'),
        );
    } catch {
      /* serveur momentanément injoignable : nouvel essai au prochain passage */
    }
  };
  void check();
  window.setInterval(() => void check(), 60_000);
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'visible' && void check(),
  );
}
watchSession();

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
            : route.name === 'content'
              ? await mountContent(main, route, meta)
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
        : route.name === 'content'
          ? 'Contenu du site — Administration'
          : 'Administration — Ibrahima Faye';
}

window.addEventListener('hashchange', () => void navigate());
void navigate();
