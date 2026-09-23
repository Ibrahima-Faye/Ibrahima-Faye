/**
 * Éditeurs du Contenu du site, une fonction par catégorie.
 * Textes → content.json « texts » (chemin du dictionnaire) ; structure (listes, liens, logos…) → content.json.
 */
import { api } from '../api';
import { h, icon, toast } from '../ui';
import { getPath, row, selectControl, setPath, toggleControl } from '../studio/controls';
import type { ContentTab, Meta } from '../types';
import type {
  AboutBlock,
  AboutBlockType,
  ContentSettings,
  EntityItem,
  ExpertiseItem,
  SocialItem,
} from '@/lib/studio/content';
import {
  dictField,
  heading,
  listEditor,
  plainInput,
  plainRich,
  valueField,
  type FieldContext,
} from './fields';

type Ctx = FieldContext & { meta: Meta };

const content = (ctx: Ctx) => ctx.state.get<ContentSettings>('content');
const change = (ctx: Ctx, mutate: (c: ContentSettings) => void) =>
  ctx.state.change('content', (d) => mutate(d as ContentSettings));
const dict = (ctx: Ctx, path: string) => getPath(ctx.dictionary, path);

/** Téléversement d'une image (logo, image de bloc) → public/identite/. */
function imagePicker(current: string | undefined, onChange: (path: string | undefined) => void) {
  const input = h('input', { type: 'file', accept: '.svg,.png,.webp,.jpg,.jpeg', hidden: true });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const { path } = await api.uploadIdentity(file);
      onChange(path);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Envoi impossible.', 'error');
    }
  });
  return h(
    'div',
    { class: 'st-upload' },
    current
      ? h('img', { src: current, alt: '', class: 'st-upload-img' })
      : h('span', { class: 'st-muted' }, 'Aucune'),
    h(
      'button',
      { type: 'button', class: 'cms-btn is-ghost', onclick: () => input.click() },
      icon('upload', 15),
      'Choisir…',
    ),
    current
      ? h(
          'button',
          { type: 'button', class: 'cms-btn is-ghost', onclick: () => onChange(undefined) },
          'Retirer',
        )
      : null,
    input,
  );
}

const domainOptions = (ctx: Ctx) =>
  ctx.meta.categories.map((c) => ({ value: c.slug, label: `${c.number} · ${c.title}` }));

/* ================================================================== Accueil */
function home(ctx: Ctx) {
  const identityOrigin = ctx.meta.studio?.contact?.name ?? 'Ibrahima Faye';
  return [
    heading(
      'Identité',
      'Le nom apparaît dans l’en-tête, le Hero, le pied de page et le référencement.',
    ),
    valueField(ctx, 'Nom', 'theme', 'identity.name', identityOrigin),
    heading('Hero'),
    dictField(ctx, 'Petit titre (au-dessus du nom)', 'hero.eyebrow'),
    dictField(ctx, 'Grand titre (une ligne par ligne)', 'hero.lines', 'lines'),
    dictField(ctx, 'Slogan (séparateur « · »)', 'hero.subtitle'),
    valueField(
      ctx,
      'Description (sous le slogan)',
      'content',
      'hero.description',
      '',
      'rich',
      'Facultatif — vide : rien n’est affiché.',
    ),
    dictField(ctx, 'Bouton principal — texte', 'hero.ctaProjects'),
    valueField(
      ctx,
      'Bouton principal — lien',
      'content',
      'hero.primaryHref',
      '/#projets',
      'line',
      'Ex. /#projets, /projets/, https://…',
    ),
    dictField(ctx, 'Bouton secondaire — texte', 'hero.ctaContact'),
    valueField(ctx, 'Bouton secondaire — lien', 'content', 'hero.secondaryHref', '/#contact'),
    dictField(ctx, 'Indication de défilement', 'hero.scroll'),
    dictField(ctx, 'Texte en bas du Hero', 'hero.entitiesLabel'),
    heading('Manifeste'),
    dictField(ctx, 'Surtitre', 'manifesto.eyebrow'),
    dictField(ctx, 'Texte', 'manifesto.statement', 'text'),
    dictField(ctx, 'Équation (un mot par ligne)', 'manifesto.equation', 'lines'),
    heading('Référencement', 'Titre de l’onglet, description pour Google et les réseaux sociaux.'),
    dictField(ctx, 'Titre du site', 'meta.siteTitle'),
    dictField(ctx, 'Description', 'meta.description', 'text'),
    dictField(ctx, 'Métier (référencement, pied de page)', 'meta.jobTitle'),
  ];
}

/* ================================================================== Expertises */
function expertises(ctx: Ctx) {
  const own = content(ctx).expertises?.items ?? [];
  const all: ExpertiseItem[] = [
    ...own.filter((i) => ctx.meta.categories.some((c) => c.slug === i.slug)),
    ...ctx.meta.categories
      .filter((c) => !own.some((i) => i.slug === c.slug))
      .map((c) => ({ slug: c.slug })),
  ];
  const clean = (list: ExpertiseItem[]) => {
    const meaningful = list.map(
      (i) =>
        Object.fromEntries(
          Object.entries(i).filter(([, v]) => v !== undefined && v !== ''),
        ) as ExpertiseItem,
    );
    const defaultOrder = meaningful.every((i, k) => i.slug === ctx.meta.categories[k]?.slug);
    const onlySlugs = meaningful.every((i) => Object.keys(i).length === 1);
    return defaultOrder && onlySlugs ? undefined : meaningful;
  };
  const save = (list: ExpertiseItem[]) =>
    change(ctx, (c) => {
      const items = clean(list);
      if (items) c.expertises = { ...c.expertises, items };
      else delete c.expertises;
    });
  return [
    heading('Section'),
    dictField(ctx, 'Surtitre', 'expertises.eyebrow'),
    dictField(ctx, 'Titre', 'expertises.title'),
    dictField(ctx, 'Sous-titre', 'expertises.intro', 'text'),
    heading(
      'Expertises',
      'Ordre d’affichage, visibilité, textes. Les catégories des projets ne changent pas.',
    ),
    listEditor<ExpertiseItem>(ctx, {
      items: all,
      save,
      title: (i) =>
        String(
          content(ctx).texts?.[`domains.${i.slug}.title`] ??
            dict(ctx, `domains.${i.slug}.title`) ??
            i.slug,
        ),
      visible: (i) => i.visible !== false,
      toggleVisible: (i) => ({ ...i, visible: i.visible === false ? undefined : false }),
      body: (i, _k, update) => [
        dictField(ctx, 'Titre', `domains.${i.slug}.title`),
        dictField(ctx, 'Description', `domains.${i.slug}.description`, 'text'),
        plainRich('Texte complémentaire', i.extra, 'Facultatif', (v) => update({ extra: v })),
        row(
          'Icône',
          selectControl<string>(
            i.icon,
            [{ value: '', label: 'Celle du domaine' }, ...domainOptions(ctx)],
            (v) => update({ icon: v }),
          ),
        ),
      ],
    }),
  ];
}

/* ================================================================== Projets */
function projects(ctx: Ctx) {
  const labels: [string, string][] = [
    ['Retour à la liste', 'projects.back'],
    ['Marque', 'projects.labelEntity'],
    ['Domaine', 'projects.labelDomain'],
    ['Année', 'projects.labelYear'],
    ['Statut', 'projects.labelStatus'],
    ['Client', 'projects.labelClient'],
    ['Rôle', 'projects.labelRole'],
    ['Contexte', 'projects.labelContext'],
    ['Résultat', 'projects.labelResult'],
    ['Technologies', 'projects.labelTechnologies'],
    ['Liens', 'projects.labelLinks'],
    ['Galerie', 'projects.gallery'],
    ['Projet suivant', 'projects.next'],
    ['Projet précédent', 'projects.previous'],
  ];
  return [
    heading('Section « Projets » de l’accueil'),
    dictField(ctx, 'Surtitre', 'projects.eyebrow'),
    dictField(ctx, 'Titre', 'projects.title'),
    dictField(ctx, 'Sous-titre', 'projects.intro', 'text'),
    dictField(ctx, 'Bouton « tous les projets »', 'projects.seeAll'),
    dictField(ctx, 'Texte si aucun projet', 'projects.empty', 'text'),
    heading(
      'Page Projets',
      'Le contenu de chaque projet se modifie dans Projets (éditeur de projet).',
    ),
    dictField(ctx, 'Titre de la page', 'projects.pageTitle'),
    dictField(ctx, 'Filtre « Tous »', 'projects.filterAll'),
    dictField(ctx, 'Filtre « Domaine »', 'projects.filterDomain'),
    dictField(ctx, 'Filtre « Marque »', 'projects.filterEntity'),
    dictField(ctx, 'Aucun résultat', 'projects.emptyFiltered'),
    dictField(ctx, 'Réinitialiser les filtres', 'projects.resetFilters'),
    dictField(ctx, 'Description (référencement)', 'meta.projectsDescription', 'text'),
    heading('Page d’un projet — libellés'),
    labels.map(([label, path]) => dictField(ctx, label, path)),
  ];
}

/* ================================================================== Écosystème */
function ecosystem(ctx: Ctx) {
  const own = content(ctx).ecosystem?.items ?? [];
  const builtins = ['clicgraph', 'jeefsys'];
  const all: EntityItem[] = [
    ...own,
    ...builtins.filter((id) => !own.some((i) => i.id === id)).map((id) => ({ id })),
  ];
  const save = (list: EntityItem[]) =>
    change(ctx, (c) => {
      const meaningful = list.map(
        (i) =>
          Object.fromEntries(
            Object.entries(i).filter(([, v]) => v !== undefined && v !== ''),
          ) as EntityItem,
      );
      const untouched =
        meaningful.length === 2 &&
        meaningful.every((i, k) => i.id === builtins[k] && Object.keys(i).length === 1);
      if (untouched) delete c.ecosystem;
      else c.ecosystem = { ...c.ecosystem, items: meaningful };
    });
  let n = 1;
  while (all.some((i) => i.id === `entite-${n}`)) n++;
  return [
    heading('Section'),
    dictField(ctx, 'Surtitre', 'ecosystem.eyebrow'),
    dictField(ctx, 'Titre', 'ecosystem.title'),
    dictField(ctx, 'Sous-titre', 'ecosystem.intro', 'text'),
    dictField(ctx, 'Libellé « Domaines »', 'ecosystem.domainsLabel'),
    dictField(
      ctx,
      'Bouton par défaut',
      'ecosystem.seeProjects',
      'line',
      '« {name} » est remplacé par le nom de l’entité.',
    ),
    heading(
      'Entités',
      'Les textes de ClicGraph et JeeFSYS sont partagés avec tout le site (cartes, filtres, pied de page).',
    ),
    listEditor<EntityItem>(ctx, {
      items: all,
      save,
      title: (i) =>
        builtins.includes(i.id)
          ? String(
              content(ctx).texts?.[`entities.${i.id}.name`] ?? dict(ctx, `entities.${i.id}.name`),
            )
          : i.name || 'Nouvelle entité',
      visible: (i) => i.visible !== false,
      toggleVisible: (i) => ({ ...i, visible: i.visible === false ? undefined : false }),
      removable: (i) => !builtins.includes(i.id),
      add: {
        label: 'Ajouter une entité',
        create: () => ({ id: `entite-${n}`, name: 'Nouvelle entité' }),
      },
      body: (i, _k, update) => {
        const builtin = builtins.includes(i.id);
        return [
          builtin
            ? dictField(ctx, 'Nom', `entities.${i.id}.name`)
            : plainInput('Nom', i.name, 'Nom', (v) => update({ name: v })),
          builtin
            ? dictField(ctx, 'Slogan', `entities.${i.id}.role`)
            : plainInput('Slogan', i.role, 'Slogan', (v) => update({ role: v })),
          builtin
            ? dictField(ctx, 'Description', `entities.${i.id}.description`, 'text')
            : plainRich('Description', i.description, 'Description', (v) =>
                update({ description: v }),
              ),
          row(
            'Logo',
            imagePicker(i.logo, (path) => (update({ logo: path }), ctx.redraw())),
          ),
          row(
            'Icône',
            selectControl<string>(
              i.icon,
              [{ value: '', label: 'Aucune' }, ...domainOptions(ctx)],
              (v) => update({ icon: v }),
            ),
          ),
          plainInput(
            'Lien',
            i.href,
            builtin ? `/projets/?entite=${i.id} (projets de l’entité)` : 'https://…',
            (v) => update({ href: v }),
          ),
          row(
            'Bouton',
            toggleControl(
              i.button !== false,
              (v) => update({ button: v ? undefined : false }),
              'Afficher le bouton',
            ),
          ),
          plainInput('Texte du bouton', i.buttonLabel, 'Texte par défaut', (v) =>
            update({ buttonLabel: v }),
          ),
        ];
      },
    }),
    heading('Projets personnels'),
    dictField(ctx, 'Nom affiché', 'entities.personal.name'),
  ];
}

/* ================================================================== À propos */
const BLOCK_TYPES: { value: AboutBlockType; label: string }[] = [
  { value: 'heading', label: 'Titre' },
  { value: 'text', label: 'Texte' },
  { value: 'list', label: 'Liste' },
  { value: 'quote', label: 'Citation' },
  { value: 'image', label: 'Image' },
  { value: 'button', label: 'Bouton' },
];

function about(ctx: Ctx) {
  const originSteps = (dict(ctx, 'about.steps') as { title: string; text: string }[]) ?? [];
  const steps = content(ctx).about?.steps ?? originSteps;
  const saveSteps = (list: { title: string; text: string }[]) =>
    change(ctx, (c) => {
      const same = JSON.stringify(list) === JSON.stringify(originSteps);
      setPath(c as Record<string, unknown>, 'about.steps', same ? undefined : list);
    });
  const blocks = content(ctx).about?.blocks ?? [];
  const saveBlocks = (list: AboutBlock[]) =>
    change(ctx, (c) =>
      setPath(c as Record<string, unknown>, 'about.blocks', list.length ? list : undefined),
    );
  let n = 1;
  while (blocks.some((b) => b.id === `bloc-${n}`)) n++;
  const addBlock = h('div', { class: 'ce-add-row' });
  for (const t of BLOCK_TYPES)
    addBlock.append(
      h(
        'button',
        {
          type: 'button',
          class: 'cms-btn is-ghost',
          onclick: () => {
            saveBlocks([...blocks, { id: `bloc-${n}`, type: t.value }]);
            ctx.redraw();
          },
        },
        icon('plus', 14),
        t.label,
      ),
    );
  return [
    heading('Présentation'),
    dictField(ctx, 'Surtitre', 'about.eyebrow'),
    dictField(ctx, 'Titre', 'about.title'),
    dictField(
      ctx,
      'Paragraphes',
      'about.paragraphs',
      'paragraphs',
      'Ligne vide entre deux paragraphes. Le premier est mis en avant.',
    ),
    dictField(ctx, 'Texte alternatif du portrait', 'about.portraitAlt'),
    heading('Démarche / parcours'),
    dictField(ctx, 'Titre de la liste', 'about.stepsLabel'),
    listEditor(ctx, {
      items: steps,
      save: saveSteps,
      title: (s) => s.title || 'Étape',
      removable: () => true,
      add: { label: 'Ajouter une étape', create: () => ({ title: 'Nouvelle étape', text: '' }) },
      body: (s, _k, update) => [
        plainInput('Titre', s.title, 'Titre', (v) => update({ title: v ?? '' })),
        plainInput('Texte', s.text, 'Texte', (v) => update({ text: v ?? '' })),
      ],
    }),
    heading(
      'Blocs de contenu',
      'Affichés après les paragraphes : titre, texte, liste (compétences…), citation, image, bouton.',
    ),
    listEditor<AboutBlock>(ctx, {
      items: blocks,
      save: saveBlocks,
      title: (b) =>
        `${BLOCK_TYPES.find((t) => t.value === b.type)?.label ?? b.type}${b.text || b.label ? ` — ${(b.text || b.label || '').slice(0, 40)}` : ''}`,
      removable: () => true,
      body: (b, _k, update) => {
        if (b.type === 'heading' || b.type === 'quote')
          return plainInput(b.type === 'heading' ? 'Titre' : 'Citation', b.text, '', (v) =>
            update({ text: v }),
          );
        if (b.type === 'text') return plainRich('Texte', b.text, '', (v) => update({ text: v }));
        if (b.type === 'list')
          return row(
            'Éléments (un par ligne)',
            (() => {
              const el = h(
                'textarea',
                { class: 'st-input st-textarea ce-area', rows: 4 },
                (b.items ?? []).join('\n'),
              );
              el.addEventListener('input', () =>
                update({
                  items: el.value
                    .split('\n')
                    .map((x) => x.trim())
                    .filter(Boolean),
                }),
              );
              return el;
            })(),
          );
        if (b.type === 'image')
          return [
            row(
              'Image',
              imagePicker(b.src, (path) => (update({ src: path }), ctx.redraw())),
            ),
            plainInput('Texte alternatif', b.alt, 'Description de l’image', (v) =>
              update({ alt: v }),
            ),
          ];
        return [
          plainInput('Texte du bouton', b.label, 'Ex. Me contacter', (v) => update({ label: v })),
          plainInput('Lien', b.href, '/#contact, https://…', (v) => update({ href: v })),
        ];
      },
    }),
    addBlock,
  ];
}

/* ================================================================== Contact */
function contact(ctx: Ctx) {
  const origin = ctx.meta.studio?.contact ?? {};
  const socials = content(ctx).contact?.socials ?? [];
  const saveSocials = (list: SocialItem[]) =>
    change(ctx, (c) =>
      setPath(c as Record<string, unknown>, 'contact.socials', list.length ? list : undefined),
    );
  const labels: [string, string][] = [
    ['Libellé e-mail', 'contact.email'],
    ['Libellé téléphone', 'contact.phone'],
    ['Libellé WhatsApp', 'contact.whatsapp'],
    ['Libellé localisation', 'contact.location'],
    ['Formulaire — Nom', 'contact.form.name'],
    ['Formulaire — E-mail', 'contact.form.email'],
    ['Formulaire — Message', 'contact.form.message'],
    ['Formulaire — Envoyer', 'contact.form.send'],
    ['Formulaire — Envoi…', 'contact.form.sending'],
    ['Formulaire — Succès', 'contact.form.success'],
    ['Formulaire — Erreur', 'contact.form.error'],
  ];
  return [
    heading('Textes'),
    dictField(ctx, 'Surtitre', 'contact.eyebrow'),
    dictField(ctx, 'Titre', 'contact.title', 'text'),
    dictField(ctx, 'Sous-titre', 'contact.text'),
    valueField(ctx, 'Texte d’introduction', 'content', 'contact.intro', '', 'rich', 'Facultatif.'),
    heading(
      'Coordonnées',
      'Centralisées : utilisées par la section Contact (et le référencement). Vide = non affiché.',
    ),
    valueField(ctx, 'E-mail', 'content', 'contact.email', origin.email ?? ''),
    valueField(ctx, 'Téléphone', 'content', 'contact.phone', origin.phone ?? ''),
    valueField(
      ctx,
      'WhatsApp (lien https://wa.me/…)',
      'content',
      'contact.whatsapp',
      origin.whatsapp ?? '',
    ),
    valueField(ctx, 'Localisation', 'content', 'contact.location', origin.location ?? ''),
    valueField(
      ctx,
      'Formulaire — adresse du service',
      'content',
      'contact.formEndpoint',
      origin.formEndpoint ?? '',
      'line',
      'Web3Forms, Formspree… Vide : pas de formulaire.',
    ),
    valueField(
      ctx,
      'Formulaire — clé publique',
      'content',
      'contact.formAccessKey',
      origin.formAccessKey ?? '',
      'line',
      'Clé « access_key » publique du service (jamais un mot de passe).',
    ),
    heading('Réseaux sociaux'),
    listEditor<SocialItem>(ctx, {
      items: socials,
      save: saveSocials,
      title: (s) => s.label || 'Réseau',
      removable: () => true,
      add: { label: 'Ajouter un réseau', create: () => ({ label: 'LinkedIn', href: 'https://' }) },
      body: (s, _k, update) => [
        plainInput('Nom', s.label, 'LinkedIn', (v) => update({ label: v ?? '' })),
        plainInput('Adresse', s.href, 'https://…', (v) => update({ href: v ?? '' })),
      ],
    }),
    heading('Libellés'),
    labels.map(([label, path]) => dictField(ctx, label, path)),
  ];
}

/* ================================================================== Footer */
function footer(ctx: Ctx) {
  const nav = ctx.meta.studio?.nav ?? {};
  const originLinks = [
    { label: nav.expertises ?? 'Expertises', href: '/#expertises' },
    { label: nav.projects ?? 'Projets', href: '/projets/' },
    { label: nav.ecosystem ?? 'Écosystème', href: '/#ecosysteme' },
    { label: nav.about ?? 'À propos', href: '/#a-propos' },
    { label: nav.contact ?? 'Contact', href: '/#contact' },
  ];
  const links = content(ctx).footer?.links ?? originLinks;
  const saveLinks = (list: { label: string; href: string }[]) =>
    change(ctx, (c) => {
      const same = JSON.stringify(list) === JSON.stringify(originLinks);
      setPath(
        c as Record<string, unknown>,
        'footer.links',
        same || !list.length ? undefined : list,
      );
    });
  const socials = content(ctx).footer?.socials !== false;
  return [
    heading('Présentation', 'Le nom se modifie dans Accueil → Identité.'),
    valueField(
      ctx,
      'Description (sous le nom)',
      'content',
      'footer.description',
      '',
      'rich',
      'Vide : le métier (référencement) est affiché, comme aujourd’hui.',
    ),
    dictField(
      ctx,
      'Copyright',
      'footer.rights',
      'line',
      '{year} est remplacé par l’année en cours.',
    ),
    row(
      'Réseaux sociaux',
      toggleControl(
        socials,
        (v) =>
          change(ctx, (c) =>
            setPath(c as Record<string, unknown>, 'footer.socials', v ? undefined : false),
          ),
        'Afficher ceux de Contact',
      ),
    ),
    heading('Liens « Explorer »'),
    dictField(ctx, 'Titre de la colonne', 'footer.explore'),
    listEditor(ctx, {
      items: links,
      save: saveLinks,
      title: (l) => l.label || 'Lien',
      removable: () => true,
      add: { label: 'Ajouter un lien', create: () => ({ label: 'Nouveau lien', href: '/' }) },
      body: (l, _k, update) => [
        plainInput('Texte', l.label, 'Texte', (v) => update({ label: v ?? '' })),
        plainInput('Lien', l.href, '/#section, /page/, https://…', (v) =>
          update({ href: v ?? '' }),
        ),
      ],
    }),
    heading('Colonne « Univers »'),
    dictField(ctx, 'Titre de la colonne', 'footer.universe'),
    dictField(
      ctx,
      'Texte ClicGraph',
      'entities.clicgraph.role',
      'line',
      'Partagé avec la section Écosystème.',
    ),
    dictField(
      ctx,
      'Texte JeeFSYS',
      'entities.jeefsys.role',
      'line',
      'Partagé avec la section Écosystème.',
    ),
    heading('Bas de page'),
    dictField(ctx, 'Lien « Haut de page »', 'footer.backToTop'),
    dictField(ctx, 'Titre des réseaux', 'footer.socials'),
  ];
}

export const EDITORS: Record<Exclude<ContentTab, 'navigation'>, (ctx: Ctx) => unknown[]> = {
  accueil: home,
  expertises,
  projets: projects,
  ecosysteme: ecosystem,
  'a-propos': about,
  contact,
  footer,
};

export type { Ctx as ContentContext };
