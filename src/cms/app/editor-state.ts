/**
 * État d'un projet en cours d'édition + enregistrement automatique.
 * Chaque modification appelle `touch()` : l'enregistrement part ~1 s plus tard (ou tout de suite avec `flush()`).
 */
import { DEFAULT_ALIGN, defaultSpan, parseRatio, type Span } from '@/lib/gallery-layout';
import { effectiveCover, galleryEntries } from '@/lib/media-rules';
import { api } from './api';
import type { FileInfo, GalleryItem, MediaEntry, ProjectData, ProjectDetail } from './types';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

/** Ratio (largeur / hauteur) d'un média de la galerie. */
export function itemRatio(item: GalleryItem, files: FileInfo[]): number {
  if (item.kind === 'image') return item.width && item.height ? item.width / item.height : 1.5;
  const declared = parseRatio(item.ratio);
  if (declared) return declared;
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

  /** Le projet est-il mis en page en blocs ? (la composition ci-dessous ne concerne alors que les médias non placés) */
  hasBlocks(): boolean {
    return Array.isArray(this.data.blocks);
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

  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.saving) return this.pending;
    if (this.rev === this.savedRev && this.status !== 'error') return Promise.resolve();
    this.saving = true;
    this.status = 'saving';
    this.emit();
    const rev = this.rev;
    this.pending = (async () => {
      try {
        const result = await api.save(this.slug, this.payload());
        this.updatedAt = result.updatedAt;
        this.savedAt = Date.now();
        this.savedRev = rev;
        this.error = '';
        this.status = this.rev === rev ? 'saved' : 'dirty';
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        this.status = 'error';
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
    this.listeners.clear();
  }
}
