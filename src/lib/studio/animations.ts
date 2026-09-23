/**
 * Animation Studio — vocabulaire partagé par le site (src/scripts/studio/) et l'administration.
 *
 *   ANIMATIONS      les effets disponibles (ajouter un effet = une entrée ici + son rendu dans
 *                   src/scripts/studio/effects.ts)
 *   STYLE_PRESETS   styles prêts à l'emploi (durée, courbe, distance…) : Cinematic, Smooth…
 *   ANIM_TARGETS    éléments du site animables, repérés par `data-anim="<id>"` dans les composants
 *
 * Un élément SANS réglage garde exactement son animation d'origine (src/scripts/motion.ts).
 */

export const TRIGGERS = ['load', 'scroll', 'scrub', 'hover', 'loop'] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABELS: Record<Trigger, string> = {
  load: 'Au chargement',
  scroll: 'À l’apparition (scroll)',
  scrub: 'Lié au défilement',
  hover: 'Au survol',
  loop: 'En boucle',
};

export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type AnimationCategory = 'entrance' | 'text' | 'scroll' | 'hover' | 'loop' | 'section';

export const CATEGORY_LABELS: Record<AnimationCategory, string> = {
  entrance: 'Apparition',
  text: 'Texte',
  scroll: 'Défilement',
  hover: 'Survol',
  loop: 'Boucle',
  section: 'Section',
};

/** Paramètres réglables (l'interface n'affiche que ceux utilisés par l'effet choisi). */
export type ParamKey =
  | 'duration'
  | 'delay'
  | 'ease'
  | 'direction'
  | 'distance'
  | 'scale'
  | 'opacity'
  | 'blur'
  | 'rotation'
  | 'intensity'
  | 'speed'
  | 'stagger';

export interface AnimationDef {
  id: string;
  label: string;
  category: AnimationCategory;
  /** Déclencheur par défaut, et ceux qui ont un sens pour cet effet. */
  trigger: Trigger;
  triggers: readonly Trigger[];
  params: readonly ParamKey[];
  /** Découpe le texte (caractères, mots, lignes). */
  split?: 'chars' | 'words' | 'lines';
}

const TIMING = ['duration', 'delay', 'ease', 'stagger'] as const;
const ENTRY = ['scroll', 'load'] as const;

export const ANIMATIONS: readonly AnimationDef[] = [
  {
    id: 'fade-in',
    label: 'Fade in',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'opacity'],
  },
  {
    id: 'fade-out',
    label: 'Fade out',
    category: 'scroll',
    trigger: 'scrub',
    triggers: ['scrub'],
    params: ['opacity', 'ease'],
  },
  {
    id: 'slide-up',
    label: 'Slide up',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'distance', 'opacity'],
  },
  {
    id: 'slide-down',
    label: 'Slide down',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'distance', 'opacity'],
  },
  {
    id: 'slide-left',
    label: 'Slide left',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'distance', 'opacity'],
  },
  {
    id: 'slide-right',
    label: 'Slide right',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'distance', 'opacity'],
  },
  {
    id: 'scale-in',
    label: 'Scale in',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'scale', 'opacity'],
  },
  {
    id: 'scale-out',
    label: 'Scale out',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'scale', 'opacity'],
  },
  {
    id: 'blur-reveal',
    label: 'Blur reveal',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'blur', 'distance'],
  },
  {
    id: 'clip-reveal',
    label: 'Clip reveal',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'direction'],
  },
  {
    id: 'mask-reveal',
    label: 'Mask reveal',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING],
  },
  {
    id: 'text-reveal',
    label: 'Text reveal',
    category: 'text',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'direction'],
    split: 'lines',
  },
  {
    id: 'char-reveal',
    label: 'Character reveal',
    category: 'text',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'rotation'],
    split: 'chars',
  },
  {
    id: 'word-reveal',
    label: 'Word reveal',
    category: 'text',
    trigger: 'scroll',
    triggers: [...ENTRY, 'scrub'],
    params: [...TIMING, 'opacity', 'blur'],
    split: 'words',
  },
  {
    id: 'line-reveal',
    label: 'Line reveal',
    category: 'text',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'distance', 'opacity'],
    split: 'lines',
  },
  {
    id: 'parallax',
    label: 'Parallax',
    category: 'scroll',
    trigger: 'scrub',
    triggers: ['scrub'],
    params: ['speed', 'direction'],
  },
  {
    id: 'zoom-scroll',
    label: 'Zoom on scroll',
    category: 'scroll',
    trigger: 'scrub',
    triggers: ['scrub'],
    params: ['scale'],
  },
  {
    id: 'horizontal',
    label: 'Horizontal movement',
    category: 'scroll',
    trigger: 'scrub',
    triggers: ['scrub'],
    params: ['distance', 'direction'],
  },
  {
    id: 'marquee',
    label: 'Marquee',
    category: 'loop',
    trigger: 'loop',
    triggers: ['loop'],
    params: ['speed', 'direction'],
  },
  {
    id: 'magnetic',
    label: 'Magnetic',
    category: 'hover',
    trigger: 'hover',
    triggers: ['hover'],
    params: ['intensity', 'duration'],
  },
  {
    id: 'hover-scale',
    label: 'Hover scale',
    category: 'hover',
    trigger: 'hover',
    triggers: ['hover'],
    params: ['scale', 'duration', 'ease'],
  },
  {
    id: 'hover-lift',
    label: 'Hover lift',
    category: 'hover',
    trigger: 'hover',
    triggers: ['hover'],
    params: ['distance', 'duration', 'ease'],
  },
  {
    id: 'hover-tilt',
    label: 'Hover tilt',
    category: 'hover',
    trigger: 'hover',
    triggers: ['hover'],
    params: ['rotation', 'duration'],
  },
  {
    id: 'image-distortion',
    label: 'Image distortion',
    category: 'hover',
    trigger: 'hover',
    triggers: ['hover'],
    params: ['intensity', 'duration'],
  },
  {
    id: 'image-reveal',
    label: 'Image reveal',
    category: 'entrance',
    trigger: 'scroll',
    triggers: ENTRY,
    params: [...TIMING, 'scale', 'direction'],
  },
  {
    id: 'section-transition',
    label: 'Section transition',
    category: 'section',
    trigger: 'scrub',
    triggers: ['scrub', 'scroll'],
    params: ['scale', 'opacity', 'blur', 'duration', 'ease'],
  },
];

export const animationById = (id?: string) => ANIMATIONS.find((a) => a.id === id);

/** Valeurs propres à certains effets (priorité sur le style prêt à l'emploi). */
export const ANIMATION_DEFAULTS: Record<
  string,
  Partial<Omit<AnimParams, 'direction'>> & { direction?: Direction }
> = {
  'fade-out': { opacity: 0, ease: 'none' },
  'scale-out': { scale: 1.08 },
  'zoom-scroll': { scale: 1.15 },
  parallax: { speed: 0.4 },
  horizontal: { distance: 160, direction: 'left' },
  marquee: { speed: 1, direction: 'left' },
  magnetic: { intensity: 0.3, duration: 0.6 },
  'hover-scale': { scale: 1.05, duration: 0.5, ease: 'power3.out' },
  'hover-lift': { distance: 8, duration: 0.5, ease: 'power3.out' },
  'hover-tilt': { rotation: 8, duration: 0.6 },
  'image-distortion': { intensity: 0.5, duration: 0.8 },
  'image-reveal': { scale: 1.25 },
  'section-transition': { scale: 0.94, opacity: 0.35, blur: 6, ease: 'none' },
  'word-reveal': { opacity: 0.12, blur: 6 },
  'char-reveal': { rotation: 0 },
  'mask-reveal': { duration: 1.4 },
};

export const EASES = [
  { id: 'expo.out', label: 'Expo (cinématique)' },
  { id: 'power3.out', label: 'Power 3' },
  { id: 'power2.inOut', label: 'Doux (in-out)' },
  { id: 'sine.out', label: 'Sinus' },
  { id: 'circ.out', label: 'Circulaire' },
  { id: 'back.out(1.6)', label: 'Rebond léger' },
  { id: 'elastic.out(1,0.45)', label: 'Élastique' },
  { id: 'steps(6)', label: 'Saccadé (glitch)' },
  { id: 'none', label: 'Linéaire' },
] as const;

/** Valeurs complètes d'un réglage (après fusion effet ← style ← élément ← appareil). */
export interface AnimParams {
  duration: number;
  delay: number;
  ease: string;
  direction: Direction;
  distance: number;
  scale: number;
  opacity: number;
  blur: number;
  rotation: number;
  intensity: number;
  speed: number;
  stagger: number;
  /** Position de déclenchement dans l'écran (%, 100 = bas de l'écran). */
  start: number;
  /** false = une seule fois ; true = rejoue à chaque passage. */
  repeat: boolean;
}

export const BASE_PARAMS: AnimParams = {
  duration: 1.1,
  delay: 0,
  ease: 'expo.out',
  direction: 'up',
  distance: 40,
  scale: 0.92,
  opacity: 0,
  blur: 12,
  rotation: 8,
  intensity: 0.5,
  speed: 1,
  stagger: 0.08,
  start: 88,
  repeat: false,
};

export interface StylePreset {
  id: string;
  label: string;
  description: string;
  values: Partial<AnimParams>;
}

/** Styles prêts à l'emploi : appliqués à tout le site, ou à un élément. */
export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Lent, ample, courbe expo — l’esprit actuel du site.',
    values: { duration: 1.3, ease: 'expo.out', distance: 48, stagger: 0.1, blur: 14 },
  },
  {
    id: 'smooth',
    label: 'Smooth',
    description: 'Fluide et régulier.',
    values: { duration: 1, ease: 'power2.inOut', distance: 32, stagger: 0.08 },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Discret : faible distance, fondu court.',
    values: {
      duration: 0.7,
      ease: 'power3.out',
      distance: 14,
      stagger: 0.05,
      blur: 4,
      scale: 0.98,
    },
  },
  {
    id: 'luxury',
    label: 'Luxury',
    description: 'Très lent, élégant, léger flou.',
    values: { duration: 1.8, ease: 'sine.out', distance: 24, stagger: 0.14, blur: 10 },
  },
  {
    id: 'tech',
    label: 'Tech',
    description: 'Net et rapide, courbe circulaire.',
    values: { duration: 0.8, ease: 'circ.out', distance: 30, stagger: 0.04, blur: 0 },
  },
  {
    id: 'glitch',
    label: 'Glitch',
    description: 'Saccadé, apparition par à-coups.',
    values: { duration: 0.6, ease: 'steps(6)', distance: 18, stagger: 0.03, blur: 0, rotation: 2 },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Posé, lignes de texte en cascade.',
    values: { duration: 1.2, ease: 'power3.out', distance: 22, stagger: 0.12 },
  },
  {
    id: 'elastic',
    label: 'Elastic',
    description: 'Rebond élastique.',
    values: {
      duration: 1.4,
      ease: 'elastic.out(1,0.45)',
      distance: 44,
      stagger: 0.07,
      scale: 0.85,
    },
  },
  {
    id: 'fast',
    label: 'Fast',
    description: 'Tout plus rapide.',
    values: { duration: 0.5, ease: 'power3.out', distance: 24, stagger: 0.03 },
  },
  {
    id: 'slow',
    label: 'Slow',
    description: 'Tout plus lent.',
    values: { duration: 2, ease: 'expo.out', distance: 40, stagger: 0.16 },
  },
];

export const presetById = (id?: string) => STYLE_PRESETS.find((p) => p.id === id);

/* ------------------------------------------------------------------ éléments animables */
export type TargetKind =
  'section' | 'heading' | 'text' | 'block' | 'items' | 'media' | 'button' | 'background' | 'loop';

export interface AnimTarget {
  id: string;
  label: string;
  /** Section à laquelle l'élément appartient (regroupement dans l'interface). */
  group: string;
  kind: TargetKind;
  /** Animation d'origine (affichée quand l'élément n'a pas de réglage). */
  origin: string;
}

const heading = (
  group: string,
  prefix: string,
  originTitle = 'Titre ligne par ligne',
): AnimTarget[] => [
  { id: `${prefix}.eyebrow`, label: 'Surtitre', group, kind: 'text', origin: 'Fondu' },
  { id: `${prefix}.title`, label: 'Titre', group, kind: 'heading', origin: originTitle },
  { id: `${prefix}.intro`, label: 'Introduction', group, kind: 'text', origin: 'Fondu + montée' },
];

export const ANIM_TARGETS: readonly AnimTarget[] = [
  {
    id: 'hero.section',
    label: 'Section entière',
    group: 'Hero',
    kind: 'section',
    origin: 'S’éloigne au défilement',
  },
  {
    id: 'hero.eyebrow',
    label: 'Surtitre',
    group: 'Hero',
    kind: 'text',
    origin: 'Fondu (séquence d’entrée)',
  },
  { id: 'hero.title', label: 'Nom', group: 'Hero', kind: 'heading', origin: 'Lettres en cascade' },
  {
    id: 'hero.lines',
    label: 'Lignes « Je conçois… »',
    group: 'Hero',
    kind: 'heading',
    origin: 'Lignes en cascade',
  },
  { id: 'hero.subtitle', label: 'Sous-titre', group: 'Hero', kind: 'text', origin: 'Fondu' },
  { id: 'hero.actions', label: 'Boutons', group: 'Hero', kind: 'block', origin: 'Fondu' },
  {
    id: 'hero.background',
    label: 'Champ 3D (fond)',
    group: 'Hero',
    kind: 'background',
    origin: 'Dérive au défilement',
  },
  {
    id: 'marquee.track',
    label: 'Bandeau défilant',
    group: 'Bandeau',
    kind: 'loop',
    origin: 'Défilement 60 s',
  },
  {
    id: 'manifesto.section',
    label: 'Section entière',
    group: 'Manifeste',
    kind: 'section',
    origin: '—',
  },
  { id: 'manifesto.eyebrow', label: 'Surtitre', group: 'Manifeste', kind: 'text', origin: 'Fondu' },
  {
    id: 'manifesto.statement',
    label: 'Texte',
    group: 'Manifeste',
    kind: 'heading',
    origin: 'Mots allumés au défilement',
  },
  {
    id: 'manifesto.items',
    label: 'Équation',
    group: 'Manifeste',
    kind: 'block',
    origin: 'Fondu + montée',
  },
  {
    id: 'expertises.section',
    label: 'Section entière',
    group: 'Expertises',
    kind: 'section',
    origin: '—',
  },
  ...heading('Expertises', 'expertises'),
  {
    id: 'expertises.items',
    label: 'Liste des domaines',
    group: 'Expertises',
    kind: 'items',
    origin: 'Lignes en cascade',
  },
  {
    id: 'projects.section',
    label: 'Section entière',
    group: 'Projets',
    kind: 'section',
    origin: '—',
  },
  ...heading('Projets', 'projects'),
  {
    id: 'projects.cards',
    label: 'Cartes projets',
    group: 'Projets',
    kind: 'items',
    origin: 'Balayage',
  },
  {
    id: 'projects.images',
    label: 'Images des cartes',
    group: 'Projets',
    kind: 'media',
    origin: 'Zoom au survol',
  },
  {
    id: 'ecosystem.section',
    label: 'Section entière',
    group: 'Écosystème',
    kind: 'section',
    origin: '—',
  },
  ...heading('Écosystème', 'ecosystem'),
  {
    id: 'ecosystem.panels',
    label: 'Panneaux ClicGraph / JeeFSYS',
    group: 'Écosystème',
    kind: 'items',
    origin: 'Traits puis panneaux',
  },
  {
    id: 'about.section',
    label: 'Section entière',
    group: 'À propos',
    kind: 'section',
    origin: '—',
  },
  ...heading('À propos', 'about'),
  { id: 'about.portrait', label: 'Portrait', group: 'À propos', kind: 'media', origin: 'Balayage' },
  {
    id: 'about.text',
    label: 'Paragraphes',
    group: 'À propos',
    kind: 'items',
    origin: 'Fondu + montée',
  },
  {
    id: 'contact.section',
    label: 'Section entière',
    group: 'Contact',
    kind: 'section',
    origin: '—',
  },
  { id: 'contact.eyebrow', label: 'Surtitre', group: 'Contact', kind: 'text', origin: 'Fondu' },
  {
    id: 'contact.title',
    label: 'Titre',
    group: 'Contact',
    kind: 'heading',
    origin: 'Titre ligne par ligne',
  },
  {
    id: 'footer.wordmark',
    label: 'Grand mot-symbole',
    group: 'Pied de page',
    kind: 'text',
    origin: '—',
  },
  {
    id: 'buttons',
    label: 'Tous les boutons',
    group: 'Global',
    kind: 'button',
    origin: 'Magnétique (Hero)',
  },
];

export const targetById = (id: string) => ANIM_TARGETS.find((t) => t.id === id);

/** Effets proposés pour un type d'élément (tous restent possibles, ceux-ci sont mis en avant). */
export function suggestedAnimations(kind: TargetKind): string[] {
  switch (kind) {
    case 'heading':
      return [
        'text-reveal',
        'char-reveal',
        'word-reveal',
        'line-reveal',
        'blur-reveal',
        'clip-reveal',
        'fade-in',
        'slide-up',
      ];
    case 'text':
      return ['fade-in', 'slide-up', 'blur-reveal', 'word-reveal', 'line-reveal', 'clip-reveal'];
    case 'items':
      return [
        'slide-up',
        'fade-in',
        'scale-in',
        'blur-reveal',
        'clip-reveal',
        'slide-left',
        'slide-right',
      ];
    case 'media':
      return [
        'image-reveal',
        'mask-reveal',
        'clip-reveal',
        'scale-in',
        'zoom-scroll',
        'parallax',
        'hover-scale',
        'hover-tilt',
        'image-distortion',
      ];
    case 'button':
      return ['magnetic', 'hover-scale', 'hover-lift', 'hover-tilt'];
    case 'background':
      return ['parallax', 'zoom-scroll', 'fade-out', 'horizontal'];
    case 'loop':
      return ['marquee'];
    case 'section':
      return [
        'section-transition',
        'fade-in',
        'slide-up',
        'blur-reveal',
        'scale-in',
        'fade-out',
        'parallax',
      ];
    default:
      return ['fade-in', 'slide-up'];
  }
}

/* ------------------------------------------------------------------ réglage d'un élément */
export type DeviceKey = 'desktop' | 'tablet' | 'mobile';

export interface AnimationSetting extends Partial<AnimParams> {
  animation: string;
  trigger?: Trigger;
  /** Style prêt à l'emploi propre à cet élément (sinon celui du site). */
  preset?: string;
  enabled?: boolean;
  /** Valeurs différentes selon l'appareil ; `enabled: false` coupe l'animation sur cet appareil. */
  devices?: Partial<
    Record<DeviceKey, Partial<AnimParams> & { enabled?: boolean; animation?: string }>
  >;
}

export interface AnimationsSettings {
  enabled?: boolean;
  /** Style appliqué à tout le site (réglages des éléments). */
  preset?: string;
  targets?: Record<string, AnimationSetting>;
}

/** Paramètres finaux d'un élément sur un appareil. `null` = pas d'animation Studio (animation d'origine ou aucune). */
export function resolveAnimation(
  settings: AnimationsSettings,
  targetId: string,
  device: DeviceKey,
): (AnimParams & { animation: AnimationDef; trigger: Trigger }) | null {
  const setting = settings.targets?.[targetId];
  if (!setting || setting.enabled === false) return null;
  const override = setting.devices?.[device] ?? {};
  if (override.enabled === false) return null;
  const def = animationById(override.animation ?? setting.animation);
  if (!def) return null;
  const { devices: _d, animation: _a, preset, trigger, enabled: _e, ...own } = setting;
  const { enabled: _oe, animation: _oa, ...ownDevice } = override;
  const style = presetById(preset ?? settings.preset)?.values ?? {};
  const params = {
    ...BASE_PARAMS,
    ...style,
    ...ANIMATION_DEFAULTS[def.id],
    ...clean(own),
    ...clean(ownDevice),
  } as AnimParams;
  const chosen = trigger && def.triggers.includes(trigger) ? trigger : def.trigger;
  return { ...params, animation: def, trigger: chosen };
}

function clean<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>;
}
