/**
 * Studio → Animations : style global, liste des éléments animables (groupés par section),
 * et réglage de l'élément choisi (effet, déclencheur, durée… et valeurs par appareil).
 * Chaque changement rejoue l'animation dans l'aperçu ; « Animation d'origine » retire le réglage.
 */
import { h, icon } from '../ui';
import {
  ANIM_TARGETS,
  ANIMATIONS,
  ANIMATION_DEFAULTS,
  BASE_PARAMS,
  CATEGORY_LABELS,
  EASES,
  STYLE_PRESETS,
  TRIGGER_LABELS,
  animationById,
  presetById,
  suggestedAnimations,
  targetById,
  type AnimParams,
  type AnimationSetting,
  type AnimationsSettings,
  type ParamKey,
} from '@/lib/studio/animations';
import {
  DEVICE_LABELS,
  rangeControl,
  row,
  segmented,
  selectControl,
  toggleControl,
  type DeviceKey,
} from './controls';
import type { StudioState } from './state';

const PARAM_UI: Record<
  ParamKey | 'start',
  { label: string; min: number; max: number; step: number; unit?: string }
> = {
  duration: { label: 'Durée', min: 0, max: 4, step: 0.05, unit: 's' },
  delay: { label: 'Délai', min: 0, max: 3, step: 0.05, unit: 's' },
  ease: { label: 'Courbe (easing)', min: 0, max: 0, step: 0 },
  direction: { label: 'Direction', min: 0, max: 0, step: 0 },
  distance: { label: 'Distance', min: 0, max: 400, step: 2, unit: 'px' },
  scale: { label: 'Échelle', min: 0, max: 2, step: 0.01, unit: '×' },
  opacity: { label: 'Opacité de départ', min: 0, max: 1, step: 0.01 },
  blur: { label: 'Flou', min: 0, max: 40, step: 1, unit: 'px' },
  rotation: { label: 'Rotation', min: -45, max: 45, step: 1, unit: '°' },
  intensity: { label: 'Intensité', min: 0, max: 2, step: 0.05 },
  speed: { label: 'Vitesse', min: -3, max: 3, step: 0.05, unit: '×' },
  stagger: { label: 'Décalage (stagger)', min: 0, max: 0.6, step: 0.01, unit: 's' },
  start: { label: 'Déclenchement (position à l’écran)', min: 10, max: 100, step: 1, unit: '%' },
};

export interface AnimationsPanel {
  select(id: string | null): void;
  selected(): string | null;
}

export function renderAnimationsPanel(
  host: HTMLElement,
  state: StudioState,
  options: {
    rerender: () => void;
    replay: (id: string) => void;
    initial: string | null;
    onSelect: (id: string | null) => void;
  },
): AnimationsPanel {
  const config = () => state.get<AnimationsSettings>('animations');
  let current = options.initial;
  let scope: 'all' | DeviceKey = 'all';

  const change = (mutate: (c: AnimationsSettings) => void, replayId?: string) => {
    state.change('animations', (d) => mutate(d as AnimationsSettings));
    if (replayId) options.replay(replayId);
  };

  function draw() {
    host.replaceChildren(current ? inspector(current) : overview());
  }

  /* ---------------------------------------------------------------- vue d'ensemble */
  function overview() {
    const c = config();
    const enabled = c.enabled !== false;
    const presets = h(
      'div',
      { class: 'st-presets' },
      [
        { id: '', label: 'Origine', description: 'Réglages de base (proches de Cinematic).' },
        ...STYLE_PRESETS,
      ].map((p) =>
        h(
          'button',
          {
            type: 'button',
            class: `st-preset${(c.preset ?? '') === p.id ? ' is-on' : ''}`,
            onclick: () => {
              change((d) => {
                if (p.id) d.preset = p.id;
                else delete d.preset;
              });
              draw();
              const first = Object.keys(config().targets ?? {})[0];
              if (first) options.replay(first);
            },
          },
          h('strong', null, p.label),
          h('small', null, p.description),
        ),
      ),
    );

    const groups = new Map<string, (typeof ANIM_TARGETS)[number][]>();
    for (const t of ANIM_TARGETS) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
    const list = [...groups].map(([name, targets]) =>
      h(
        'div',
        { class: 'st-tgroup' },
        h('p', { class: 'st-tgroup-title' }, name),
        targets.map((t) => {
          const s = c.targets?.[t.id];
          const def = animationById(s?.animation);
          return h(
            'button',
            {
              type: 'button',
              class: `st-target${s ? ' is-set' : ''}${s?.enabled === false ? ' is-off' : ''}`,
              onclick: () => open(t.id),
            },
            h('span', null, t.label),
            h(
              'small',
              null,
              s ? (s.enabled === false ? 'Désactivée' : (def?.label ?? s.animation)) : t.origin,
            ),
          );
        }),
      ),
    );

    return h(
      'div',
      null,
      row(
        'Animations du site',
        toggleControl(
          enabled,
          (v) => {
            change((d) => {
              if (v) delete d.enabled;
              else d.enabled = false;
            });
            draw();
          },
          enabled ? 'Activées' : 'Toutes désactivées (contenu affiché sans mouvement)',
        ),
      ),
      h('p', { class: 'st-label' }, 'Style prêt à l’emploi (éléments réglés dans le Studio)'),
      presets,
      h(
        'p',
        { class: 'st-hint' },
        'Choisis un élément ci-dessous, ou clique « Sélectionner » puis un élément dans l’aperçu. Un élément sans réglage garde son animation d’origine.',
      ),
      list,
    );
  }

  function open(id: string | null) {
    current = id;
    scope = 'all';
    options.onSelect(id);
    draw();
    if (id) options.replay(id);
  }

  /* ---------------------------------------------------------------- réglage d'un élément */
  function inspector(id: string) {
    const target = targetById(id);
    const c = config();
    const setting = c.targets?.[id];
    const device = scope === 'all' ? null : scope;
    const deviceSetting = device ? setting?.devices?.[device] : undefined;
    const effective = (device && deviceSetting?.animation) || setting?.animation;
    const def = animationById(effective);

    const writeTarget = (mutate: (s: AnimationSetting) => void) =>
      change((d) => {
        d.targets ??= {};
        const s = d.targets[id];
        if (!s) return;
        mutate(s);
      }, id);

    /** Valeur affichée : réglage de l'appareil, sinon de l'élément, sinon valeur par défaut de l'effet / du style. */
    const shown = (key: keyof AnimParams): unknown => {
      const own = device
        ? (deviceSetting as Record<string, unknown> | undefined)?.[key]
        : undefined;
      if (own !== undefined) return own;
      const base = (setting as Record<string, unknown> | undefined)?.[key];
      if (base !== undefined) return base;
      const style = presetById(setting?.preset ?? c.preset)?.values ?? {};
      return (
        (ANIMATION_DEFAULTS[def?.id ?? ''] as Record<string, unknown> | undefined)?.[key] ??
        (style as Record<string, unknown>)[key] ??
        BASE_PARAMS[key]
      );
    };
    const isSet = (key: keyof AnimParams) =>
      device
        ? (deviceSetting as Record<string, unknown> | undefined)?.[key] !== undefined
        : (setting as Record<string, unknown> | undefined)?.[key] !== undefined;
    const setParam = (key: keyof AnimParams, v: unknown) =>
      writeTarget((s) => {
        const holder = (device ? ((s.devices ??= {})[device] ??= {}) : s) as Record<
          string,
          unknown
        >;
        if (v === undefined) delete holder[key];
        else holder[key] = v;
        if (device && s.devices?.[device] && !Object.keys(s.devices[device]!).length)
          delete s.devices[device];
        if (s.devices && !Object.keys(s.devices).length) delete s.devices;
      });
    const resetParam = (key: keyof AnimParams) => () => {
      setParam(key, undefined);
      draw();
    };

    // choix de l'effet
    const suggested = target ? suggestedAnimations(target.kind) : [];
    const effectOptions = [
      {
        value: '' as string,
        label: device ? '— Comme sur tous les appareils —' : '— Animation d’origine —',
      },
      ...suggested.map((a) => ({
        value: a,
        label: animationById(a)?.label ?? a,
        group: 'Suggérées',
      })),
      ...ANIMATIONS.filter((a) => !suggested.includes(a.id)).map((a) => ({
        value: a.id,
        label: a.label,
        group: CATEGORY_LABELS[a.category],
      })),
    ];
    const effect = selectControl<string>(
      device ? deviceSetting?.animation : setting?.animation,
      effectOptions,
      (v) => {
        if (device) {
          if (!setting) return;
          setParam('animation' as keyof AnimParams, v);
        } else
          change((d) => {
            d.targets ??= {};
            if (!v) delete d.targets[id];
            else d.targets[id] = { ...(d.targets[id] ?? {}), animation: v };
            if (!Object.keys(d.targets).length) delete d.targets;
          }, id);
        draw();
      },
    );

    const header = h(
      'div',
      { class: 'st-insp-head' },
      h(
        'button',
        { type: 'button', class: 'cms-btn is-ghost', onclick: () => open(null) },
        icon('arrowLeft', 15),
        'Éléments',
      ),
      h(
        'div',
        null,
        h('p', { class: 'st-insp-group' }, target?.group ?? ''),
        h('h3', null, target?.label ?? id),
      ),
    );

    const body: (HTMLElement | null)[] = [
      h('p', { class: 'st-hint' }, `Origine : ${target?.origin ?? '—'}`),
      row(
        'Appareil',
        segmented<'all' | DeviceKey>(
          scope,
          [
            { value: 'all', label: 'Tous' },
            { value: 'desktop', label: DEVICE_LABELS.desktop },
            { value: 'tablet', label: DEVICE_LABELS.tablet },
            { value: 'mobile', label: DEVICE_LABELS.mobile },
          ],
          (s) => {
            scope = s;
            draw();
          },
        ),
        {
          hint: device
            ? `Les valeurs réglées ici ne concernent que : ${DEVICE_LABELS[device]}.`
            : undefined,
        },
      ),
      row('Animation', effect),
    ];

    if (setting) {
      body.push(
        row(
          device ? `Active sur ${DEVICE_LABELS[device].toLowerCase()}` : 'Active',
          toggleControl(
            device ? deviceSetting?.enabled !== false : setting.enabled !== false,
            (v) => {
              if (device)
                writeTarget((s) => {
                  const d = ((s.devices ??= {})[device] ??= {});
                  if (v) delete d.enabled;
                  else d.enabled = false;
                });
              else
                writeTarget((s) => {
                  if (v) delete s.enabled;
                  else s.enabled = false;
                });
              draw();
            },
          ),
        ),
      );
      if (def) {
        if (!device) {
          body.push(
            row(
              'Déclencheur',
              selectControl<string>(
                setting.trigger,
                [
                  { value: '', label: `${TRIGGER_LABELS[def.trigger]} (par défaut)` },
                  ...def.triggers
                    .filter((t) => t !== def.trigger)
                    .map((t) => ({ value: t, label: TRIGGER_LABELS[t] })),
                ],
                (v) =>
                  writeTarget((s) =>
                    v ? (s.trigger = v as AnimationSetting['trigger']) : delete s.trigger,
                  ),
              ),
            ),
            row(
              'Style',
              selectControl<string>(
                setting.preset,
                [
                  { value: '', label: 'Celui du site' },
                  ...STYLE_PRESETS.map((p) => ({ value: p.id, label: p.label })),
                ],
                (v) => {
                  writeTarget((s) => (v ? (s.preset = v) : delete s.preset));
                  draw();
                },
              ),
            ),
          );
        }
        for (const key of def.params) {
          if (key === 'ease') {
            body.push(
              row(
                'Courbe (easing)',
                selectControl<string>(
                  isSet('ease') ? String(shown('ease')) : undefined,
                  [
                    { value: '', label: `${String(shown('ease'))} (par défaut)` },
                    ...EASES.map((e) => ({ value: e.id, label: e.label })),
                  ],
                  (v) => setParam('ease', v),
                ),
                {
                  customized: isSet('ease'),
                  onReset: resetParam('ease'),
                },
              ),
            );
          } else if (key === 'direction') {
            body.push(
              row(
                'Direction',
                segmented(
                  String(shown('direction')),
                  [
                    { value: 'up', label: '↑' },
                    { value: 'down', label: '↓' },
                    { value: 'left', label: '←' },
                    { value: 'right', label: '→' },
                  ],
                  (v) => setParam('direction', v),
                ),
                { customized: isSet('direction'), onReset: resetParam('direction') },
              ),
            );
          } else {
            const ui = PARAM_UI[key];
            body.push(
              row(
                ui.label,
                rangeControl(Number(shown(key)), Number(shown(key)), ui, (v) => setParam(key, v)),
                {
                  customized: isSet(key),
                  onReset: resetParam(key),
                },
              ),
            );
          }
        }
        const trigger = setting.trigger ?? def.trigger;
        if (trigger === 'scroll') {
          const ui = PARAM_UI.start;
          body.push(
            row(
              ui.label,
              rangeControl(Number(shown('start')), Number(shown('start')), ui, (v) =>
                setParam('start', v),
              ),
              {
                customized: isSet('start'),
                onReset: resetParam('start'),
                hint: '100 % = dès que l’élément entre par le bas de l’écran.',
              },
            ),
            row(
              'Répétition',
              toggleControl(
                Boolean(shown('repeat')),
                (v) => setParam('repeat', v || undefined),
                'Rejouer à chaque passage',
              ),
              {
                customized: isSet('repeat'),
                onReset: resetParam('repeat'),
              },
            ),
          );
        }
      }
      body.push(
        h(
          'div',
          { class: 'st-tools' },
          h(
            'button',
            { type: 'button', class: 'cms-btn is-primary', onclick: () => options.replay(id) },
            icon('play', 15),
            'Rejouer',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'cms-btn is-ghost',
              onclick: () => {
                change((d) => {
                  delete d.targets?.[id];
                  if (d.targets && !Object.keys(d.targets).length) delete d.targets;
                }, id);
                draw();
              },
            },
            icon('refresh', 15),
            'Animation d’origine',
          ),
        ),
      );
    } else {
      body.push(
        h(
          'p',
          { class: 'st-hint' },
          'Choisis une animation pour remplacer celle d’origine sur cet élément.',
        ),
      );
    }

    return h('div', { class: 'st-inspector' }, header, body);
  }

  draw();
  return {
    select: (id) => open(id),
    selected: () => current,
  };
}
