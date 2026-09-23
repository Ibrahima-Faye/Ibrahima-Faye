/**
 * Studio → Navigation : liens de l'en-tête (texte, ordre, section cible, visibilité, bouton),
 * défilement, lien actif, menu mobile. Le comportement du site (scripts/navigation.ts) est conservé :
 * seuls ses paramètres changent.
 */
import { h, icon } from '../ui';
import {
  DEFAULT_LINKS,
  SECTIONS,
  navLinks,
  type LayoutSettings,
  type NavLink,
  type NavigationSettings,
} from '@/lib/studio/layout';
import {
  getPath,
  rangeControl,
  row,
  segmented,
  selectControl,
  setPath,
  textControl,
  toggleControl,
} from './controls';
import type { StudioState } from './state';

export function renderNavigationPanel(
  host: HTMLElement,
  state: StudioState,
  options: { labels: Record<string, string> },
) {
  const nav = () => state.get<NavigationSettings>('navigation');
  const set = (path: string, v: unknown) => state.change('navigation', (d) => setPath(d, path, v));

  /** Liens modifiables : la liste réglée, sinon celle d'origine (recopiée au premier changement). */
  const links = (): NavLink[] => navLinks(nav()).map(({ labelKey: _k, ...l }) => l as NavLink);
  const writeLinks = (next: NavLink[]) =>
    state.change('navigation', (d) => {
      const same =
        next.length === DEFAULT_LINKS.length &&
        next.every((l, i) => {
          const d0 = DEFAULT_LINKS[i]!;
          return (
            l.id === d0.id &&
            l.target === d0.target &&
            !l.label &&
            l.visible !== false &&
            Boolean(l.button) === Boolean(d0.button)
          );
        });
      if (same) delete d.links;
      else
        d.links = next.map((l) =>
          Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined && v !== '')),
        );
    });

  const layout = state.get<LayoutSettings>('layout');
  const targetOptions = [
    ...SECTIONS.filter(
      (s) =>
        s.anchor ||
        (layout.sections as Record<string, { anchor?: string }> | undefined)?.[s.key]?.anchor,
    ).map((s) => ({
      value: s.key,
      label: `Section ${s.label}`,
    })),
    { value: 'page:/projets/', label: 'Page Projets' },
  ];

  function draw() {
    const list = links();
    const update = (i: number, patch: Partial<NavLink>) => {
      const next = list.map((l, j) => (j === i ? { ...l, ...patch } : l));
      writeLinks(next);
    };
    const move = (i: number, delta: number) => {
      const next = [...list];
      const j = i + delta;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j]!, next[i]!];
      writeLinks(next);
      draw();
    };

    const rows = list.map((l, i) => {
      const base = DEFAULT_LINKS.find((d) => d.id === l.id);
      const fallback = base ? (options.labels[base.labelKey] ?? l.id) : 'Lien';
      return h(
        'li',
        { class: `st-link${l.visible === false ? ' is-hidden' : ''}` },
        h(
          'div',
          { class: 'st-link-top' },
          textControl(l.label, fallback, (v) => update(i, { label: v })),
          h(
            'button',
            {
              type: 'button',
              class: 'st-icon-btn',
              title: 'Monter',
              disabled: i === 0,
              onclick: () => move(i, -1),
            },
            '↑',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'st-icon-btn',
              title: 'Descendre',
              disabled: i === list.length - 1,
              onclick: () => move(i, 1),
            },
            '↓',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'st-icon-btn',
              title: l.visible === false ? 'Afficher' : 'Masquer',
              onclick: () => {
                update(i, { visible: l.visible === false ? undefined : false });
                draw();
              },
            },
            icon(l.visible === false ? 'eyeOff' : 'eye', 16),
          ),
          base
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  class: 'st-icon-btn',
                  title: 'Retirer ce lien',
                  onclick: () => {
                    writeLinks(list.filter((_, j) => j !== i));
                    draw();
                  },
                },
                icon('trash', 15),
              ),
        ),
        h(
          'div',
          { class: 'st-link-bottom' },
          selectControl<string>(l.target, targetOptions, (v) =>
            update(i, { target: v ?? l.target }),
          ),
          toggleControl(Boolean(l.button), (v) => update(i, { button: v || undefined }), 'Bouton'),
        ),
      );
    });

    const addLink = () => {
      const used = new Set(list.map((l) => l.id));
      let n = 1;
      while (used.has(`lien-${n}`)) n++;
      writeLinks([...list, { id: `lien-${n}`, label: 'Nouveau lien', target: 'page:/projets/' }]);
      draw();
    };

    const v = (path: string) => getPath(nav(), path);
    host.replaceChildren(
      h('p', { class: 'st-label' }, 'Liens de l’en-tête'),
      h(
        'p',
        { class: 'st-hint' },
        'Un lien vers une section masquée est masqué lui aussi. « Bouton » : affiché comme « Contact ».',
      ),
      h('ol', { class: 'st-links' }, rows),
      h(
        'div',
        { class: 'st-tools' },
        h(
          'button',
          { type: 'button', class: 'cms-btn is-ghost', onclick: addLink },
          icon('plus', 15),
          'Ajouter un lien',
        ),
        nav().links
          ? h(
              'button',
              {
                type: 'button',
                class: 'cms-btn is-ghost',
                onclick: () => {
                  writeLinks(DEFAULT_LINKS.map(({ labelKey: _k, ...l }) => ({ ...l })));
                  draw();
                },
              },
              icon('refresh', 15),
              'Liens d’origine',
            )
          : null,
      ),
      h('p', { class: 'st-label' }, 'Comportement'),
      row(
        'Défilement vers les sections',
        segmented(
          (v('scroll.behavior') as string) ?? 'smooth',
          [
            { value: 'smooth', label: 'Fluide' },
            { value: 'instant', label: 'Instantané' },
          ],
          (x) => set('scroll.behavior', x === 'smooth' ? undefined : x),
        ),
      ),
      row(
        'Ligne de lecture (section active)',
        rangeControl(
          v('scroll.readingLine') as number | undefined,
          0.35,
          { min: 0.1, max: 0.9, step: 0.05 },
          (x) => set('scroll.readingLine', x),
        ),
        {
          hint: 'Hauteur de l’écran à laquelle une section devient « active » (0,35 = un tiers).',
          customized: v('scroll.readingLine') !== undefined,
          onReset: () => (set('scroll.readingLine', undefined), draw()),
        },
      ),
      row(
        'Lien actif',
        toggleControl(
          v('active.enabled') !== false,
          (x) => set('active.enabled', x ? undefined : false),
          'Mettre en évidence la section en cours',
        ),
      ),
      row(
        'Style du lien actif',
        segmented(
          (v('active.style') as string) ?? 'text',
          [
            { value: 'text', label: 'Texte' },
            { value: 'underline', label: 'Souligné' },
            { value: 'dot', label: 'Point' },
          ],
          (x) => set('active.style', x === 'text' ? undefined : x),
        ),
      ),
      row(
        'Menu mobile numéroté',
        toggleControl(v('mobile.numbered') !== false, (x) =>
          set('mobile.numbered', x ? undefined : false),
        ),
      ),
    );
  }

  draw();
}
