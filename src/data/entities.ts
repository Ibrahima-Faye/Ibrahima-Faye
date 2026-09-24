import type { DomainSlug } from './domains';

/**
 * Les entités de l'univers professionnel d'Ibrahima Faye.
 * - `clicgraph` : studio créatif
 * - `jeefsys`   : startup robotique & automatisation
 * - `personal`  : projet personnel, rattaché à aucune des deux
 *
 * Les textes sont dans src/i18n/ui/*.ts sous la clé `entities`.
 */
export const entitySlugs = ['clicgraph', 'jeefsys', 'personal'] as const;

export type EntitySlug = (typeof entitySlugs)[number];

export function isEntitySlug(value: unknown): value is EntitySlug {
  return typeof value === 'string' && (entitySlugs as readonly string[]).includes(value);
}

/** Domaines couverts par chaque entité (section « Écosystème »). */
export const entityDomains: Record<Exclude<EntitySlug, 'personal'>, readonly DomainSlug[]> = {
  clicgraph: ['3d-architecture', 'design-graphique', 'impression-3d-fabrication', 'prototypage'],
  jeefsys: ['robotique', 'automatisation', 'electronique-electrotechnique', 'prototypage'],
};

/**
 * Univers de chaque entité (section « Écosystème ») : mots-clés affichés sur chaque pôle.
 * `key` → texte dans src/i18n/ui/*.ts (ecosystem.keywords) ; `domain` → lien vers les projets de ce domaine
 * (seulement s'il en existe).
 */
export const entityUniverse: Record<
  Exclude<EntitySlug, 'personal'>,
  readonly { key: string; domain?: DomainSlug }[]
> = {
  clicgraph: [
    { key: 'creation' },
    { key: '3d', domain: '3d-architecture' },
    { key: 'architecture', domain: '3d-architecture' },
    { key: 'visualisation', domain: '3d-architecture' },
    { key: 'design-graphique', domain: 'design-graphique' },
    { key: 'impression-3d', domain: 'impression-3d-fabrication' },
    { key: 'fabrication', domain: 'impression-3d-fabrication' },
  ],
  jeefsys: [
    { key: 'robotique', domain: 'robotique' },
    { key: 'automatisation', domain: 'automatisation' },
    { key: 'electronique', domain: 'electronique-electrotechnique' },
    { key: 'embarque', domain: 'electronique-electrotechnique' },
    { key: 'prototypage', domain: 'prototypage' },
  ],
};

export const projectStatuses = ['concept', 'en-cours', 'prototype', 'termine'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
