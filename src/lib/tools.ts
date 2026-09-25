/**
 * Expertises : outils (CV) ↔ domaines ↔ projets, avec les réglages de l'administration.
 *
 *  - toolViews   : les outils affichés, dans l'ordre, avec catégorie, niveau (s'il est réglé),
 *                  domaines et projets associés ;
 *  - toolGroups  : les mêmes, regroupés (Création & design / Technologies & ingénierie → sous-catégories) ;
 *  - domainViews : pour chaque domaine, ses projets, ses outils et le matériel cité dans ses projets.
 *
 * Fonctions pures (tests/tools.test.ts) : rien n'est inventé — outils du CV, projets réels, niveaux réglés.
 */
import { domainSlugs, isDomainSlug, type DomainSlug } from '@/data/domains';
import {
  TOOL_GROUPS,
  TOOL_SUBGROUPS,
  TOOLS,
  isToolSubgroup,
  toolLevel,
  type ToolDef,
  type ToolSubgroup,
} from '@/data/tools';
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
  group?: ToolSubgroup;
  /** Niveau réglé dans l'administration (aucun par défaut). */
  level?: { id: string; label: string; value: number };
  domains: DomainSlug[];
  projects: ProjectRef[];
}

export interface DomainView {
  slug: DomainSlug;
  projects: ProjectRef[];
  tools: ToolView[];
  /** Matériel et techniques cités dans les projets du domaine (dont les technologies inconnues). */
  extras: string[];
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const IMAGE = /^(\/|https?:\/\/)\S+\.(svg|png|webp|jpe?g|avif)$/i;

/** Outil ou matériel du registre correspondant à une technologie citée dans une fiche. */
export function findTool(tech: string): ToolDef | undefined {
  const key = norm(tech);
  return TOOLS.find((t) => t.id === key || t.aliases.includes(key));
}

/** Outils affichés : ceux du CV (registre) et ceux ajoutés dans l'administration. */
export function toolViews(
  projects: readonly ProjectRef[],
  content: Pick<ContentSettings, 'tools'> = {},
): ToolView[] {
  const items = content.tools?.items ?? [];
  const cited = new Map<string, ProjectRef[]>();
  for (const project of projects)
    for (const tech of project.technologies) {
      const def = findTool(tech);
      if (def?.kind !== 'tool') continue;
      const list = cited.get(def.id) ?? [];
      if (!list.some((p) => p.id === project.id)) list.push(project);
      cited.set(def.id, list);
    }

  // ordre : celui de l'administration, puis le registre
  const ids = [
    ...items.map((i) => i.id),
    ...TOOLS.filter((t) => t.kind === 'tool').map((t) => t.id),
  ];
  const views: ToolView[] = [];
  for (const id of new Set(ids)) {
    const item = items.find((i) => i.id === id);
    const def = TOOLS.find((t) => t.id === id);
    if (item?.visible === false || def?.kind === 'hardware') continue;
    const name = item?.name?.trim() || def?.name;
    if (!name) continue;

    // projets : cités dans les fiches + choisis dans l'administration (projets publiés uniquement)
    const chosen = (item?.projects ?? [])
      .map((pid) => projects.find((p) => p.id === pid))
      .filter((p): p is ProjectRef => Boolean(p));
    const toolProjects = [...(cited.get(id) ?? [])];
    for (const p of chosen) if (!toolProjects.some((x) => x.id === p.id)) toolProjects.push(p);

    // domaines : ceux réglés dans l'administration, sinon ceux du registre + ceux des projets
    const own = item?.domains?.filter(isDomainSlug);
    const domains = own?.length
      ? own
      : [...(def?.domains ?? []), ...toolProjects.map((p) => p.category)];

    const icon = item?.icon?.trim();
    const group = isToolSubgroup(item?.group) ? item!.group : def?.group;
    const level = toolLevel(item?.level);
    views.push({
      id,
      name,
      usage: item?.usage?.trim() || def?.usage,
      icon:
        icon && IMAGE.test(icon)
          ? { src: icon }
          : { builtin: isToolIcon(icon) ? icon : (def?.icon ?? 'tool') },
      group,
      level: level ? { ...level } : undefined,
      domains: domainSlugs.filter((d) => domains.includes(d)),
      projects: toolProjects,
    });
  }
  return views;
}

/** Outils regroupés par catégorie puis sous-catégorie (groupes vides retirés). */
export function toolGroups(tools: readonly ToolView[]) {
  const others = tools.filter((t) => !t.group);
  return [
    ...TOOL_GROUPS.map((g) => ({
      id: g.id as string,
      label: g.label as string,
      subgroups: TOOL_SUBGROUPS.filter((s) => s.group === g.id)
        .map((s) => ({
          id: s.id as string,
          label: s.label as string,
          tools: tools.filter((t) => t.group === s.id),
        }))
        .filter((s) => s.tools.length > 0),
    })),
    {
      id: 'autres',
      label: 'Autres outils',
      subgroups: [{ id: 'autres', label: '', tools: others }],
    },
  ].filter((g) => g.subgroups.some((s) => s.tools.length > 0));
}

/** Domaines : projets qui les démontrent, outils qui y interviennent, matériel cité. */
export function domainViews(
  projects: readonly ProjectRef[],
  tools: readonly ToolView[],
  domainTitles: Partial<Record<DomainSlug, string>> = {},
): Map<DomainSlug, DomainView> {
  const titles = new Set(Object.values(domainTitles).map((t) => norm(t ?? '')));
  const views = new Map<DomainSlug, DomainView>(
    domainSlugs.map((slug) => [
      slug,
      { slug, projects: [], tools: tools.filter((t) => t.domains.includes(slug)), extras: [] },
    ]),
  );
  for (const project of projects) {
    const view = views.get(project.category);
    if (!view) continue;
    view.projects.push(project);
    for (const tech of project.technologies) {
      // « Automatisation industrielle » cité comme technologie = le domaine lui-même : pas de doublon
      if (!tech.trim() || titles.has(norm(tech))) continue;
      const def = findTool(tech);
      if (def?.kind === 'tool') continue; // déjà parmi les outils du domaine
      const label = def?.name ?? tech.trim();
      if (!view.extras.includes(label)) view.extras.push(label);
    }
  }
  return views;
}
