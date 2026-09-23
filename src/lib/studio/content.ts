/**
 * Contenu du site (admin → Contenu du site) — src/settings/content.json.
 *
 *   texts       textes modifiés, repérés par leur chemin dans le dictionnaire (src/i18n/ui/fr.ts),
 *               ex. « hero.eyebrow », « entities.clicgraph.name » : UNE seule source pour chaque texte,
 *               utilisée partout où il apparaît (accueil, cartes de projets, filtres, pied de page…)
 *   hero        liens des boutons, description
 *   expertises  ordre, visibilité, texte complémentaire, icône de chaque domaine
 *   ecosystem   entités (ClicGraph, JeeFSYS, et d'autres à ajouter) : logo, lien, bouton, ordre…
 *   about       étapes de la démarche, blocs de contenu supplémentaires
 *   contact     coordonnées (centralisées : priorité sur src/config/site.ts), réseaux, intro
 *   footer      liens, description, réseaux
 *
 * Tout est facultatif : sans réglage, le site garde exactement ses contenus actuels (valeurs du code).
 */
import { domainSlugs, type DomainSlug } from '@/data/domains';

export interface ExpertiseItem {
  slug: string;
  visible?: boolean;
  /** Texte complémentaire (Markdown léger), affiché sous la description. */
  extra?: string;
  /** Icône : celle d'un autre domaine. */
  icon?: string;
}

export interface EntityItem {
  /** Identifiant : 'clicgraph' / 'jeefsys' (entités du site) ou libre (entité ajoutée). */
  id: string;
  /** Entité ajoutée : ses textes sont ici (ceux de ClicGraph / JeeFSYS sont dans `texts`). */
  name?: string;
  role?: string;
  description?: string;
  logo?: string;
  icon?: string;
  href?: string;
  /** false : pas de bouton. */
  button?: boolean;
  buttonLabel?: string;
  visible?: boolean;
  domains?: string[];
}

export type AboutBlockType = 'heading' | 'text' | 'list' | 'quote' | 'image' | 'button';

export interface AboutBlock {
  id: string;
  type: AboutBlockType;
  text?: string;
  items?: string[];
  src?: string;
  alt?: string;
  label?: string;
  href?: string;
}

export interface SocialItem {
  label: string;
  href: string;
}

export interface ContentSettings {
  texts?: Record<string, string | string[]>;
  hero?: { description?: string; primaryHref?: string; secondaryHref?: string };
  expertises?: { items?: ExpertiseItem[] };
  ecosystem?: { items?: EntityItem[] };
  about?: { steps?: { title: string; text: string }[]; blocks?: AboutBlock[] };
  contact?: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    location?: string;
    intro?: string;
    socials?: SocialItem[];
    formEndpoint?: string;
    formAccessKey?: string;
  };
  footer?: {
    description?: string;
    links?: { label: string; href: string }[];
    /** Afficher les réseaux sociaux (s'il y en a). */
    socials?: boolean;
  };
}

/* ------------------------------------------------------------------ expertises */
/** Domaines dans l'ordre choisi (les domaines oubliés à la suite), sans les masqués. */
export function expertiseRows(content: ContentSettings = {}) {
  const items = content.expertises?.items ?? [];
  const known = new Set<string>(domainSlugs);
  const ordered = [
    ...new Set(items.map((i) => i.slug).filter((s) => known.has(s))),
    ...domainSlugs.filter((s) => !items.some((i) => i.slug === s)),
  ] as DomainSlug[];
  return ordered
    .map((slug) => {
      const item = items.find((i) => i.slug === slug) ?? { slug };
      const icon = item.icon && known.has(item.icon) ? (item.icon as DomainSlug) : slug;
      return { slug, extra: item.extra, icon, visible: item.visible !== false };
    })
    .filter((row) => row.visible);
}

/* ------------------------------------------------------------------ écosystème */
export const BUILTIN_ENTITIES = ['clicgraph', 'jeefsys'] as const;

/** Entités de la section Écosystème, dans l'ordre (ClicGraph et JeeFSYS par défaut). */
export function entityItems(content: ContentSettings = {}): (EntityItem & { builtin: boolean })[] {
  const items = content.ecosystem?.items ?? [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = [...items.map((i) => i.id), ...BUILTIN_ENTITIES.filter((id) => !byId.has(id))];
  return [...new Set(ordered)]
    .map((id) => ({
      ...(byId.get(id) ?? { id }),
      builtin: (BUILTIN_ENTITIES as readonly string[]).includes(id),
    }))
    .filter((i) => i.visible !== false && (i.builtin || i.name));
}

/* ------------------------------------------------------------------ liens */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

/** Lien sûr (pas de javascript:), sinon undefined. */
export function safeHref(href?: string): string | undefined {
  const h = href?.trim();
  return h && SAFE_URL.test(h) ? h : undefined;
}

/* ------------------------------------------------------------------ Markdown léger */
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** **gras**, *italique*, [lien](https://…) ; le reste est affiché tel quel (HTML échappé). */
export function inlineMarkdown(text: string): string {
  return escape(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
      const href = safeHref(url.replace(/&amp;/g, '&'));
      if (!href) return label;
      const external = /^https?:/i.test(href);
      return `<a href="${escape(href)}" class="link-line text-lavender-100"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

/** Paragraphes (ligne vide), listes (« - »), retours à la ligne. */
export function markdownBlocks(text: string): { type: 'p' | 'ul'; html: string[] }[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l)))
        return {
          type: 'ul' as const,
          html: lines.map((l) => inlineMarkdown(l.replace(/^\s*[-•*]\s+/, ''))),
        };
      return { type: 'p' as const, html: [lines.map(inlineMarkdown).join('<br />')] };
    });
}
