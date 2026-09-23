/**
 * Studio → Sections : ordre, visibilité, ancre, textes, animation, fond, hauteur, espacement, effets.
 * Les textes laissés vides gardent ceux du site (src/i18n/ui/fr.ts), affichés en gris.
 * Enregistrement automatique ; l'aperçu se recharge à la bonne position.
 */
import { h, icon } from '../ui';
import {
  HEIGHTS,
  SECTIONS,
  isAnchorValid,
  sectionOrder,
  type LayoutSettings,
  type SectionKey,
  type SectionSettings,
} from '@/lib/studio/layout';
import { ANIMATIONS, suggestedAnimations, type AnimationsSettings } from '@/lib/studio/animations';
import {
  colorControl,
  getPath,
  rangeControl,
  responsiveScope,
  row,
  scopedValue,
  segmented,
  selectControl,
  setPath,
  textControl,
  toggleControl,
  withScope,
  type DeviceKey,
} from './controls';
import type { StudioState } from './state';

export function renderSectionsPanel(
  host: HTMLElement,
  state: StudioState,
  options: {
    texts: Record<string, string | string[]>;
    initial: string | null;
    onFocus: (key: string) => void;
  },
) {
  const layout = () => state.get<LayoutSettings>('layout');
  let current: string | null = options.initial;
  let spacingScope: 'all' | DeviceKey = 'all';

  const setSection = (key: string, path: string, v: unknown) =>
    state.change('layout', (d) => setPath(d, `sections.${key}.${path}`, v));
  const own = (key: string): SectionSettings =>
    (layout().sections as Record<string, SectionSettings> | undefined)?.[key] ?? {};

  function draw() {
    host.replaceChildren(current ? editor(current) : list());
  }

  /* ---------------------------------------------------------------- liste ordonnée */
  function list() {
    const order = sectionOrder(layout());
    const move = (key: SectionKey, delta: number) => {
      const next = [...order];
      const i = next.indexOf(key);
      const j = i + delta;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j]!, next[i]!];
      state.change('layout', (d) => (d.order = next));
      draw();
    };
    const item = (key: SectionKey | 'footer', index: number) => {
      const def = SECTIONS.find((s) => s.key === key)!;
      const visible = own(key).visible !== false;
      return h(
        'li',
        { class: `st-sec${visible ? '' : ' is-hidden'}` },
        h(
          'span',
          { class: 'st-sec-num' },
          key === 'footer' ? '—' : String(index + 1).padStart(2, '0'),
        ),
        h(
          'button',
          { type: 'button', class: 'st-sec-name', onclick: () => open(key) },
          def.label,
          h(
            'small',
            null,
            own(key).anchor || def.anchor ? `#${own(key).anchor || def.anchor}` : '',
          ),
        ),
        key === 'footer'
          ? null
          : h(
              'span',
              { class: 'st-sec-move' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'st-icon-btn',
                  title: 'Monter',
                  disabled: index === 0,
                  onclick: () => move(key, -1),
                },
                '↑',
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'st-icon-btn',
                  title: 'Descendre',
                  disabled: index === order.length - 1,
                  onclick: () => move(key, 1),
                },
                '↓',
              ),
            ),
        h(
          'button',
          {
            type: 'button',
            class: 'st-icon-btn',
            title: visible ? 'Masquer la section' : 'Afficher la section',
            onclick: () => {
              setSection(key, 'visible', visible ? false : undefined);
              draw();
            },
          },
          icon(visible ? 'eye' : 'eyeOff', 16),
        ),
      );
    };
    return h(
      'div',
      null,
      h(
        'p',
        { class: 'st-hint' },
        'Ordre de la page d’accueil. Une section masquée n’est pas supprimée : elle réapparaît dès qu’on la réaffiche.',
      ),
      h(
        'ol',
        { class: 'st-sections' },
        order.map((key, i) => item(key, i)),
        item('footer', order.length),
      ),
    );
  }

  function open(key: string | null) {
    current = key;
    spacingScope = 'all';
    draw();
    if (key) options.onFocus(key);
  }

  /* ---------------------------------------------------------------- réglages d'une section */
  function editor(key: string) {
    const def = SECTIONS.find((s) => s.key === key)!;
    const s = own(key);
    const content = (layout().content ?? {}) as Record<string, string | string[]>;
    const setContent = (path: string, v: string | string[] | undefined) =>
      state.change('layout', (d) => {
        d.content ??= {};
        const c = d.content as Record<string, unknown>;
        if (v === undefined || (Array.isArray(v) && !v.length)) delete c[path];
        else c[path] = v;
        if (!Object.keys(c).length) delete d.content;
      });

    const fields = def.fields.map((f) => {
      const fallback = options.texts[f.path];
      const value = content[f.path];
      if (f.type === 'lines' || f.type === 'paragraphs') {
        const sep = f.type === 'lines' ? '\n' : '\n\n';
        const control = textControl(
          Array.isArray(value) ? value.join(sep) : undefined,
          Array.isArray(fallback) ? fallback.join(sep) : String(fallback ?? ''),
          (v) =>
            setContent(
              f.path,
              v === undefined
                ? undefined
                : v
                    .split(f.type === 'lines' ? /\n/ : /\n\s*\n/)
                    .map((x) => x.trim())
                    .filter(Boolean),
            ),
          true,
        );
        return row(f.label, control, {
          customized: value !== undefined,
          onReset: () => (setContent(f.path, undefined), draw()),
        });
      }
      return row(
        f.label,
        textControl(
          typeof value === 'string' ? value : undefined,
          String(fallback ?? ''),
          (v) => setContent(f.path, v),
          f.type === 'textarea',
        ),
        { customized: value !== undefined, onReset: () => (setContent(f.path, undefined), draw()) },
      );
    });

    // ancre
    const anchorInput = textControl(s.anchor, def.anchor || '(aucune)', (v) => {
      const clean = v?.trim().toLowerCase();
      anchorInput.classList.toggle('is-invalid', Boolean(clean && !isAnchorValid(clean)));
      if (!clean || isAnchorValid(clean)) setSection(key, 'anchor', clean || undefined);
    });

    // animation de la section (raccourci vers le Studio d'animations)
    const animId = `${key}.section`;
    const anims = state.get<AnimationsSettings>('animations');
    const animation =
      key === 'marquee' || key === 'footer'
        ? null
        : row(
            'Animation de la section',
            selectControl<string>(
              anims.targets?.[animId]?.animation,
              [
                { value: '', label: '— Animation d’origine —' },
                ...suggestedAnimations('section').map((a) => ({
                  value: a,
                  label: ANIMATIONS.find((x) => x.id === a)?.label ?? a,
                })),
              ],
              (v) =>
                state.change('animations', (d) => {
                  const a = d as AnimationsSettings;
                  a.targets ??= {};
                  if (!v) delete a.targets[animId];
                  else a.targets[animId] = { ...(a.targets[animId] ?? {}), animation: v };
                  if (!Object.keys(a.targets).length) delete a.targets;
                }),
            ),
            { hint: 'Réglages détaillés : onglet Animations.' },
          );

    // fond
    const bg = s.background ?? {};
    const mode = bg.mode ?? 'default';
    const background = [
      row(
        'Fond',
        segmented(
          mode,
          [
            { value: 'default', label: 'Origine' },
            { value: 'none', label: 'Aucun' },
            { value: 'color', label: 'Couleur' },
            { value: 'gradient', label: 'Dégradé' },
          ],
          (v) => {
            setSection(
              key,
              'background',
              v === 'default' ? undefined : { ...bg, mode: v, color: bg.color ?? '#0b1233' },
            );
            draw();
          },
        ),
      ),
      mode === 'color' || mode === 'gradient'
        ? row(
            'Couleur',
            colorControl(bg.color, '#0b1233', (v) => setSection(key, 'background.color', v)),
          )
        : null,
      mode === 'gradient'
        ? row(
            'Seconde couleur',
            colorControl(bg.color2, '#04050d', (v) => setSection(key, 'background.color2', v)),
          )
        : null,
      mode === 'gradient'
        ? row(
            'Angle',
            rangeControl(bg.angle, 180, { min: 0, max: 360, step: 5, unit: '°' }, (v) =>
              setSection(key, 'background.angle', v),
            ),
          )
        : null,
    ];

    const spacingHolder = h('div');
    const drawSpacing = () =>
      spacingHolder.replaceChildren(
        rangeControl(
          scopedValue(getPath(layout(), `sections.${key}.spacing`), spacingScope),
          1,
          { min: 0.2, max: 2.5, step: 0.05, unit: '×' },
          (v) =>
            setSection(
              key,
              'spacing',
              withScope(getPath(layout(), `sections.${key}.spacing`), spacingScope, v),
            ),
        ),
      );
    drawSpacing();

    const heightOptions = (Object.keys(HEIGHTS) as (keyof typeof HEIGHTS)[]).map((k) => ({
      value: k,
      label: HEIGHTS[k].label,
    }));

    return h(
      'div',
      { class: 'st-inspector' },
      h(
        'div',
        { class: 'st-insp-head' },
        h(
          'button',
          { type: 'button', class: 'cms-btn is-ghost', onclick: () => open(null) },
          icon('arrowLeft', 15),
          'Sections',
        ),
        h('div', null, h('p', { class: 'st-insp-group' }, 'Section'), h('h3', null, def.label)),
      ),
      row(
        'Visible',
        toggleControl(s.visible !== false, (v) =>
          setSection(key, 'visible', v ? undefined : false),
        ),
      ),
      key === 'marquee' || key === 'footer'
        ? null
        : row('Ancre (ID)', anchorInput, {
            customized: Boolean(s.anchor),
            onReset: () => (setSection(key, 'anchor', undefined), draw()),
            hint: 'Minuscules, chiffres et tirets. La navigation suit automatiquement.',
          }),
      fields.length ? h('p', { class: 'st-label' }, 'Contenu') : null,
      fields,
      animation,
      h('p', { class: 'st-label' }, 'Apparence'),
      background,
      key === 'footer'
        ? row(
            'Grand mot-symbole',
            toggleControl(s.wordmark !== false, (v) =>
              setSection(key, 'wordmark', v ? undefined : false),
            ),
          )
        : row(
            'Hauteur',
            selectControl<string>(
              s.height,
              heightOptions.map((o) => ({ ...o, value: o.value === 'auto' ? '' : o.value })),
              (v) => setSection(key, 'height', v),
            ),
          ),
      key === 'footer' || key === 'hero' || key === 'marquee'
        ? null
        : row('Espacement vertical', spacingHolder, {
            customized: s.spacing !== undefined,
            onReset: () => (setSection(key, 'spacing', undefined), draw()),
            scope: responsiveScope(s.spacing, spacingScope, (sc) => {
              spacingScope = sc;
              drawSpacing();
            }),
          }),
      def.effects
        ? row(
            'Effets décoratifs',
            toggleControl(s.effects !== false, (v) =>
              setSection(key, 'effects', v ? undefined : false),
            ),
            {
              hint: 'Halos, dégradés, champ 3D de la section.',
            },
          )
        : null,
    );
  }

  draw();
  return { select: (key: string | null) => open(key), selected: () => current };
}
