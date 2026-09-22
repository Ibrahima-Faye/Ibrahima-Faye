/** Tableau de bord : vue d'ensemble du portfolio et ce qu'il reste à compléter. */
import { api, thumbUrl } from '../api';
import type { Meta, ProjectSummary, View } from '../types';
import { formatDate, h, icon } from '../ui';

export async function mountDashboard(host: HTMLElement, meta: Meta): Promise<View> {
  host.replaceChildren(h('div', { class: 'cms-loading' }, 'Chargement…'));
  let projects: ProjectSummary[] = [];
  try {
    projects = await api.list();
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

  const published = projects.filter((p) => !p.draft && !p.error);
  const drafts = projects.filter((p) => p.draft && !p.error);
  const mediaTotal = projects.reduce((n, p) => n + p.mediaCount, 0);
  const categoryTitle = (slug?: string) =>
    meta.categories.find((c) => c.slug === slug)?.title ?? '—';

  const stat = (value: number, label: string, tone = '') =>
    h(
      'div',
      { class: `cms-stat ${tone}` },
      h('strong', null, String(value)),
      h('span', null, label),
    );

  const recent = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);

  const todo: { text: string; slug: string; tab: string }[] = [];
  for (const p of projects) {
    if (p.error) continue;
    if (!p.cover)
      todo.push({
        text: `« ${p.title} » n’a pas encore d’image de couverture`,
        slug: p.slug,
        tab: '/galerie',
      });
    else if (p.mediaCount === 0)
      todo.push({ text: `« ${p.title} » n’a aucun média`, slug: p.slug, tab: '/galerie' });
    if (!p.hasSummary)
      todo.push({ text: `« ${p.title} » n’a pas de description courte`, slug: p.slug, tab: '' });
  }

  const broken = projects.filter((p) => p.error);

  const blocks: (Node | false)[] = [
    h(
      'header',
      { class: 'cms-page-head' },
      h(
        'div',
        null,
        h('p', { class: 'eyebrow' }, 'Administration locale'),
        h('h1', { class: 'cms-title' }, 'Tableau de bord'),
        h(
          'p',
          { class: 'cms-lead' },
          'Crée, modifie et compose tes projets. Tout est enregistré dans les fichiers du site, sans base de données.',
        ),
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
      { class: 'cms-stats' },
      stat(projects.length, 'Projets'),
      stat(published.length, 'Publiés', 'is-live'),
      stat(drafts.length, 'Brouillons', 'is-draft'),
      stat(mediaTotal, 'Médias'),
    ),

    broken.length > 0 &&
      h(
        'div',
        { class: 'cms-card cms-warn' },
        h('h3', null, 'Fiches à corriger'),
        h(
          'ul',
          { class: 'cms-list' },
          broken.map((p) =>
            h(
              'li',
              null,
              h('strong', null, p.slug),
              ' — ',
              h('span', { class: 'cms-muted' }, p.error),
            ),
          ),
        ),
      ),

    h(
      'div',
      { class: 'cms-dash-grid' },
      h(
        'section',
        { class: 'cms-card' },
        h(
          'div',
          { class: 'cms-card-head' },
          h('h3', null, 'Projets récents'),
          h('a', { class: 'cms-link', href: '#/projets' }, 'Tout voir'),
        ),
        recent.length
          ? h(
              'ul',
              { class: 'cms-recent' },
              recent.map((p) =>
                h(
                  'li',
                  null,
                  h(
                    'a',
                    { href: `#/projets/${p.slug}` },
                    p.cover
                      ? h('img', { src: thumbUrl(p.slug, p.cover, 160, p.coverV), alt: '' })
                      : h('span', { class: 'cms-recent-empty' }, icon('image', 18)),
                    h(
                      'span',
                      { class: 'cms-recent-text' },
                      h('strong', null, p.title),
                      h('small', null, categoryTitle(p.category), ' · ', formatDate(p.updatedAt)),
                    ),
                    h(
                      'span',
                      { class: `cms-pill ${p.draft ? 'is-draft' : 'is-live'}` },
                      p.draft ? 'Brouillon' : 'Publié',
                    ),
                  ),
                ),
              ),
            )
          : h('p', { class: 'cms-muted' }, 'Aucun projet pour l’instant. Crée le premier.'),
      ),

      h(
        'section',
        { class: 'cms-card' },
        h('div', { class: 'cms-card-head' }, h('h3', null, 'À compléter')),
        todo.length
          ? h(
              'ul',
              { class: 'cms-todo' },
              todo
                .slice(0, 8)
                .map((t) =>
                  h(
                    'li',
                    null,
                    icon('info', 15),
                    h('a', { href: `#/projets/${t.slug}${t.tab}` }, t.text),
                  ),
                ),
              todo.length > 8 &&
                h(
                  'li',
                  { class: 'cms-muted' },
                  `… et ${todo.length - 8} autre${todo.length - 8 > 1 ? 's' : ''}`,
                ),
            )
          : h('p', { class: 'cms-muted' }, 'Tout est à jour. 👌'),
      ),
    ),

    h(
      'div',
      { class: 'cms-card cms-note' },
      icon('info', 18),
      h(
        'div',
        null,
        h('strong', null, 'Comment ça marche'),
        h(
          'p',
          null,
          'Ici, tout est enregistré dans ',
          h('code', null, 'src/content/projects/'),
          '. Le site publié reste 100 % statique : cette administration n’existe qu’en local (',
          h('code', null, 'npm run dev'),
          ') et n’est jamais mise en ligne.',
        ),
        h(
          'p',
          null,
          'Pour mettre à jour le site en ligne : ',
          h('code', null, 'git add . && git commit && git push'),
          ' — l’hébergeur reconstruit le site.',
        ),
      ),
    ),
  ];
  host.replaceChildren(...blocks.filter((b): b is Node => b !== false));
  return { dispose() {} };
}
