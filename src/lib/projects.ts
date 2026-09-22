import { getCollection, type CollectionEntry } from 'astro:content';
import { domainSlugs, type DomainSlug } from '@/data/domains';
import { entitySlugs, type EntitySlug } from '@/data/entities';
import { projectFolder } from './media';

export type Project = CollectionEntry<'projects'>;

/** URL d'un projet — l'unique endroit qui connaît le schéma d'URL. */
export function projectUrl(project: Project): string {
  return `/projets/${project.id}/`;
}

function compare(a: Project, b: Project): number {
  const oa = a.data.order;
  const ob = b.data.order;
  if (oa !== undefined || ob !== undefined) {
    if (oa === undefined) return 1;
    if (ob === undefined) return -1;
    if (oa !== ob) return oa - ob;
  }
  const ya = a.data.year ?? 0;
  const yb = b.data.year ?? 0;
  if (ya !== yb) return yb - ya;
  return a.data.title.localeCompare(b.data.title, 'fr');
}

/** Projets publiables, triés. Les brouillons ne sont visibles qu'en développement. */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort(compare);
}

export async function getFeaturedProjects(limit = 6): Promise<Project[]> {
  const all = await getProjects();
  const featured = all.filter((p) => p.data.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

/** Nombre de projets par domaine / par entité (uniquement les valeurs > 0). */
export function countBy(projects: Project[]) {
  const domains = new Map<DomainSlug, number>();
  const entities = new Map<EntitySlug, number>();
  for (const p of projects) {
    domains.set(p.data.category, (domains.get(p.data.category) ?? 0) + 1);
    for (const e of p.data.entity) entities.set(e, (entities.get(e) ?? 0) + 1);
  }
  return {
    domains: domainSlugs.filter((d) => domains.has(d)).map((d) => [d, domains.get(d)!] as const),
    entities: entitySlugs.filter((e) => entities.has(e)).map((e) => [e, entities.get(e)!] as const),
    domainCount: domains,
    entityCount: entities,
  };
}

/** Projet précédent / suivant dans l'ordre d'affichage (circulaire). */
export function neighbours(projects: Project[], current: Project) {
  const i = projects.findIndex((p) => p.id === current.id);
  if (i === -1 || projects.length < 2) return { previous: undefined, next: undefined };
  return {
    previous: projects[(i - 1 + projects.length) % projects.length],
    next: projects[(i + 1) % projects.length],
  };
}

export { projectFolder };
