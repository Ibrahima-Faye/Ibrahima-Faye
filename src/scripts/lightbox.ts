/**
 * Visionneuse plein écran — <dialog> natif (focus piégé, Échap, couche supérieure).
 *
 * Chaque tuile de galerie porte : data-lightbox-item, data-type (image|video), data-src, data-alt,
 * data-caption, data-poster, data-thumb, data-w, data-h.
 * Le média est affiché à son ratio d'origine (jamais recadré).
 *
 * Fonctions :
 *  - ouverture / fermeture animées depuis / vers la vignette (FLIP) ;
 *  - navigation : ← →, boutons, miniatures, balayage tactile ;
 *  - zoom (images) : molette, double-clic / double-tap, pincement, + − 0, boutons ;
 *  - déplacement de l'image zoomée (glisser) ;
 *  - vidéos avec contrôles natifs ; plein écran (F) ; Échap ferme.
 */

interface Item {
  type: 'image' | 'video';
  src: string;
  alt: string;
  caption: string;
  poster: string;
  thumb: string;
  w: number;
  h: number;
}

interface Labels {
  counter: string;
  enter: string;
  exit: string;
  goTo: string;
}

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

let items: Item[] = [];
let tiles: HTMLElement[] = [];
let index = 0;
let closing = false;
let suppressClick = false;
let suppressTimer = 0;
/** Ignore le « clic » que le navigateur émet à la fin d'un geste (glisser, pincer…), puis expire. */
function suppress() {
  suppressClick = true;
  clearTimeout(suppressTimer);
  suppressTimer = window.setTimeout(() => (suppressClick = false), 380);
}

/** Zoom / déplacement de l'image courante. */
const view = { s: 1, x: 0, y: 0, max: 4 };

const currentDialog = () => document.querySelector<HTMLDialogElement>('dialog[data-lightbox]');
const q = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;
const labelsOf = (dialog: HTMLElement) => JSON.parse(dialog.dataset.labels ?? '{}') as Labels;

function readItems(gallery: HTMLElement) {
  const list = Array.from(gallery.querySelectorAll<HTMLElement>('[data-lightbox-item]'));
  tiles = list;
  items = list.map((t) => ({
    type: t.dataset.type === 'video' ? 'video' : 'image',
    src: t.dataset.src ?? '',
    alt: t.dataset.alt ?? '',
    caption: t.dataset.caption ?? '',
    poster: t.dataset.poster ?? '',
    thumb: t.dataset.thumb ?? '',
    w: Number(t.dataset.w) || 0,
    h: Number(t.dataset.h) || 0,
  }));
}

/* ------------------------------------------------------------------ *
 * Mise à l'échelle : la taille est calculée en pixels à partir du ratio,
 * ce qui rend l'animation d'ouverture exacte, sans attendre le chargement.
 * ------------------------------------------------------------------ */
function stageBox(dialog: HTMLElement) {
  return q(dialog, '[data-lb-stage]').getBoundingClientRect();
}

function tileRatio(i: number, item: Item) {
  const r = tiles[i]?.getBoundingClientRect();
  if (r && r.width && r.height) return r.width / r.height;
  return item.w && item.h ? item.w / item.h : 16 / 9;
}

function fit(dialog: HTMLElement, el: HTMLElement, item: Item) {
  const box = stageBox(dialog);
  if (!box.width || !box.height) return;
  let w: number;
  let h: number;
  if (item.type === 'image' && item.w && item.h) {
    const k = Math.min(box.width / item.w, box.height / item.h, 1); // jamais agrandi au-delà de sa taille
    w = item.w * k;
    h = item.h * k;
    view.max = clamp((item.w / w) * 2, 2.5, 6);
  } else {
    const ratio =
      el instanceof HTMLVideoElement && el.videoWidth
        ? el.videoWidth / el.videoHeight
        : tileRatio(index, item);
    w = box.width;
    h = w / ratio;
    if (h > box.height) {
      h = box.height;
      w = h * ratio;
    }
  }
  el.style.width = `${Math.round(w)}px`;
  el.style.height = `${Math.round(h)}px`;
}

/* ------------------------------------------------------------------ *
 * Zoom
 * ------------------------------------------------------------------ */
function pan(dialog: HTMLElement) {
  return dialog.querySelector<HTMLElement>('.lb-pan');
}

function applyView(dialog: HTMLElement, smooth = false) {
  const el = pan(dialog);
  if (!el) return;
  el.style.transition = smooth && !reduced() ? `transform 0.35s ${EASE}` : 'none';
  el.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`;
  el.classList.toggle('is-zoomed', view.s > 1.001);

  const level = dialog.querySelector<HTMLElement>('[data-lb-zoom-level]');
  if (level) level.textContent = `${Math.round(view.s * 100)} %`;
  dialog.querySelector<HTMLButtonElement>('[data-lb-zoom-in]')!.disabled =
    view.s >= view.max - 0.01;
  dialog.querySelector<HTMLButtonElement>('[data-lb-zoom-out]')!.disabled = view.s <= 1.001;
  dialog.querySelector<HTMLButtonElement>('[data-lb-zoom-reset]')!.disabled = view.s <= 1.001;
}

function clampView(dialog: HTMLElement) {
  const media = dialog.querySelector<HTMLElement>('.lb-media');
  if (!media || view.s <= 1) {
    view.s = Math.max(1, view.s);
    view.x = 0;
    view.y = 0;
    return;
  }
  const box = stageBox(dialog);
  const maxX = Math.max(0, (media.offsetWidth * view.s - box.width) / 2);
  const maxY = Math.max(0, (media.offsetHeight * view.s - box.height) / 2);
  view.x = clamp(view.x, -maxX, maxX);
  view.y = clamp(view.y, -maxY, maxY);
}

/** Zoome autour d'un point de l'écran : le point sous le doigt / le curseur reste fixe. */
function zoomAt(
  dialog: HTMLElement,
  next: number,
  clientX?: number,
  clientY?: number,
  smooth = false,
) {
  if (items[index]?.type !== 'image') return;
  const box = stageBox(dialog);
  const px = (clientX ?? box.left + box.width / 2) - (box.left + box.width / 2);
  const py = (clientY ?? box.top + box.height / 2) - (box.top + box.height / 2);
  const s = clamp(next, 1, view.max);
  view.x = px - ((px - view.x) * s) / view.s;
  view.y = py - ((py - view.y) * s) / view.s;
  view.s = s;
  clampView(dialog);
  applyView(dialog, smooth);
}

const resetView = (dialog: HTMLElement, smooth = false) => {
  view.s = 1;
  view.x = 0;
  view.y = 0;
  applyView(dialog, smooth);
};

/* ------------------------------------------------------------------ *
 * Affichage d'un média
 * ------------------------------------------------------------------ */
function flipFromTile(dialog: HTMLElement, el: HTMLElement, tile: HTMLElement | undefined) {
  if (!tile || reduced()) return;
  const from = tile.getBoundingClientRect();
  const to = el.getBoundingClientRect();
  if (!from.width || !to.width) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  el.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`,
        borderRadius: '0.4rem',
      },
      { transform: 'none', borderRadius: '0.3rem' },
    ],
    { duration: 560, easing: EASE },
  );
  dialog.querySelectorAll<HTMLElement>('.lb-chrome').forEach((chrome) =>
    chrome.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 420,
      delay: 140,
      easing: 'ease-out',
      fill: 'backwards',
    }),
  );
}

function show(dialog: HTMLDialogElement, next: number, direction = 0, fromTile?: HTMLElement) {
  if (!items.length) return;
  index = (next + items.length) % items.length;
  const item = items[index]!;
  const stage = q(dialog, '[data-lb-stage]');
  const labels = labelsOf(dialog);

  stage.querySelector('video')?.pause();
  stage.replaceChildren();
  view.s = 1;
  view.x = 0;
  view.y = 0;

  const wrap = document.createElement('div');
  wrap.className = 'lb-pan';
  let el: HTMLElement;

  if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.src;
    if (item.poster) video.poster = item.poster;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', item.alt);
    video.addEventListener('loadedmetadata', () => fit(dialog, video, item), { once: true });
    el = video;
  } else {
    const img = document.createElement('img');
    img.alt = item.alt;
    img.decoding = 'async';
    img.draggable = false;
    // la miniature (déjà en cache) sert de fond flou le temps que l'image grand format arrive
    if (item.thumb) img.style.background = `center / cover url("${item.thumb}")`;
    img.addEventListener('load', () => (img.style.background = 'none'), { once: true });
    img.src = item.src;
    el = img;
  }
  el.className = 'lb-media';
  wrap.append(el);
  stage.append(wrap);
  fit(dialog, el, item);

  if (fromTile) flipFromTile(dialog, el, fromTile);
  else if (!reduced()) {
    el.animate(
      [
        { opacity: 0, transform: `translateX(${direction * 48}px) scale(0.985)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 460, easing: EASE },
    );
  }

  // légende, compteur, boutons de zoom
  const caption = q(dialog, '[data-lb-caption]');
  caption.textContent = item.caption;
  caption.hidden = !item.caption;
  q(dialog, '[data-lb-counter]').textContent = labels.counter
    .replace('{n}', String(index + 1))
    .replace('{total}', String(items.length));
  dialog
    .querySelectorAll<HTMLElement>('[data-lb-zoom]')
    .forEach((g) => (g.hidden = item.type !== 'image'));
  applyView(dialog);

  // miniature active
  dialog.querySelectorAll<HTMLElement>('.lb-thumb').forEach((t, i) => {
    const on = i === index;
    if (on) t.setAttribute('aria-current', 'true');
    else t.removeAttribute('aria-current');
    if (on)
      t.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: reduced() || fromTile ? 'auto' : 'smooth',
      });
  });

  // précharge les voisines
  for (const off of [1, -1]) {
    const n = items[(index + off + items.length) % items.length];
    if (n && n.type === 'image') new Image().src = n.src;
  }
}

function buildThumbs(dialog: HTMLElement) {
  const strip = q(dialog, '[data-lb-thumbs]');
  const labels = labelsOf(dialog);
  strip.replaceChildren(
    ...items.map((item, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lb-thumb';
      b.dataset.lbGo = String(i);
      b.setAttribute('aria-label', labels.goTo.replace('{n}', String(i + 1)));
      if (item.type === 'video') b.classList.add('is-video');
      const src = item.type === 'video' ? item.thumb || item.poster : item.thumb;
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        b.append(img);
      }
      return b;
    }),
  );
}

function open(dialog: HTMLDialogElement, start: number, from: HTMLElement) {
  closing = false;
  const single = items.length < 2;
  dialog
    .querySelectorAll<HTMLElement>(
      '[data-lb-prev],[data-lb-next],[data-lb-counter],[data-lb-thumbs]',
    )
    .forEach((b) => (b.hidden = single));
  buildThumbs(dialog);
  dialog.showModal();
  show(dialog, start, 0, from);
}

function closeAnimated(dialog: HTMLDialogElement) {
  if (closing || !dialog.open) return;
  closing = true;
  dialog.querySelector('video')?.pause();

  const finish = () => {
    closing = false;
    dialog.close();
  };
  const media = dialog.querySelector<HTMLElement>('.lb-media');
  const tile = tiles[index];
  const rect = tile?.getBoundingClientRect();
  const visible =
    rect &&
    rect.width > 0 &&
    rect.bottom > 0 &&
    rect.top < innerHeight &&
    rect.right > 0 &&
    rect.left < innerWidth;

  if (reduced() || !media) return finish();

  resetView(dialog);
  const fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: visible ? 380 : 240,
    easing: 'ease-in',
    fill: 'forwards',
  });
  if (visible && rect) {
    const to = media.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - (to.left + to.width / 2);
    const dy = rect.top + rect.height / 2 - (to.top + to.height / 2);
    media.animate(
      [
        { transform: 'none' },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${rect.width / to.width}, ${rect.height / to.height})`,
        },
      ],
      { duration: 380, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
    );
  }
  fade.finished.then(() => {
    fade.cancel();
    finish();
  }, finish);
}

/* ------------------------------------------------------------------ *
 * Écouteurs globaux — posés une seule fois (routeur de transitions Astro)
 * ------------------------------------------------------------------ */
function toggleFullscreen(dialog: HTMLDialogElement) {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void dialog.requestFullscreen?.().catch(() => {});
}

function syncFullscreenButton(dialog: HTMLDialogElement) {
  const button = dialog.querySelector<HTMLElement>('[data-lb-fullscreen]');
  if (!button) return;
  const labels = labelsOf(dialog);
  const on = document.fullscreenElement === dialog;
  button.setAttribute('aria-label', on ? labels.exit : labels.enter);
  button.setAttribute('aria-pressed', String(on));
  button.querySelector('[data-icon-enter]')?.toggleAttribute('hidden', on);
  button.querySelector('[data-icon-exit]')?.toggleAttribute('hidden', !on);
}

let bound = false;

export function initLightbox(): void {
  if (bound) return;
  bound = true;

  /* clics */
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const dialog = currentDialog();
    if (!dialog) return;

    const tile = target.closest<HTMLElement>('[data-lightbox-item]');
    if (tile) {
      e.preventDefault();
      const gallery = tile.closest<HTMLElement>('[data-gallery]');
      if (!gallery) return;
      readItems(gallery);
      open(dialog, tiles.indexOf(tile), tile);
      return;
    }
    if (!dialog.open) return;

    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const go = target.closest<HTMLElement>('[data-lb-go]');
    if (go) {
      const n = Number(go.dataset.lbGo);
      show(dialog, n, n > index ? 1 : -1);
    } else if (target.closest('[data-lb-close]')) closeAnimated(dialog);
    else if (target.closest('[data-lb-prev]')) show(dialog, index - 1, -1);
    else if (target.closest('[data-lb-next]')) show(dialog, index + 1, 1);
    else if (target.closest('[data-lb-fullscreen]')) toggleFullscreen(dialog);
    else if (target.closest('[data-lb-zoom-in]'))
      zoomAt(dialog, view.s * 1.6, undefined, undefined, true);
    else if (target.closest('[data-lb-zoom-out]'))
      zoomAt(dialog, view.s / 1.6, undefined, undefined, true);
    else if (target.closest('[data-lb-zoom-reset]')) resetView(dialog, true);
    else if (target === dialog || target.matches('[data-lb-stage], .lb-pan')) closeAnimated(dialog);
  });

  /* clavier */
  document.addEventListener('keydown', (e) => {
    const dialog = currentDialog();
    if (!dialog?.open || e.metaKey || e.altKey || e.ctrlKey) return;
    switch (e.key) {
      case 'ArrowRight':
        return show(dialog, index + 1, 1);
      case 'ArrowLeft':
        return show(dialog, index - 1, -1);
      case '+':
      case '=':
        return zoomAt(dialog, view.s * 1.5, undefined, undefined, true);
      case '-':
      case '_':
        return zoomAt(dialog, view.s / 1.5, undefined, undefined, true);
      case '0':
        return resetView(dialog, true);
      case 'f':
      case 'F':
        return toggleFullscreen(dialog);
    }
  });

  /* Échap : fermeture animée */
  document.addEventListener(
    'cancel',
    (e) => {
      const dialog = e.target as HTMLDialogElement;
      if (!dialog.matches?.('dialog[data-lightbox]')) return;
      e.preventDefault();
      closeAnimated(dialog);
    },
    true,
  );

  /* molette / pincement de pavé tactile */
  document.addEventListener(
    'wheel',
    (e) => {
      const dialog = currentDialog();
      if (!dialog?.open || items[index]?.type !== 'image') return;
      if (!(e.target as HTMLElement).closest('[data-lb-stage]')) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016));
      zoomAt(dialog, view.s * factor, e.clientX, e.clientY);
    },
    { passive: false },
  );

  /* gestes : glisser, pincer, double-tap, balayage */
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { dist: number; s: number } | null = null;
  let start = { x: 0, y: 0, t: 0 };
  let lastTap = { t: 0, x: 0, y: 0 };
  let moved = 0;

  const dist = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const mid = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
  };
  const inStage = (e: Event) => (e.target as HTMLElement).closest('[data-lb-stage]');
  const isVideoUi = (e: Event) => Boolean((e.target as HTMLElement).closest('video'));

  document.addEventListener('pointerdown', (e) => {
    const dialog = currentDialog();
    if (!dialog?.open || !inStage(e) || isVideoUi(e)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      moved = 0;
    }
    if (pointers.size === 2) {
      pinch = { dist: dist(), s: view.s };
      suppress();
    }
    if (items[index]?.type === 'image') (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  });

  document.addEventListener('pointermove', (e) => {
    const dialog = currentDialog();
    const p = pointers.get(e.pointerId);
    if (!dialog?.open || !p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    if (items[index]?.type !== 'image') return;

    if (pointers.size === 2 && pinch) {
      const m = mid();
      zoomAt(dialog, pinch.s * (dist() / pinch.dist), m.x, m.y);
    } else if (pointers.size === 1 && view.s > 1.001) {
      view.x += dx;
      view.y += dy;
      clampView(dialog);
      applyView(dialog);
      if (moved > 6) suppress();
      pan(dialog)?.classList.add('is-dragging');
    }
  });

  const endPointer = (e: PointerEvent) => {
    const dialog = currentDialog();
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (dialog) pan(dialog)?.classList.remove('is-dragging');
    if (!dialog?.open || pointers.size > 0 || e.type === 'pointercancel') return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const quick = performance.now() - start.t < 320;

    // double-tap / double-clic → zoom
    if (
      moved < 10 &&
      quick &&
      items[index]?.type === 'image' &&
      (e.target as HTMLElement).closest('.lb-media')
    ) {
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        zoomAt(dialog, view.s > 1.05 ? 1 : Math.min(2.6, view.max), e.clientX, e.clientY, true);
        suppress();
        lastTap.t = 0;
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
      return;
    }

    // balayage (image non zoomée uniquement)
    if (view.s <= 1.001 && moved > 40) {
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppress();
        show(dialog, index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      } else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        suppress();
        closeAnimated(dialog);
      }
    }
  };
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);

  /* redimensionnement : recalcule la taille du média affiché */
  window.addEventListener('resize', () => {
    const dialog = currentDialog();
    const media = dialog?.querySelector<HTMLElement>('.lb-media');
    const item = items[index];
    if (!dialog?.open || !media || !item) return;
    fit(dialog, media, item);
    clampView(dialog);
    applyView(dialog);
  });

  document.addEventListener('fullscreenchange', () => {
    const dialog = currentDialog();
    if (!dialog) return;
    syncFullscreenButton(dialog);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });

  /* fermeture : coupe la vidéo, quitte le plein écran, rend le focus à la vignette */
  document.addEventListener(
    'close',
    (e) => {
      const dialog = e.target as HTMLDialogElement;
      if (!dialog.matches?.('dialog[data-lightbox]')) return;
      dialog.querySelector('video')?.pause();
      dialog.querySelector('[data-lb-stage]')?.replaceChildren();
      if (document.fullscreenElement) void document.exitFullscreen();
      pointers.clear();
      resetView(dialog);
      tiles[index]?.focus({ preventScroll: true });
    },
    true,
  );
}

/**
 * Le ratio d'une vidéo est inconnu au build (sauf `ratio:` ou affiche `<nom>.jpg`).
 * Dès que le navigateur connaît ses dimensions, la tuile s'y adapte : plus de recadrage.
 */
export function initGalleryVideos(): () => void {
  const cleanups: Array<() => void> = [];
  document
    .querySelectorAll<HTMLVideoElement>('video[data-gallery-video][data-ratio-known="false"]')
    .forEach((video) => {
      const apply = () => {
        if (!video.videoWidth || !video.videoHeight) return;
        video
          .closest<HTMLElement>('.gallery-item')
          ?.style.setProperty('--r', (video.videoWidth / video.videoHeight).toFixed(4));
      };
      if (video.readyState >= 1) apply();
      else {
        video.addEventListener('loadedmetadata', apply, { once: true });
        cleanups.push(() => video.removeEventListener('loadedmetadata', apply));
      }
    });
  return () => cleanups.forEach((fn) => fn());
}
