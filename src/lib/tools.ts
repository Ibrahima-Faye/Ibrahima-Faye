/**
 * Expertises « compétence → projet » : à partir des fiches projet (catégorie + technologies) et des réglages
 * de l'administration, calcule
 *  - pour chaque domaine : les projets qui le démontrent, les outils et le matériel cités ;
 *  - la liste des outils (logiciels, cartes) avec leur catégorie et les projets qui les utilisent.
 *
 * Fonctions pures (testées dans tests/tools.test.ts) : rien n'est inventé, tout vient des données.
 */
import { domainSlugs, isDomainSlug, type DomainSlug } from '@/data/domains';
import { TOOLS, type ToolDef } from '@/data/tools';
import { isToolIcon, type ToolIconName } from './tool-icons';
import type { ContentSettings } from './studio/content';

export interface ProjectRef {
  id: string;
  title: string;
  href: string;
  category: DomainSlug;
  technologies: readonly string[];
}

export interface ToolView {
  id: string;
  name: string;
  usage?: string;
  /** Icône intégrée, ou chemin d'une image téléversée. */
  icon: { builtin: ToolIconName } | { src: string };
  /** Domaines où l'outil est utilisé (projets), sinon son domaine de repli. */
  domains: DomainSlug[];
  projects: ProjectRef[];
}

export interface DomainView {
  slug: DomainSlug;
  projects: ProjectRef[];
  /** Outils (logiciels, cartes) cités dans les projets du domaine. */
  tools: string[];
  /** Matériel et techniques cités (y compris les technologies inconnues du registre). */
  extras: string[];
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Outil du registre correspondant à une technologie citée dans une fiche. */
export function findTool(tech: string): ToolDef | undefined {
  const key = norm(tech);
  return TOOLS.find((t) => t.id === key || t.aliases.includes(key));
}

const isCard = (tool: ToolDef) => tool.kind === 'software' || tool.kind === 'board';
const IMAGE = /^(\/|https?:\/\/)\S+\.(svg|png|webp|jpe?g|avif)$/i;

/** Domaines : projets qui les démontrent, outils et matériel cités. */
export function domainViews(
  projects: readonly ProjectRef[],
  domainTitles: Partial<Record<DomainSlug, string>> = {},
): Map<DomainSlug, DomainView> {
  const titles = new Set(Object.values(domainTitles).map((t) => norm(t ?? '')));
  const views = new Map<DomainSlug, DomainView>(
    domainSlugs.map((slug) => [slug, { slug, projects: [], tools: [], extras: [] }]),
  );
  for (const project of projects) {
    const view = views.get(project.category);
    if (!view) continue;
    view.projects.push(project);
    for (const tech of project.technologies) {
      // « Automatisation industrielle » cité comme technologie = le domaine lui-même : pas de doublon
      if (!tech.trim() || titles.has(norm(tech))) continue;
      const tool = findTool(tech);
      const label = tool?.name ?? tech.trim();
      const list = tool && isCard(tool) ? view.tools : view.extras;
      if (!list.includes(label)) list.push(label);
    }
  }
  return views;
}

/** Outils affichés (logiciels, cartes) : cités dans un projet publié ou ajoutés dans l'administration. */
export function toolViews(
  projects: readonly ProjectRef[],
  content: Pick<ContentSettings, 'tools'> = {},
): ToolView[] {
  const items = content.tools?.items ?? [];
  const used = new Map<string, ProjectRef[]>();
  for (const project of projects)
    for (const tech of project.technologies) {
      const tool = findTool(tech);
      if (!tool || !isCard(tool)) continue;
      const list = used.get(tool.id) ?? [];
      if (!list.some((p) => p.id === project.id)) list.push(project);
      used.set(tool.id, list);
    }

  // ordre : celui de l'administration, puis les outils cités (ordre du registre)
  const ids = [...items.map((i) => i.id), ...TOOLS.filter((t) => used.has(t.id)).map((t) => t.id)];
  const views: ToolView[] = [];
  for (const id of new Set(ids)) {
    const item = items.find((i) => i.id === id);
    const def = TOOLS.find((t) => t.id === id);
    if (item?.visible === false) continue;
    const name = item?.name?.trim() || def?.name;
    // affiché s'il est cité dans un projet publié, ou ajouté (nouvel outil, ou outil connu renommé)
    const added = Boolean(item && (!def || item.name?.trim()));
    if (!name || (!used.has(id) && !added)) continue;
    const toolProjects = used.get(id) ?? [];
    const fromProjects = [...new Set(toolProjects.map((p) => p.category))];
    const fallback = isDomainSlug(item?.domain) ? item!.domain : def?.domain;
    const domains = fromProjects.length ? fromProjects : fallback ? [fallback as DomainSlug] : [];
    const icon = item?.icon?.trim();
    views.push({
      id,
      name,
      usage: item?.usage?.trim() || def?.usage,
      icon:
        icon && IMAGE.test(icon)
          ? { src: icon }
          : { builtin: isToolIcon(icon) ? icon : (def?.icon ?? 'tool') },
      domains: domainSlugs.filter((d) => domains.includes(d)),
      projects: toolProjects,
    });
  }
  return views;
}
