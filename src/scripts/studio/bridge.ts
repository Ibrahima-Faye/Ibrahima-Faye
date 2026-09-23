/**
 * Pont entre l'administration (Studio) et la page affichée dans son aperçu — DÉVELOPPEMENT UNIQUEMENT,
 * et seulement quand la page est dans un cadre de l'administration (même origine).
 *
 *   theme        applique un thème en cours d'édition (CSS + attributs), sans recharger
 *   animations   rejoue les animations avec les réglages en cours d'édition
 *   select-mode  cliquer un élément de la page le sélectionne dans le Studio
 *   focus        fait défiler jusqu'à un élément et l'entoure
 * La position de défilement est conservée quand la page se recharge (enregistrement des sections).
 */
import type { AnimationsSettings } from '@/lib/studio/animations';

const THEME_ATTRS = [
  'data-glass',
  'data-shadows',
  'data-gradients',
  'data-grid',
  'data-particles',
  'data-cursor',
  'data-smooth',
  'data-buttons',
  'data-header-style',
  'data-footer-glow',
];

type Message =
  | { type: 'theme'; css: string; attrs: Record<string, string> }
  | { type: 'animations'; config: AnimationsSettings; focus?: string }
  | { type: 'select-mode'; on: boolean }
  | { type: 'focus'; id: string }
  | { type: 'hold-reload' };

const html = document.documentElement;
const post = (message: Record<string, unknown>) =>
  window.parent.postMessage({ source: 'site-preview', ...message }, location.origin);

function elementFor(id: string): HTMLElement | null {
  return id === 'buttons'
    ? document.querySelector<HTMLElement>('.btn')
    : document.querySelector<HTMLElement>(`[data-anim="${CSS.escape(id)}"]`);
}

function highlight(id: string | null) {
  document
    .querySelectorAll('[data-studio-highlight]')
    .forEach((el) => el.removeAttribute('data-studio-highlight'));
  if (!id) return;
  const targets =
    id === 'buttons'
      ? document.querySelectorAll('.btn')
      : document.querySelectorAll(`[data-anim="${CSS.escape(id)}"]`);
  targets.forEach((el) => el.setAttribute('data-studio-highlight', ''));
}

function focus(id: string) {
  const el = elementFor(id);
  if (!el) return;
  // (pas de scrollIntoView : il ferait aussi défiler la page de l'administration autour du cadre)
  const r = el.getBoundingClientRect();
  window.scrollTo({
    top: window.scrollY + r.top - (window.innerHeight - r.height) / 2,
    behavior: 'instant',
  });
  highlight(id);
}

function applyTheme(css: string, attrs: Record<string, string>) {
  let style = document.getElementById('site-theme');
  if (!style) {
    style = document.createElement('style');
    style.id = 'site-theme';
    document.head.append(style);
  }
  style.textContent = css;
  const before = `${html.dataset.cursor}|${html.dataset.particles}`;
  THEME_ATTRS.forEach((attr) => html.removeAttribute(attr));
  Object.entries(attrs).forEach(([key, value]) => html.setAttribute(key, value));
  // hauteur d'en-tête, tailles de texte… : positions des animations à recalculer
  window.dispatchEvent(new Event('resize'));
  if (`${html.dataset.cursor}|${html.dataset.particles}` !== before)
    document.dispatchEvent(new Event('studio:reinit'));
}

function onClick(e: MouseEvent) {
  if (!html.hasAttribute('data-studio-select')) return;
  const el = (e.target as Element).closest<HTMLElement>('[data-anim], .btn');
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  const id = el.dataset.anim ?? 'buttons';
  highlight(id);
  post({ type: 'select', id });
}

if (window.parent !== window) {
  // Enregistrement du thème ou des animations : déjà appliqués en direct, la page n'a pas à se recharger.
  let holdUntil = 0;
  if (import.meta.hot) {
    import.meta.hot.on('vite:beforeFullReload', () => {
      if (Date.now() < holdUntil) throw new Error('[studio] rechargement évité');
    });
    window.addEventListener('error', (event) => {
      if (String(event.message).includes('[studio] rechargement')) event.preventDefault();
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    html[data-studio-select] [data-anim] { outline: 1px dashed rgb(200 169 255 / 0.35); outline-offset: 3px; cursor: crosshair; }
    html[data-studio-select] [data-anim]:hover, html[data-studio-select] .btn:hover { outline: 2px solid #c8a9ff; }
    [data-studio-highlight] { outline: 2px solid #7b4dff !important; outline-offset: 4px; }
  `;
  document.head.append(style);

  // position conservée d'un rechargement à l'autre
  const key = `studio-scroll:${location.pathname}`;
  const saved = Number(sessionStorage.getItem(key));
  if (saved > 0) requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'instant' }));
  let timer = 0;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(timer);
      timer = window.setTimeout(
        () => sessionStorage.setItem(key, String(Math.round(window.scrollY))),
        120,
      );
    },
    { passive: true },
  );

  document.addEventListener('click', onClick, true);
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    const message = event.data as (Message & { source?: string }) | undefined;
    if (!message || message.source !== 'studio') return;
    if (message.type === 'theme') applyTheme(message.css, message.attrs);
    if (message.type === 'animations') {
      window.__studioAnimations = message.config;
      document.dispatchEvent(new Event('studio:reinit'));
      if (message.focus) requestAnimationFrame(() => focus(message.focus!));
    }
    if (message.type === 'select-mode') html.toggleAttribute('data-studio-select', message.on);
    if (message.type === 'focus') focus(message.id);
    if (message.type === 'hold-reload') holdUntil = Date.now() + 4000;
  });
  post({ type: 'ready', path: location.pathname });
}
