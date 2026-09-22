import type { Align, Span, SpanInfo } from '@/lib/gallery-layout';

/** Vocabulaire du site, transmis par la page /admin (une seule source de vérité : src/data + src/i18n). */
export interface Meta {
  categories: { slug: string; number: string; title: string }[];
  entities: { slug: string; name: string; role: string }[];
  statuses: { slug: string; label: string }[];
  spans: SpanInfo[];
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
  | { name: 'edit'; slug: string; tab: 'infos' | 'galerie' | 'apercu' };

export interface View {
  dispose(): void | Promise<void>;
  /** Appelé quand seule la sous-page change (onglet) ; renvoie true si la vue s'est mise à jour seule. */
  update?(route: Route): boolean;
}
