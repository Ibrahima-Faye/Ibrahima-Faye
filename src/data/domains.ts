/**
 * Les 7 domaines d'expertise. C'est LA source de vérité :
 * - l'ordre ci-dessous = l'ordre d'affichage (01 → 07) ;
 * - le champ `category` d'un projet ne peut prendre que ces valeurs ;
 * - les textes (titre, description) sont dans src/i18n/ui/*.ts sous la clé `domains`.
 *
 * Pour ajouter un domaine : ajouter le slug ici, son texte dans fr.ts,
 * et son icône dans src/components/ui/DomainIcon.astro.
 */
export const domainSlugs = [
  '3d-architecture',
  'design-graphique',
  'impression-3d-fabrication',
  'robotique',
  'automatisation',
  'electronique-electrotechnique',
  'prototypage',
] as const;

export type DomainSlug = (typeof domainSlugs)[number];

export function isDomainSlug(value: unknown): value is DomainSlug {
  return typeof value === 'string' && (domainSlugs as readonly string[]).includes(value);
}

/** Numéro affiché (« 01 », « 02 »…) déduit de la position dans la liste. */
export function domainNumber(slug: DomainSlug): string {
  return String(domainSlugs.indexOf(slug) + 1).padStart(2, '0');
}
