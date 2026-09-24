/**
 * Studio — personnaliser le site sans toucher au code : Thème, Animations, Sections, Navigation.
 *
 *   #/studio/theme · #/studio/animations · #/studio/sections · #/studio/navigation
 *
 * À gauche les réglages, à droite la vraie page du site (ordinateur / tablette / mobile).
 * Thème et animations : appliqués en direct dans l'aperçu (CSS, rejeu des animations).
 * Sections et navigation : enregistrées aussitôt, l'aperçu se recharge à la même position.
 * Tout s'enregistre seul dans src/settings/*.json (historique : .cms/historique/reglages/).
 */
import type { Meta, Route, SettingsName, StudioTab, View } from '../types';
import { h } from '../ui';
import { themeToCss, type ThemeSettings } from '@/lib/studio/theme';
import { StudioState, type SaveStatus } from '../studio/state';
import { createPreview } from '../studio/preview';
import { renderThemePanel } from '../studio/theme-panel';
import { renderAnimationsPanel, type AnimationsPanel } from '../studio/animations-panel';
import { renderSectionsPanel } from '../studio/sections-panel';
import { renderNavigationPanel } from '../studio/navigation-panel';

const TABS: { id: StudioTab; label: string; doc: SettingsName; hint: string }[] = [
  {
    id: 'theme',
    label: 'Thème',
    doc: 'theme',
    hint: 'Couleurs, typographie, interface, effets, identité',
  },
  {
    id: 'animations',
    label: 'Animations',
    doc: 'animations',
    hint: 'Animation Studio : préréglages, animation de chaque élément, rejeu dans l’aperçu',
  },
  {
    id: 'sections',
    label: 'Sections',
    doc: 'layout',
    hint: 'Ordre, textes, fonds de la page d’accueil',
  },
  {
    id: 'navigation',
    label: 'Navigation',
    doc: 'navigation',
    hint: 'Liens de l’en-tête : ordre, libellés et visibilité',
  },
];

const STATUS: Record<SaveStatus, string> = {
  saved: 'Enregistré',
  dirty: 'Modifications en cours',
  saving: 'Enregistrement…',
  error: 'Erreur',
};

export async function mountStudio(host: HTMLElement, route: Route, meta: Meta): Promise<View> {
  host.replaceChildren(h('p', { class: 'cms-muted' }, 'Chargement du Studio…'));
  const state = await StudioState.load();
  let tab: StudioTab = route.name === 'studio' ? route.tab : 'theme';
  let animationsPanel: AnimationsPanel | undefined;
  let animTarget: string | null = null;
  let sectionKey: string | null = null;

  /* ---------------------------------------------------------------- aperçu en direct */
  let lastReady = 0;
  let pendingFocus: string | undefined;
  let animTimer = 0;
  const pushTheme = () => {
    const { css, attrs } = themeToCss(state.get<ThemeSettings>('theme'));
    preview.post({ type: 'theme', css, attrs });
  };
  const pushAnimations = (focus?: string) => {
    if (focus) pendingFocus = focus;
    clearTimeout(animTimer);
    animTimer = window.setTimeout(() => {
      preview.post({ type: 'animations', config: state.get('animations'), focus: pendingFocus });
      pendingFocus = undefined;
    }, 90);
  };

  const preview = createPreview({
    onReady: () => {
      lastReady = Date.now();
      pushTheme();
      pushAnimations(animTarget ?? undefined);
    },
    onSelect: (id) => {
      if (tab !== 'animations') location.hash = '#/studio/animations';
      animTarget = id;
      setTimeout(() => animationsPanel?.select(id), 0);
    },
  });

  // Thème / animations : déjà visibles en direct → la page ne doit pas se recharger à l'enregistrement.
  // Sections, navigation, identité : rendues par le serveur → rechargement de l'aperçu.
  let savedIdentity = JSON.stringify(state.get<ThemeSettings>('theme').identity ?? {});
  const needsRender = new Map<SettingsName, boolean>();
  state.beforeSave = (name) => {
    const identity = JSON.stringify(state.get<ThemeSettings>('theme').identity ?? {});
    const render =
      name === 'layout' ||
      name === 'navigation' ||
      (name === 'theme' && identity !== savedIdentity);
    needsRender.set(name, render);
    if (!render) preview.post({ type: 'hold-reload' });
  };
  state.afterSave = (name) => {
    if (name === 'theme')
      savedIdentity = JSON.stringify(state.get<ThemeSettings>('theme').identity ?? {});
    if (!needsRender.get(name)) return;
    const since = Date.now();
    // le serveur de dev recharge normalement la page seul ; sinon, on le fait
    setTimeout(() => lastReady < since && preview.reload(), 1400);
  };

  state.onChange((name) => {
    if (name === 'theme') pushTheme();
    if (name === 'animations') pushAnimations(animTarget ?? undefined);
  });

  /* ---------------------------------------------------------------- panneaux */
  const panel = h('div', { class: 'st-panel-body' });
  const renderPanel = () => {
    // conserve groupes ouverts et position de défilement
    const open = new Set(
      [...panel.querySelectorAll('details[open] > summary')].map((s) => s.textContent),
    );
    const top = panel.scrollTop;
    animationsPanel = undefined;
    if (tab === 'theme') renderThemePanel(panel, state, renderPanel);
    if (tab === 'animations')
      animationsPanel = renderAnimationsPanel(panel, state, {
        rerender: renderPanel,
        initial: animTarget,
        replay: (id) => pushAnimations(id),
        onSelect: (id) => {
          animTarget = id;
          if (id) preview.post({ type: 'focus', id });
        },
      });
    if (tab === 'sections') {
      renderSectionsPanel(panel, state, {
        texts: meta.studio?.texts ?? {},
        initial: sectionKey,
        onFocus: (key) => {
          sectionKey = key;
          preview.post({
            type: 'focus',
            id:
              key === 'footer'
                ? 'footer.wordmark'
                : key === 'marquee'
                  ? 'marquee.track'
                  : `${key}.section`,
          });
        },
      });
    }
    if (tab === 'navigation')
      renderNavigationPanel(panel, state, { labels: meta.studio?.nav ?? {} });
    if (open.size)
      panel.querySelectorAll('details > summary').forEach((s) => {
        if (open.has(s.textContent)) (s.parentElement as HTMLDetailsElement).open = true;
      });
    panel.scrollTop = top;
  };

  const tabButtons = TABS.map((t) =>
    h(
      'a',
      {
        class: `st-tab${t.id === tab ? ' is-on' : ''}`,
        href: `#/studio/${t.id}`,
        title: t.hint,
        'aria-current': t.id === tab ? 'page' : undefined,
      },
      t.label,
    ),
  );
  const status = h('span', { class: 'st-status', role: 'status' });
  state.onStatus((s) => {
    // retour visuel bref quand un enregistrement vient d'aboutir
    if (s === 'saved' && status.dataset.state === 'saving') {
      status.classList.remove('is-flash');
      void status.offsetWidth;
      status.classList.add('is-flash');
    }
    status.textContent = STATUS[s];
    status.dataset.state = s;
    status.title = s === 'error' ? 'L’enregistrement automatique a échoué.' : '';
  });
  const heading = h('h1', null);
  const subtitle = h('p', null);
  const showTab = () => {
    const current = TABS.find((t) => t.id === tab)!;
    heading.textContent = current.label;
    subtitle.textContent = current.hint;
  };
  showTab();

  const docOf = () => TABS.find((t) => t.id === tab)!.doc;
  const undo = () => state.undo(docOf()) && renderPanel();
  const redo = () => state.redo(docOf()) && renderPanel();
  const onKey = (e: KeyboardEvent) => {
    const typing = (e.target as HTMLElement | null)?.closest?.('input[type=text], textarea');
    if (typing || !(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      redo();
    }
  };
  window.addEventListener('keydown', onKey);

  const root = h(
    'div',
    { class: 'st' },
    h(
      'header',
      { class: 'st-head' },
      h(
        'div',
        { class: 'st-title' },
        h('p', { class: 'st-eyebrow' }, 'Studio · enregistrement automatique'),
        heading,
        subtitle,
      ),
      h(
        'div',
        { class: 'st-actions' },
        status,
        h(
          'button',
          {
            type: 'button',
            class: 'st-icon-btn',
            title: 'Annuler (Ctrl+Z)',
            'aria-label': 'Annuler (Ctrl+Z)',
            onclick: undo,
          },
          '↶',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'st-icon-btn',
            title: 'Rétablir (Ctrl+Maj+Z)',
            'aria-label': 'Rétablir (Ctrl+Maj+Z)',
            onclick: redo,
          },
          '↷',
        ),
      ),
    ),
    h('nav', { class: 'st-tabs', 'aria-label': 'Studio' }, tabButtons),
    h(
      'div',
      { class: 'st-body' },
      h('aside', { class: 'st-panel', 'aria-label': 'Réglages' }, panel),
      preview.el,
    ),
  );
  host.replaceChildren(root);
  renderPanel();

  const setTab = (next: StudioTab) => {
    tab = next;
    tabButtons.forEach((b, i) => {
      const on = TABS[i]!.id === tab;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    showTab();
    panel.scrollTop = 0;
    renderPanel();
    preview.setSelecting(false);
  };

  return {
    update(next) {
      if (next.name !== 'studio') return false;
      if (next.tab !== tab) setTab(next.tab);
      return true;
    },
    async dispose() {
      window.removeEventListener('keydown', onKey);
      clearTimeout(animTimer);
      await state.flush();
      state.dispose();
      preview.dispose();
    },
  };
}
