/**
 * Onglet « Galerie » : composition libre par glisser-déposer.
 *
 * - le canevas utilise EXACTEMENT la même grille que le site public (src/styles/gallery-grid.css) :
 *   ce que tu vois ici est ce qui sera publié ;
 * - chaque média garde son ratio d'origine ;
 * - tout est enregistré automatiquement dans project.md.
 */
import Sortable from 'sortablejs';
import { ALIGNS, SPAN_INFO, defaultSpan, type Align, type Span } from '@/lib/gallery-layout';
import { api, fileUrl, thumbUrl, upload } from '../api';
import { itemRatio, type Editor } from '../editor-state';
import type { GalleryItem } from '../types';
import { confirmModal, describeRatio, formatBytes, h, icon, toast, type IconName } from '../ui';

const ACCEPT = /\.(jpe?g|png|webp|avif|mp4|webm)$/i;
const THUMB_WIDTH = 900;

const PRESETS: { id: string; label: string }[] = [
  { id: '', label: 'Composition rapide…' },
  { id: 'auto', label: 'Automatique (selon le ratio)' },
  { id: 'full', label: 'Tout en pleine largeur' },
  { id: 'two', label: '2 par ligne' },
  { id: 'three', label: '3 par ligne' },
  { id: 'four', label: '4 par ligne' },
];

/* ------------------------------------------------------------------ vidéos : lecture des dimensions + image d'affiche */
async function captureFrame(video: HTMLVideoElement, maxWidth = 1920): Promise<Blob | null> {
  if (!video.videoWidth) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86));
}

async function probeVideo(
  file: File,
): Promise<{ width: number; height: number; poster: Blob | null }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.src = url;
  const wait = (event: string, ms = 8000) =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      video.addEventListener(event, () => (clearTimeout(timer), resolve(true)), { once: true });
    });
  try {
    if (!(await wait('loadeddata'))) return { width: 0, height: 0, poster: null };
    const result = {
      width: video.videoWidth,
      height: video.videoHeight,
      poster: null as Blob | null,
    };
    video.currentTime = Math.min(1, (video.duration || 1) * 0.1);
    if (await wait('seeked', 5000)) result.poster = await captureFrame(video);
    return result;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

/* ------------------------------------------------------------------ vue */
export function mountGallery(host: HTMLElement, editor: Editor): () => void {
  const slug = editor.slug;
  let selected: string | undefined;
  const tiles = new Map<string, HTMLElement>();

  const fileInput = h('input', {
    type: 'file',
    multiple: true,
    accept: 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm',
    hidden: true,
  });
  const canvas = h('div', { class: 'gg cms-canvas' });
  const empty = h(
    'div',
    { class: 'cms-empty' },
    icon('upload', 34),
    h('strong', null, 'Dépose tes images et tes vidéos ici'),
    h(
      'span',
      null,
      'JPG, PNG, WebP, AVIF · MP4, WebM — tous les ratios sont acceptés, rien n’est jamais recadré.',
    ),
    h(
      'button',
      { type: 'button', class: 'cms-btn is-primary', onclick: () => fileInput.click() },
      icon('plus', 16),
      'Choisir des fichiers',
    ),
  );
  const dropOverlay = h(
    'div',
    { class: 'cms-drop-overlay' },
    icon('upload', 30),
    h('strong', null, 'Relâche pour ajouter à la galerie'),
  );
  const count = h('span', { class: 'cms-count' });
  const inspector = h('aside', { class: 'cms-inspector' });
  const presetSelect = h(
    'select',
    { class: 'cms-select', 'aria-label': 'Composition rapide' },
    PRESETS.map((p) => h('option', { value: p.id }, p.label)),
  );

  const root = h(
    'section',
    { class: 'cms-gallery' },
    h(
      'div',
      { class: 'cms-gal-main' },
      h(
        'div',
        { class: 'cms-gal-toolbar' },
        h(
          'button',
          { type: 'button', class: 'cms-btn is-primary', onclick: () => fileInput.click() },
          icon('upload', 16),
          'Ajouter des médias',
        ),
        presetSelect,
        count,
      ),
      h('div', { class: 'cms-drop' }, canvas, empty, dropOverlay),
      h(
        'p',
        { class: 'cms-hint' },
        'Glisse les médias par la poignée ⠿ pour les réordonner · clique un média pour ses options · ★ = couverture · − / + = taille dans la grille.',
      ),
    ),
    inspector,
    fileInput,
  );
  host.append(root);

  /* ------------------------------------------------------------------ tuiles */
  const isCover = (item: GalleryItem) => editor.coverFile() === item.file;

  function createTile(item: GalleryItem): HTMLElement {
    const media: HTMLElement =
      item.kind === 'image'
        ? h('img', {
            src: thumbUrl(slug, item.file, THUMB_WIDTH, item.v),
            alt: '',
            draggable: false,
            loading: 'lazy',
          })
        : item.poster
          ? h('img', {
              src: thumbUrl(slug, item.poster, THUMB_WIDTH, item.v),
              alt: '',
              draggable: false,
            })
          : h('video', {
              src: fileUrl(slug, item.file, item.v),
              muted: true,
              preload: 'metadata',
              playsinline: true,
            });

    if (media instanceof HTMLVideoElement && !item.ratio) {
      // ratio inconnu : on le lit une fois pour toutes puis on l'enregistre
      media.addEventListener(
        'loadedmetadata',
        () => {
          if (!media.videoWidth) return;
          item.ratio = `${media.videoWidth}:${media.videoHeight}`;
          refreshTile(item);
          editor.touch();
        },
        { once: true },
      );
    }

    const fig = h(
      'figure',
      { class: 'gg-item cms-item', 'data-file': item.file },
      h(
        'div',
        { class: 'gg-tile cms-tile', 'data-action': 'select' },
        media,
        item.kind === 'video' && h('span', { class: 'cms-play' }, icon('play', 22)),
        h(
          'span',
          { class: 'cms-grip', title: 'Déplacer', 'aria-label': 'Déplacer' },
          icon('grip', 16),
        ),
        h('span', { class: 'cms-index' }),
        h(
          'div',
          { class: 'cms-badges' },
          h('span', { class: 'cms-badge is-cover' }, icon('star', 12), 'Couverture'),
          h('span', { class: 'cms-badge is-hidden' }, icon('eyeOff', 12), 'Masquée'),
        ),
        h(
          'div',
          { class: 'cms-tile-top' },
          item.kind === 'image' &&
            h(
              'button',
              {
                type: 'button',
                class: 'cms-mini',
                'data-action': 'star',
                title: 'Définir comme couverture',
              },
              icon('star', 15),
            ),
          h(
            'button',
            {
              type: 'button',
              class: 'cms-mini',
              'data-action': 'hide',
              title: 'Masquer / afficher dans la galerie',
            },
            icon('eye', 15),
          ),
        ),
        h(
          'div',
          { class: 'cms-tile-size' },
          h(
            'button',
            { type: 'button', class: 'cms-mini', 'data-action': 'smaller', title: 'Plus étroit' },
            '−',
          ),
          h('span', { class: 'cms-size-label' }),
          h(
            'button',
            { type: 'button', class: 'cms-mini', 'data-action': 'larger', title: 'Plus large' },
            '+',
          ),
        ),
      ),
    );
    tiles.set(item.file, fig);
    refreshTile(item, fig);
    return fig;
  }

  function refreshTile(item: GalleryItem, el = tiles.get(item.file)) {
    if (!el) return;
    el.style.setProperty('--span', String(item.span));
    el.style.setProperty('--align', item.align);
    el.style.setProperty('--r', itemRatio(item, editor.files).toFixed(4));
    el.classList.toggle('is-hidden', item.hidden);
    el.classList.toggle('is-cover', isCover(item));
    el.classList.toggle('is-selected', item.file === selected);
    const info = SPAN_INFO.find((s) => s.span === item.span);
    const label = el.querySelector('.cms-size-label');
    if (label) label.textContent = info?.short ?? String(item.span);
    const hide = el.querySelector('[data-action="hide"]');
    hide?.replaceChildren(icon(item.hidden ? 'eyeOff' : 'eye', 15));
    el.querySelector('[data-action="star"]')?.classList.toggle('is-on', isCover(item));
  }

  const refreshAll = () => editor.items.forEach((item) => refreshTile(item));

  function renumber() {
    let n = 0;
    for (const el of canvas.querySelectorAll<HTMLElement>('.cms-item')) {
      const index = el.querySelector('.cms-index');
      if (index) index.textContent = String(++n).padStart(2, '0');
    }
    const hidden = editor.items.filter((i) => i.hidden).length;
    const total = editor.items.length;
    count.textContent = total
      ? `${total} média${total > 1 ? 's' : ''}${hidden ? ` · ${hidden} masqué${hidden > 1 ? 's' : ''}` : ''}`
      : '';
    empty.hidden = total > 0 || canvas.querySelector('.cms-pending') !== null;
    canvas.hidden = !empty.hidden;
  }

  for (const item of editor.items) canvas.append(createTile(item));
  renumber();

  /* ------------------------------------------------------------------ glisser-déposer */
  const sortable = Sortable.create(canvas, {
    animation: 190,
    handle: '.cms-grip',
    draggable: '.cms-item',
    filter: '.cms-pending',
    forceFallback: true, // souris / doigt plutôt que le glisser natif : rendu identique partout
    fallbackOnBody: true,
    fallbackTolerance: 3,
    // grille aux tuiles de tailles très différentes : l'insertion se décide sur la moitié de la cible survolée
    swapThreshold: 0.5,
    invertSwap: true,
    invertedSwapThreshold: 0.5,
    ghostClass: 'is-ghost',
    chosenClass: 'is-chosen',
    dragClass: 'is-dragging',
    onEnd: () => {
      const names = [...canvas.querySelectorAll<HTMLElement>('.cms-item')].map(
        (el) => el.dataset.file!,
      );
      editor.reorder(names);
      renumber();
    },
  });

  /* ------------------------------------------------------------------ actions sur les tuiles */
  function select(file: string | undefined) {
    const previous = selected;
    selected = file;
    if (previous) tiles.get(previous)?.classList.remove('is-selected');
    if (file) tiles.get(file)?.classList.add('is-selected');
    renderInspector();
  }

  function stepSpan(item: GalleryItem, direction: 1 | -1) {
    const order = SPAN_INFO.map((s) => s.span);
    const i = order.indexOf(item.span);
    const next = order[Math.min(order.length - 1, Math.max(0, i + direction))];
    if (next !== undefined && next !== item.span) changeSpan(item, next);
  }

  function changeSpan(item: GalleryItem, span: Span) {
    editor.setSpan(item, span);
    refreshTile(item);
    if (selected === item.file) renderInspector();
  }

  function toggleHidden(item: GalleryItem) {
    item.hidden = !item.hidden;
    editor.touch();
    refreshTile(item);
    renumber();
    if (selected === item.file) renderInspector();
  }

  function toggleCover(item: GalleryItem) {
    editor.setCover(isCover(item) && editor.data.cover === item.file ? undefined : item.file);
    refreshAll();
    if (selected) renderInspector();
  }

  canvas.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const figure = target.closest<HTMLElement>('.cms-item');
    const item = figure && editor.item(figure.dataset.file!);
    if (!item) return;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'star') toggleCover(item);
    else if (action === 'hide') toggleHidden(item);
    else if (action === 'smaller') stepSpan(item, -1);
    else if (action === 'larger') stepSpan(item, 1);
    else select(item.file);
  });

  presetSelect.addEventListener('change', () => {
    const preset = presetSelect.value;
    presetSelect.value = '';
    if (!preset) return;
    for (const item of editor.items) {
      item.span =
        preset === 'auto'
          ? defaultSpan(item.kind, itemRatio(item, editor.files))
          : preset === 'full'
            ? 12
            : preset === 'two'
              ? 6
              : preset === 'three'
                ? 4
                : 3;
    }
    editor.touch();
    refreshAll();
    if (selected) renderInspector();
    toast('Composition appliquée. Ajuste ensuite chaque média si besoin.', 'info');
  });

  /* ------------------------------------------------------------------ ajout de médias */
  function pendingTile(name: string) {
    const bar = h('span', { class: 'cms-progress-bar' });
    const label = h('small', null, 'Envoi…');
    const el = h(
      'figure',
      { class: 'gg-item cms-pending', style: '--span:4' },
      h(
        'div',
        { class: 'cms-pending-box' },
        icon(/\.(mp4|webm)$/i.test(name) ? 'video' : 'image', 22),
        h('strong', null, name),
        h('span', { class: 'cms-progress' }, bar),
        label,
      ),
    );
    canvas.append(el);
    empty.hidden = true;
    canvas.hidden = false;
    return {
      el,
      progress: (r: number) => (
        (bar.style.width = `${Math.round(r * 100)}%`),
        (label.textContent = `Envoi ${Math.round(r * 100)} %`)
      ),
      done: () => el.remove(),
      fail: (message: string) => {
        el.classList.add('is-error');
        label.textContent = message;
        setTimeout(() => (el.remove(), renumber()), 5000);
      },
    };
  }

  const domOrder = () =>
    [...canvas.querySelectorAll<HTMLElement>('.cms-item')].map((el) => el.dataset.file!);

  async function addOne(file: File, pending: ReturnType<typeof pendingTile>) {
    const isVideo = /\.(mp4|webm)$/i.test(file.name);
    try {
      const probe = isVideo ? await probeVideo(file) : null;
      const info = await upload(slug, file, { name: file.name, onProgress: pending.progress });
      const ratio = probe?.width ? `${probe.width}:${probe.height}` : undefined;
      const item = editor.addFile(info, { ratio });
      // le média prend la place de sa tuile d'attente : l'ordre de sélection est conservé,
      // même si les envois (en parallèle) se terminent dans le désordre
      pending.el.replaceWith(createTile(item));
      editor.reorder(domOrder());
      renumber();

      if (isVideo && probe?.poster) {
        // affiche générée automatiquement (image extraite de la vidéo) — modifiable ensuite
        try {
          const poster = await upload(slug, probe.poster, {
            name: 'affiche.jpg',
            poster: info.name,
          });
          editor.setPoster(info.name, poster);
          swapTileMedia(item);
        } catch {
          /* pas d'affiche : la vidéo reste utilisable */
        }
      }
    } catch (error) {
      pending.fail(error instanceof Error ? error.message : 'Échec de l’envoi.');
      toast(
        `« ${file.name} » : ${error instanceof Error ? error.message : 'échec de l’envoi.'}`,
        'error',
        6000,
      );
    }
  }

  /** Remplace le média affiché d'une tuile vidéo par son affiche. */
  function swapTileMedia(item: GalleryItem) {
    const el = tiles.get(item.file);
    if (!el || !item.poster) return;
    const media = el.querySelector('.cms-tile > video, .cms-tile > img');
    const next = h('img', {
      src: thumbUrl(slug, item.poster, THUMB_WIDTH, item.v),
      alt: '',
      draggable: false,
    });
    media?.replaceWith(next);
    refreshTile(item);
  }

  async function addFiles(list: FileList | File[]) {
    const files = [...list].filter((file) => {
      const ok = ACCEPT.test(file.name);
      if (!ok)
        toast(
          `« ${file.name} » : format non pris en charge (JPG, PNG, WebP, AVIF, MP4, WebM).`,
          'error',
          5200,
        );
      return ok;
    });
    if (!files.length) return;
    // toutes les tuiles d'attente apparaissent tout de suite, dans l'ordre choisi ; 2 envois en parallèle
    const queue = files.map((file) => ({ file, pending: pendingTile(file.name) }));
    await Promise.all(
      Array.from({ length: Math.min(2, queue.length) }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) await addOne(job.file, job.pending);
      }),
    );
    renumber();
    if (selected) renderInspector();
  }

  fileInput.addEventListener('change', () => {
    void addFiles(fileInput.files ?? []);
    fileInput.value = '';
  });

  // dépôt de fichiers depuis l'explorateur
  let dragDepth = 0;
  const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  const onEnter = (e: DragEvent) => hasFiles(e) && (dragDepth++, root.classList.add('is-dropping'));
  const onLeave = (e: DragEvent) =>
    hasFiles(e) &&
    (dragDepth = Math.max(0, dragDepth - 1)) === 0 &&
    root.classList.remove('is-dropping');
  const onOver = (e: DragEvent) => hasFiles(e) && e.preventDefault();
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    root.classList.remove('is-dropping');
    void addFiles(e.dataTransfer?.files ?? []);
  };
  root.addEventListener('dragenter', onEnter);
  root.addEventListener('dragleave', onLeave);
  root.addEventListener('dragover', onOver);
  root.addEventListener('drop', onDrop);
  // évite que le navigateur ouvre un fichier déposé à côté de la zone
  const preventStray = (e: DragEvent) => hasFiles(e) && e.preventDefault();
  window.addEventListener('dragover', preventStray);
  window.addEventListener('drop', preventStray);

  /* ------------------------------------------------------------------ panneau de détail */
  async function deleteItem(item: GalleryItem) {
    const ok = await confirmModal({
      title: 'Supprimer ce média ?',
      body: h(
        'div',
        null,
        h('p', null, h('strong', null, item.file), ' sera retiré du projet.'),
        h(
          'p',
          { class: 'cms-muted' },
          'Le fichier est déplacé dans le dossier .trash/ du projet : il reste récupérable.',
        ),
      ),
      confirm: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      const { removed } = await api.deleteMedia(slug, item.file);
      editor.removeFiles(removed);
      tiles.get(item.file)?.remove();
      tiles.delete(item.file);
      select(undefined);
      renumber();
      refreshAll();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Suppression impossible.', 'error');
    }
  }

  function move(item: GalleryItem, direction: -1 | 1) {
    const el = tiles.get(item.file);
    const sibling = direction < 0 ? el?.previousElementSibling : el?.nextElementSibling;
    if (!el || !sibling?.classList.contains('cms-item')) return;
    if (direction < 0) sibling.before(el);
    else sibling.after(el);
    editor.reorder(
      [...canvas.querySelectorAll<HTMLElement>('.cms-item')].map((n) => n.dataset.file!),
    );
    renumber();
  }

  function field(label: string, control: HTMLElement) {
    return h('label', { class: 'cms-field' }, h('span', null, label), control);
  }

  function renderInspector() {
    inspector.replaceChildren();
    const item = selected ? editor.item(selected) : undefined;

    if (!item) {
      inspector.append(
        h(
          'div',
          { class: 'cms-insp-empty' },
          icon('layout', 28),
          h('h3', null, 'Composition libre'),
          h(
            'p',
            null,
            'Clique un média pour régler sa taille, son alignement, sa légende ou le définir comme couverture.',
          ),
          h(
            'ul',
            null,
            h(
              'li',
              null,
              'Les médias se placent de gauche à droite et passent à la ligne quand elle est pleine.',
            ),
            h('li', null, 'Exemple : 2/3 + 1/3, puis pleine largeur, puis 1/3 + 1/3 + 1/3.'),
            h(
              'li',
              null,
              'Sur mobile, chaque média s’affiche en pleine largeur, dans le même ordre.',
            ),
          ),
        ),
      );
      return;
    }

    const ratio = itemRatio(item, editor.files);
    const preview =
      item.kind === 'video'
        ? h('video', {
            class: 'cms-insp-video',
            src: fileUrl(slug, item.file, item.v),
            controls: true,
            preload: 'metadata',
            playsinline: true,
            muted: true,
          })
        : h('img', { class: 'cms-insp-img', src: thumbUrl(slug, item.file, 700, item.v), alt: '' });

    const spanButtons = SPAN_INFO.map((s) =>
      h(
        'button',
        {
          type: 'button',
          class: `cms-span${s.span === item.span ? ' is-on' : ''}`,
          title: s.label,
          'aria-pressed': String(s.span === item.span),
          onclick: () => changeSpan(item, s.span),
        },
        h('span', { class: 'cms-span-bar' }, h('i', { style: `width:${(s.span / 12) * 100}%` })),
        s.short,
      ),
    );

    const alignIcons: Record<Align, IconName> = {
      start: 'alignTop',
      center: 'alignMiddle',
      end: 'alignBottom',
    };
    const alignLabels: Record<Align, string> = { start: 'Haut', center: 'Centre', end: 'Bas' };
    const alignButtons = ALIGNS.map((a) =>
      h(
        'button',
        {
          type: 'button',
          class: `cms-seg${a === item.align ? ' is-on' : ''}`,
          'aria-pressed': String(a === item.align),
          onclick: () => {
            item.align = a;
            editor.touch();
            refreshTile(item);
            renderInspector();
          },
        },
        icon(alignIcons[a], 16),
        alignLabels[a],
      ),
    );

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

    const posterBlock =
      item.kind === 'video' &&
      h(
        'div',
        { class: 'cms-poster' },
        h('h4', null, 'Affiche de la vidéo'),
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
              onclick: async (e: Event) => {
                const button = e.currentTarget as HTMLButtonElement;
                const video = preview as HTMLVideoElement;
                const blob = await captureFrame(video);
                if (!blob)
                  return toast('Lance la lecture ou avance la vidéo, puis réessaie.', 'info');
                button.disabled = true;
                try {
                  const poster = await upload(slug, blob, {
                    name: 'affiche.jpg',
                    poster: item.file,
                  });
                  editor.setPoster(item.file, poster);
                  swapTileMedia(item);
                  renderInspector();
                  toast('Affiche mise à jour.');
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Échec.', 'error');
                } finally {
                  button.disabled = false;
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
              accept: 'image/jpeg,image/png,image/webp,image/avif',
              hidden: true,
              onchange: async (e: Event) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                input.value = '';
                if (!file) return;
                try {
                  const poster = await upload(slug, file, { name: file.name, poster: item.file });
                  editor.setPoster(item.file, poster);
                  swapTileMedia(item);
                  renderInspector();
                  toast('Affiche importée.');
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Échec.', 'error');
                }
              },
            }),
          ),
        ),
        h(
          'p',
          { class: 'cms-muted' },
          'Avance la vidéo jusqu’à l’image voulue, puis « Utiliser l’image affichée ».',
        ),
      );

    const index = editor.items.indexOf(item);
    inspector.append(
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
              describeRatio(item.width, item.height) || `Vidéo · ratio ${ratio.toFixed(2)}:1`,
            ),
            h(
              'span',
              null,
              formatBytes(item.size),
              ' · ',
              item.kind === 'image' ? 'Image' : 'Vidéo',
            ),
          ),
        ),

        h(
          'div',
          { class: 'cms-insp-block' },
          h('h4', null, 'Taille dans la grille'),
          h('div', { class: 'cms-spans' }, spanButtons),
          h('p', { class: 'cms-muted' }, SPAN_INFO.find((s) => s.span === item.span)?.label ?? ''),
        ),

        h(
          'div',
          { class: 'cms-insp-block' },
          h('h4', null, 'Alignement vertical'),
          h('div', { class: 'cms-segs' }, alignButtons),
          h('p', { class: 'cms-muted' }, 'Quand les médias d’une ligne n’ont pas la même hauteur.'),
        ),

        h(
          'div',
          { class: 'cms-insp-block' },
          field('Texte alternatif', alt),
          field('Légende', caption),
        ),

        posterBlock,

        h(
          'div',
          { class: 'cms-insp-block' },
          h(
            'div',
            { class: 'cms-row' },
            item.kind === 'image' &&
              h(
                'button',
                {
                  type: 'button',
                  class: `cms-btn ${isCover(item) ? 'is-primary' : 'is-ghost'}`,
                  onclick: () => toggleCover(item),
                },
                icon('star', 16),
                isCover(item) ? 'Couverture ✓' : 'Définir comme couverture',
              ),
            h(
              'button',
              { type: 'button', class: 'cms-btn is-ghost', onclick: () => toggleHidden(item) },
              icon(item.hidden ? 'eye' : 'eyeOff', 16),
              item.hidden ? 'Afficher dans la galerie' : 'Masquer de la galerie',
            ),
          ),
          h(
            'div',
            { class: 'cms-row' },
            h(
              'button',
              {
                type: 'button',
                class: 'cms-btn is-ghost',
                disabled: index <= 0,
                onclick: () => move(item, -1),
              },
              '◀ Avancer',
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'cms-btn is-ghost',
                disabled: index >= editor.items.length - 1,
                onclick: () => move(item, 1),
              },
              'Reculer ▶',
            ),
          ),
        ),

        h(
          'button',
          {
            type: 'button',
            class: 'cms-btn is-danger cms-block',
            onclick: () => void deleteItem(item),
          },
          icon('trash', 16),
          'Supprimer ce média',
        ),
      ),
    );
  }

  renderInspector();
  const off = editor.onChange(() => {
    // la couverture peut changer depuis un autre onglet
    refreshAll();
  });

  return () => {
    off();
    sortable.destroy();
    root.removeEventListener('dragenter', onEnter);
    root.removeEventListener('dragleave', onLeave);
    root.removeEventListener('dragover', onOver);
    root.removeEventListener('drop', onDrop);
    window.removeEventListener('dragover', preventStray);
    window.removeEventListener('drop', preventStray);
    root.remove();
  };
}
