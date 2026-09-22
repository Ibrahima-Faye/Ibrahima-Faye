/**
 * Modèle de composition de la galerie — partagé par le site public ET l'administration locale.
 *
 * La galerie est une grille de 12 colonnes. Chaque média occupe `span` colonnes :
 *
 *   3  = 1 colonne  (1/4)    4  = 1/3      6  = 2 colonnes (1/2)
 *   8  = 2/3                 9  = 3 colonnes (3/4)   12 = pleine largeur
 *
 * Les médias se placent dans l'ordre de la liste, de gauche à droite, à la ligne quand la ligne est pleine.
 * Chaque média garde SON ratio : la hauteur d'une ligne n'est jamais imposée.
 */

export const SPANS = [3, 4, 6, 8, 9, 12] as const;
export type Span = (typeof SPANS)[number];

export const ALIGNS = ['start', 'center', 'end'] as const;
export type Align = (typeof ALIGNS)[number];

export const DEFAULT_ALIGN: Align = 'center';

export interface SpanInfo {
  span: Span;
  /** Étiquette courte (boutons). */
  short: string;
  /** Description complète. */
  label: string;
}

export const SPAN_INFO: readonly SpanInfo[] = [
  { span: 3, short: '1 col', label: '1 colonne (1/4 de la largeur)' },
  { span: 4, short: '1/3', label: 'Un tiers de la largeur' },
  { span: 6, short: '2 col', label: '2 colonnes (1/2 de la largeur)' },
  { span: 8, short: '2/3', label: 'Deux tiers de la largeur' },
  { span: 9, short: '3 col', label: '3 colonnes (3/4 de la largeur)' },
  { span: 12, short: 'Pleine', label: 'Pleine largeur' },
];

export const isSpan = (value: unknown): value is Span =>
  (SPANS as readonly number[]).includes(value as number);

export const isAlign = (value: unknown): value is Align =>
  (ALIGNS as readonly string[]).includes(value as string);

/**
 * Taille proposée tant que rien n'a été choisi dans l'administration :
 * panoramiques et très larges en pleine largeur, vidéos horizontales en pleine largeur, le reste sur 2 colonnes.
 */
export function defaultSpan(kind: 'image' | 'video', ratio: number): Span {
  if (ratio >= 2.2) return 12;
  if (kind === 'video' && ratio >= 1.2) return 12;
  return 6;
}

/** « 16:9 », « 4/3 », « 1.5:1 » → nombre (largeur / hauteur). */
export function parseRatio(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const [w, h] = value.split(/[:/]/).map((part) => parseFloat(part));
  return w && h ? w / h : undefined;
}
