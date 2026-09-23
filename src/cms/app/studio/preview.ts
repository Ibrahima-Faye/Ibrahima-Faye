/**
 * Aperçu du Studio : la VRAIE page du site, dans un cadre à la largeur exacte de l'appareil
 * (media queries réelles), réduit pour tenir dans la zone. Dialogue avec la page par postMessage
 * (src/scripts/studio/bridge.ts) : thème et animations appliqués en direct, sélection d'éléments.
 */
import { h, icon } from '../ui';
import type { DeviceKey } from './controls';

export const DEVICES: {
  id: DeviceKey;
  label: string;
  width: number;
  icon: 'monitor' | 'tablet' | 'phone';
}[] = [
  { id: 'desktop', label: 'Ordinateur', width: 1440, icon: 'monitor' },
  { id: 'tablet', label: 'Tablette', width: 820, icon: 'tablet' },
  { id: 'mobile', label: 'Mobile', width: 390, icon: 'phone' },
];

const PAGES = [
  { path: '/', label: 'Accueil' },
  { path: '/projets/', label: 'Projets' },
];

export interface Preview {
  el: HTMLElement;
  post(message: Record<string, unknown>): void;
  reload(): void;
  device(): DeviceKey;
  setSelecting(on: boolean): void;
  dispose(): void;
}

export function createPreview(options: {
  /** La page vient de (re)charger : lui renvoyer les réglages en cours d'édition. */
  onReady: () => void;
  onSelect?: (id: string) => void;
  onDevice?: (device: DeviceKey) => void;
}): Preview {
  let device = DEVICES[0]!;
  let page = PAGES[0]!.path;
  let selecting = false;

  const frame = h('iframe', { class: 'st-frame', title: 'Aperçu du site', loading: 'eager' });
  const stage = h('div', { class: 'st-stage is-loading' }, frame);

  const fit = () => {
    const height = Math.max(420, stage.clientHeight);
    const scale = Math.min(1, (stage.clientWidth - 24) / device.width);
    frame.style.width = `${device.width}px`;
    frame.style.height = `${Math.round(height / scale)}px`;
    frame.style.transform = `translateX(-50%) scale(${scale})`;
  };

  const post = (message: Record<string, unknown>) =>
    frame.contentWindow?.postMessage({ source: 'studio', ...message }, location.origin);

  const load = () => {
    stage.classList.add('is-loading');
    frame.src = page;
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    const data = event.data as { source?: string; type?: string; id?: string };
    if (data?.source !== 'site-preview') return;
    if (data.type === 'ready') {
      stage.classList.remove('is-loading');
      options.onReady();
      if (selecting) post({ type: 'select-mode', on: true });
    }
    if (data.type === 'select' && data.id) options.onSelect?.(data.id);
  };
  window.addEventListener('message', onMessage);
  frame.addEventListener('load', () => stage.classList.remove('is-loading'));

  const deviceButtons = DEVICES.map((d) => {
    const b = h(
      'button',
      {
        type: 'button',
        class: `st-seg-btn${d.id === device.id ? ' is-on' : ''}`,
        title: `${d.label} · ${d.width} px`,
        'aria-pressed': String(d.id === device.id),
      },
      icon(d.icon, 16),
      h('span', null, d.label),
    );
    b.addEventListener('click', () => {
      device = d;
      deviceButtons.forEach((x) => {
        x.classList.toggle('is-on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      fit();
      options.onDevice?.(d.id);
    });
    return b;
  });

  const pageSelect = h(
    'select',
    { class: 'st-input st-page', 'aria-label': 'Page affichée' },
    PAGES.map((p) => h('option', { value: p.path }, p.label)),
  );
  pageSelect.addEventListener('change', () => {
    page = pageSelect.value;
    load();
  });

  const selectButton = h(
    'button',
    {
      type: 'button',
      class: 'cms-btn is-ghost st-pick',
      title: 'Cliquer un élément de la page pour le régler',
    },
    icon('search', 16),
    'Sélectionner',
  );
  const setSelecting = (on: boolean) => {
    selecting = on;
    selectButton.classList.toggle('is-on', on);
    post({ type: 'select-mode', on });
  };
  selectButton.addEventListener('click', () => setSelecting(!selecting));

  const el = h(
    'section',
    { class: 'st-preview' },
    h(
      'div',
      { class: 'st-preview-bar' },
      h('div', { class: 'st-seg' }, deviceButtons),
      pageSelect,
      h('span', { class: 'cms-grow' }),
      selectButton,
      h(
        'button',
        { type: 'button', class: 'cms-btn is-ghost', title: 'Recharger l’aperçu', onclick: load },
        icon('refresh', 16),
      ),
    ),
    stage,
  );

  const resize = new ResizeObserver(fit);
  resize.observe(stage);
  load();

  return {
    el,
    post,
    reload: load,
    device: () => device.id,
    setSelecting,
    dispose() {
      resize.disconnect();
      window.removeEventListener('message', onMessage);
    },
  };
}
