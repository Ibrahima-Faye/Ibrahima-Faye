/** Éditeur d'un projet : en-tête, onglets (Informations · Galerie · Prévisualisation), enregistrement automatique. */
import { api } from '../api';
import { Editor, type SaveStatus } from '../editor-state';
import type { Meta, Route, View } from '../types';
import { confirmModal, formatDate, h, icon, toast } from '../ui';
import { mountComposer } from './editor-composer';
import { mountInfo } from './editor-info';
import { mountPreview } from './editor-preview';

type Tab = 'infos' | 'galerie' | 'apercu';

const TABS: { id: Tab; label: string; icon: 'edit' | 'image' | 'eye'; hash: string }[] = [
  { id: 'infos', label: 'Informations', icon: 'edit', hash: '' },
  { id: 'galerie', label: 'Galerie', icon: 'image', hash: '/galerie' },
  { id: 'apercu', label: 'Prévisualisation', icon: 'eye', hash: '/apercu' },
];

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Enregistré',
  dirty: 'Modifications en attente…',
  saving: 'Enregistrement…',
  error: 'Échec — nouvel essai automatique…',
  conflict: 'Modifié ailleurs — action requise',
};

export async function mountEditor(
  host: HTMLElement,
  route: Extract<Route, { name: 'edit' }>,
  meta: Meta,
): Promise<View> {
  host.replaceChildren(h('div', { class: 'cms-loading' }, 'Chargement du projet…'));

  let detail;
  try {
    detail = await api.get(route.slug);
  } catch (error) {
    host.replaceChildren(
      h(
        'div',
        { class: 'cms-card cms-error-card' },
        h('h2', null, 'Projet introuvable'),
        h('p', null, error instanceof Error ? error.message : String(error)),
        h('a', { class: 'cms-btn is-primary', href: '#/projets' }, 'Retour aux projets'),
      ),
    );
    return { dispose() {} };
  }

  const editor = new Editor(detail);
  let tab: Tab = route.tab;
  let disposeTab: (() => void) | undefined;

  /* ---------- en-tête ---------- */
  const title = h('h1', { class: 'cms-title' });
  const badge = h('span', { class: 'cms-pill' });
  const statusEl = h('button', {
    type: 'button',
    class: 'cms-save',
    title: 'Enregistrer maintenant (Ctrl + S)',
    onclick: () => void editor.flush(),
  });
  const publishBtn = h('button', {
    type: 'button',
    class: 'cms-btn is-ghost',
    onclick: () => {
      editor.data.draft = editor.data.draft === false ? true : false;
      editor.touch();
      renderHeader();
    },
  });
  const viewLink = h(
    'a',
    {
      class: 'cms-btn is-ghost',
      href: `/projets/${editor.slug}/`,
      target: '_blank',
      rel: 'noopener',
    },
    icon('external', 16),
    'Voir sur le site',
  );
  const deleteBtn = h(
    'button',
    {
      type: 'button',
      class: 'cms-btn is-danger-ghost',
      title: 'Supprimer le projet',
      'aria-label': 'Supprimer le projet',
      onclick: () => void removeProject(),
    },
    icon('trash', 16),
  );
  const tabsNav = h('nav', { class: 'cms-tabs', 'aria-label': 'Sections du projet' });
  const panel = h('div', { class: 'cms-panel' });

  function renderHeader() {
    const published = editor.data.draft === false;
    title.textContent = editor.data.title || editor.slug;
    badge.textContent = published ? 'Publié' : 'Brouillon';
    badge.className = `cms-pill ${published ? 'is-live' : 'is-draft'}`;
    publishBtn.replaceChildren(
      icon(published ? 'eyeOff' : 'globe', 16),
      published ? 'Repasser en brouillon' : 'Publier',
    );
    publishBtn.className = `cms-btn ${published ? 'is-ghost' : 'is-primary'}`;

    const s = editor.status;
    statusEl.className = `cms-save is-${s}`;
    statusEl.replaceChildren(
      h('i'),
      s === 'saved' ? `Enregistré · ${formatDate(editor.savedAt)}` : STATUS_TEXT[s],
    );
    statusEl.title =
      s === 'error' || s === 'conflict' ? editor.error : 'Enregistrer maintenant (Ctrl + S)';
    if (s === 'conflict') void resolveConflict();

    tabsNav.replaceChildren(
      ...TABS.map((t) =>
        h(
          'a',
          {
            class: `cms-tab${t.id === tab ? ' is-on' : ''}`,
            href: `#/projets/${editor.slug}${t.hash}`,
            'aria-current': t.id === tab ? 'page' : undefined,
          },
          icon(t.icon, 16),
          t.label,
          t.id === 'galerie' && h('em', null, String(editor.items.filter((i) => !i.hidden).length)),
        ),
      ),
    );
  }

  const header = h(
    'header',
    { class: 'cms-editor-head' },
    h(
      'div',
      { class: 'cms-crumb' },
      h('a', { href: '#/projets' }, icon('arrowLeft', 14), 'Projets'),
      h('span', null, '/'),
      h('span', { class: 'cms-mono' }, editor.slug),
    ),
    h(
      'div',
      { class: 'cms-head-row' },
      h('div', { class: 'cms-head-title' }, title, badge),
      h('div', { class: 'cms-head-actions' }, statusEl, viewLink, publishBtn, deleteBtn),
    ),
    tabsNav,
  );
  host.replaceChildren(header, panel);

  /* ---------- onglets ---------- */
  function showTab(next: Tab) {
    disposeTab?.();
    tab = next;
    panel.replaceChildren();
    panel.dataset.tab = next;
    disposeTab =
      next === 'infos'
        ? mountInfo(panel, editor, meta)
        : next === 'galerie'
          ? mountComposer(panel, editor)
          : mountPreview(panel, editor);
    renderHeader();
  }

  async function removeProject() {
    const ok = await confirmModal({
      title: 'Supprimer ce projet ?',
      body: h(
        'div',
        null,
        h(
          'p',
          null,
          h('strong', null, editor.data.title),
          ' et tous ses médias seront retirés du site.',
        ),
        h(
          'p',
          { class: 'cms-muted' },
          'Le dossier est déplacé dans .trash/ à la racine du projet : tu peux le récupérer à la main si besoin.',
        ),
      ),
      confirm: 'Supprimer le projet',
      danger: true,
    });
    if (!ok) return;
    try {
      editor.dispose();
      await api.remove(editor.slug);
      toast('Projet supprimé (déplacé dans .trash/).');
      location.hash = '#/projets';
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Suppression impossible.', 'error');
    }
  }

  /** Le fichier a changé ailleurs : l'utilisateur choisit ; rien n'est écrasé sans son accord. */
  let conflictOpen = false;
  async function resolveConflict() {
    if (conflictOpen) return;
    conflictOpen = true;
    const overwrite = await confirmModal({
      title: 'Ce projet a été modifié ailleurs',
      body: h(
        'div',
        null,
        h(
          'p',
          null,
          'Depuis son ouverture ici, project.md a changé (autre onglet de l’administration, ou fichier édité à la main).',
        ),
        h(
          'p',
          { class: 'cms-muted' },
          '« Garder mes modifications » enregistre ta version ; l’autre version est conservée dans .cms/historique/ (récupérable). « Recharger » affiche la version du disque et abandonne tes modifications non enregistrées.',
        ),
      ),
      confirm: 'Garder mes modifications',
      cancel: 'Recharger le projet',
    });
    conflictOpen = false;
    if (overwrite) void editor.flush(true);
    else {
      editor.dispose();
      location.reload();
    }
  }

  const unsubscribe = editor.onChange(renderHeader);
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void editor.flush();
    }
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (editor.status !== 'saved') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('cms:publication', renderHeader);

  showTab(tab);

  return {
    update(next) {
      if (next.name !== 'edit' || next.slug !== editor.slug) return false;
      if (next.tab !== tab) showTab(next.tab);
      return true;
    },
    async dispose() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('cms:publication', renderHeader);
      unsubscribe();
      disposeTab?.();
      await editor.flush(); // rien n'est perdu en quittant l'éditeur
      editor.dispose();
    },
  };
}
