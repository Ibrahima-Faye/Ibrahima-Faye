import type { Align, Span, SpanInfo } from '@/lib/gallery-layout';
import type { Block } from '@/schemas/blocks';

/** Vocabulaire du site, transmis par la page /admin (une seule source de vérité : src/data + src/i18n). */
export interface Meta {
  categories: { slug: string; number: string; title: string }[];
  entities: { slug: string; name: string; role: string }[];
  statuses: { slug: string; label: string }[];
  spans: SpanInfo[];
  /** Projets (Expertises → Outils : projets associés). */
  projects?: { id: string; title: string; draft: boolean }[];
  /** Studio : textes d'origine du site (chemin du dictionnaire → texte) et libellés de navigation. */
  studio?: {
    texts: Record<string, string | string[]>;
    nav: Record<string, string>;
    /** Dictionnaire d'origine complet (src/i18n/ui/fr.ts) : valeurs par défaut du Contenu du site. */
    dictionary: Record<string, unknown>;
    /** Coordonnées d'origine (src/config/site.ts, sans les réglages). */
    contact: Record<string, string>;
  };
}

export interface ProjectSummary {
  slug: string;
  title: string;
  category?: string;
  entity: string[];
  year?: number;
  status?: string;
  draft: boolean;
  featured?: boolean;
  order?: number;
  hasSummary?: boolean;
  cover?: string;
  coverV?: number;
  mediaCount: number;
  /** Originaux dont la version web manque ou n'est plus à jour. */
  webPending?: number;
  updatedAt: number;
  /** Renseigné si project.md est illisible (erreur de syntaxe…). */
  error?: string;
}

export interface FileInfo {
  name: string;
  kind: 'image' | 'video';
  size: number;
  mtime: number;
  width?: number;
  height?: number;
  /** Vidéo : nom de son affiche (image du même nom). */
  poster?: string;
  /** Image : nom de la vidéo dont elle est l'affiche. */
  posterFor?: string;
  /** Versions web (pipeline médias) : statut et caractéristiques. */
  web?: WebInfo;
}

/** État des versions web d'un original (integrations/local-cms/media/pipeline.mjs). */
export interface WebInfo {
  /** ok · pending (à générer) · queued (en file) · running (en cours) · error */
  status: 'ok' | 'pending' | 'queued' | 'running' | 'error';
  progress?: number;
  error?: string;
  kind?: 'image' | 'video';
  width?: number;
  height?: number;
  ratio?: number;
  duration?: number;
  audio?: boolean;
  animated?: boolean;
  vector?: boolean;
  transcode?: string;
  sizes?: Record<string, number>;
  outputs?: Record<string, string>;
  /** Versions de plus de 25 Mio : 'remote' (stockage externe, hors git et hors build). */
  storage?: Record<string, 'local' | 'remote'>;
  source?: {
    width?: number;
    height?: number;
    codec?: string;
    fps?: number;
    hdr?: boolean;
    format?: string;
    size?: number;
  };
}

export interface MediaEntry {
  file: string;
  span?: Span;
  align?: Align;
  alt?: string;
  caption?: string;
  ratio?: string;
  hidden?: boolean;
}

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectData {
  title: string;
  category: string;
  entity: string | string[];
  summary?: string;
  year?: number;
  status?: string;
  technologies?: string[];
  role?: string;
  context?: string;
  result?: string;
  client?: string;
  featured?: boolean;
  order?: number;
  cover?: string;
  coverAlt?: string;
  links?: ProjectLink[];
  media?: MediaEntry[];
  /** Mise en page en blocs (src/schemas/blocks.ts). Conservée telle quelle par l'éditeur. */
  blocks?: Block[];
  unplaced?: 'append' | 'hide';
  draft?: boolean;
  [key: string]: unknown;
}

export interface ProjectDetail {
  slug: string;
  data: ProjectData;
  body: string;
  files: FileInfo[];
  updatedAt: number;
}

/** Un média de la galerie, tel qu'édité dans l'administration. */
export interface GalleryItem {
  file: string;
  kind: 'image' | 'video';
  size: number;
  width?: number;
  height?: number;
  span: Span;
  align: Align;
  alt: string;
  caption: string;
  /** Vidéos : ratio « L:H ». */
  ratio?: string;
  hidden: boolean;
  /** Vidéos : nom du fichier d'affiche. */
  poster?: string;
  /** Force le rechargement des miniatures quand le fichier change. */
  v: number;
}

export type Route =
  | { name: 'dashboard' }
  | { name: 'projects' }
  | { name: 'new' }
  | { name: 'edit'; slug: string; tab: 'infos' | 'galerie' | 'apercu' }
  | { name: 'studio'; tab: StudioTab }
  | { name: 'content'; tab: ContentTab };

export type StudioTab = 'theme' | 'animations' | 'sections' | 'navigation';

export type SettingsName = 'theme' | 'layout' | 'navigation' | 'animations' | 'content';

export type ContentTab =
  | 'accueil'
  | 'identite'
  | 'expertises'
  | 'projets'
  | 'ecosysteme'
  | 'a-propos'
  | 'contact'
  | 'footer'
  | 'navigation';

/** Réglages du site (src/settings/<name>.json) tels que renvoyés par l'API. */
export interface SettingsFile {
  name: SettingsName;
  data: Record<string, unknown>;
  updatedAt: number;
}

export interface View {
  dispose(): void | Promise<void>;
  /** Appelé quand seule la sous-page change (onglet) ; renvoie true si la vue s'est mise à jour seule. */
  update?(route: Route): boolean;
}
