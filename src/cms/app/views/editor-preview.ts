/**
 * Onglet « Prévisualisation » : la VRAIE page publique du projet, dans un cadre aux dimensions d'un
 * ordinateur, d'une tablette ou d'un téléphone. Les modifications sont enregistrées avant l'affichage.
 */
import type { Editor } from '../editor-state';
import { h, icon } from '../ui';

const DEVICES = [
  { id: 'desktop', label: 'Ordinateur', width: 1440, icon: 'monitor' as const },
  { id: 'tablet', label: 'Tablette', width: 820, icon: 'tablet' as const },
  { id: 'phone', label: 'Téléphone', width: 390, icon: 'phone' as const },
];

export function mountPreview(host: HTMLElement, editor: Editor): () => void {
  let device = DEVICES[0]!;
  const url = () => `/projets/${editor.slug}/`;

  const frame = h('iframe', { class: 'cms-frame', title: 'Aperçu du projet', loading: 'eager' });
  const stage = h('div', { class: 'cms-stage' }, frame);
  const buttons = new Map<string, HTMLButtonElement>();

  /** Cadre à la largeur réelle de l'appareil, réduit pour tenir dans la zone (proportions et media queries exactes). */
  const fit = () => {
    const stageHeight = Math.round(Math.max(560, window.innerHeight - 250));
    const scale = Math.min(1, (stage.clientWidth - 2) / device.width);
    stage.style.height = `${stageHeight}px`;
    frame.style.width = `${device.width}px`;
    frame.style.height = `${Math.round(stageHeight / scale)}px`;
    frame.style.marginLeft = `${-device.width / 2}px`;
    frame.style.transform = `scale(${scale})`;
  };

  async function load() {
    stage.classList.add('is-loading');
    await editor.flush(); // l'aperçu montre toujours la dernière version enregistrée
    frame.src = `${url()}?preview=${Date.now()}`;
  }
  frame.addEventListener('load', () => stage.classList.remove('is-loading'));

  const deviceBar = h(
    'div',
    { class: 'cms-segs' },
    DEVICES.map((d) => {
      const b = h(
        'button',
        {
          type: 'button',
          class: `cms-seg${d.id === device.id ? ' is-on' : ''}`,
          'aria-pressed': String(d.id === device.id),
          onclick: () => {
            device = d;
            buttons.forEach((btn, id) => {
              btn.classList.toggle('is-on', id === d.id);
              btn.setAttribute('aria-pressed', String(id === d.id));
            });
            fit();
          },
        },
        icon(d.icon, 16),
        `${d.label} · ${d.width}`,
      );
      buttons.set(d.id, b);
      return b;
    }),
  );

  const root = h(
    'section',
    { class: 'cms-preview' },
    h(
      'div',
      { class: 'cms-gal-toolbar' },
      deviceBar,
      h('span', { class: 'cms-grow' }),
      h(
        'button',
        { type: 'button', class: 'cms-btn is-ghost', onclick: () => void load() },
        icon('refresh', 16),
        'Actualiser',
      ),
      h(
        'a',
        { class: 'cms-btn is-ghost', href: url(), target: '_blank', rel: 'noopener' },
        icon('external', 16),
        'Ouvrir dans un onglet',
      ),
    ),
    stage,
    h(
      'p',
      { class: 'cms-hint' },
      'C’est exactement la page du site, avec la même galerie et la même visionneuse. Elle affiche les projets en brouillon tant que tu travailles en local.',
    ),
  );
  host.append(root);

  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  requestAnimationFrame(() => {
    fit();
    void load();
  });

  return () => {
    window.removeEventListener('resize', onResize);
    root.remove();
  };
}
