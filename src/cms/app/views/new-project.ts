/** Création d'un projet : titre, catégorie, marque(s), année → dossier + fiche prêts, en brouillon. */
import { api } from '../api';
import type { Meta, View } from '../types';
import { h, icon, slugify, toast } from '../ui';

export function mountNewProject(host: HTMLElement, meta: Meta): View {
  const brands = new Set<string>(['personal']);
  let category = '';
  let slugTouched = false;

  const title = h('input', {
    class: 'cms-input is-title',
    type: 'text',
    placeholder: 'Ex. Bras robotique',
    required: true,
    autofocus: true,
  });
  const slug = h('input', { class: 'cms-input cms-mono', type: 'text', spellcheck: false });
  const year = h('input', {
    class: 'cms-input',
    type: 'number',
    min: 2000,
    max: 2100,
    placeholder: 'ex. 2025',
  });
  const error = h('p', { class: 'cms-error-text', hidden: true });
  const submit = h(
    'button',
    { type: 'submit', class: 'cms-btn is-primary' },
    icon('plus', 16),
    'Créer le projet',
  );

  title.addEventListener('input', () => {
    if (!slugTouched) slug.value = slugify(title.value);
  });
  slug.addEventListener('input', () => (slugTouched = true));

  const categoryBox = h('div', { class: 'cms-cats' });
  const brandBox = h('div', { class: 'cms-chips' });
  const renderChoices = () => {
    categoryBox.replaceChildren(
      ...meta.categories.map((c) =>
        h(
          'button',
          {
            type: 'button',
            class: `cms-cat${c.slug === category ? ' is-on' : ''}`,
            'aria-pressed': String(c.slug === category),
            onclick: () => {
              category = c.slug;
              renderChoices();
            },
          },
          h('span', { class: 'cms-mono' }, c.number),
          c.title,
        ),
      ),
    );
    brandBox.replaceChildren(
      ...meta.entities.map((e) => {
        const on = brands.has(e.slug);
        return h(
          'button',
          {
            type: 'button',
            class: `cms-toggle${on ? ' is-on' : ''}`,
            'aria-pressed': String(on),
            title: e.role,
            onclick: () => {
              if (on) brands.delete(e.slug);
              else brands.add(e.slug);
              if (!brands.size) brands.add('personal');
              renderChoices();
            },
          },
          on && icon('check', 14),
          e.name,
        );
      }),
    );
  };
  renderChoices();

  const form = h(
    'form',
    {
      class: 'cms-card cms-new',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        error.hidden = true;
        if (!title.value.trim()) return fail('Donne un titre au projet.');
        if (!category) return fail('Choisis une catégorie.');
        submit.disabled = true;
        try {
          const created = await api.create({
            title: title.value.trim(),
            category,
            entity: [...brands],
            year: year.value ? Number(year.value) : undefined,
            slug: slug.value.trim() || undefined,
          });
          toast('Projet créé. Ajoute maintenant ses images et ses vidéos.');
          location.hash = `#/projets/${created.slug}/galerie`;
        } catch (err) {
          fail(err instanceof Error ? err.message : String(err));
          submit.disabled = false;
        }
      },
    },
    h('label', { class: 'cms-field' }, h('span', null, 'Titre du projet'), title),
    h('div', { class: 'cms-field' }, h('span', null, 'Catégorie'), categoryBox),
    h('div', { class: 'cms-field' }, h('span', null, 'Marque'), brandBox),
    h(
      'div',
      { class: 'cms-grid-2' },
      h('label', { class: 'cms-field' }, h('span', null, 'Année (facultatif)'), year),
      h(
        'label',
        { class: 'cms-field' },
        h('span', null, 'Adresse du projet'),
        slug,
        h('small', { class: 'cms-muted' }, 'Déduite du titre : /projets/…/'),
      ),
    ),
    error,
    h(
      'div',
      { class: 'cms-row' },
      h('a', { class: 'cms-btn is-ghost', href: '#/projets' }, 'Annuler'),
      submit,
    ),
  );

  function fail(message: string) {
    error.textContent = message;
    error.hidden = false;
  }

  host.replaceChildren(
    h(
      'header',
      { class: 'cms-page-head' },
      h(
        'div',
        null,
        h('p', { class: 'eyebrow' }, 'Contenu'),
        h('h1', { class: 'cms-title' }, 'Nouveau projet'),
        h(
          'p',
          { class: 'cms-lead' },
          'Trois choix suffisent : le reste se complète ensuite. Le projet est créé en brouillon.',
        ),
      ),
    ),
    form,
  );
  requestAnimationFrame(() => title.focus());
  return { dispose() {} };
}
