/**
 * Sections de la page d'accueil et navigation — vocabulaire partagé par le site et l'administration.
 * Réglages : src/settings/layout.json et src/settings/navigation.json (vides = site d'origine).
 *
 * Les textes modifiés depuis l'administration sont des « surcharges » du dictionnaire (src/i18n/ui/fr.ts),
 * repérées par leur chemin (ex. « expertises.title ») : le dictionnaire reste la valeur par défaut.
 */
import type { Responsive } from './theme';

/**
 * Ordre d'origine de la page d'accueil : qui je suis → comment mon univers est organisé → ce que je sais
 * faire → ce que j'ai réalisé → me contacter. (Le Manifeste, repris dans « À propos », est masqué par défaut.)
 */
export const SECTION_KEYS = [
  'hero',
  'marquee',
  'about',
  'ecosystem',
  'expertises',
  'projects',
  'contact',
  'manifesto',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Sections masquées tant que l'administration ne les affiche pas explicitement. */
export const HIDDEN_BY_DEFAULT: readonly SectionKey[] = ['manifesto'];

/** Visibilité d'une section : réglage, sinon valeur d'origine. */
export function sectionVisible(layout: LayoutSettings = {}, key: SectionKey | 'footer'): boolean {
  const own = layout.sections?.[key]?.visible;
  if (typeof own === 'boolean') return own;
  return !(HIDDEN_BY_DEFAULT as readonly string[]).includes(key);
}

/** Sections numérotées (01, 02…) dans leur ordre d'affichage. */
export const NUMBERED_SECTIONS: readonly SectionKey[] = [
  'about',
  'ecosystem',
  'expertises',
  'projects',
  'contact',
];

export type ContentFieldType = 'text' | 'textarea' | 'lines' | 'paragraphs';

export interface ContentField {
  /** Chemin dans le dictionnaire (src/i18n/ui/fr.ts). */
  path: string;
  label: string;
  type: ContentFieldType;
}

export interface SectionDef {
  key: SectionKey | 'footer';
  label: string;
  /** Ancre par défaut (id HTML, cible de la navigation). Vide = pas d'ancre. */
  anchor: string;
  fields: readonly ContentField[];
  /** La section a des calques décoratifs (halos, dégradés, champ 3D) que l'on peut couper. */
  effects: boolean;
}

const heading = (ns: string): ContentField[] => [
  { path: `${ns}.eyebrow`, label: 'Surtitre', type: 'text' },
  { path: `${ns}.title`, label: 'Titre', type: 'text' },
  { path: `${ns}.intro`, label: 'Sous-titre', type: 'textarea' },
];

export const SECTIONS: readonly SectionDef[] = [
  {
    key: 'hero',
    label: 'Hero',
    anchor: '',
    effects: true,
    fields: [
      { path: 'hero.eyebrow', label: 'Surtitre', type: 'text' },
      { path: 'hero.lines', label: 'Lignes du titre (une par ligne)', type: 'lines' },
      { path: 'hero.subtitle', label: 'Sous-titre (séparateur « · »)', type: 'text' },
      { path: 'hero.ctaProjects', label: 'Bouton principal', type: 'text' },
      { path: 'hero.ctaContact', label: 'Bouton secondaire', type: 'text' },
      { path: 'hero.entitiesLabel', label: 'Mention bas de page', type: 'text' },
    ],
  },
  { key: 'marquee', label: 'Bandeau défilant', anchor: '', effects: false, fields: [] },
  {
    key: 'manifesto',
    label: 'Manifeste',
    anchor: '',
    effects: true,
    fields: [
      { path: 'manifesto.eyebrow', label: 'Surtitre', type: 'text' },
      { path: 'manifesto.statement', label: 'Texte', type: 'textarea' },
      { path: 'manifesto.equation', label: 'Équation (un mot par ligne)', type: 'lines' },
    ],
  },
  {
    key: 'expertises',
    label: 'Expertises',
    anchor: 'expertises',
    effects: false,
    fields: heading('expertises'),
  },
  {
    key: 'projects',
    label: 'Projets',
    anchor: 'projets',
    effects: false,
    fields: [
      ...heading('projects'),
      { path: 'projects.seeAll', label: 'Bouton « Tous les projets »', type: 'text' },
    ],
  },
  {
    key: 'ecosystem',
    label: 'Écosystème',
    anchor: 'ecosysteme',
    effects: true,
    fields: heading('ecosystem'),
  },
  {
    key: 'about',
    label: 'À propos',
    anchor: 'a-propos',
    effects: false,
    fields: [
      { path: 'about.eyebrow', label: 'Surtitre', type: 'text' },
      { path: 'about.title', label: 'Titre', type: 'text' },
      {
        path: 'about.paragraphs',
        label: 'Paragraphes (séparés par une ligne vide)',
        type: 'paragraphs',
      },
      { path: 'about.stepsLabel', label: 'Titre de la démarche', type: 'text' },
    ],
  },
  {
    key: 'contact',
    label: 'Contact',
    anchor: 'contact',
    effects: true,
    fields: [
      { path: 'contact.eyebrow', label: 'Surtitre', type: 'text' },
      { path: 'contact.title', label: 'Titre', type: 'textarea' },
      { path: 'contact.text', label: 'Texte', type: 'text' },
    ],
  },
  {
    key: 'footer',
    label: 'Pied de page',
    anchor: '',
    effects: true,
    fields: [
      { path: 'footer.explore', label: 'Titre « Explorer »', type: 'text' },
      { path: 'footer.universe', label: 'Titre « Univers »', type: 'text' },
      { path: 'footer.backToTop', label: 'Lien « Haut de page »', type: 'text' },
    ],
  },
];

export const sectionDef = (key: string) => SECTIONS.find((s) => s.key === key);

export const HEIGHTS = {
  auto: { label: 'Automatique', value: '' },
  half: { label: '50 % de l’écran', value: '50svh' },
  large: { label: '75 % de l’écran', value: '75svh' },
  screen: { label: 'Plein écran', value: '100svh' },
} as const;
export type HeightKey = keyof typeof HEIGHTS;

export interface SectionBackground {
  mode?: 'default' | 'none' | 'color' | 'gradient';
  color?: string;
  color2?: string;
  angle?: number;
}

export interface SectionSettings {
  visible?: boolean;
  anchor?: string;
  background?: SectionBackground;
  height?: HeightKey;
  /** Espacement vertical (multiplicateur), éventuellement par appareil. */
  spacing?: Responsive<number>;
  /** Calques décoratifs (halos, dégradés, champ 3D). */
  effects?: boolean;
  /** Pied de page : grand mot-symbole. */
  wordmark?: boolean;
}

export interface LayoutSettings {
  order?: string[];
  sections?: Partial<Record<SectionKey | 'footer', SectionSettings>>;
  /** Textes modifiés : chemin du dictionnaire → texte (ou liste). */
  content?: Record<string, string | string[]>;
}

/** Ordre final : réglage, complété des sections absentes (une section n'est jamais perdue). */
export function sectionOrder(layout: LayoutSettings = {}): SectionKey[] {
  const known = new Set<string>(SECTION_KEYS);
  const chosen = (layout.order ?? []).filter((k): k is SectionKey => known.has(k));
  const unique = [...new Set(chosen)];
  return [...unique, ...SECTION_KEYS.filter((k) => !unique.includes(k))];
}

const ANCHOR = /^[a-z][a-z0-9-]*$/;
/** Ancre d'une section (réglée si valide, sinon celle d'origine). */
export function sectionAnchor(layout: LayoutSettings = {}, key: SectionKey): string {
  const own = layout.sections?.[key]?.anchor?.trim();
  if (own && ANCHOR.test(own)) return own;
  return sectionDef(key)?.anchor ?? '';
}

export function isAnchorValid(anchor: string) {
  return anchor === '' || ANCHOR.test(anchor);
}

/** Style en ligne d'une section (fond, hauteur, espacement) + attributs. Vide si rien n'est réglé. */
export function sectionStyle(settings: SectionSettings = {}): {
  style: string;
  attrs: Record<string, string>;
} {
  const style: string[] = [];
  const attrs: Record<string, string> = {};
  const bg = settings.background;
  const clean = (v?: string) => (v ?? '').replace(/[;{}<>"\\]/g, '');
  if (bg?.mode === 'none') attrs['data-section-bg'] = 'none';
  if (bg?.mode === 'color' && bg.color) {
    attrs['data-section-bg'] = 'custom';
    style.push(`background:${clean(bg.color)}`);
  }
  if (bg?.mode === 'gradient' && bg.color) {
    attrs['data-section-bg'] = 'custom';
    style.push(
      `background:linear-gradient(${Number(bg.angle ?? 180)}deg, ${clean(bg.color)}, ${clean(bg.color2 || 'transparent')})`,
    );
  }
  const height = settings.height ? HEIGHTS[settings.height]?.value : '';
  if (height) {
    style.push(`min-height:${height}`);
    attrs['data-section-height'] = settings.height!;
  }
  const sp = settings.spacing;
  if (typeof sp === 'number') style.push(`--sec-space:${sp}`);
  else if (sp && typeof sp === 'object') {
    for (const [device, value] of Object.entries(sp))
      if (typeof value === 'number') style.push(`--sec-space-${device}:${value}`);
  }
  if (settings.effects === false) attrs['data-section-fx'] = 'off';
  return { style: style.join(';'), attrs };
}

/** Ce que reçoit le composant d'une section : ancre, style en ligne, attributs. */
export interface SectionProps {
  id?: string;
  style?: string;
  attrs: Record<string, string>;
  /** Numéro affiché dans le surtitre (« 01 »…), selon la position réelle de la section. */
  index?: string;
}

export function sectionProps(
  layout: LayoutSettings,
  key: SectionKey,
  order: readonly SectionKey[] = [],
): SectionProps {
  const look = sectionStyle(layout.sections?.[key]);
  const anchor = sectionAnchor(layout, key);
  const numbered = order.filter((k) => NUMBERED_SECTIONS.includes(k));
  const position = numbered.indexOf(key);
  return {
    id: anchor || undefined,
    style: look.style || undefined,
    attrs: look.attrs,
    index: position >= 0 ? String(position + 1).padStart(2, '0') : undefined,
  };
}

/* ------------------------------------------------------------------ navigation */
export interface NavLink {
  id: string;
  /** Texte affiché (sinon celui du dictionnaire). */
  label?: string;
  /** Section cible (clé), 'page:/projets/' pour une page, ou 'url:https://…' pour une adresse. */
  target: string;
  /** Texte du menu mobile (sinon le même). */
  mobileLabel?: string;
  visible?: boolean;
  /** Affiché comme un bouton (comme « Contact »). */
  button?: boolean;
}

export interface NavigationSettings {
  links?: NavLink[];
  scroll?: { behavior?: 'smooth' | 'instant'; readingLine?: number };
  active?: { enabled?: boolean; style?: 'text' | 'underline' | 'dot' };
  mobile?: { numbered?: boolean };
}

/** Liens d'origine (identiques à l'en-tête historique). `labelKey` : clé de `t.nav`. */
export const DEFAULT_LINKS: readonly (NavLink & { labelKey: string })[] = [
  { id: 'a-propos', target: 'about', labelKey: 'about' },
  { id: 'ecosysteme', target: 'ecosystem', labelKey: 'ecosystem' },
  { id: 'expertises', target: 'expertises', labelKey: 'expertises' },
  { id: 'projets', target: 'projects', labelKey: 'projects' },
  { id: 'contact', target: 'contact', labelKey: 'contact', button: true },
];

/** Liens finaux (réglés, sinon d'origine). */
export function navLinks(nav: NavigationSettings = {}): (NavLink & { labelKey?: string })[] {
  if (!nav.links?.length) return DEFAULT_LINKS.map((l) => ({ ...l }));
  return nav.links.map((l) => ({ ...DEFAULT_LINKS.find((d) => d.id === l.id), ...l }));
}

/* ------------------------------------------------------------------ textes */
/** Applique les textes modifiés (chemins « a.b ») à une copie du dictionnaire. */
export function applyContent<T>(dict: T, content: Record<string, unknown> = {}): T {
  const entries = Object.entries(content).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return dict;
  const out = structuredClone(dict) as Record<string, unknown>;
  for (const [path, value] of entries) {
    const keys = path.split('.');
    let node = out;
    for (const key of keys.slice(0, -1)) {
      if (typeof node[key] !== 'object' || node[key] === null) {
        node = {};
        break;
      }
      node = node[key] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1]!;
    // ne remplace que des textes existants, du même genre (texte ↔ texte, liste ↔ liste)
    if (Array.isArray(node[last]) && Array.isArray(value)) {
      const list = value.map(String).filter((v) => v.trim());
      if (list.length) node[last] = list;
    } else if (typeof node[last] === 'string' && typeof value === 'string') node[last] = value;
  }
  return out as T;
}
