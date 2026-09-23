/**
 * Theme Editor — réglages du thème (src/settings/theme.json) → CSS.
 *
 * Principe : les jetons du site (src/styles/global.css, `@theme static`) restent la référence.
 * `themeToCss` ne produit QUE les valeurs réglées : un thème vide = le site tel qu'il est.
 * Utilisé au rendu (BaseLayout) ET par l'aperçu instantané de l'administration : une seule source.
 */

export type DeviceKey = 'desktop' | 'tablet' | 'mobile';
/** Une valeur, ou des valeurs différentes selon l'appareil. */
export type Responsive<T> = T | Partial<Record<DeviceKey, T>>;

export interface ThemeSettings {
  colors?: Partial<Record<ColorKey, string>>;
  typography?: {
    display?: string;
    body?: string;
    headingWeight?: number;
    bodyWeight?: number;
    baseSize?: Responsive<number>;
    lineHeight?: number;
    headingTracking?: number;
    bodyTracking?: number;
    scale?: Responsive<number>;
  };
  ui?: {
    radius?: number;
    buttonRadius?: number;
    buttonSize?: 'sm' | 'md' | 'lg';
    buttonStyle?: 'gradient' | 'solid' | 'outline';
    containerMax?: number;
    containerPad?: Responsive<number>;
    sectionSpace?: Responsive<number>;
    headerHeight?: Responsive<number>;
    headerStyle?: 'auto' | 'solid' | 'transparent';
    navGap?: number;
    footerGlow?: boolean;
  };
  effects?: {
    glass?: boolean;
    glassBlur?: number;
    grain?: number;
    shadows?: 'off' | 'soft' | 'strong';
    glow?: number;
    gradients?: boolean;
    grid?: boolean;
    gridOpacity?: number;
    particles?: boolean;
    cursor?: 'default' | 'dot' | 'ring';
    smoothScroll?: boolean;
  };
  identity?: {
    name?: string;
    initials?: string;
    tagline?: string;
    logo?: string;
    favicon?: string;
  };
}

export const COLOR_KEYS = [
  'bg',
  'bg2',
  'surface',
  'glass',
  'text',
  'textMuted',
  'accent',
  'accent2',
  'border',
  'success',
  'warning',
  'error',
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

/** Libellé + valeur actuelle du site (affichée tant que rien n'est réglé). */
export const COLORS: Record<ColorKey, { label: string; value: string }> = {
  bg: { label: 'Background principal', value: '#04050d' },
  bg2: { label: 'Background secondaire', value: '#0b1233' },
  surface: { label: 'Surface', value: '#070b1e' },
  glass: { label: 'Surface glass', value: 'rgba(11, 18, 51, 0.35)' },
  text: { label: 'Texte principal', value: '#f3f0f8' },
  textMuted: { label: 'Texte secondaire', value: '#b4b1cc' },
  accent: { label: 'Accent', value: '#7b4dff' },
  accent2: { label: 'Accent secondaire', value: '#b58cff' },
  border: { label: 'Bordures', value: 'rgba(200, 169, 255, 0.2)' },
  success: { label: 'Succès', value: '#ece6ff' },
  warning: { label: 'Avertissement', value: '#f0b450' },
  error: { label: 'Erreur', value: '#ff6b8a' },
};

/** Polices installées dans le projet (aucun chargement externe). */
export const FONTS = [
  {
    id: 'syne',
    label: 'Syne',
    stack: "'Syne Variable', 'Manrope Variable', system-ui, sans-serif",
  },
  {
    id: 'manrope',
    label: 'Manrope',
    stack: "'Manrope Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    stack: "'Space Grotesk Variable', system-ui, sans-serif",
  },
  { id: 'unbounded', label: 'Unbounded', stack: "'Unbounded Variable', system-ui, sans-serif" },
  { id: 'inter', label: 'Inter', stack: "'Inter Variable', system-ui, sans-serif" },
  { id: 'fraunces', label: 'Fraunces (serif)', stack: "'Fraunces Variable', Georgia, serif" },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack: "'JetBrains Mono Variable', ui-monospace, monospace",
  },
  { id: 'system', label: 'Système', stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
] as const;

export const THEME_DEFAULTS = {
  display: 'syne',
  body: 'manrope',
  headingWeight: 700,
  bodyWeight: 400,
  baseSize: 16,
  lineHeight: 1.65,
  headingTracking: -0.02,
  bodyTracking: 0,
  scale: 1,
  radius: 0.5,
  buttonRadius: 999,
  buttonSize: 'md',
  buttonStyle: 'gradient',
  containerMax: 96,
  containerPad: 4,
  sectionSpace: 1,
  headerHeight: 4.5,
  headerStyle: 'auto',
  navGap: 2.25,
  glassBlur: 10,
  grain: 0.045,
  shadows: 'soft',
  glow: 1,
  gridOpacity: 0.06,
} as const;

/* ------------------------------------------------------------------ CSS */
const MEDIA: Record<DeviceKey, string> = {
  mobile: '(max-width: 47.99rem)',
  tablet: '(min-width: 48rem) and (max-width: 63.99rem)',
  desktop: '(min-width: 64rem)',
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const safe = (v: string) =>
  String(v)
    .replace(/[;{}<>\\]/g, '')
    .trim();

/** Couleur dérivée (plus claire / plus sombre), calculée par le navigateur. */
const mix = (color: string, other: string, pct: number) =>
  `color-mix(in oklab, ${color}, ${other} ${pct}%)`;

export interface ThemeOutput {
  /** Feuille de style à injecter après le CSS du site. */
  css: string;
  /** Attributs à poser sur <html> (interrupteurs d'effets). */
  attrs: Record<string, string>;
}

export function themeToCss(theme: ThemeSettings = {}): ThemeOutput {
  const root: string[] = [];
  const perDevice: Record<DeviceKey, string[]> = { mobile: [], tablet: [], desktop: [] };
  const extra: string[] = [];
  const attrs: Record<string, string> = {};

  const set = (name: string, value: string | number | undefined) => {
    if (value === undefined || value === '') return;
    root.push(`${name}: ${typeof value === 'string' ? safe(value) : value};`);
  };
  const setResponsive = <T extends number>(
    name: string,
    value: Responsive<T> | undefined,
    format: (v: T) => string,
  ) => {
    if (value === undefined) return;
    if (!isObject(value)) return set(name, format(value as T));
    for (const device of Object.keys(MEDIA) as DeviceKey[]) {
      const v = (value as Partial<Record<DeviceKey, T>>)[device];
      if (typeof v === 'number') perDevice[device].push(`${name}: ${format(v)};`);
    }
  };

  // couleurs → jetons existants (et nuances dérivées)
  const c = theme.colors ?? {};
  if (c.bg) {
    set('--color-ink-950', c.bg);
    set('--color-ink-900', mix(safe(c.bg), 'white', 2));
  }
  if (c.bg2) {
    set('--color-navy-900', c.bg2);
    set('--color-navy-800', mix(safe(c.bg2), 'white', 8));
    set('--color-navy-700', mix(safe(c.bg2), 'white', 18));
  }
  if (c.surface) set('--color-navy-950', c.surface);
  if (c.glass) set('--surface-glass', c.glass);
  if (c.text) set('--color-paper', c.text);
  if (c.textMuted) {
    set('--color-paper-muted', c.textMuted);
    set('--color-paper-faint', mix(safe(c.textMuted), 'black', 32));
  }
  if (c.accent) {
    set('--color-electric-500', c.accent);
    set('--color-electric-600', mix(safe(c.accent), 'black', 18));
    set('--color-electric-400', mix(safe(c.accent), 'white', 16));
  }
  if (c.accent2) {
    set('--color-mauve-400', c.accent2);
    set('--color-mauve-300', mix(safe(c.accent2), 'white', 22));
    set('--color-lavender-200', mix(safe(c.accent2), 'white', 58));
    set('--color-lavender-100', mix(safe(c.accent2), 'white', 78));
  }
  if (c.border) {
    set('--line', c.border);
    set('--line-strong', c.border);
  }
  if (c.success) set('--color-success', c.success);
  if (c.warning) set('--color-warning', c.warning);
  if (c.error) set('--color-error', c.error);

  // typographie
  const t = theme.typography ?? {};
  const font = (id?: string) => FONTS.find((f) => f.id === id)?.stack;
  set('--font-display', font(t.display));
  set('--font-sans', font(t.body));
  if (t.headingWeight) set('--heading-weight', t.headingWeight);
  if (t.bodyWeight) set('--body-weight', t.bodyWeight);
  setResponsive('--text-base', t.baseSize, (v) => `${v / 16}rem`);
  if (t.lineHeight) set('--leading-body', t.lineHeight);
  if (t.headingTracking !== undefined) set('--heading-tracking', `${t.headingTracking}em`);
  if (t.bodyTracking !== undefined) set('--body-tracking', `${t.bodyTracking}em`);
  setResponsive('--type-scale', t.scale, (v) => String(v));

  // interface
  const u = theme.ui ?? {};
  if (u.radius !== undefined) set('--radius-media', `${u.radius}rem`);
  if (u.buttonRadius !== undefined) set('--btn-radius', `${u.buttonRadius}px`);
  if (u.buttonSize && u.buttonSize !== 'md') {
    const size = { sm: ['0.7rem', '1.2rem', '0.8rem'], lg: ['1.15rem', '2rem', '1rem'] }[
      u.buttonSize
    ];
    set('--btn-py', size[0]);
    set('--btn-px', size[1]);
    set('--btn-font', size[2]);
  }
  if (u.buttonStyle && u.buttonStyle !== 'gradient') attrs['data-buttons'] = u.buttonStyle;
  if (u.containerMax) set('--container-max', `${u.containerMax}rem`);
  setResponsive('--container-pad', u.containerPad, (v) => `${v}rem`);
  setResponsive('--space-y', u.sectionSpace, (v) => String(v));
  setResponsive('--header-height', u.headerHeight, (v) => `${v}rem`);
  if (u.headerStyle && u.headerStyle !== 'auto') attrs['data-header-style'] = u.headerStyle;
  if (u.navGap !== undefined) set('--nav-gap', `${u.navGap}rem`);
  if (u.footerGlow === false) attrs['data-footer-glow'] = 'off';

  // effets
  const e = theme.effects ?? {};
  if (e.glass === false) attrs['data-glass'] = 'off';
  if (e.glassBlur !== undefined) set('--glass-blur', `${e.glassBlur}px`);
  if (e.grain !== undefined) set('--grain', e.grain);
  if (e.shadows && e.shadows !== 'soft') attrs['data-shadows'] = e.shadows;
  if (e.glow !== undefined) set('--glow', e.glow);
  if (e.gradients === false) attrs['data-gradients'] = 'off';
  if (e.grid) {
    attrs['data-grid'] = 'on';
    if (e.gridOpacity !== undefined) set('--grid-opacity', e.gridOpacity);
  }
  if (e.particles === false) attrs['data-particles'] = 'off';
  if (e.cursor && e.cursor !== 'default') attrs['data-cursor'] = e.cursor;
  if (e.smoothScroll === false) attrs['data-smooth'] = 'off';

  const blocks: string[] = [];
  if (root.length) blocks.push(`:root { ${root.join(' ')} }`);
  for (const device of Object.keys(MEDIA) as DeviceKey[]) {
    if (perDevice[device].length)
      blocks.push(`@media ${MEDIA[device]} { :root { ${perDevice[device].join(' ')} } }`);
  }
  blocks.push(...extra);
  return { css: blocks.join('\n'), attrs };
}

/** Valeur pour un appareil d'un réglage éventuellement responsive. */
export function valueFor<T>(value: Responsive<T> | undefined, device: DeviceKey): T | undefined {
  if (value === undefined) return undefined;
  if (isObject(value)) return (value as Partial<Record<DeviceKey, T>>)[device];
  return value as T;
}
