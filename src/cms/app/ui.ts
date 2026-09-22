/** Petites briques d'interface : création d'éléments, icônes, notifications, fenêtres de confirmation. */

export type Child = Node | string | number | false | null | undefined | Child[];
type Attrs = Record<string, unknown>;

/** Crée un élément : h('div', { class: 'x', onclick: fn }, 'texte', autreElement). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'html') el.innerHTML = String(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value as EventListener);
    } else if (['value', 'checked', 'disabled', 'selected', 'indeterminate'].includes(key)) {
      (el as unknown as Record<string, unknown>)[key] = value;
    } else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

export function append(parent: Element, children: Child[]) {
  for (const child of children.flat(Infinity as 1) as Child[]) {
    if (child === false || child === null || child === undefined) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el: Element) {
  el.replaceChildren();
}

/* ------------------------------------------------------------------ icônes (trait fin, 24×24) */
const ICONS = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  external: '<path d="M7 17 17 7M8 7h9v9"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrowLeft: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2 5.3M20 5v6h-6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  alignTop: '<path d="M4 4h16M9 8h6v12H9z"/>',
  alignMiddle: '<path d="M4 12h3M17 12h3M9 6h6v12H9z"/>',
  alignBottom: '<path d="M4 20h16M9 4h6v12H9z"/>',
} as const;
export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 18): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'cms-icon');
  svg.innerHTML = ICONS[name];
  return svg;
}

/* ------------------------------------------------------------------ notifications */
export function toast(message: string, kind: 'ok' | 'error' | 'info' = 'ok', ms = 3600) {
  const host = document.getElementById('cms-toasts');
  if (!host) return;
  const el = h(
    'div',
    { class: `cms-toast is-${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    icon(kind === 'error' ? 'close' : kind === 'ok' ? 'check' : 'info', 16),
    h('span', null, message),
  );
  host.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 320);
  }, ms);
}

/* ------------------------------------------------------------------ fenêtres */
interface ModalOptions {
  title: string;
  body: Child;
  confirm: string;
  cancel?: string;
  danger?: boolean;
}

/** Fenêtre de confirmation : renvoie true si l'utilisateur confirme. */
export function confirmModal({
  title,
  body,
  confirm,
  cancel = 'Annuler',
  danger = false,
}: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'cms-modal' });
    const done = (value: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.append(
      h(
        'div',
        { class: 'cms-modal-box' },
        h('h3', null, title),
        h('div', { class: 'cms-modal-body' }, body),
        h(
          'div',
          { class: 'cms-modal-actions' },
          h(
            'button',
            { type: 'button', class: 'cms-btn is-ghost', onclick: () => done(false) },
            cancel,
          ),
          h(
            'button',
            {
              type: 'button',
              class: `cms-btn ${danger ? 'is-danger' : 'is-primary'}`,
              onclick: () => done(true),
            },
            confirm,
          ),
        ),
      ),
    );
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      done(false);
    });
    dialog.addEventListener('click', (e) => e.target === dialog && done(false));
    document.body.append(dialog);
    dialog.showModal();
  });
}

/* ------------------------------------------------------------------ utilitaires */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer = 0;
  const wrapped = (...args: A) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
  return `${(bytes / 1024 ** 3).toFixed(2)} Go`;
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms);
}

export const natural = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** « 1920 × 1080 · 16:9 » */
export function describeRatio(width?: number, height?: number): string {
  if (!width || !height) return '';
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(width, height);
  const [rw, rh] = [width / d, height / d];
  const known = rw <= 32 && rh <= 32 ? `${rw}:${rh}` : `${(width / height).toFixed(2)}:1`;
  return `${width} × ${height} · ${known}`;
}
