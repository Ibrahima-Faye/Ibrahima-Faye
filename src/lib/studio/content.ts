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
 *   links       liens personnels (réseaux, contact) : nom, URL, icône, catégorie, ordre, actif — utilisés par
 *               l'en-tête (menu mobile), la section Contact, le pied de page et le référencement
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

export type LinkCategory = 'social' | 'contact' | 'other';

export interface LinkItem {
  id: string;
  label: string;
  /** URL, adresse e-mail, numéro de téléphone… (complétés : mailto:, tel:, https://wa.me/…). */
  href?: string;
  icon?: string;
  category?: LinkCategory;
  visible?: boolean;
}

export interface TimelineItem {
  id: string;
  /** formation | experience (colonne du parcours). */
  kind?: string;
  /** Ex. « 2021 – 2023 » (libre). */
  period?: string;
  title: string;
  text?: string;
}

export interface ToolItem {
  /** Identifiant (celui d'un outil connu, ex. « sketchup », ou un nouvel identifiant). */
  id: string;
  name?: string;
  /** Icône intégrée (ex. « sketchup », « chip ») ou image (« /identite/logo-outil.svg »). */
  icon?: string;
  /** Description courte : l'usage de l'outil dans le travail. */
  usage?: string;
  /** Sous-catégorie (src/data/tools.ts → TOOL_GROUPS), ex. « 3d-cao ». */
  group?: string;
  /** Niveau : decouverte | utilisation | maitrise | avance (aucun par défaut). */
  level?: string;
  /** Domaines d'expertise associés (slugs) ; vide = ceux d'origine. */
  domains?: string[];
  /** Projets associés (identifiants), en plus de ceux dont la fiche cite l'outil. */
  projects?: string[];
  visible?: boolean;
}

export interface ContentSettings {
  texts?: Record<string, string | string[]>;
  links?: LinkItem[];
  hero?: { description?: string; primaryHref?: string; secondaryHref?: string };
  expertises?: { items?: ExpertiseItem[] };
  ecosystem?: {
    items?: EntityItem[];
    /** Parcours d'un projet entre les deux univers : remplace celui d'origine. */
    flow?: { title: string; text?: string; side?: string }[];
  };
  about?: {
    steps?: { title: string; text: string }[];
    blocks?: AboutBlock[];
    /** Parcours (formation, expérience) : remplace celui d'origine. */
    timeline?: TimelineItem[];
    /** Fiche d'identité : remplace celle d'origine. */
    facts?: { label: string; value: string }[];
  };
  /** Outils (section Expertises) : ajouts, icônes, textes, visibilité — voir src/lib/tools.ts. */
  tools?: { items?: ToolItem[] };
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

/* ------------------------------------------------------------------ liens personnels */
/** Liste proposée par défaut (vide : rien ne s'affiche tant qu'une adresse n'est pas saisie). */
export const DEFAULT_LINK_ITEMS: readonly LinkItem[] = [
  { id: 'instagram', label: 'Instagram', icon: 'instagram', category: 'social' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', category: 'contact' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin', category: 'social' },
  { id: 'github', label: 'GitHub', icon: 'github', category: 'social' },
  { id: 'youtube', label: 'YouTube', icon: 'youtube', category: 'social' },
  { id: 'email', label: 'E-mail', icon: 'mail', category: 'contact' },
  { id: 'telephone', label: 'Téléphone', icon: 'phone', category: 'contact' },
];

/**
 * Liens personnels : la liste réglée ; sinon la liste par défaut, complétée par les anciennes
 * coordonnées (Contact : e-mail, téléphone, WhatsApp, réseaux) pour ne rien perdre.
 */
export function linkItems(content: ContentSettings = {}): LinkItem[] {
  if (content.links) return content.links;
  const c = content.contact ?? {};
  const legacy: Record<string, string | undefined> = {
    email: c.email,
    telephone: c.phone,
    whatsapp: c.whatsapp,
  };
  const socials = (c.socials ?? []).map((s, i) => ({
    id: `reseau-${i + 1}`,
    label: s.label,
    href: s.href,
    icon: guessIcon(s.href),
    category: 'social' as const,
  }));
  return [
    ...DEFAULT_LINK_ITEMS.map((l) => ({ ...l, ...(legacy[l.id] ? { href: legacy[l.id] } : {}) })),
    ...socials,
  ];
}

/** Icône déduite d'une adresse (liens anciens sans icône). */
export function guessIcon(href = ''): string {
  const h = href.toLowerCase();
  const known = [
    'instagram',
    'linkedin',
    'github',
    'youtube',
    'facebook',
    'tiktok',
    'behance',
    'dribbble',
    'telegram',
  ];
  const found = known.find((k) => h.includes(k));
  if (found) return found;
  if (h.includes('wa.me') || h.includes('whatsapp')) return 'whatsapp';
  if (h.includes('x.com') || h.includes('twitter')) return 'x';
  if (h.startsWith('mailto:') || h.includes('@')) return 'mail';
  if (h.startsWith('tel:')) return 'phone';
  return 'link';
}

/** Adresse finale d'un lien (e-mail → mailto:, numéro → tel: ou wa.me, domaine → https://). */
export function linkHref(item: Pick<LinkItem, 'href' | 'icon'>): string | undefined {
  const raw = item.href?.trim();
  if (!raw) return undefined;
  if (safeHref(raw)) return raw;
  if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(raw)) return `mailto:${raw}`;
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+?\d{6,15}$/.test(digits) && /^[\d\s+().-]+$/.test(raw))
    return item.icon === 'whatsapp'
      ? `https://wa.me/${digits.replace(/^\+/, '')}`
      : `tel:${digits}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(raw)) return `https://${raw}`;
  return undefined;
}

/** Texte affiché pour un lien de contact (adresse lisible plutôt que l'URL). */
export function linkDisplay(item: Pick<LinkItem, 'href' | 'label'>): string {
  const raw = item.href?.trim() ?? '';
  if (raw.startsWith('mailto:')) return raw.slice(7);
  if (raw.startsWith('tel:')) return raw.slice(4);
  if (/^https?:\/\//.test(raw)) return item.label;
  return raw || item.label;
}

export interface ResolvedLink extends LinkItem {
  url: string;
  display: string;
}

/** Liens actifs, avec une adresse valable, dans l'ordre choisi. */
export function activeLinks(
  content: ContentSettings = {},
  category?: LinkCategory,
): ResolvedLink[] {
  return linkItems(content)
    .filter((l) => l.visible !== false && (!category || (l.category ?? 'social') === category))
    .map((l) => ({ ...l, url: linkHref(l) ?? '', display: linkDisplay(l) }))
    .filter((l) => l.url && l.label?.trim());
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
