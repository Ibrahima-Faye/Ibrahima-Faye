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

const TABS: {
  id: ContentTab;
  label: string;
  focus?: string;
  doc: SettingsName;
  /** Sous-titre de l'en-tête : ce que contient la catégorie. */
  about: string;
}[] = [
  {
    id: 'accueil',
    label: 'Accueil',
    focus: 'hero.section',
    doc: 'content',
    about: 'Hero, manifeste et référencement de la page d’accueil.',
  },
  {
    id: 'identite',
    label: 'Identité & Liens',
    focus: 'contact.section',
    doc: 'content',
    about: 'Nom, symbole de l’en-tête, photo de profil, réseaux et coordonnées.',
  },
  {
    id: 'expertises',
    label: 'Expertises',
    focus: 'expertises.section',
    doc: 'content',
    about: 'Textes de la section, ordre et visibilité des domaines.',
  },
  {
    id: 'projets',
    label: 'Projets',
    focus: 'projects.section',
    doc: 'content',
    about: 'Section Projets de l’accueil, page Projets et libellés des pages projet.',
  },
  {
    id: 'ecosysteme',
    label: 'Écosystème',
    focus: 'ecosystem.section',
    doc: 'content',
    about: 'Textes de la section, entités ClicGraph et JeeFSYS, projets personnels.',
  },
  {
    id: 'a-propos',
    label: 'À propos',
    focus: 'about.section',
    doc: 'content',
    about: 'Présentation, démarche et blocs de contenu.',
  },
  {
    id: 'contact',
    label: 'Contact',
    focus: 'contact.section',
    doc: 'content',
    about: 'Textes et libellés de la section Contact.',
  },
  {
    id: 'footer',
    label: 'Footer',
    focus: 'footer.wordmark',
    doc: 'content',
    about: 'Présentation, liens « Explorer », colonne « Univers » et bas de page.',
  },
  {
    id: 'navigation',
    label: 'Navigation',
    doc: 'navigation',
    about: 'Liens de l’en-tête du site : ordre, libellés et visibilité.',
  },
];

/**
 * Regroupe les champs en cartes : chaque titre (.ce-heading) ouvre un groupe qui contient
 * les champs qui le suivent. Présentation uniquement — les champs et leur logique ne changent pas.
 */
function groupFields(panel: HTMLElement) {
  if (!panel.querySelector(':scope > .ce-heading')) return;
  let body: HTMLElement | undefined;
  const groups: HTMLElement[] = [];
  for (const node of [...panel.childNodes]) {
    if (node instanceof HTMLElement && node.classList.contains('ce-heading')) {
      body = h('div', { class: 'ce-group-body' });
      groups.push(h('section', { class: 'ce-group' }, node, body));
    } else {
      if (!body) {
        body = h('div', { class: 'ce-group-body' });
        groups.push(h('section', { class: 'ce-group' }, body));
      }
      body.append(node);
    }
  }
  panel.replaceChildren(...groups);
}

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
    groupFields(panel);
    panel.querySelectorAll('details.ce-item').forEach((d) => {
      if (open.has(d.querySelector('.ce-item-title')?.textContent ?? ''))
        (d as HTMLDetailsElement).open = true;
    });
    panel.scrollTop = top;
  };

  /* ---------------------------------------------------------------- barre d'actions */
  const status = h('span', { class: 'st-status', role: 'status' });
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
          ? 'Erreur'
          : dirty
            ? 'Modifications en cours'
            : 'Enregistré';
    const next = s === 'saving' ? 'saving' : s === 'error' ? 'error' : dirty ? 'dirty' : 'saved';
    // retour visuel bref quand un enregistrement vient d'aboutir
    if (next === 'saved' && status.dataset.state === 'saving') {
      status.classList.remove('is-flash');
      void status.offsetWidth;
      status.classList.add('is-flash');
      panel.querySelectorAll('.st-row.is-edited').forEach((r) => r.classList.remove('is-edited'));
    }
    status.dataset.state = next;
    status.title =
      next === 'error'
        ? 'L’enregistrement a échoué : les modifications sont toujours dans l’éditeur.'
        : next === 'dirty'
          ? 'Modifications non enregistrées (Ctrl+S pour enregistrer)'
          : '';
    saveButton.disabled = !dirty;
    cancelButton.disabled = !dirty;
  };
  // champ modifié depuis le dernier enregistrement (repère visuel)
  panel.addEventListener('input', (e) =>
    (e.target as HTMLElement).closest?.('.st-row')?.classList.add('is-edited'),
  );
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
    h('a', { class: 'st-tab', href: `#/contenu/${t.id}` }, t.label),
  );
  const heading = h('h1', null);
  const subtitle = h('p', null);
  const showTab = () => {
    const current = TABS.find((t) => t.id === tab)!;
    heading.textContent = current.label;
    subtitle.textContent = current.about;
    tabButtons.forEach((b, i) => {
      const on = TABS[i]!.id === tab;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  };

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
          h('p', { class: 'st-eyebrow' }, 'Contenu du site'),
          heading,
          subtitle,
        ),
        h(
          'div',
          { class: 'st-actions' },
          status,
          h('label', { class: 'st-versions' }, icon('history', 15), versions),
          cancelButton,
          saveButton,
        ),
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
  showTab();
  draw();
  refreshStatus();
  void loadVersions();

  return {
    update(next) {
      if (next.name !== 'content') return false;
      if (next.tab !== tab) {
        tab = next.tab;
        showTab();
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
