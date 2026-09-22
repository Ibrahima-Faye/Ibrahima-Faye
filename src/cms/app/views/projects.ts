/** Liste des projets : recherche, filtres, accès rapide à l'édition, aperçu et suppression. */
import { api, thumbUrl } from '../api';
import type { Meta, ProjectSummary, View } from '../types';
import { confirmModal, formatDate, h, icon, toast } from '../ui';

/** Même ordre que le site : ordre manuel, puis année récente, puis titre. */
function publicOrder(a: ProjectSummary, b: ProjectSummary) {
  if (a.order !== undefined || b.order !== undefined) {
    if (a.order === undefined) return 1;
    if (b.order === undefined) return -1;
    if (a.order !== b.order) return a.order - b.order;
  }
  if ((a.year ?? 0) !== (b.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
  return a.title.localeCompare(b.title, 'fr');
}

export async function mountProjects(host: HTMLElement, meta: Meta): Promise<View> {
  host.replaceChildren(h('div', { class: 'cms-loading' }, 'Chargement des projets…'));
  let projects: ProjectSummary[] = [];
  try {
    projects = (await api.list()).sort(publicOrder);
  } catch (error) {
    host.replaceChildren(
      h(
        'div',
        { class: 'cms-card cms-error-card' },
        h('h2', null, 'Impossible de lire les projets'),
        h('p', null, String(error)),
      ),
    );
    return { dispose() {} };
  }

  const filters = { q: '', category: '', brand: '', state: '' };
  const grid = h('div', { class: 'cms-cards' });
  const count = h('span', { class: 'cms-count' });

  const categoryTitle = (slug?: string) => {
    const c = meta.categories.find((x) => x.slug === slug);
    return c ? `${c.number} · ${c.title}` : '—';
  };
  const brandName = (slug: string) => meta.entities.find((e) => e.slug === slug)?.name ?? slug;

  function card(p: ProjectSummary) {
    return h(
      'article',
      { class: `cms-project${p.error ? ' has-error' : ''}` },
      h(
        'a',
        {
          class: 'cms-project-cover',
          href: `#/projets/${p.slug}`,
          'aria-label': `Modifier ${p.title}`,
        },
        p.cover
          ? h('img', { src: thumbUrl(p.slug, p.cover, 640, p.coverV), alt: '', loading: 'lazy' })
          : h(
              'span',
              { class: 'cms-project-nocover' },
              icon('image', 26),
              h('small', null, p.error ? 'Fiche illisible' : 'Pas de couverture'),
            ),
        h(
          'span',
          { class: `cms-pill ${p.draft ? 'is-draft' : 'is-live'}` },
          p.draft ? 'Brouillon' : 'Publié',
        ),
      ),
      h(
        'div',
        { class: 'cms-project-body' },
        h('h3', null, h('a', { href: `#/projets/${p.slug}` }, p.title)),
        p.error
          ? h('p', { class: 'cms-error-text' }, p.error)
          : h('p', { class: 'cms-project-meta' }, categoryTitle(p.category)),
        h(
          'div',
          { class: 'cms-project-tags' },
          ...p.entity.map((e) => h('span', { class: 'chip' }, brandName(e))),
          p.year && h('span', { class: 'cms-mono cms-muted' }, String(p.year)),
        ),
        h(
          'div',
          { class: 'cms-project-foot' },
          h(
            'span',
            { class: 'cms-muted' },
            icon('image', 13),
            ` ${p.mediaCount} · ${formatDate(p.updatedAt)}`,
          ),
          h(
            'span',
            { class: 'cms-project-actions' },
            h(
              'a',
              {
                class: 'cms-mini-btn',
                href: `/projets/${p.slug}/`,
                target: '_blank',
                rel: 'noopener',
                title: 'Voir sur le site',
                'aria-label': 'Voir sur le site',
              },
              icon('external', 15),
            ),
            h(
              'a',
              {
                class: 'cms-mini-btn',
                href: `#/projets/${p.slug}`,
                title: 'Modifier',
                'aria-label': 'Modifier',
              },
              icon('edit', 15),
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'cms-mini-btn is-danger',
                title: 'Supprimer',
                'aria-label': `Supprimer ${p.title}`,
                onclick: () => void remove(p),
              },
              icon('trash', 15),
            ),
          ),
        ),
      ),
    );
  }

  async function remove(p: ProjectSummary) {
    const ok = await confirmModal({
      title: 'Supprimer ce projet ?',
      body: h(
        'div',
        null,
        h(
          'p',
          null,
          h('strong', null, p.title),
          ' et ses ',
          String(p.mediaCount),
          ' média(s) seront retirés du site.',
        ),
        h(
          'p',
          { class: 'cms-muted' },
          'Le dossier est déplacé dans .trash/ : il reste récupérable à la main.',
        ),
      ),
      confirm: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.remove(p.slug);
      projects = projects.filter((x) => x.slug !== p.slug);
      render();
      toast('Projet supprimé (déplacé dans .trash/).');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Suppression impossible.', 'error');
    }
  }

  function render() {
    const q = filters.q.trim().toLowerCase();
    const list = projects.filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || p.slug.includes(q)) &&
        (!filters.category || p.category === filters.category) &&
        (!filters.brand || p.entity.includes(filters.brand)) &&
        (!filters.state || (filters.state === 'draft' ? p.draft : !p.draft)),
    );
    count.textContent = `${list.length} projet${list.length > 1 ? 's' : ''}${list.length !== projects.length ? ` sur ${projects.length}` : ''}`;
    grid.replaceChildren(
      ...(list.length
        ? list.map(card)
        : [
            h(
              'div',
              { class: 'cms-empty is-flat' },
              icon('folder', 30),
              h('strong', null, projects.length ? 'Aucun projet ne correspond' : 'Aucun projet'),
              h(
                'a',
                { class: 'cms-btn is-primary', href: '#/projets/nouveau' },
                icon('plus', 16),
                'Créer un projet',
              ),
            ),
          ]),
    );
  }

  const select = (
    key: 'category' | 'brand' | 'state',
    label: string,
    options: [string, string][],
  ) =>
    h(
      'select',
      {
        class: 'cms-select',
        'aria-label': label,
        onchange: (e: Event) => {
          filters[key] = (e.target as HTMLSelectElement).value;
          render();
        },
      },
      h('option', { value: '' }, label),
      options.map(([v, t]) => h('option', { value: v }, t)),
    );

  host.replaceChildren(
    h(
      'header',
      { class: 'cms-page-head' },
      h(
        'div',
        null,
        h('p', { class: 'eyebrow' }, 'Contenu'),
        h('h1', { class: 'cms-title' }, 'Projets'),
        h('p', { class: 'cms-lead' }, 'Classés dans l’ordre d’affichage du site.'),
      ),
      h(
        'a',
        { class: 'cms-btn is-primary', href: '#/projets/nouveau' },
        icon('plus', 16),
        'Nouveau projet',
      ),
    ),
    h(
      'div',
      { class: 'cms-toolbar-row' },
      h(
        'label',
        { class: 'cms-search' },
        icon('search', 16),
        h('input', {
          type: 'search',
          placeholder: 'Rechercher un projet…',
          oninput: (e: Event) => {
            filters.q = (e.target as HTMLInputElement).value;
            render();
          },
        }),
      ),
      select(
        'category',
        'Toutes les catégories',
        meta.categories.map((c) => [c.slug, `${c.number} · ${c.title}`]),
      ),
      select(
        'brand',
        'Toutes les marques',
        meta.entities.map((e) => [e.slug, e.name]),
      ),
      select('state', 'Tous les états', [
        ['live', 'Publiés'],
        ['draft', 'Brouillons'],
      ]),
      count,
    ),
    grid,
  );
  render();
  return { dispose() {} };
}
