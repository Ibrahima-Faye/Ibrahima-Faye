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

export const projectStatuses = ['concept', 'en-cours', 'prototype', 'termine'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
