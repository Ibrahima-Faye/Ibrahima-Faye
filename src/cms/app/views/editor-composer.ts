/**
 * Onglet « Galerie » — éditeur visuel en blocs.
 *
 *   ┌ Médiathèque ┐ ┌──────────── Canevas (ordinateur / tablette / mobile) ───────────┐ ┌ Réglages ┐
 *   │ envoyer     │ │ [Média seul] [Grille] [Carrousel]                                 │ │ bloc,    │
 *   │ glisser →   │ │ ┌ bloc ───────────────────────────────────────────┐ ⠿ ↑ ↓ ⧉ 👁 🗑 │ │ média ou │
 *   │ vers un bloc│ │ │ médias (glisser pour réordonner / changer de bloc)│              │ │ fichier  │
 *   └─────────────┘ └──────────────────────────────────────────────────────────────────┘ └──────────┘
 *
 * - Le canevas utilise les colonnes / médias visibles de l'appareil choisi : chaque appareil a ses réglages.
 * - Chaque média garde son ratio (aucun recadrage), comme sur le site.
 * - Tout est enregistré automatiquement (Editor.touch) ; rien n'est supprimé sans confirmation.
 * - Projet sans blocs : aperçu de la composition actuelle + « Organiser en blocs » (rendu identique).
 */
import Sortable from 'sortablejs';
import { SPAN_INFO } from '@/lib/gallery-layout';
import { resolveColumns, resolvePerView, resolveSpan } from '@/lib/gallery/normalize';
import { acceptAttribute, formatLabels, kindOf } from '@/lib/media-rules';
import { isKnownBlockType, type Block, type BlockItem, type Device } from '@/schemas/blocks';
import * as ops from '../blocks-ops';
import { api, fileUrl, thumbUrl, upload, webUrl } from '../api';
import { itemRatio, type Editor } from '../editor-state';
import { captureFrame, probeVideo } from '../media-probe';
import type { FileInfo, GalleryItem, WebInfo } from '../types';
import { confirmModal, describeRatio, formatBytes, h, icon, toast, type IconName } from '../ui';
import { mountGallery } from './editor-gallery';

const DEVICES: { id: Device; label: string; icon: IconName; width: number }[] = [
  { id: 'desktop', label: 'Ordinateur', icon: 'monitor', width: 1200 },
  { id: 'tablet', label: 'Tablette', icon: 'tablet', width: 820 },
  { id: 'mobile', label: 'Mobile', icon: 'phone', width: 390 },
];

const TYPE_INFO: Record<ops.EditableType, { label: string; icon: IconName; hint: string }> = {
  single: { label: 'Média seul', icon: 'image', hint: 'Une image ou une vidéo, seule' },
  grid: { label: 'Grille', icon: 'layout', hint: 'Plusieurs médias en colonnes' },
  carousel: { label: 'Carrousel', icon: 'video', hint: 'Médias qui défilent horizontalement' },
};

const PER_VIEW = [1, 1.2, 1.5, 2, 3];
const AUTOPLAY = [
  { value: 0, label: 'Non' },
  { value: 3, label: '3 s' },
  { value: 5, label: '5 s' },
  { value: 8, label: '8 s' },
];
/** Glisser vers un bloc éloigné : la page défile quand le média approche du bord de l'écran. */
const AUTOSCROLL = {
  scroll: true,
  bubbleScroll: true,
  scrollSensitivity: 90,
  scrollSpeed: 18,
} as const;
const FORMATS = `${formatLabels('image')} · ${formatLabels('video')}`;
const isAccepted = (name: string) => Boolean(kindOf(name) ?? kindOf(name.toLowerCase()));

type Selection =
  | { kind: 'block'; block: string }
  | { kind: 'item'; block: string; item: string }
  | { kind: 'file'; file: string }
  | null;

const readDevice = (): Device => {
  try {
    const d = localStorage.getItem('cms:device');
    return d === 'tablet' || d === 'mobile' ? d : 'desktop';
  } catch {
    return 'desktop';
  }
};

export function mountComposer(host: HTMLElement, editor: Editor): () => void {
  const slug = editor.slug;
  let device: Device = readDevice();
  let selection: Selection = null;
  /** Dernier bloc sélectionné : cible de « Ajouter au bloc ». */
  let lastBlock: string | undefined;
  let sortables: Sortable[] = [];
  /** Glisser depuis la médiathèque (recréé à chaque rendu de la médiathèque). */
  let librarySortable: Sortable | undefined;
  let legacyView: (() => void) | undefined;
  const pending = new Map<string, { name: string; ratio: number }>();

  /* ------------------------------------------------------------------ structure */
  const fileInput = h('input', {
    type: 'file',
    multiple: true,
    accept: acceptAttribute(),
    hidden: true,
  });
  const library = h('aside', { class: 'cmp-library', 'aria-label': 'Médiathèque' });
  const toolbar = h('div', { class: 'cmp-toolbar' });
  const page = h('div', { class: 'cmp-page' });
  const stage = h('div', { class: 'cmp-stage' }, page);
  const inspector = h('aside', { class: 'cmp-inspector', 'aria-label': 'Réglages' });
  const root = h(
    'section',
    { class: 'cmp' },
    library,
    h('div', { class: 'cmp-main' }, toolbar, stage),
    inspector,
    fileInput,
    h(
      'div',
      { class: 'cmp-drop-overlay' },
      icon('upload', 30),
      h('strong', null, 'Relâche pour ajouter'),
    ),
  );
  host.append(root);

  /* ------------------------------------------------------------------ état */
  const blocks = () => editor.blocks();
  const findBlock = (id: string) => blocks().find((b) => b.id === id);
  const galleryFiles = () => editor.items; // fichiers de galerie (affiches exclues), dans l'ordre historique

  /** Modifie la mise en page et redessine. */
  function commit(next: Block[], what: 'stage' | 'all' = 'all') {
    editor.setBlocks(next);
    if (what === 'all') renderAll();
    else renderStage();
  }

  function select(next: Selection) {
    selection = next;
    if (next?.kind === 'block' || next?.kind === 'item') lastBlock = next.block;
    root.querySelectorAll('.is-selected').forEach((el) => el.classList.remove('is-selected'));
    if (next?.kind === 'block')
      root
        .querySelector(`.cmp-block[data-block-id="${CSS.escape(next.block)}"]`)
        ?.classList.add('is-selected');
    if (next?.kind === 'item')
      root
        .querySelector(`.cmp-item[data-item="${CSS.escape(next.item)}"]`)
        ?.classList.add('is-selected');
    if (next?.kind === 'file')
      root
        .querySelector(`.cmp-lib-item[data-file="${CSS.escape(next.file)}"]`)
        ?.classList.add('is-selected');
    renderInspector();
  }

  /* ------------------------------------------------------------------ médias (vignettes) */
  const ratioOf = (file: string) => {
    const item = editor.item(file);
    return item ? itemRatio(item, editor.files) : 1.5;
  };

  const fileInfo = (name: string): FileInfo | undefined =>
    editor.files.find((f) => f.name === name);
  const webOf = (name: string): WebInfo | undefined => fileInfo(name)?.web;
  /** Version de la vignette : change quand la version web est régénérée (cache du navigateur). */
  const webV = (name: string) => {
    const w = webOf(name);
    return w?.status === 'ok' ? Object.values(w.sizes ?? {}).reduce((a, b) => a + b, 0) : 0;
  };

  function mediaEl(file: string, width: number): HTMLElement {
    const item = editor.item(file);
    if (!item) return h('div', { class: 'cmp-missing' }, icon('info', 18), 'Fichier introuvable');
    const web = webOf(file);
    const needsWeb = /\.(heic|heif)$/i.test(file) || (item.kind === 'video' && !item.poster);
    if (needsWeb && web?.status !== 'ok') {
      // HEIC, MOV… : aperçu disponible dès que la version web est prête
      return h(
        'div',
        { class: 'cmp-missing is-waiting' },
        icon(item.kind === 'video' ? 'video' : 'image', 18),
        web?.status === 'error' ? 'Version web en erreur' : 'Aperçu en préparation…',
      );
    }
    if (item.kind === 'image' || item.poster || web?.status === 'ok') {
      const source = item.kind === 'image' ? item.file : (item.poster ?? item.file);
      return h('img', {
        src: thumbUrl(slug, source, width, item.v + webV(file)),
        alt: '',
        loading: 'lazy',
        draggable: false,
      });
    }
    return h('div', { class: 'cmp-missing' }, icon('video', 18), 'Aperçu indisponible');
  }

  /* ------------------------------------------------------------------ médiathèque */
  function renderLibrary() {
    const count = ops.usage(blocks());
    const hasBlocks = editor.hasBlocks();
    const cover = editor.coverFile();
    const list = h('div', { class: 'cmp-lib-grid' });
    for (const [key, p] of pending) {
      list.append(
        h(
          'div',
          { class: 'cmp-lib-item is-pending', 'data-pending': key },
          h(
            'div',
            { class: 'cmp-lib-thumb', style: `--r:${p.ratio}` },
            h('span', { class: 'cmp-progress' }, h('i')),
          ),
          h('small', null, p.name),
        ),
      );
    }
    for (const item of galleryFiles()) {
      const uses = count.get(item.file) ?? 0;
      list.append(
        h(
          'figure',
          {
            class: `cmp-lib-item${selection?.kind === 'file' && selection.file === item.file ? ' is-selected' : ''}`,
            'data-file': item.file,
            title: item.file,
          },
          h(
            'div',
            { class: 'cmp-lib-thumb', style: `--r:${ratioOf(item.file).toFixed(4)}` },
            mediaEl(item.file, 320),
            item.kind === 'video' && h('span', { class: 'cmp-kind' }, icon('play', 12)),
            item.file === cover &&
              h('span', { class: 'cmp-cover', title: 'Couverture' }, icon('star', 12)),
            webBadge(item.file),
          ),
          hasBlocks &&
            h(
              'span',
              { class: `cmp-uses${uses ? '' : ' is-unplaced'}` },
              uses ? `× ${uses}` : item.hidden ? 'masqué' : 'non placé',
            ),
        ),
      );
    }
    library.replaceChildren(
      h(
        'div',
        { class: 'cmp-lib-head' },
        h('h3', null, 'Médiathèque'),
        h('span', { class: 'cms-muted' }, String(galleryFiles().length)),
      ),
      optimizeBar() ?? '',
      h(
        'button',
        {
          type: 'button',
          class: 'cms-btn is-primary cmp-upload',
          onclick: () => fileInput.click(),
        },
        icon('upload', 16),
        'Envoyer des médias',
      ),
      h(
        'p',
        { class: 'cmp-lib-hint' },
        hasBlocks
          ? 'Glisse un média vers un bloc. Clic : ses réglages.'
          : 'Clic sur un média : ses réglages.',
        h('br'),
        FORMATS,
      ),
      list,
    );
    librarySortable?.destroy();
    librarySortable = undefined;
    if (hasBlocks) {
      librarySortable = Sortable.create(list, {
        group: { name: 'cmp-items', pull: 'clone', put: false },
        sort: false,
        draggable: '.cmp-lib-item:not(.is-pending)',
        forceFallback: true,
        ...AUTOSCROLL,
        fallbackOnBody: true,
        fallbackTolerance: 4,
        onEnd: (evt) => {
          const to = (evt.to as HTMLElement).dataset.block;
          const file = (evt.item as HTMLElement).dataset.file;
          if (to && file && evt.to !== evt.from)
            commit(ops.addItems(blocks(), to, [file], evt.newDraggableIndex ?? undefined));
          else renderLibrary();
        },
      });
    }
  }

  /* ------------------------------------------------------------------ versions web (pipeline médias) */
  const STATUS_LABEL: Record<WebInfo['status'], string> = {
    ok: 'Optimisé',
    pending: 'À optimiser',
    queued: 'En file d’attente',
    running: 'Optimisation en cours',
    error: 'Erreur d’optimisation',
  };

  function webBadge(name: string) {
    const web = webOf(name);
    if (!web || web.status === 'ok') return null;
    const text =
      web.status === 'running'
        ? `${Math.round((web.progress ?? 0) * 100)} %`
        : web.status === 'error'
          ? '!'
          : '…';
    return h(
      'span',
      {
        class: `cmp-web is-${web.status}`,
        title: STATUS_LABEL[web.status] + (web.error ? ` : ${web.error}` : ''),
      },
      text,
    );
  }

  /** Originaux sans version web à jour (hors affiches de vidéos, traitées elles aussi). */
  const notReady = () => editor.files.filter((f) => f.web && f.web.status !== 'ok');

  function optimizeBar() {
    const waiting = notReady();
    if (!waiting.length) return null;
    const busy = waiting.some((f) => f.web?.status === 'queued' || f.web?.status === 'running');
    const errors = waiting.filter((f) => f.web?.status === 'error').length;
    return h(
      'div',
      { class: 'cmp-optimize' },
      h(
        'span',
        null,
        busy
          ? `Optimisation : ${waiting.length} fichier${waiting.length > 1 ? 's' : ''} en cours ou en attente…`
          : `${waiting.length} fichier${waiting.length > 1 ? 's' : ''} sans version web${errors ? ` (${errors} en erreur)` : ''}.`,
      ),
      !busy &&
        h(
          'button',
          {
            type: 'button',
            class: 'cms-btn is-ghost',
            onclick: () => void startOptimize(waiting.map((f) => f.name)),
          },
          'Optimiser maintenant',
        ),
    );
  }

  async function startOptimize(files: string[], force = false) {
    try {
      await api.optimize(slug, { files, force });
      await refreshFiles();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Optimisation impossible.', 'error');
    }
  }

  /** Relit les fichiers (statut des versions web, dimensions) et redessine ce qui en dépend. */
  let polling = 0;
  async function refreshFiles() {
    try {
      const detail = await api.get(slug);
      editor.updateFiles(detail.files);
    } catch {
      return; // réseau : nouvel essai au prochain passage
    }
    renderLibrary();
    renderStage();
    if (selection?.kind === 'file') renderInspector();
    const active = notReady().some(
      (f) => f.web?.status === 'queued' || f.web?.status === 'running',
    );
    clearTimeout(polling);
    if (active) polling = window.setTimeout(() => void refreshFiles(), 1500);
  }

  library.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.cmp-lib-item[data-file]');
    if (el) select({ kind: 'file', file: el.dataset.file! });
  });

  /* ------------------------------------------------------------------ barre d'outils */
  function renderToolbar() {
    toolbar.replaceChildren(
      h(
        'div',
        { class: 'cms-segs', role: 'group', 'aria-label': 'Appareil' },
        DEVICES.map((d) =>
          h(
            'button',
            {
              type: 'button',
              class: `cms-seg${d.id === device ? ' is-on' : ''}`,
              'aria-pressed': String(d.id === device),
              onclick: () => {
                device = d.id;
                try {
                  localStorage.setItem('cms:device', device);
                } catch {
                  /* stockage indisponible : réglage non retenu */
                }
                renderToolbar();
                renderStage();
                renderInspector();
              },
            },
            icon(d.icon, 16),
            d.label,
          ),
        ),
      ),
      h('span', { class: 'cms-grow' }),
      ...(editor.hasBlocks() ? [addButtons()] : []),
    );
  }

  function addButtons() {
    return h(
      'div',
      { class: 'cmp-add', role: 'group', 'aria-label': 'Ajouter un bloc' },
      h('span', { class: 'cms-muted' }, 'Ajouter :'),
      (Object.keys(TYPE_INFO) as ops.EditableType[]).map((type) =>
        h(
          'button',
          {
            type: 'button',
            class: 'cms-btn is-ghost',
            title: TYPE_INFO[type].hint,
            onclick: () => addBlock(type),
          },
          icon('plus', 15),
          TYPE_INFO[type].label,
        ),
      ),
    );
  }

  function addBlock(type: ops.EditableType) {
    const current = blocks();
    const block = ops.createBlock(type, ops.collectIds(current));
    const sel = selection;
    const after = sel && sel.kind !== 'file' ? current.findIndex((b) => b.id === sel.block) : -1;
    commit(ops.insertBlock(current, block, after === -1 ? current.length : after + 1));
    select({ kind: 'block', block: block.id! });
    root
      .querySelector(`.cmp-block[data-block-id="${block.id}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ canevas */
  /**
   * Largeur du canevas : toute la place pour l'ordinateur (les colonnes sont des fractions : même composition),
   * largeur réelle de l'appareil pour la tablette et le mobile (sans zoom : tout reste lisible).
   */
  function fitStage() {
    const width = DEVICES.find((d) => d.id === device)!.width;
    page.style.width = device === 'desktop' ? '' : `${Math.min(width, stage.clientWidth - 2)}px`;
  }

  function renderStage() {
    sortables.forEach((s) => s.destroy());
    sortables = [];
    page.dataset.device = device;
    if (!editor.hasBlocks()) renderLegacy();
    else renderBlocks();
    fitStage();
    renderLibrary();
  }

  /** Projet sans blocs : aperçu fidèle de la galerie actuelle + conversion. */
  function renderLegacy() {
    const items = galleryFiles().filter((i) => !i.hidden);
    const grid = h('div', {
      class: 'cmp-items cmp-legacy',
      style: `--cols:${device === 'mobile' ? 1 : 12}`,
    });
    for (const item of items) {
      grid.append(
        h(
          'figure',
          {
            class: 'cmp-item',
            style: `--span:${device === 'mobile' ? 1 : item.span};--r:${ratioOf(item.file).toFixed(4)};--align:${item.align}`,
          },
          h('div', { class: 'cmp-tile' }, mediaEl(item.file, 700)),
        ),
      );
    }
    page.replaceChildren(
      h(
        'div',
        { class: 'cmp-intro' },
        icon('layout', 26),
        h(
          'div',
          null,
          h('h3', null, 'Composition automatique'),
          h(
            'p',
            null,
            'Ce projet n’est pas encore organisé en blocs : voici sa galerie actuelle. « Organiser en blocs » la reprend à l’identique (même rendu sur le site), puis tu peux ajouter des carrousels, des grilles, déplacer les médias…',
          ),
          h(
            'div',
            { class: 'cms-row' },
            h(
              'button',
              {
                type: 'button',
                class: 'cms-btn is-primary',
                onclick: () => {
                  const next = ops.fromLegacy(galleryFiles());
                  commit(next.length ? next : [ops.createBlock('grid', new Set())]);
                  renderToolbar();
                  toast('Galerie organisée en blocs — rendu identique sur le site.');
                  if (next[0]) select({ kind: 'block', block: next[0].id! });
                },
              },
              icon('layout', 16),
              'Organiser en blocs',
            ),
            h(
              'button',
              { type: 'button', class: 'cms-btn is-ghost', onclick: () => openSimple() },
              'Éditeur simple (ancien)',
            ),
          ),
        ),
      ),
      items.length
        ? grid
        : h(
            'div',
            { class: 'cmp-empty' },
            icon('upload', 28),
            h('strong', null, 'Aucun média'),
            h(
              'span',
              null,
              'Envoie des images ou des vidéos depuis la médiathèque, ou dépose-les ici.',
            ),
          ),
    );
  }

  function renderBlocks() {
    const list = h('div', { class: 'cmp-blocks' });
    blocks().forEach((block, index) => list.append(blockEl(block, index)));
    const count = ops.usage(blocks());
    const unplaced = galleryFiles().filter((i) => !i.hidden && !count.has(i.file));

    page.replaceChildren(
      blocks().length
        ? list
        : h(
            'div',
            { class: 'cmp-empty' },
            icon('layout', 28),
            h('strong', null, 'Aucun bloc'),
            h(
              'span',
              null,
              'Ajoute un bloc avec les boutons ci-dessus, puis glisse des médias dedans.',
            ),
          ),
      ...(unplaced.length ? [unplacedEl(unplaced)] : []),
    );
    sortables.push(
      Sortable.create(list, {
        handle: '.cmp-grip',
        draggable: '.cmp-block',
        animation: 180,
        forceFallback: true,
        ...AUTOSCROLL,
        fallbackOnBody: true,
        onEnd: (evt) => {
          if (
            evt.oldIndex === undefined ||
            evt.newIndex === undefined ||
            evt.oldIndex === evt.newIndex
          )
            return;
          commit(ops.moveBlock(blocks(), evt.oldIndex, evt.newIndex), 'stage');
        },
      }),
    );
  }

  function unplacedEl(files: GalleryItem[]) {
    const hide = editor.data.unplaced === 'hide';
    const grid = h('div', { class: 'cmp-lib-grid cmp-unplaced-grid' });
    for (const item of files) {
      grid.append(
        h(
          'figure',
          { class: 'cmp-lib-item', 'data-file': item.file, title: item.file },
          h(
            'div',
            { class: 'cmp-lib-thumb', style: `--r:${ratioOf(item.file).toFixed(4)}` },
            mediaEl(item.file, 320),
          ),
        ),
      );
    }
    sortables.push(
      Sortable.create(grid, {
        group: { name: 'cmp-items', pull: 'clone', put: false },
        sort: false,
        forceFallback: true,
        ...AUTOSCROLL,
        fallbackOnBody: true,
        fallbackTolerance: 4,
        onEnd: (evt) => {
          const to = (evt.to as HTMLElement).dataset.block;
          const file = (evt.item as HTMLElement).dataset.file;
          if (to && file && evt.to !== evt.from)
            commit(ops.addItems(blocks(), to, [file], evt.newDraggableIndex ?? undefined));
          else renderStage();
        },
      }),
    );
    grid.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-file]');
      if (el) select({ kind: 'file', file: el.dataset.file! });
    });
    return h(
      'section',
      { class: `cmp-unplaced${hide ? ' is-hidden' : ''}` },
      h(
        'div',
        { class: 'cmp-unplaced-head' },
        h('strong', null, `Non placés (${files.length})`),
        h(
          'span',
          { class: 'cms-muted' },
          hide ? 'masqués sur le site' : 'affichés à la fin de la galerie sur le site',
        ),
        h('span', { class: 'cms-grow' }),
        h(
          'label',
          { class: 'cmp-check' },
          h('input', {
            type: 'checkbox',
            checked: hide,
            onchange: (e: Event) => {
              const checked = (e.target as HTMLInputElement).checked;
              if (checked) editor.data.unplaced = 'hide';
              else delete editor.data.unplaced;
              editor.touch();
              renderStage();
            },
          }),
          'Ne pas les afficher',
        ),
      ),
      grid,
    );
  }

  function blockEl(block: Block, index: number): HTMLElement {
    const known = isKnownBlockType(block.type);
    const type = known ? (block.type as ops.EditableType | 'compare') : undefined;
    const items: BlockItem[] = block.items ?? [];
    const columns = resolveColumns(block.columns);
    const cols = block.type === 'single' ? 1 : columns[device];
    const perView = resolvePerView(block.perView)[device];
    const isCarousel = block.type === 'carousel';
    const info = type && type !== 'compare' ? TYPE_INFO[type] : undefined;
    const selected = selection && selection.kind !== 'file' && selection.block === block.id;

    const list = h('div', {
      class: `cmp-items${isCarousel ? ' is-carousel' : ''}`,
      'data-block': block.id,
      'data-type': block.type,
      style: isCarousel ? `--pv:${perView}` : `--cols:${cols}`,
    });
    items.forEach((item, i) => list.append(itemEl(block, item, i, columns)));
    if (!items.length)
      list.append(
        h(
          'div',
          { class: 'cmp-drop-hint' },
          icon('plus', 18),
          'Glisse des médias ici (depuis la médiathèque ou ton ordinateur)',
        ),
      );

    const meta = isCarousel
      ? `${String(perView).replace('.', ',')} visible${perView > 1 ? 's' : ''} · ${items.length} média${items.length > 1 ? 's' : ''}`
      : block.type === 'single'
        ? `${items.length} média${items.length > 1 ? 's' : ''}`
        : `${cols} col. · ${items.length} média${items.length > 1 ? 's' : ''}`;

    const action = (
      name: string,
      label: string,
      ico: IconName,
      extra: Record<string, unknown> = {},
    ) =>
      h(
        'button',
        {
          type: 'button',
          class: 'cms-mini-btn',
          'data-action': name,
          title: label,
          'aria-label': label,
          ...extra,
        },
        icon(ico, 15),
      );

    const el = h(
      'article',
      {
        class: `cmp-block${selected ? ' is-selected' : ''}${block.hidden ? ' is-hidden' : ''}`,
        'data-block-id': block.id,
      },
      h(
        'header',
        { class: 'cmp-bhead', 'data-action': 'select-block' },
        h('span', { class: 'cmp-grip', title: 'Glisser pour déplacer le bloc' }, icon('grip', 16)),
        h(
          'span',
          { class: 'cmp-type' },
          icon(info?.icon ?? 'info', 14),
          info?.label ?? (block.type === 'compare' ? 'Avant / après' : `Type « ${block.type} »`),
        ),
        h('span', { class: 'cmp-btitle' }, block.title || 'Sans titre'),
        h('span', { class: 'cmp-bmeta' }, meta),
        block.hidden && h('span', { class: 'cmp-flag' }, 'Masqué'),
        !known && h('span', { class: 'cmp-flag is-warn' }, 'Type inconnu : conservé'),
        h('span', { class: 'cms-grow' }),
        action('up', 'Monter', 'arrowLeft', { disabled: index === 0, class: 'cms-mini-btn is-up' }),
        action('down', 'Descendre', 'arrowLeft', {
          disabled: index === blocks().length - 1,
          class: 'cms-mini-btn is-down',
        }),
        action('duplicate', 'Dupliquer le bloc', 'plus'),
        action(
          'toggle',
          block.hidden ? 'Afficher le bloc' : 'Masquer le bloc',
          block.hidden ? 'eyeOff' : 'eye',
        ),
        action('delete', 'Supprimer le bloc (les médias restent)', 'trash', {
          class: 'cms-mini-btn is-danger',
        }),
      ),
      list,
    );

    sortables.push(
      Sortable.create(list, {
        group: {
          name: 'cmp-items',
          pull: true,
          // « Média seul » : un seul média
          put: (to) =>
            (to.el as HTMLElement).dataset.type !== 'single' ||
            !(to.el as HTMLElement).querySelector('.cmp-item'),
        },
        draggable: '.cmp-item',
        animation: 180,
        forceFallback: true,
        ...AUTOSCROLL,
        fallbackOnBody: true,
        fallbackTolerance: 4,
        ghostClass: 'is-ghost',
        onEnd: (evt) => {
          const from = (evt.from as HTMLElement).dataset.block;
          const to = (evt.to as HTMLElement).dataset.block;
          const oldIndex = evt.oldDraggableIndex;
          const newIndex = evt.newDraggableIndex;
          if (!from || !to || oldIndex === undefined || newIndex === undefined)
            return renderStage();
          if (from === to && oldIndex === newIndex) return renderStage();
          commit(
            ops.moveItem(
              blocks(),
              { block: from, index: oldIndex },
              { block: to, index: newIndex },
            ),
            'stage',
          );
        },
      }),
    );
    return el;
  }

  function itemEl(
    block: Block,
    item: BlockItem,
    index: number,
    columns: ReturnType<typeof resolveColumns>,
  ) {
    const grid = block.type !== 'carousel' && block.type !== 'single';
    const span = grid ? resolveSpan(item.span, columns)[device] : 1;
    const cols = grid ? columns[device] : 1;
    const file = editor.item(item.file);
    const selected = selection?.kind === 'item' && selection.item === item.id;
    return h(
      'figure',
      {
        class: `cmp-item${selected ? ' is-selected' : ''}`,
        'data-item': item.id,
        'data-file': item.file,
        style: `--span:${span};--r:${ratioOf(item.file).toFixed(4)};--align:${item.align ?? block.align ?? 'center'}`,
      },
      h(
        'div',
        { class: 'cmp-tile', 'data-action': 'select-item' },
        mediaEl(item.file, block.type === 'single' || span === cols ? 900 : 600),
        h('span', { class: 'cmp-index' }, String(index + 1).padStart(2, '0')),
        file?.kind === 'video' && h('span', { class: 'cmp-kind' }, icon('play', 12)),
        item.video?.autoplay && h('span', { class: 'cmp-flag is-auto' }, 'lecture auto'),
        h(
          'div',
          { class: 'cmp-tile-actions' },
          grid &&
            h(
              'button',
              {
                type: 'button',
                class: 'cms-mini',
                'data-action': 'narrower',
                title: 'Plus étroit',
              },
              '−',
            ),
          grid && h('span', { class: 'cmp-span' }, spanLabel(span, cols)),
          grid &&
            h(
              'button',
              { type: 'button', class: 'cms-mini', 'data-action': 'wider', title: 'Plus large' },
              '+',
            ),
          h(
            'button',
            {
              type: 'button',
              class: 'cms-mini',
              'data-action': 'remove-item',
              title: 'Retirer du bloc (le fichier reste)',
            },
            icon('close', 13),
          ),
        ),
      ),
    );
  }

  /** « 1/2 » pour la grille historique de 12, sinon « 2/3 col. ». */
  function spanLabel(span: number, cols: number) {
    if (cols === 12) return SPAN_INFO.find((s) => s.span === span)?.short ?? `${span}/12`;
    return span === cols ? 'pleine' : `${span}/${cols}`;
  }

  /** Largeurs possibles d'un média : 1…colonnes, ou les fractions historiques pour 12 colonnes. */
  function spanSteps(cols: number): number[] {
    return cols === 12
      ? SPAN_INFO.map((s) => s.span)
      : Array.from({ length: cols }, (_, i) => i + 1);
  }

  /* ------------------------------------------------------------------ actions du canevas */
  page.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const blockEl = target.closest<HTMLElement>('.cmp-block');
    const blockId = blockEl?.dataset.blockId;
    const itemId = target.closest<HTMLElement>('.cmp-item')?.dataset.item;
    if (!blockId) return;
    const current = blocks();
    const index = current.findIndex((b) => b.id === blockId);
    switch (action) {
      case 'up':
        return commit(ops.moveBlock(current, index, index - 1), 'stage');
      case 'down':
        return commit(ops.moveBlock(current, index, index + 1), 'stage');
      case 'duplicate':
        commit(ops.duplicateBlock(current, blockId));
        return toast('Bloc dupliqué.');
      case 'toggle':
        return commit(
          ops.updateBlock(current, blockId, (b) => ({ ...b, hidden: b.hidden ? undefined : true })),
        );
      case 'delete':
        return void deleteBlock(blockId);
      case 'remove-item':
        if (itemId) {
          if (selection?.kind === 'item' && selection.item === itemId)
            selection = { kind: 'block', block: blockId };
          return commit(ops.removeItem(current, blockId, itemId));
        }
        return;
      case 'narrower':
      case 'wider':
        if (itemId) return stepSpan(blockId, itemId, action === 'wider' ? 1 : -1);
        return;
      case 'select-item':
        if (itemId) return select({ kind: 'item', block: blockId, item: itemId });
        return;
      default:
        return select({ kind: 'block', block: blockId });
    }
  });

  function stepSpan(blockId: string, itemId: string, direction: 1 | -1) {
    const block = findBlock(blockId);
    const item = block?.items?.find((i) => i.id === itemId);
    if (!block || !item) return;
    const columns = resolveColumns(block.columns);
    const steps = spanSteps(columns[device]);
    const current = resolveSpan(item.span, columns)[device];
    const at = steps.findIndex((s) => s >= current);
    const next =
      steps[
        Math.max(0, Math.min(steps.length - 1, (at === -1 ? steps.length - 1 : at) + direction))
      ];
    if (next !== undefined && next !== current)
      commit(ops.setSpan(blocks(), blockId, itemId, device, next));
  }

  async function deleteBlock(id: string) {
    const block = findBlock(id);
    if (!block) return;
    const n = block.items?.length ?? 0;
    const ok = await confirmModal({
      title: 'Supprimer ce bloc ?',
      body: h(
        'div',
        null,
        h(
          'p',
          null,
          `Le bloc ${block.title ? `« ${block.title} » ` : ''}et ses ${n} emplacement${n > 1 ? 's' : ''} seront retirés de la galerie.`,
        ),
        h(
          'p',
          { class: 'cms-muted' },
          'Aucun fichier n’est supprimé : les médias restent dans la médiathèque (et s’affichent à la fin s’ils ne sont placés nulle part). La version précédente de la fiche est gardée dans .cms/historique/.',
        ),
      ),
      confirm: 'Supprimer le bloc',
      danger: true,
    });
    if (!ok) return;
    if (selection && selection.kind !== 'file' && selection.block === id) selection = null;
    commit(ops.removeBlock(blocks(), id));
  }

  /* ------------------------------------------------------------------ panneau de réglages */
  const field = (label: string, control: Node, hint?: string) =>
    h(
      'label',
      { class: 'cms-field' },
      h('span', null, label),
      control,
      hint && h('small', { class: 'cms-muted' }, hint),
    );

  function segs<T extends string | number>(
    options: { value: T; label: string; icon?: IconName }[],
    current: T | undefined,
    pick: (v: T) => void,
  ) {
    return h(
      'div',
      { class: 'cms-segs cmp-segs' },
      options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: `cms-seg${o.value === current ? ' is-on' : ''}`,
            'aria-pressed': String(o.value === current),
            onclick: () => pick(o.value),
          },
          o.icon && icon(o.icon, 15),
          o.label,
        ),
      ),
    );
  }

  const deviceLabel = () => DEVICES.find((d) => d.id === device)!.label.toLowerCase();
  const section = (title: string, ...children: unknown[]) =>
    h('div', { class: 'cms-insp-block' }, h('h4', null, title), ...(children as Node[]));

  function renderInspector() {
    if (selection?.kind === 'block' && findBlock(selection.block))
      return inspectBlock(findBlock(selection.block)!);
    if (selection?.kind === 'item') {
      const block = findBlock(selection.block);
      const item = block?.items?.find((i) => i.id === (selection as { item: string }).item);
      if (block && item) return inspectItem(block, item);
    }
    if (selection?.kind === 'file' && editor.item(selection.file))
      return inspectFile(editor.item(selection.file)!);
    selection = null;
    inspector.replaceChildren(
      h(
        'div',
        { class: 'cms-insp-empty' },
        icon('layout', 28),
        h('h3', null, editor.hasBlocks() ? 'Éditeur de blocs' : 'Galerie'),
        editor.hasBlocks()
          ? h(
              'ul',
              null,
              h(
                'li',
                null,
                'Ajoute un bloc (média seul, grille, carrousel) avec les boutons en haut.',
              ),
              h(
                'li',
                null,
                'Glisse les médias depuis la médiathèque, ou dépose des fichiers directement dans un bloc.',
              ),
              h(
                'li',
                null,
                'Poignée ⠿ : déplacer un bloc. Glisser un média : le réordonner ou le changer de bloc.',
              ),
              h(
                'li',
                null,
                'Ordinateur / Tablette / Mobile : colonnes et médias visibles se règlent pour chaque appareil.',
              ),
            )
          : h(
              'p',
              null,
              'Clique « Organiser en blocs » pour composer librement ta galerie. Le rendu reste identique tant que tu ne changes rien.',
            ),
        editor.hasBlocks() &&
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-ghost cms-block',
              onclick: () => void backToAutomatic(),
            },
            'Revenir à la composition automatique…',
          ),
      ),
    );
  }

  function inspectBlock(block: Block) {
    const id = block.id!;
    const update = (patch: Partial<Block>, what: 'stage' | 'all' = 'all') =>
      commit(ops.updateBlock(blocks(), id, patch), what);
    const columns = resolveColumns(block.columns);
    const perView = resolvePerView(block.perView);
    const known = isKnownBlockType(block.type);
    const editable = (['single', 'grid', 'carousel'] as const).includes(
      block.type as ops.EditableType,
    );

    const title = h('input', {
      class: 'cms-input',
      type: 'text',
      value: block.title ?? '',
      placeholder: 'Facultatif — affiché au-dessus du bloc',
      oninput: (e: Event) => {
        const value = (e.target as HTMLInputElement).value;
        editor.setBlocks(
          ops.updateBlock(blocks(), id, { title: value.trim() ? value : undefined }),
        );
        const el = root.querySelector(`.cmp-block[data-block-id="${CSS.escape(id)}"] .cmp-btitle`);
        if (el) el.textContent = value.trim() || 'Sans titre';
      },
    });
    const caption = h('input', {
      class: 'cms-input',
      type: 'text',
      value: block.caption ?? '',
      placeholder: 'Facultatif — sous le bloc',
      oninput: (e: Event) => {
        const value = (e.target as HTMLInputElement).value;
        editor.setBlocks(
          ops.updateBlock(blocks(), id, { caption: value.trim() ? value : undefined }),
        );
      },
    });

    const colOptions = [1, 2, 3, 4, 5, 6, ...(columns[device] === 12 ? [12] : [])].map((n) => ({
      value: n,
      label: String(n),
    }));
    const controls = block.controls ?? ['arrows', 'dots'];
    const toggleControl = (c: 'arrows' | 'dots') =>
      update({
        controls: controls.includes(c) ? controls.filter((x) => x !== c) : [...controls, c],
      });

    inspector.replaceChildren(
      h(
        'div',
        { class: 'cms-insp' },
        h(
          'div',
          { class: 'cmp-insp-title' },
          h('h3', null, 'Bloc'),
          h('span', { class: 'cms-mono cms-muted' }, id),
        ),
        !known &&
          h(
            'p',
            { class: 'cmp-warn' },
            `Type « ${block.type} » inconnu de cet éditeur : il est conservé tel quel et affiché comme une grille. Tu peux le convertir ci-dessous.`,
          ),
        block.type === 'compare' &&
          h(
            'p',
            { class: 'cmp-warn' },
            'Avant / après : affiché en grille pour l’instant (curseur interactif à venir).',
          ),
        section(
          'Type',
          segs(
            (Object.keys(TYPE_INFO) as ops.EditableType[]).map((t) => ({
              value: t,
              label: TYPE_INFO[t].label,
              icon: TYPE_INFO[t].icon,
            })),
            editable ? (block.type as ops.EditableType) : undefined,
            (t) => {
              if (t === 'single' && (block.items?.length ?? 0) > 1)
                return toast(
                  'Un « média seul » ne contient qu’un média : retire d’abord les autres, ou garde une grille.',
                  'info',
                  5000,
                );
              commit(ops.convertBlock(blocks(), id, t));
            },
          ),
        ),
        h('div', { class: 'cms-insp-block' }, field('Titre', title), field('Légende', caption)),
        section(
          'Largeur dans la page',
          segs(
            [
              { value: 'content', label: 'Texte' },
              { value: 'wide', label: 'Page' },
              { value: 'full', label: 'Plein écran' },
            ],
            block.width ?? 'wide',
            (w) => update({ width: w === 'wide' ? undefined : w }),
          ),
        ),
        (block.type === 'grid' || !known || block.type === 'compare') &&
          section(
            `Colonnes · ${deviceLabel()}`,
            segs(colOptions, columns[device], (n) =>
              commit(ops.setColumns(blocks(), id, device, n)),
            ),
            h(
              'p',
              { class: 'cms-muted' },
              `Ordinateur ${columns.desktop} · tablette ${columns.tablet} · mobile ${columns.mobile}. Change d’appareil en haut pour régler les autres.`,
            ),
          ),
        (block.type === 'grid' || !known) &&
          section(
            'Espacement et alignement',
            segs(
              [
                { value: 'none', label: 'Aucun' },
                { value: 'sm', label: 'Petit' },
                { value: 'md', label: 'Moyen' },
                { value: 'lg', label: 'Grand' },
              ],
              block.gap ?? 'md',
              (g) => update({ gap: g === 'md' ? undefined : g }),
            ),
            segs(
              [
                { value: 'start', label: 'Haut', icon: 'alignTop' },
                { value: 'center', label: 'Centre', icon: 'alignMiddle' },
                { value: 'end', label: 'Bas', icon: 'alignBottom' },
              ],
              block.align ?? 'center',
              (a) => update({ align: a === 'center' ? undefined : a }),
            ),
          ),
        block.type === 'carousel' &&
          section(
            `Médias visibles · ${deviceLabel()}`,
            segs(
              PER_VIEW.map((n) => ({ value: n, label: String(n).replace('.', ',') })),
              perView[device],
              (n) => commit(ops.setPerView(blocks(), id, device, n)),
            ),
            h('p', { class: 'cms-muted' }, '1,2 ou 1,5 : on devine le média suivant.'),
          ),
        block.type === 'carousel' &&
          section(
            'Défilement',
            segs(AUTOPLAY, block.autoplay ?? 0, (s) => update({ autoplay: s || undefined })),
            h(
              'div',
              { class: 'cmp-checks' },
              h(
                'label',
                { class: 'cmp-check' },
                h('input', {
                  type: 'checkbox',
                  checked: block.loop === true,
                  onchange: () => update({ loop: block.loop ? undefined : true }),
                }),
                'En boucle',
              ),
              h(
                'label',
                { class: 'cmp-check' },
                h('input', {
                  type: 'checkbox',
                  checked: controls.includes('arrows'),
                  onchange: () => toggleControl('arrows'),
                }),
                'Flèches',
              ),
              h(
                'label',
                { class: 'cmp-check' },
                h('input', {
                  type: 'checkbox',
                  checked: controls.includes('dots'),
                  onchange: () => toggleControl('dots'),
                }),
                'Points',
              ),
            ),
            h(
              'p',
              { class: 'cms-muted' },
              'Le défilement automatique se met en pause au survol et ne s’active jamais si le visiteur a demandé moins d’animations.',
            ),
          ),
        h(
          'div',
          { class: 'cms-insp-block cms-row' },
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-ghost',
              onclick: () => commit(ops.duplicateBlock(blocks(), id)),
            },
            'Dupliquer',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-ghost',
              onclick: () => update({ hidden: block.hidden ? undefined : true }),
            },
            icon(block.hidden ? 'eye' : 'eyeOff', 16),
            block.hidden ? 'Afficher' : 'Masquer',
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'cms-btn is-danger cms-block',
            onclick: () => void deleteBlock(id),
          },
          icon('trash', 16),
          'Supprimer le bloc',
        ),
      ),
    );
  }

  function inspectItem(block: Block, item: BlockItem) {
    const blockId = block.id!;
    const itemId = item.id!;
    const file = editor.item(item.file);
    const grid = block.type !== 'carousel' && block.type !== 'single';
    const columns = resolveColumns(block.columns);
    const span = resolveSpan(item.span, columns)[device];
    const index = (block.items ?? []).findIndex((i) => i.id === itemId);
    const patch = (p: Partial<BlockItem>) => commit(ops.updateItem(blocks(), blockId, itemId, p));
    const isVideo = file?.kind === 'video';
    const video = item.video ?? {};

    const caption = h('input', {
      class: 'cms-input',
      type: 'text',
      value: item.caption ?? '',
      placeholder: file?.caption
        ? `Par défaut : « ${file.caption} »`
        : 'Facultatif — sous ce média, à cet endroit',
      oninput: (e: Event) => {
        const value = (e.target as HTMLInputElement).value;
        editor.setBlocks(
          ops.updateItem(blocks(), blockId, itemId, { caption: value.trim() ? value : undefined }),
        );
      },
    });

    inspector.replaceChildren(
      h(
        'div',
        { class: 'cms-insp' },
        h(
          'div',
          { class: 'cms-insp-head' },
          h(
            'div',
            { class: 'cmp-insp-thumb', style: `--r:${ratioOf(item.file).toFixed(4)}` },
            mediaEl(item.file, 600),
          ),
          h(
            'div',
            { class: 'cms-insp-meta' },
            h('strong', { title: item.file }, item.file),
            h(
              'span',
              null,
              `${TYPE_INFO[block.type as ops.EditableType]?.label ?? 'Bloc'} · position ${index + 1}`,
            ),
          ),
        ),
        grid &&
          section(
            `Largeur · ${deviceLabel()}`,
            segs(
              spanSteps(columns[device]).map((n) => ({
                value: n,
                label: spanLabel(n, columns[device]),
              })),
              span,
              (n) => commit(ops.setSpan(blocks(), blockId, itemId, device, n)),
            ),
          ),
        grid &&
          section(
            'Alignement vertical',
            segs(
              [
                { value: 'start', label: 'Haut', icon: 'alignTop' },
                { value: 'center', label: 'Centre', icon: 'alignMiddle' },
                { value: 'end', label: 'Bas', icon: 'alignBottom' },
              ],
              item.align ?? block.align ?? 'center',
              (a) => patch({ align: a }),
            ),
          ),
        h('div', { class: 'cms-insp-block' }, field('Légende à cet endroit', caption)),
        isVideo &&
          section(
            'Vidéo',
            h(
              'label',
              { class: 'cmp-check' },
              h('input', {
                type: 'checkbox',
                checked: video.autoplay === true,
                onchange: () =>
                  patch({ video: { ...video, autoplay: video.autoplay ? undefined : true } }),
              }),
              'Lecture automatique (muette, en boucle, quand elle est visible)',
            ),
            h(
              'p',
              { class: 'cms-muted' },
              'Sinon : affiche + bouton lecture, la vidéo s’ouvre en grand au clic.',
            ),
          ),
        h(
          'div',
          { class: 'cms-insp-block cms-row' },
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-ghost',
              disabled: index <= 0,
              onclick: () =>
                commit(
                  ops.moveItem(
                    blocks(),
                    { block: blockId, index },
                    { block: blockId, index: index - 1 },
                  ),
                ),
            },
            '◀ Avant',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-ghost',
              disabled: index >= (block.items?.length ?? 0) - 1,
              onclick: () =>
                commit(
                  ops.moveItem(
                    blocks(),
                    { block: blockId, index },
                    { block: blockId, index: index + 1 },
                  ),
                ),
            },
            'Après ▶',
          ),
        ),
        h(
          'div',
          { class: 'cms-insp-block cms-row' },
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-ghost',
              onclick: () => select({ kind: 'file', file: item.file }),
            },
            icon('image', 16),
            'Réglages du fichier',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-danger-ghost',
              onclick: () => {
                selection = { kind: 'block', block: blockId };
                commit(ops.removeItem(blocks(), blockId, itemId));
              },
            },
            icon('close', 16),
            'Retirer du bloc',
          ),
        ),
        h(
          'p',
          { class: 'cms-muted' },
          'Retirer ne supprime pas le fichier : il reste dans la médiathèque.',
        ),
      ),
    );
  }

  function inspectFile(item: GalleryItem) {
    const uses = ops.usage(blocks()).get(item.file) ?? 0;
    const target = lastBlock ? findBlock(lastBlock) : undefined;
    const isCover = editor.coverFile() === item.file;
    const web = webOf(item.file);
    const ready = web?.status === 'ok';
    const preview =
      item.kind === 'video'
        ? h('video', {
            class: 'cms-insp-video',
            // la version web (H.264) se lit partout ; l'original (MOV HEVC…) pas toujours
            src: ready
              ? webUrl(slug, item.file, 'video.mp4', webV(item.file))
              : fileUrl(slug, item.file, item.v),
            poster: ready ? webUrl(slug, item.file, 'poster.jpg', webV(item.file)) : undefined,
            controls: true,
            preload: 'metadata',
            playsinline: true,
            muted: true,
          })
        : h('img', {
            class: 'cms-insp-img',
            src: thumbUrl(slug, item.file, 700, item.v + webV(item.file)),
            alt: '',
          });

    const alt = h('input', {
      class: 'cms-input',
      type: 'text',
      value: item.alt,
      placeholder: 'Décris le média (accessibilité)',
      oninput: (e: Event) => {
        item.alt = (e.target as HTMLInputElement).value;
        editor.touch();
      },
    });
    const caption = h('input', {
      class: 'cms-input',
      type: 'text',
      value: item.caption,
      placeholder: 'Légende affichée sous le média',
      oninput: (e: Event) => {
        item.caption = (e.target as HTMLInputElement).value;
        editor.touch();
      },
    });

    const setPosterFrom = async (blob: Blob | File, name: string) => {
      const poster = await upload(slug, blob, { name, poster: item.file });
      editor.setPoster(item.file, poster);
      renderAll();
    };

    inspector.replaceChildren(
      h(
        'div',
        { class: 'cms-insp' },
        h(
          'div',
          { class: 'cms-insp-head' },
          preview,
          h(
            'div',
            { class: 'cms-insp-meta' },
            h('strong', { title: item.file }, item.file),
            h(
              'span',
              null,
              describeRatio(item.width, item.height) ||
                `Vidéo · ratio ${ratioOf(item.file).toFixed(2)}:1`,
            ),
            h(
              'span',
              null,
              formatBytes(item.size),
              ' · ',
              item.kind === 'image' ? 'Image' : 'Vidéo',
            ),
            editor.hasBlocks() &&
              h(
                'span',
                null,
                uses
                  ? `Placé dans ${uses} bloc${uses > 1 ? 's' : ''}`
                  : 'Non placé : affiché à la fin',
              ),
          ),
        ),
        editor.hasBlocks() &&
          target &&
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-primary cms-block',
              onclick: () => {
                commit(ops.addItems(blocks(), target.id!, [item.file]));
                toast(`Ajouté au bloc ${target.title ? `« ${target.title} »` : ''}.`);
              },
            },
            icon('plus', 16),
            `Ajouter au bloc ${target.title ? `« ${target.title} »` : `(${TYPE_INFO[target.type as ops.EditableType]?.label ?? target.type})`}`,
          ),
        mediaDetails(item, web),
        h(
          'div',
          { class: 'cms-insp-block' },
          field('Texte alternatif', alt),
          field(
            'Légende',
            caption,
            'Utilisée partout où ce média apparaît (sauf légende propre à un emplacement).',
          ),
        ),
        item.kind === 'video' &&
          section(
            'Affiche de la vidéo',
            item.poster
              ? h('img', {
                  src: thumbUrl(slug, item.poster, 400, item.v),
                  alt: 'Affiche',
                  class: 'cms-poster-img',
                })
              : h(
                  'p',
                  { class: 'cms-muted' },
                  'Aucune affiche : la vidéo affichera sa première image.',
                ),
            h(
              'div',
              { class: 'cms-row' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'cms-btn is-ghost',
                  onclick: async () => {
                    const blob = await captureFrame(preview as HTMLVideoElement);
                    if (!blob)
                      return toast('Lance la lecture ou avance la vidéo, puis réessaie.', 'info');
                    try {
                      await setPosterFrom(blob, 'affiche.jpg');
                      toast('Affiche mise à jour.');
                    } catch (error) {
                      toast(error instanceof Error ? error.message : 'Échec.', 'error');
                    }
                  },
                },
                icon('camera', 16),
                'Utiliser l’image affichée',
              ),
              h(
                'label',
                { class: 'cms-btn is-ghost' },
                icon('image', 16),
                'Importer…',
                h('input', {
                  type: 'file',
                  accept: acceptAttribute('image'),
                  hidden: true,
                  onchange: async (e: Event) => {
                    const input = e.target as HTMLInputElement;
                    const f = input.files?.[0];
                    input.value = '';
                    if (!f) return;
                    try {
                      await setPosterFrom(f, f.name);
                      toast('Affiche importée.');
                    } catch (error) {
                      toast(error instanceof Error ? error.message : 'Échec.', 'error');
                    }
                  },
                }),
              ),
            ),
          ),
        h(
          'div',
          { class: 'cms-insp-block cms-row' },
          item.kind === 'image' &&
            h(
              'button',
              {
                type: 'button',
                class: `cms-btn ${isCover ? 'is-primary' : 'is-ghost'}`,
                onclick: () => {
                  editor.setCover(
                    isCover && editor.data.cover === item.file ? undefined : item.file,
                  );
                  renderAll();
                },
              },
              icon('star', 16),
              isCover ? 'Couverture ✓' : 'Définir comme couverture',
            ),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'cms-btn is-danger cms-block',
            onclick: () => void deleteFile(item),
          },
          icon('trash', 16),
          'Supprimer le fichier…',
        ),
      ),
    );
  }

  /** Original (format, dimensions, ratio, poids…) et versions web (statut, poids), avec « Régénérer ». */
  function mediaDetails(item: GalleryItem, web: WebInfo | undefined) {
    const info = fileInfo(item.file);
    const src = web?.source ?? {};
    const width = src.width ?? item.width;
    const height = src.height ?? item.height;
    const row = (label: string, value: unknown) =>
      value === undefined || value === '' || value === null
        ? null
        : h('div', { class: 'cmp-dl-row' }, h('dt', null, label), h('dd', null, String(value)));
    const LABELS: Record<string, string> = {
      image: 'Image maîtresse',
      video: 'Vidéo (MP4 H.264)',
      mobile: 'Vidéo mobile',
      poster: 'Affiche',
      thumb: 'Miniature',
    };
    const ext = (item.file.split('.').pop() ?? '').toUpperCase();
    return h(
      'div',
      { class: 'cms-insp-block' },
      h('h4', null, 'Original'),
      h(
        'dl',
        { class: 'cmp-dl' },
        row(
          'Type',
          `${item.kind === 'video' ? 'Vidéo' : web?.vector ? 'Image vectorielle' : 'Image'} ${ext}${web?.animated ? ' animée' : ''}`,
        ),
        row('Dimensions', width && height ? `${width} × ${height} px` : undefined),
        row(
          'Ratio',
          // « 2160 × 3840 · 9:16 » → « 9:16 » (les dimensions ont leur propre ligne)
          width && height ? describeRatio(width, height).split(' · ').pop() : undefined,
        ),
        row('Poids', formatBytes(info?.size ?? item.size)),
        row(
          'Durée',
          web?.duration
            ? `${web.duration.toFixed(1)} s${web.audio ? ' · avec son' : ' · sans son'}`
            : undefined,
        ),
        row(
          'Codec',
          src.codec
            ? `${src.codec.toUpperCase()}${src.fps ? ` · ${src.fps} i/s` : ''}${src.hdr ? ' · HDR' : ''}`
            : undefined,
        ),
      ),
      h(
        'h4',
        null,
        'Versions web ',
        h(
          'span',
          { class: `cmp-web-status is-${web?.status ?? 'pending'}` },
          STATUS_LABEL[web?.status ?? 'pending'],
        ),
      ),
      web?.status === 'running' &&
        h(
          'div',
          { class: 'cmp-progress is-inline' },
          h('i', { style: `width:${Math.round((web.progress ?? 0) * 100)}%` }),
        ),
      web?.status === 'error' && h('p', { class: 'cmp-warn' }, web.error ?? 'Erreur inconnue.'),
      web?.status === 'ok' &&
        h(
          'dl',
          { class: 'cmp-dl' },
          ...Object.entries(web.sizes ?? {}).map(([key, size]) =>
            row(
              LABELS[key] ?? key,
              `${formatBytes(size)}${key === 'image' || key === 'video' ? ` · ${web.width} × ${web.height}` : ''}${web.storage?.[key] === 'remote' ? ' · stockage distant (hors Git)' : ''}`,
            ),
          ),
          row('Traitement', web.transcode),
          Object.values(web.storage ?? {}).includes('remote') &&
            row(
              'Stockage',
              'Plus de 25 Mio : copie locale dans distant/, à envoyer vers le stockage externe (R2…).',
            ),
        ),
      h(
        'p',
        { class: 'cms-muted' },
        'L’original n’est jamais modifié. Le site utilise ces versions web (AVIF / WebP et tailles adaptées à chaque écran sont produites à la publication).',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'cms-btn is-ghost',
          disabled: web?.status === 'queued' || web?.status === 'running',
          onclick: () => void startOptimize([item.file], web?.status === 'ok'),
        },
        icon('refresh', 16),
        web?.status === 'ok' ? 'Régénérer' : 'Générer maintenant',
      ),
    );
  }

  async function deleteFile(item: GalleryItem) {
    const uses = ops.usage(blocks()).get(item.file) ?? 0;
    const ok = await confirmModal({
      title: 'Supprimer ce fichier ?',
      body: h(
        'div',
        null,
        h(
          'p',
          null,
          h('strong', null, item.file),
          ' sera retiré du projet',
          uses
            ? ` (et de ses ${uses} emplacement${uses > 1 ? 's' : ''} dans les blocs ; les blocs restent).`
            : '.',
        ),
        h(
          'p',
          { class: 'cms-muted' },
          'Le fichier est déplacé dans le dossier .trash/ du projet : il reste récupérable.',
        ),
      ),
      confirm: 'Supprimer le fichier',
      danger: true,
    });
    if (!ok) return;
    try {
      const { removed } = await api.deleteMedia(slug, item.file);
      editor.removeFiles(removed);
      selection = null;
      renderAll();
      toast('Fichier déplacé dans .trash/.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Suppression impossible.', 'error');
    }
  }

  async function backToAutomatic() {
    const ok = await confirmModal({
      title: 'Revenir à la composition automatique ?',
      body: h(
        'div',
        null,
        h(
          'p',
          null,
          'Les blocs seront retirés de la fiche : la galerie reprendra l’ordre et les tailles de la composition simple.',
        ),
        h(
          'p',
          { class: 'cms-muted' },
          'Aucun fichier n’est supprimé. La version actuelle (avec ses blocs) est gardée dans .cms/historique/ : elle reste récupérable.',
        ),
      ),
      confirm: 'Revenir à la composition automatique',
      danger: true,
    });
    if (!ok) return;
    selection = null;
    editor.setBlocks(null);
    renderToolbar();
    renderAll();
  }

  /* ------------------------------------------------------------------ envoi de fichiers */
  async function uploadFiles(list: FileList | File[], target?: { block: string; index?: number }) {
    const files = [...list].filter((file) => {
      if (!isAccepted(file.name))
        toast(
          `« ${file.name} » : format non pris en charge (${FORMATS.replace(' · ', ', ')}).`,
          'error',
          5200,
        );
      return isAccepted(file.name);
    });
    if (!files.length) return;
    const queue = files.map((file, i) => ({ file, key: `${Date.now()}-${i}` }));
    for (const { file, key } of queue) pending.set(key, { name: file.name, ratio: 1.5 });
    renderLibrary();
    const added: string[] = [];
    await Promise.all(
      Array.from({ length: Math.min(2, queue.length) }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          const { file, key } = job;
          const isVideo = kindOf(file.name.toLowerCase()) === 'video';
          try {
            const probe = isVideo ? await probeVideo(file) : null;
            const info = await upload(slug, file, {
              name: file.name,
              onProgress: (r) => {
                const bar = library.querySelector<HTMLElement>(
                  `[data-pending="${key}"] .cmp-progress i`,
                );
                if (bar) bar.style.width = `${Math.round(r * 100)}%`;
              },
            });
            editor.addFile(info, {
              ratio: probe?.width ? `${probe.width}:${probe.height}` : undefined,
            });
            added.push(info.name);
            if (isVideo && probe?.poster) {
              try {
                const poster = await upload(slug, probe.poster, {
                  name: 'affiche.jpg',
                  poster: info.name,
                });
                editor.setPoster(info.name, poster);
              } catch {
                /* pas d'affiche : la vidéo reste utilisable */
              }
            }
          } catch (error) {
            toast(
              `« ${file.name} » : ${error instanceof Error ? error.message : 'échec de l’envoi.'}`,
              'error',
              6000,
            );
          } finally {
            pending.delete(key);
            renderLibrary();
          }
        }
      }),
    );
    if (target && added.length && findBlock(target.block)) {
      const block = findBlock(target.block)!;
      const room =
        block.type === 'single' && (block.items?.length ?? 0) > 0
          ? []
          : block.type === 'single'
            ? added.slice(0, 1)
            : added;
      if (room.length) commit(ops.addItems(blocks(), target.block, room, target.index));
      else renderAll();
    } else renderAll();
    if (added.length) {
      toast(
        `${added.length} média${added.length > 1 ? 's' : ''} ajouté${added.length > 1 ? 's' : ''} — versions web en préparation.`,
      );
      void refreshFiles();
    }
  }

  fileInput.addEventListener('change', () => {
    void uploadFiles(fileInput.files ?? []);
    fileInput.value = '';
  });

  // dépôt de fichiers : sur un bloc → dans ce bloc ; ailleurs → médiathèque
  let dragDepth = 0;
  const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  const onEnter = (e: DragEvent) => hasFiles(e) && (dragDepth++, root.classList.add('is-dropping'));
  const onLeave = (e: DragEvent) =>
    hasFiles(e) &&
    (dragDepth = Math.max(0, dragDepth - 1)) === 0 &&
    root.classList.remove('is-dropping');
  const onOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    root
      .querySelectorAll('.cmp-block.is-drop-target')
      .forEach((el) => el.classList.remove('is-drop-target'));
    (e.target as HTMLElement).closest('.cmp-block')?.classList.add('is-drop-target');
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    root.classList.remove('is-dropping');
    const block = (e.target as HTMLElement).closest<HTMLElement>('.cmp-block')?.dataset.blockId;
    root
      .querySelectorAll('.cmp-block.is-drop-target')
      .forEach((el) => el.classList.remove('is-drop-target'));
    void uploadFiles(e.dataTransfer?.files ?? [], block ? { block } : undefined);
  };
  root.addEventListener('dragenter', onEnter);
  root.addEventListener('dragleave', onLeave);
  root.addEventListener('dragover', onOver);
  root.addEventListener('drop', onDrop);
  const preventStray = (e: DragEvent) => hasFiles(e) && e.preventDefault();
  window.addEventListener('dragover', preventStray);
  window.addEventListener('drop', preventStray);

  /* ------------------------------------------------------------------ éditeur simple (ancien) */
  function openSimple() {
    root.hidden = true;
    const bar = h(
      'div',
      { class: 'cmp-simple-bar' },
      h(
        'button',
        { type: 'button', class: 'cms-btn is-ghost', onclick: () => closeSimple() },
        icon('arrowLeft', 16),
        'Revenir à l’éditeur visuel',
      ),
      h(
        'span',
        { class: 'cms-muted' },
        'Éditeur simple : ordre et tailles de la composition automatique.',
      ),
    );
    const holder = h('div', null);
    host.append(bar, holder);
    const dispose = mountGallery(holder, editor);
    legacyView = () => {
      dispose();
      bar.remove();
      holder.remove();
    };
  }
  function closeSimple() {
    legacyView?.();
    legacyView = undefined;
    root.hidden = false;
    renderAll();
  }

  /* ------------------------------------------------------------------ démarrage */
  function renderAll() {
    renderToolbar();
    renderStage();
    renderInspector();
  }

  const resize = new ResizeObserver(() => fitStage());
  resize.observe(stage);
  renderAll();
  if (notReady().length) void refreshFiles();

  return () => {
    clearTimeout(polling);
    resize.disconnect();
    librarySortable?.destroy();
    legacyView?.();
    sortables.forEach((s) => s.destroy());
    root.removeEventListener('dragenter', onEnter);
    root.removeEventListener('dragleave', onLeave);
    root.removeEventListener('dragover', onOver);
    root.removeEventListener('drop', onDrop);
    window.removeEventListener('dragover', preventStray);
    window.removeEventListener('drop', preventStray);
    root.remove();
  };
}
