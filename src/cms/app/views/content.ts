/**
 * Contenu du site — textes et contenus éditoriaux du portfolio, sans toucher au code.
 *
 *   #/contenu/accueil · identite · expertises · projets · ecosysteme · a-propos · contact · footer · navigation
 *
 * Enregistrement MANUEL (bouton « Enregistrer », Ctrl+S) ; « Annuler » revient à la dernière version
 * enregistrée ; « Versions » recharge une version précédente (historique .cms/historique/reglages/).
 * L'aperçu (vraie page du site) se recharge après chaque enregistrement, à la même position.
 */
import type { ContentTab, Meta, Route, SettingsName, View } from '../types';
import { api } from '../api';
import { confirmModal, formatDate, h, icon, toast } from '../ui';
import { StudioState } from '../studio/state';
import { createPreview } from '../studio/preview';
import { renderNavigationPanel } from '../studio/navigation-panel';
import { EDITORS } from '../content/editors';

const TABS: { id: ContentTab; label: string; focus?: string; doc: SettingsName }[] = [
  { id: 'accueil', label: 'Accueil', focus: 'hero.section', doc: 'content' },
  { id: 'identite', label: 'Identité & Liens', focus: 'contact.section', doc: 'content' },
  { id: 'expertises', label: 'Expertises', focus: 'expertises.section', doc: 'content' },
  { id: 'projets', label: 'Projets', focus: 'projects.section', doc: 'content' },
  { id: 'ecosysteme', label: 'Écosystème', focus: 'ecosystem.section', doc: 'content' },
  { id: 'a-propos', label: 'À propos', focus: 'about.section', doc: 'content' },
  { id: 'contact', label: 'Contact', focus: 'contact.section', doc: 'content' },
  { id: 'footer', label: 'Footer', focus: 'footer.wordmark', doc: 'content' },
  { id: 'navigation', label: 'Navigation', doc: 'navigation' },
];

export async function mountContent(host: HTMLElement, route: Route, meta: Meta): Promise<View> {
  host.replaceChildren(h('p', { class: 'cms-muted' }, 'Chargement du contenu…'));
  const state = await StudioState.load({ autosave: false, snapshot: true });
  let tab: ContentTab = route.name === 'content' ? route.tab : 'accueil';
  let lastReady = 0;

  const preview = createPreview({
    onReady: () => {
      lastReady = Date.now();
      const focus = TABS.find((t) => t.id === tab)?.focus;
      if (focus) preview.post({ type: 'focus', id: focus });
    },
  });
  state.afterSave = () => {
    const since = Date.now();
    setTimeout(() => lastReady < since && preview.reload(), 1400);
  };

  /* ---------------------------------------------------------------- éditeur */
  const panel = h('div', { class: 'st-panel-body ce-body' });
  const draw = () => {
    const top = panel.scrollTop;
    const open = new Set(
      [...panel.querySelectorAll('details[open] .ce-item-title')].map((e) => e.textContent ?? ''),
    );
    if (tab === 'navigation')
      renderNavigationPanel(panel, state, { labels: meta.studio?.nav ?? {} });
    else {
      const ctx = { state, meta, dictionary: meta.studio?.dictionary ?? {}, redraw: draw };
      panel.replaceChildren(...(EDITORS[tab](ctx).flat(3) as (Node | string)[]).filter(Boolean));
    }
    panel.querySelectorAll('details.ce-item').forEach((d) => {
      if (open.has(d.querySelector('.ce-item-title')?.textContent ?? ''))
        (d as HTMLDetailsElement).open = true;
    });
    panel.scrollTop = top;
  };

  /* ---------------------------------------------------------------- barre d'actions */
  const status = h('span', { class: 'st-status' });
  const saveButton = h(
    'button',
    { type: 'button', class: 'cms-btn is-primary' },
    icon('check', 16),
    'Enregistrer',
  );
  const cancelButton = h('button', { type: 'button', class: 'cms-btn is-ghost' }, 'Annuler');
  const refreshStatus = () => {
    const dirty = state.isDirty();
    const s = state.status();
    status.textContent =
      s === 'saving'
        ? 'Enregistrement…'
        : s === 'error'
          ? 'Non enregistré'
          : dirty
            ? 'Modifications non enregistrées'
            : 'Enregistré';
    status.dataset.state =
      s === 'saving' ? 'saving' : s === 'error' ? 'error' : dirty ? 'dirty' : 'saved';
    saveButton.disabled = !dirty;
    cancelButton.disabled = !dirty;
  };
  state.onStatus(refreshStatus);
  state.onChange(refreshStatus);

  const save = async () => {
    if (!state.isDirty()) return;
    await state.flush();
    if (!state.isDirty()) toast('Contenu enregistré — l’aperçu se met à jour.');
  };
  saveButton.addEventListener('click', () => void save());
  cancelButton.addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'Annuler les modifications ?',
      body: 'Les modifications non enregistrées sont abandonnées (retour à la dernière version enregistrée).',
      confirm: 'Annuler les modifications',
      cancel: 'Continuer l’édition',
      danger: true,
    });
    if (!ok) return;
    state.revert();
    draw();
  });

  // versions précédentes (historique)
  const versions = h('select', {
    class: 'st-input ce-versions',
    'aria-label': 'Versions précédentes',
  });
  const loadVersions = async () => {
    const doc = TABS.find((t) => t.id === tab)!.doc;
    const list = await api.settingsHistory(doc).catch(() => []);
    versions.replaceChildren(
      h(
        'option',
        { value: '' },
        list.length ? `Versions précédentes (${list.length})` : 'Aucune version précédente',
      ),
      ...list.map((v) => h('option', { value: v.id }, formatDate(v.savedAt))),
    );
    versions.disabled = !list.length;
  };
  versions.addEventListener('change', async () => {
    const id = versions.value;
    if (!id) return;
    const doc = TABS.find((t) => t.id === tab)!.doc;
    const ok = await confirmModal({
      title: 'Charger cette version ?',
      body: `Le contenu (${doc === 'navigation' ? 'navigation' : 'textes et contenus'}) de cette version remplace celui de l’éditeur. Rien n’est écrit tant que tu n’enregistres pas.`,
      confirm: 'Charger',
    });
    versions.value = '';
    if (!ok) return;
    try {
      const { data } = await api.settingsVersion(doc, id);
      state.replace(doc, data);
      draw();
      toast('Version chargée — « Enregistrer » pour l’appliquer au site.', 'info');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Version illisible.', 'error');
    }
  });

  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    }
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (state.isDirty()) e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', onBeforeUnload);

  const tabButtons = TABS.map((t) =>
    h('a', { class: `st-tab${t.id === tab ? ' is-on' : ''}`, href: `#/contenu/${t.id}` }, t.label),
  );

  host.replaceChildren(
    h(
      'div',
      { class: 'st ce' },
      h(
        'header',
        { class: 'st-head' },
        h(
          'div',
          { class: 'st-title' },
          h('h1', null, 'Contenu du site'),
          h('p', null, 'Textes et contenus du portfolio'),
        ),
        h('span', { class: 'cms-grow' }),
        status,
        versions,
        cancelButton,
        saveButton,
      ),
      h('nav', { class: 'st-tabs ce-tabs', 'aria-label': 'Catégories' }, tabButtons),
      h(
        'div',
        { class: 'st-body' },
        h('aside', { class: 'st-panel', 'aria-label': 'Contenu' }, panel),
        preview.el,
      ),
    ),
  );
  draw();
  refreshStatus();
  void loadVersions();

  return {
    update(next) {
      if (next.name !== 'content') return false;
      if (next.tab !== tab) {
        tab = next.tab;
        tabButtons.forEach((b, i) => b.classList.toggle('is-on', TABS[i]!.id === tab));
        panel.scrollTop = 0;
        draw();
        void loadVersions();
        const focus = TABS.find((t) => t.id === tab)?.focus;
        if (focus) preview.post({ type: 'focus', id: focus });
      }
      return true;
    },
    async dispose() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (state.isDirty()) {
        const keep = await confirmModal({
          title: 'Modifications non enregistrées',
          body: 'Enregistrer le contenu modifié avant de quitter ?',
          confirm: 'Enregistrer',
          cancel: 'Abandonner',
        });
        if (keep) await state.flush();
      }
      state.dispose();
      preview.dispose();
    },
  };
}
