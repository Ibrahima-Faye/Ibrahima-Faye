/**
 * État d'un projet en cours d'édition + enregistrement automatique.
 * Chaque modification appelle `touch()` : l'enregistrement part ~1 s plus tard (ou tout de suite avec `flush()`).
 */
import { DEFAULT_ALIGN, defaultSpan, parseRatio, type Span } from '@/lib/gallery-layout';
import { effectiveCover, galleryEntries } from '@/lib/media-rules';
import type { Block } from '@/schemas/blocks';
import { api, ApiError } from './api';
import type { FileInfo, GalleryItem, MediaEntry, ProjectData, ProjectDetail } from './types';

/**
 * `error` : échec (réseau…) — nouvel essai automatique toutes les 5 s ;
 * `conflict` : le fichier a été modifié ailleurs — l'utilisateur choisit (recharger ou écraser).
 */
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

const RETRY_MS = 5000;

/** Ratio (largeur / hauteur) d'un média de la galerie. */
export function itemRatio(item: GalleryItem, files: FileInfo[]): number {
  if (item.kind === 'image') return item.width && item.height ? item.width / item.height : 1.5;
  const declared = parseRatio(item.ratio);
  if (declared) return declared;
  // dimensions mesurées par le pipeline médias (vidéo web)
  if (item.width && item.height) return item.width / item.height;
  const poster = files.find((f) => f.name === item.poster);
  return poster?.width && poster.height ? poster.width / poster.height : 16 / 9;
}

export class Editor {
  slug: string;
  data: ProjectData;
  body: string;
  files: FileInfo[];
  items: GalleryItem[];
  updatedAt: number;

  status: SaveStatus = 'saved';
  error = '';
  savedAt = 0;

  private rev = 0;
  private savedRev = 0;
  private timer = 0;
  private retryTimer = 0;
  private saving = false;
  private pending: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(detail: ProjectDetail) {
    this.slug = detail.slug;
    this.data = { ...detail.data, entity: [detail.data.entity ?? 'personal'].flat() };
    this.body = detail.body;
    this.files = detail.files;
    this.updatedAt = detail.updatedAt;
    this.savedAt = detail.updatedAt;
    this.items = this.buildItems(detail.files, detail.data.media ?? []);
  }

  /* ------------------------------------------------------------------ construction de la galerie */
  /** Composition de la galerie — mêmes règles que le site (src/lib/media-rules.ts). */
  private buildItems(files: FileInfo[], media: MediaEntry[]): GalleryItem[] {
    const byName = new Map(files.map((f) => [f.name, f]));
    const settings = new Map(media.map((m) => [m.file, m]));
    return galleryEntries(files, media).map(({ file: name, hidden }) => {
      const file = byName.get(name)!;
      const entry = settings.get(name);
      const item: GalleryItem = {
        file: file.name,
        kind: file.kind,
        size: file.size,
        width: file.width,
        height: file.height,
        span: entry?.span ?? 6,
        align: entry?.align ?? DEFAULT_ALIGN,
        alt: entry?.alt ?? '',
        caption: entry?.caption ?? '',
        ratio: entry?.ratio,
        hidden, // `cover.*` non listé : masqué, comme sur le site
        poster: file.poster,
        v: file.mtime,
      };
      if (!entry?.span) item.span = defaultSpan(item.kind, itemRatio(item, files));
      return item;
    });
  }

  /** Le projet est-il mis en page en blocs ? (la composition historique ne concerne alors que les médias non placés) */
  hasBlocks(): boolean {
    return Array.isArray(this.data.blocks);
  }

  blocks(): Block[] {
    return Array.isArray(this.data.blocks) ? this.data.blocks : [];
  }

  /**
   * Remplace la mise en page en blocs. `null` = retour à la composition historique (demande explicite
   * de l'utilisateur ; la version précédente reste dans .cms/historique/).
   */
  setBlocks(blocks: Block[] | null) {
    (this.data as { blocks?: Block[] | null }).blocks = blocks;
    this.touch();
  }

  /* ------------------------------------------------------------------ couverture */
  /** Fichier de couverture effectif — même règle que le site : champ `cover`, sinon `cover.*`, sinon 1re image. */
  coverFile(): string | undefined {
    return effectiveCover(this.data.cover, this.files);
  }

  setCover(file: string | undefined) {
    if (file) this.data.cover = file;
    else delete this.data.cover;
    this.touch();
  }

  /* ------------------------------------------------------------------ médias */
  item(file: string) {
    return this.items.find((i) => i.file === file);
  }

  addFile(info: FileInfo, extra: Partial<GalleryItem> = {}): GalleryItem {
    this.files = [...this.files.filter((f) => f.name !== info.name), info];
    const item: GalleryItem = {
      file: info.name,
      kind: info.kind,
      size: info.size,
      width: info.width,
      height: info.height,
      span: 6,
      align: DEFAULT_ALIGN,
      alt: '',
      caption: '',
      hidden: false,
      poster: info.poster,
      v: info.mtime,
      ...extra,
    };
    item.span = extra.span ?? defaultSpan(item.kind, itemRatio(item, this.files));
    this.items.push(item);
    this.touch();
    return item;
  }

  /**
   * Nouvelles informations sur les fichiers (ex. versions web générées) : dimensions et affiches mises à jour,
   * sans rien modifier dans la fiche (aucun enregistrement déclenché).
   */
  updateFiles(files: FileInfo[]) {
    this.files = files;
    const byName = new Map(files.map((f) => [f.name, f]));
    for (const item of this.items) {
      const file = byName.get(item.file);
      if (!file) continue;
      item.width = file.width;
      item.height = file.height;
      item.poster = file.poster;
      item.size = file.size;
    }
    this.emit();
  }

  setPoster(video: string, poster: FileInfo) {
    this.files = [...this.files.filter((f) => f.name !== poster.name), poster];
    const item = this.item(video);
    if (item) {
      item.poster = poster.name;
      item.v = Date.now();
    }
    this.touch();
  }

  removeFiles(names: string[]) {
    this.files = this.files.filter((f) => !names.includes(f.name));
    this.items = this.items.filter((i) => !names.includes(i.file));
    if (this.data.cover && names.includes(this.data.cover)) delete this.data.cover;
    // Les emplacements de ces fichiers sont retirés des blocs ; les blocs eux-mêmes ne sont JAMAIS supprimés.
    if (Array.isArray(this.data.blocks)) {
      this.data.blocks = this.data.blocks.map((block) =>
        Array.isArray(block.items)
          ? { ...block, items: block.items.filter((item) => !names.includes(item.file)) }
          : block,
      );
    }
    this.touch();
  }

  /** Applique l'ordre affiché (liste de noms de fichiers). */
  reorder(names: string[]) {
    const order = new Map(names.map((n, i) => [n, i]));
    this.items.sort((a, b) => (order.get(a.file) ?? 1e9) - (order.get(b.file) ?? 1e9));
    this.touch();
  }

  setSpan(item: GalleryItem, span: Span) {
    item.span = span;
    this.touch();
  }

  /* ------------------------------------------------------------------ enregistrement */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  /** À appeler après toute modification. */
  touch() {
    this.rev++;
    this.status = 'dirty';
    this.emit();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), 900);
  }

  private payload() {
    const media: MediaEntry[] = this.items.map((i) => ({
      file: i.file,
      span: i.span,
      align: i.align,
      alt: i.alt.trim() || undefined,
      caption: i.caption.trim() || undefined,
      ratio: i.kind === 'video' ? i.ratio : undefined,
      hidden: i.hidden || undefined,
    }));
    return { data: { ...this.data, media }, body: this.body };
  }

  /**
   * Enregistre maintenant. `force` : écrase une version modifiée ailleurs (après accord de l'utilisateur ;
   * l'autre version est gardée dans .cms/historique/).
   */
  flush(force = false): Promise<void> {
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    if (this.saving) return this.pending;
    if (this.status === 'conflict' && !force) return Promise.resolve();
    if (this.rev === this.savedRev && this.status !== 'error' && !force) return Promise.resolve();
    this.saving = true;
    this.status = 'saving';
    this.emit();
    const rev = this.rev;
    this.pending = (async () => {
      try {
        const result = await api.save(this.slug, {
          ...this.payload(),
          baseUpdatedAt: this.updatedAt,
          force,
        });
        this.updatedAt = result.updatedAt;
        this.savedAt = Date.now();
        this.savedRev = rev;
        this.error = '';
        this.status = this.rev === rev ? 'saved' : 'dirty';
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        if (error instanceof ApiError && error.status === 409) {
          this.status = 'conflict';
        } else {
          this.status = 'error';
          // nouvel essai automatique (serveur arrêté, réseau…) : rien n'est perdu tant que la page reste ouverte
          this.retryTimer = window.setTimeout(() => void this.flush(), RETRY_MS);
        }
      } finally {
        this.saving = false;
        this.emit();
      }
      if (this.status === 'dirty') await this.flush();
    })();
    return this.pending;
  }

  dispose() {
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    this.listeners.clear();
  }
}
