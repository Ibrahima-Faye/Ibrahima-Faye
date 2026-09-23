/**
 * Studio → Thème : couleurs, typographie, interface, effets, identité.
 * Chaque modification s'applique immédiatement dans l'aperçu (CSS en direct), puis s'enregistre seule.
 */
import { api } from '../api';
import { confirmModal, h, icon, toast } from '../ui';
import { COLOR_KEYS, COLORS, FONTS, THEME_DEFAULTS } from '@/lib/studio/theme';
import {
  colorControl,
  getPath,
  group,
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

type Scope = 'all' | DeviceKey;

export function renderThemePanel(host: HTMLElement, state: StudioState, rerender: () => void) {
  const theme = () => state.get('theme');
  const value = (path: string) => getPath(theme(), path);
  const set = (path: string, v: unknown) => state.change('theme', (d) => setPath(d, path, v));
  const has = (path: string) => value(path) !== undefined;
  const reset = (path: string) => () => {
    set(path, undefined);
    rerender();
  };

  /** Curseur simple. */
  const range = (
    label: string,
    path: string,
    fallback: number,
    opts: { min: number; max: number; step: number; unit?: string },
    hint?: string,
  ) =>
    row(
      label,
      rangeControl(value(path) as number | undefined, fallback, opts, (v) => set(path, v)),
      {
        customized: has(path),
        onReset: reset(path),
        hint,
      },
    );

  /** Curseur dont la valeur peut changer selon l'appareil. */
  const scopes = new Map<string, Scope>();
  const responsive = (
    label: string,
    path: string,
    fallback: number,
    opts: { min: number; max: number; step: number; unit?: string },
  ) => {
    const scope = scopes.get(path) ?? (typeof value(path) === 'object' ? 'desktop' : 'all');
    const holder = h('div');
    const draw = () => {
      const s = scopes.get(path) ?? scope;
      holder.replaceChildren(
        rangeControl(scopedValue(value(path), s), fallback, opts, (v) =>
          set(path, withScope(value(path), s, v)),
        ),
      );
    };
    draw();
    return row(label, holder, {
      customized: has(path),
      onReset: reset(path),
      scope: responsiveScope(value(path), scope, (s) => {
        scopes.set(path, s);
        draw();
      }),
    });
  };

  const toggle = (label: string, path: string, fallback: boolean, hint?: string) =>
    row(
      label,
      toggleControl((value(path) as boolean | undefined) ?? fallback, (v) =>
        set(path, v === fallback ? undefined : v),
      ),
      {
        customized: has(path),
        onReset: reset(path),
        hint,
      },
    );

  const seg = <T extends string>(
    label: string,
    path: string,
    fallback: T,
    options: { value: T; label: string }[],
  ) =>
    row(
      label,
      segmented<T>((value(path) as T | undefined) ?? fallback, options, (v) =>
        set(path, v === fallback ? undefined : v),
      ),
      { customized: has(path), onReset: reset(path) },
    );

  /* ---------------------------------------------------------------- couleurs */
  const colors = group(
    'Couleurs',
    COLOR_KEYS.map((key) =>
      row(
        COLORS[key].label,
        colorControl(value(`colors.${key}`) as string | undefined, COLORS[key].value, (v) =>
          set(`colors.${key}`, v),
        ),
        { customized: has(`colors.${key}`), onReset: reset(`colors.${key}`) },
      ),
    ),
    true,
  );

  /* ---------------------------------------------------------------- typographie */
  const fontOptions = FONTS.map((f) => ({ value: f.id, label: f.label }));
  const typography = group('Typographie', [
    row(
      'Police des titres',
      selectControl(
        value('typography.display') as string | undefined,
        [{ value: '', label: 'Syne (origine)' }, ...fontOptions],
        (v) => set('typography.display', v),
      ),
      { customized: has('typography.display'), onReset: reset('typography.display') },
    ),
    row(
      'Police du texte',
      selectControl(
        value('typography.body') as string | undefined,
        [{ value: '', label: 'Manrope (origine)' }, ...fontOptions],
        (v) => set('typography.body', v),
      ),
      { customized: has('typography.body'), onReset: reset('typography.body') },
    ),
    range('Poids des titres', 'typography.headingWeight', THEME_DEFAULTS.headingWeight, {
      min: 300,
      max: 900,
      step: 100,
    }),
    range('Poids du texte', 'typography.bodyWeight', THEME_DEFAULTS.bodyWeight, {
      min: 300,
      max: 700,
      step: 100,
    }),
    responsive('Taille du texte', 'typography.baseSize', THEME_DEFAULTS.baseSize, {
      min: 12,
      max: 22,
      step: 0.5,
      unit: 'px',
    }),
    range('Interligne', 'typography.lineHeight', THEME_DEFAULTS.lineHeight, {
      min: 1.1,
      max: 2.2,
      step: 0.05,
    }),
    range('Espacement des titres', 'typography.headingTracking', THEME_DEFAULTS.headingTracking, {
      min: -0.08,
      max: 0.12,
      step: 0.005,
      unit: 'em',
    }),
    range('Espacement du texte', 'typography.bodyTracking', THEME_DEFAULTS.bodyTracking, {
      min: -0.05,
      max: 0.1,
      step: 0.005,
      unit: 'em',
    }),
    responsive('Échelle des titres', 'typography.scale', THEME_DEFAULTS.scale, {
      min: 0.6,
      max: 1.5,
      step: 0.02,
      unit: '×',
    }),
  ]);

  /* ---------------------------------------------------------------- interface */
  const radiusOptions = [
    { value: '999', label: 'Pilule' },
    { value: '24', label: '24 px' },
    { value: '16', label: '16 px' },
    { value: '10', label: '10 px' },
    { value: '6', label: '6 px' },
    { value: '0', label: 'Carré' },
  ];
  const ui = group('Interface', [
    range('Arrondi des médias', 'ui.radius', THEME_DEFAULTS.radius, {
      min: 0,
      max: 2.5,
      step: 0.05,
      unit: 'rem',
    }),
    row(
      'Arrondi des boutons',
      selectControl(
        value('ui.buttonRadius') === undefined ? undefined : String(value('ui.buttonRadius')),
        [{ value: '', label: 'Pilule (origine)' }, ...radiusOptions.slice(1)],
        (v) => set('ui.buttonRadius', v === undefined ? undefined : Number(v)),
      ),
      { customized: has('ui.buttonRadius'), onReset: reset('ui.buttonRadius') },
    ),
    seg('Taille des boutons', 'ui.buttonSize', 'md', [
      { value: 'sm', label: 'Petits' },
      { value: 'md', label: 'Moyens' },
      { value: 'lg', label: 'Grands' },
    ]),
    seg('Style des boutons', 'ui.buttonStyle', 'gradient', [
      { value: 'gradient', label: 'Dégradé' },
      { value: 'solid', label: 'Plein' },
      { value: 'outline', label: 'Contour' },
    ]),
    range('Largeur max. du contenu', 'ui.containerMax', THEME_DEFAULTS.containerMax, {
      min: 56,
      max: 130,
      step: 1,
      unit: 'rem',
    }),
    responsive('Marges latérales', 'ui.containerPad', THEME_DEFAULTS.containerPad, {
      min: 0.5,
      max: 8,
      step: 0.25,
      unit: 'rem',
    }),
    responsive('Espacement des sections', 'ui.sectionSpace', THEME_DEFAULTS.sectionSpace, {
      min: 0.3,
      max: 2,
      step: 0.05,
      unit: '×',
    }),
    responsive('Hauteur de l’en-tête', 'ui.headerHeight', THEME_DEFAULTS.headerHeight, {
      min: 3,
      max: 8,
      step: 0.25,
      unit: 'rem',
    }),
    seg('Fond de l’en-tête', 'ui.headerStyle', 'auto', [
      { value: 'auto', label: 'Au défilement' },
      { value: 'solid', label: 'Toujours' },
      { value: 'transparent', label: 'Jamais' },
    ]),
    range('Espace entre les liens', 'ui.navGap', THEME_DEFAULTS.navGap, {
      min: 0.75,
      max: 5,
      step: 0.25,
      unit: 'rem',
    }),
    toggle('Halo du pied de page', 'ui.footerGlow', true),
  ]);

  /* ---------------------------------------------------------------- effets */
  const effects = group('Effets', [
    toggle(
      'Glassmorphism',
      'effects.glass',
      true,
      'Flou d’arrière-plan des éléments translucides (en-tête, boutons secondaires…).',
    ),
    range('Intensité du flou', 'effects.glassBlur', THEME_DEFAULTS.glassBlur, {
      min: 0,
      max: 40,
      step: 1,
      unit: 'px',
    }),
    range('Grain', 'effects.grain', THEME_DEFAULTS.grain, { min: 0, max: 0.2, step: 0.005 }),
    seg('Ombres', 'effects.shadows', 'soft', [
      { value: 'off', label: 'Aucune' },
      { value: 'soft', label: 'Douces' },
      { value: 'strong', label: 'Fortes' },
    ]),
    range('Halos lumineux (glow)', 'effects.glow', THEME_DEFAULTS.glow, {
      min: 0,
      max: 2,
      step: 0.05,
      unit: '×',
    }),
    toggle(
      'Dégradés',
      'effects.gradients',
      true,
      'Texte et boutons en dégradé ; désactivé : couleurs pleines.',
    ),
    toggle('Grille de fond', 'effects.grid', false),
    has('effects.grid')
      ? range('Opacité de la grille', 'effects.gridOpacity', THEME_DEFAULTS.gridOpacity, {
          min: 0.01,
          max: 0.3,
          step: 0.01,
        })
      : null,
    toggle('Particules (champ 3D du Hero)', 'effects.particles', true),
    seg('Curseur', 'effects.cursor', 'default', [
      { value: 'default', label: 'Normal' },
      { value: 'dot', label: 'Point' },
      { value: 'ring', label: 'Anneau' },
    ]),
    toggle('Défilement fluide', 'effects.smoothScroll', true),
  ]);

  /* ---------------------------------------------------------------- identité */
  const upload = (path: string, label: string) => {
    const input = h('input', {
      type: 'file',
      accept: '.svg,.png,.webp,.jpg,.jpeg,.ico',
      hidden: true,
    });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { path: url } = await api.uploadIdentity(file);
        set(path, url);
        rerender();
        toast(`${label} importé.`);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Envoi impossible.', 'error');
      }
    });
    const current = value(path) as string | undefined;
    return row(
      label,
      h(
        'div',
        { class: 'st-upload' },
        current
          ? h('img', { src: current, alt: '', class: 'st-upload-img' })
          : h('span', { class: 'st-muted' }, 'Origine'),
        h(
          'button',
          { type: 'button', class: 'cms-btn is-ghost', onclick: () => input.click() },
          icon('upload', 15),
          'Choisir…',
        ),
        input,
      ),
      { customized: Boolean(current), onReset: reset(path) },
    );
  };
  const text = (label: string, path: string, placeholder: string, hint?: string) =>
    row(
      label,
      textControl(value(path) as string | undefined, placeholder, (v) => set(path, v)),
      {
        customized: has(path),
        onReset: reset(path),
        hint,
      },
    );
  const identity = group('Logo / identité', [
    text(
      'Nom affiché',
      'identity.name',
      'Ibrahima Faye',
      'En-tête, Hero, pied de page, référencement.',
    ),
    text('Symbole (monogramme)', 'identity.initials', 'IF'),
    text(
      'Slogan',
      'identity.tagline',
      'Créateur technologique',
      'Pied de page et référencement. Rechargement de l’aperçu à l’enregistrement.',
    ),
    upload('identity.logo', 'Logo principal'),
    upload('identity.favicon', 'Favicon'),
  ]);

  /* ---------------------------------------------------------------- import / export */
  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(theme(), null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'theme-clicgraph.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error();
      state.replace('theme', { version: 1, ...data });
      rerender();
      toast('Thème importé (annulable avec Ctrl+Z).');
    } catch {
      toast('Fichier de thème illisible.', 'error');
    }
  });
  const tools = h(
    'div',
    { class: 'st-tools' },
    h(
      'button',
      { type: 'button', class: 'cms-btn is-ghost', onclick: exportTheme },
      icon('external', 15),
      'Exporter',
    ),
    h(
      'button',
      { type: 'button', class: 'cms-btn is-ghost', onclick: () => importInput.click() },
      icon('upload', 15),
      'Importer',
    ),
    importInput,
    h(
      'button',
      {
        type: 'button',
        class: 'cms-btn is-ghost',
        onclick: async () => {
          const ok = await confirmModal({
            title: 'Revenir au thème d’origine ?',
            body: 'Tous les réglages du thème sont retirés (annulable avec Ctrl+Z ; l’ancienne version est aussi gardée dans l’historique).',
            confirm: 'Réinitialiser',
            danger: true,
          });
          if (!ok) return;
          state.replace('theme', { version: 1 });
          rerender();
        },
      },
      icon('refresh', 15),
      'Origine',
    ),
  );

  host.replaceChildren(tools, colors, typography, ui, effects, identity);
}
