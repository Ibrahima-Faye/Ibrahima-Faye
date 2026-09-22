/** Onglet « Informations » : titre, catégorie, marque, année, textes, description détaillée, publication. */
import { api, thumbUrl } from '../api';
import type { Editor } from '../editor-state';
import type { Meta } from '../types';
import { confirmModal, h, icon, slugify, toast, type Child } from '../ui';

type TextKey = 'summary' | 'role' | 'context' | 'result' | 'client' | 'coverAlt';

export function mountInfo(host: HTMLElement, editor: Editor, meta: Meta): () => void {
  const data = editor.data;

  /** Met à jour un champ texte (vide = champ supprimé) puis programme l'enregistrement. */
  const setText = (key: TextKey, value: string) => {
    if (value.trim()) (data as Record<string, unknown>)[key] = value;
    else delete (data as Record<string, unknown>)[key];
    editor.touch();
  };

  const field = (label: string, control: HTMLElement, hint?: Child) =>
    h(
      'label',
      { class: 'cms-field' },
      h('span', null, label),
      control,
      hint && h('small', { class: 'cms-muted' }, hint),
    );

  const text = (key: TextKey, label: string, placeholder = '', hint?: Child) =>
    field(
      label,
      h('input', {
        class: 'cms-input',
        type: 'text',
        value: (data[key] as string) ?? '',
        placeholder,
        oninput: (e: Event) => setText(key, (e.target as HTMLInputElement).value),
      }),
      hint,
    );

  const area = (key: TextKey, label: string, placeholder = '', rows = 3, hint?: Child) =>
    field(
      label,
      h('textarea', {
        class: 'cms-input',
        rows,
        placeholder,
        value: (data[key] as string) ?? '',
        oninput: (e: Event) => setText(key, (e.target as HTMLTextAreaElement).value),
      }),
      hint,
    );

  /* ---------- identité ---------- */
  const titleInput = h('input', {
    class: 'cms-input is-title',
    type: 'text',
    value: data.title,
    placeholder: 'Titre du projet',
    required: true,
    oninput: (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      titleInput.classList.toggle('is-invalid', !value.trim());
      if (!value.trim()) return; // un titre vide n'est jamais enregistré
      data.title = value;
      editor.touch();
    },
  });

  const categorySelect = h(
    'select',
    {
      class: 'cms-select',
      onchange: (e: Event) => {
        data.category = (e.target as HTMLSelectElement).value;
        editor.touch();
      },
    },
    meta.categories.map((c) =>
      h(
        'option',
        { value: c.slug, selected: c.slug === data.category },
        `${c.number} · ${c.title}`,
      ),
    ),
  );

  const brands = () => (Array.isArray(data.entity) ? data.entity : [data.entity]) as string[];
  const brandBox = h('div', { class: 'cms-chips' });
  const renderBrands = () => {
    brandBox.replaceChildren(
      ...meta.entities.map((entity) => {
        const on = brands().includes(entity.slug);
        return h(
          'button',
          {
            type: 'button',
            class: `cms-toggle${on ? ' is-on' : ''}`,
            'aria-pressed': String(on),
            title: entity.role,
            onclick: () => {
              const current = new Set(brands());
              if (on) current.delete(entity.slug);
              else current.add(entity.slug);
              data.entity = current.size ? [...current] : ['personal'];
              editor.touch();
              renderBrands();
            },
          },
          on && icon('check', 14),
          entity.name,
        );
      }),
    );
  };
  renderBrands();

  const yearInput = h('input', {
    class: 'cms-input',
    type: 'number',
    min: 2000,
    max: 2100,
    step: 1,
    value: data.year ?? '',
    placeholder: 'ex. 2025',
    oninput: (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      if (v) data.year = Number(v);
      else delete data.year;
      editor.touch();
    },
  });

  const statusSelect = h(
    'select',
    {
      class: 'cms-select',
      onchange: (e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        if (v) data.status = v;
        else delete data.status;
        editor.touch();
      },
    },
    h('option', { value: '' }, '— non précisé —'),
    meta.statuses.map((s) =>
      h('option', { value: s.slug, selected: s.slug === data.status }, s.label),
    ),
  );

  /* ---------- adresse ---------- */
  const slugRow = h(
    'div',
    { class: 'cms-slug' },
    icon('globe', 15),
    h('code', null, `/projets/${editor.slug}/`),
    h(
      'button',
      { type: 'button', class: 'cms-link', onclick: () => void renameSlug() },
      'Modifier',
    ),
  );

  async function renameSlug() {
    const input = h('input', {
      class: 'cms-input',
      type: 'text',
      value: editor.slug,
      spellcheck: false,
    });
    const ok = await confirmModal({
      title: 'Modifier l’adresse du projet',
      body: h(
        'div',
        null,
        h(
          'p',
          { class: 'cms-muted' },
          'Le dossier du projet est renommé. Si le site est déjà en ligne, l’ancienne adresse ne fonctionnera plus.',
        ),
        input,
      ),
      confirm: 'Renommer',
    });
    if (!ok) return;
    const next = slugify(input.value);
    if (!next || next === editor.slug) return;
    try {
      await editor.flush();
      const { slug } = await api.rename(editor.slug, next);
      location.hash = `#/projets/${slug}`;
      location.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Renommage impossible.', 'error');
    }
  }

  /* ---------- technologies (étiquettes) ---------- */
  const techList = h('div', { class: 'cms-tags' });
  const techInput = h('input', {
    class: 'cms-tag-input',
    type: 'text',
    placeholder: 'Ajouter… (Entrée)',
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTech(techInput.value);
      } else if (e.key === 'Backspace' && !techInput.value && data.technologies?.length) {
        data.technologies = data.technologies.slice(0, -1);
        commitTech();
      }
    },
    onblur: () => addTech(techInput.value),
  });
  function addTech(value: string) {
    const v = value.replace(/,/g, '').trim();
    techInput.value = '';
    if (!v || data.technologies?.includes(v)) return;
    data.technologies = [...(data.technologies ?? []), v];
    commitTech();
  }
  function commitTech() {
    if (!data.technologies?.length) delete data.technologies;
    editor.touch();
    renderTech();
  }
  function renderTech() {
    techList.replaceChildren(
      ...(data.technologies ?? []).map((t) =>
        h(
          'span',
          { class: 'cms-tag' },
          t,
          h(
            'button',
            {
              type: 'button',
              'aria-label': `Retirer ${t}`,
              onclick: () => {
                data.technologies = (data.technologies ?? []).filter((x) => x !== t);
                commitTech();
              },
            },
            '×',
          ),
        ),
      ),
      techInput,
    );
  }
  renderTech();

  /* ---------- liens ---------- */
  const linksBox = h('div', { class: 'cms-links' });
  function renderLinks() {
    const links = data.links ?? (data.links = []);
    linksBox.replaceChildren(
      ...links.map((link, i) =>
        h(
          'div',
          { class: 'cms-link-row' },
          h('input', {
            class: 'cms-input',
            type: 'text',
            placeholder: 'Libellé (ex. Code source)',
            value: link.label,
            oninput: (e: Event) => {
              link.label = (e.target as HTMLInputElement).value;
              editor.touch();
            },
          }),
          h('input', {
            class: 'cms-input',
            type: 'url',
            placeholder: 'https://…',
            value: link.href,
            oninput: (e: Event) => {
              link.href = (e.target as HTMLInputElement).value;
              editor.touch();
            },
          }),
          h(
            'button',
            {
              type: 'button',
              class: 'cms-mini-btn',
              'aria-label': 'Retirer ce lien',
              onclick: () => {
                links.splice(i, 1);
                if (!links.length) delete data.links;
                editor.touch();
                renderLinks();
              },
            },
            icon('close', 14),
          ),
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'cms-btn is-ghost',
          onclick: () => {
            (data.links ??= []).push({ label: '', href: '' });
            renderLinks();
          },
        },
        icon('plus', 15),
        'Ajouter un lien',
      ),
    );
    if (!links.length) delete data.links;
  }
  renderLinks();

  /* ---------- description détaillée (Markdown) ---------- */
  const body = h('textarea', {
    class: 'cms-input cms-md',
    rows: 14,
    placeholder:
      'Décris le projet : le contexte, la démarche, les choix techniques, le résultat…\n\nMarkdown accepté : ## Titre, **gras**, *italique*, - listes, [lien](https://…)',
    value: editor.body,
    oninput: (e: Event) => {
      editor.body = (e.target as HTMLTextAreaElement).value;
      editor.touch();
    },
  });
  const wrap = (before: string, after = before, placeholder = 'texte') => {
    const { selectionStart: a, selectionEnd: b, value } = body;
    const selected = value.slice(a, b) || placeholder;
    body.setRangeText(`${before}${selected}${after}`, a, b, 'select');
    body.dispatchEvent(new Event('input'));
    body.focus();
  };
  const tool = (label: string, title: string, fn: () => void) =>
    h('button', { type: 'button', class: 'cms-tool', title, onclick: fn }, label);

  /* ---------- publication ---------- */
  const publishBox = h('div');
  function renderPublish() {
    const cover = editor.coverFile();
    const checks: [boolean, string][] = [
      [Boolean(data.title?.trim()), 'Titre'],
      [Boolean(cover), 'Image de couverture'],
      [Boolean(data.summary), 'Description courte'],
      [editor.items.some((i) => !i.hidden), 'Au moins un média dans la galerie'],
    ];
    const published = data.draft === false;
    publishBox.replaceChildren(
      h(
        'div',
        { class: 'cms-card cms-publish' },
        h('h3', null, 'Publication'),
        h(
          'button',
          {
            type: 'button',
            class: `cms-switch${published ? ' is-on' : ''}`,
            role: 'switch',
            'aria-checked': String(published),
            onclick: () => {
              data.draft = published ? true : false;
              editor.touch();
              renderPublish();
              document.dispatchEvent(new CustomEvent('cms:publication'));
            },
          },
          h('i'),
          h('span', null, published ? 'Publié sur le site' : 'Brouillon (visible ici uniquement)'),
        ),
        cover
          ? h(
              'div',
              { class: 'cms-cover' },
              h('img', {
                src: thumbUrl(
                  editor.slug,
                  cover,
                  520,
                  editor.files.find((f) => f.name === cover)?.mtime,
                ),
                alt: 'Couverture',
              }),
              h('small', null, 'Couverture · à changer dans l’onglet Galerie (★)'),
            )
          : h(
              'div',
              { class: 'cms-cover is-empty' },
              icon('image', 24),
              h('small', null, 'Aucune couverture : ajoute des images dans l’onglet Galerie.'),
            ),
        h(
          'ul',
          { class: 'cms-checks' },
          checks.map(([ok, label]) =>
            h('li', { class: ok ? 'is-ok' : '' }, icon(ok ? 'check' : 'info', 14), label),
          ),
        ),
        h(
          'label',
          { class: 'cms-check' },
          h('input', {
            type: 'checkbox',
            checked: data.featured === true,
            onchange: (e: Event) => {
              if ((e.target as HTMLInputElement).checked) data.featured = true;
              else delete data.featured;
              editor.touch();
            },
          }),
          h('span', null, 'Mettre en avant sur la page d’accueil'),
        ),
        field(
          'Ordre d’affichage',
          h('input', {
            class: 'cms-input',
            type: 'number',
            step: 1,
            value: data.order ?? '',
            placeholder: 'ex. 1',
            oninput: (e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              if (v !== '') data.order = Number(v);
              else delete data.order;
              editor.touch();
            },
          }),
          'Plus petit = plus haut. Vide : tri par année.',
        ),
      ),
    );
  }
  renderPublish();
  const off = editor.onChange(() => renderPublishSoon());
  let queued = 0;
  const renderPublishSoon = () => {
    cancelAnimationFrame(queued);
    queued = requestAnimationFrame(() => {
      // ne réécrit pas le panneau pendant la saisie d'un champ qu'il contient
      if (!publishBox.contains(document.activeElement)) renderPublish();
    });
  };

  const root = h(
    'div',
    { class: 'cms-info' },
    h(
      'div',
      { class: 'cms-info-main' },
      h(
        'div',
        { class: 'cms-card' },
        h('h3', null, 'Identité'),
        field('Titre', titleInput),
        slugRow,
        h(
          'div',
          { class: 'cms-grid-2' },
          field('Catégorie', categorySelect),
          field('Statut du projet', statusSelect),
        ),
        h(
          'div',
          { class: 'cms-field' },
          h('span', null, 'Marque'),
          brandBox,
          h('small', { class: 'cms-muted' }, 'Plusieurs marques possibles pour un projet commun.'),
        ),
        h(
          'div',
          { class: 'cms-grid-2' },
          field('Année', yearInput),
          text('client', 'Client', 'Uniquement si c’est vrai'),
        ),
      ),
      h(
        'div',
        { class: 'cms-card' },
        h('h3', null, 'Présentation'),
        area(
          'summary',
          'Description courte',
          'Une phrase qui résume le projet (carte + Google).',
          2,
          '240 caractères maximum.',
        ),
        field('Technologies utilisées', techList),
        text('role', 'Rôle', 'Ex. Conception 3D et modélisation'),
        area('context', 'Contexte', 'D’où vient le projet ? Quel besoin ?', 3),
        area('result', 'Résultat', 'Ce qui a été obtenu (vérifiable).', 3),
      ),
      h(
        'div',
        { class: 'cms-card' },
        h('h3', null, 'Description détaillée'),
        h(
          'div',
          { class: 'cms-toolbar' },
          tool('B', 'Gras', () => wrap('**')),
          tool('I', 'Italique', () => wrap('*')),
          tool('H2', 'Titre', () => wrap('\n## ', '\n', 'Titre')),
          tool('•', 'Liste', () => wrap('\n- ', '\n', 'élément')),
          tool('↗', 'Lien', () => wrap('[', '](https://)', 'texte du lien')),
        ),
        body,
      ),
      h(
        'div',
        { class: 'cms-card' },
        h('h3', null, 'Liens et accessibilité'),
        field('Liens externes', linksBox),
        text('coverAlt', 'Texte alternatif de la couverture', 'Décris l’image de couverture'),
      ),
    ),
    h('aside', { class: 'cms-info-side' }, publishBox),
  );
  host.append(root);

  return () => {
    off();
    cancelAnimationFrame(queued);
    root.remove();
  };
}
