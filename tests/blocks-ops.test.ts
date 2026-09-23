/** Opérations de l'éditeur de blocs : ids stables, rien de perdu, conversion fidèle. */
import { describe, expect, it } from 'vitest';
import {
  addItems,
  collectIds,
  convertBlock,
  createBlock,
  duplicateBlock,
  fromLegacy,
  insertBlock,
  moveBlock,
  moveItem,
  removeBlock,
  removeItem,
  setColumns,
  setPerView,
  setSpan,
  usage,
} from '@/cms/app/blocks-ops';
import { normalizeGallery } from '@/lib/gallery/normalize';
import { galleryEntries, mediaFiles } from '@/lib/media-rules';
import { blocksSchema, type Block } from '@/schemas/blocks';
import { realProjects } from './helpers';

const base = (): Block[] => [
  {
    id: 'b-1',
    type: 'grid',
    columns: { desktop: 3, tablet: 2, mobile: 1 },
    futur: 1,
    items: [
      { id: 'i-1', file: 'a.jpg', span: { desktop: 2 } },
      { id: 'i-2', file: 'b.jpg', note: 'x' },
    ],
  },
  {
    id: 'b-2',
    type: 'carousel',
    items: [
      { id: 'i-3', file: 'c.jpg' },
      { id: 'i-4', file: 'd.mp4' },
    ],
  },
];

describe('opérations', () => {
  it('ajouter des blocs : ids uniques, valeurs par défaut valides', () => {
    const used = collectIds(base());
    const grid = createBlock('grid', used);
    const carousel = createBlock('carousel', used);
    const blocks = insertBlock(insertBlock(base(), grid, 0), carousel);
    expect(blocks.map((b) => b.type)).toEqual(['grid', 'grid', 'carousel', 'carousel']);
    expect(new Set(blocks.map((b) => b.id)).size).toBe(4);
    expect(grid.columns).toEqual({ desktop: 3, tablet: 2, mobile: 1 });
    expect(carousel).toMatchObject({ perView: { desktop: 1 }, controls: ['arrows', 'dots'] });
    expect(blocksSchema.safeParse(blocks).success).toBe(true);
  });

  it('réordonner, dupliquer, supprimer un bloc ; l’original n’est jamais modifié', () => {
    const original = base();
    const snapshot = structuredClone(original);
    expect(moveBlock(original, 1, 0).map((b) => b.id)).toEqual(['b-2', 'b-1']);
    const dup = duplicateBlock(original, 'b-1');
    expect(dup).toHaveLength(3);
    expect(dup[1]!.id).not.toBe('b-1');
    expect(dup[1]!.items!.map((i) => i.file)).toEqual(['a.jpg', 'b.jpg']);
    expect(dup[1]!.items!.map((i) => i.id)).not.toContain('i-1');
    expect(dup[1]).toMatchObject({ futur: 1 }); // champs inconnus copiés
    expect(removeBlock(original, 'b-2').map((b) => b.id)).toEqual(['b-1']);
    expect(original).toEqual(snapshot);
  });

  it('glisser un média d’un bloc à l’autre : il garde son id et ses réglages', () => {
    const moved = moveItem(base(), { block: 'b-1', index: 1 }, { block: 'b-2', index: 0 });
    expect(moved[0]!.items!.map((i) => i.id)).toEqual(['i-1']);
    expect(moved[1]!.items![0]).toEqual({ id: 'i-2', file: 'b.jpg', note: 'x' });
    const reordered = moveItem(base(), { block: 'b-1', index: 0 }, { block: 'b-1', index: 1 });
    expect(reordered[0]!.items!.map((i) => i.id)).toEqual(['i-2', 'i-1']);
  });

  it('ajouter depuis la médiathèque (même fichier réutilisable), retirer un élément sans toucher au fichier', () => {
    const added = addItems(base(), 'b-2', ['a.jpg', 'e.jpg'], 1);
    expect(added[1]!.items!.map((i) => i.file)).toEqual(['c.jpg', 'a.jpg', 'e.jpg', 'd.mp4']);
    expect(usage(added).get('a.jpg')).toBe(2);
    const removed = removeItem(added, 'b-2', added[1]!.items![1]!.id!);
    expect(removed[1]!.items!.map((i) => i.file)).toEqual(['c.jpg', 'e.jpg', 'd.mp4']);
    expect(removed).toHaveLength(2); // le bloc reste
  });

  it('colonnes par appareil : spans ramenés en proportion, jamais plus larges que la grille', () => {
    const blocks = setColumns(base(), 'b-1', 'desktop', 1);
    expect(blocks[0]!.columns).toEqual({ desktop: 1, tablet: 2, mobile: 1 });
    expect(blocks[0]!.items!.every((i) => (i.span as { desktop: number }).desktop === 1)).toBe(
      true,
    );
    const wide = setSpan(base(), 'b-1', 'i-2', 'tablet', 9);
    expect(wide[0]!.items![1]!.span).toMatchObject({ tablet: 2 }); // borné à 2 colonnes
    const twelve: Block[] = [
      {
        id: 'g',
        type: 'grid',
        columns: { desktop: 12 },
        items: [{ id: 'x', file: 'a.jpg', span: 6 }],
      },
    ];
    expect(setColumns(twelve, 'g', 'desktop', 3)[0]!.items![0]!.span).toMatchObject({ desktop: 2 }); // 1/2 → 2 sur 3 ≈ 1/2
  });

  it('carrousel ↔ grille : médias conservés ; médias visibles par appareil', () => {
    const grid = convertBlock(base(), 'b-2', 'grid');
    expect(grid[1]!.type).toBe('grid');
    expect(grid[1]!.items!.map((i) => i.id)).toEqual(['i-3', 'i-4']);
    expect(grid[1]!.columns).toBeDefined();
    const pv = setPerView(base(), 'b-2', 'desktop', 1.5);
    expect(pv[1]!.perView).toEqual({ desktop: 1.5, tablet: 1, mobile: 1 });
  });
});

describe('« Organiser en blocs » reproduit exactement la composition actuelle', () => {
  for (const p of realProjects()) {
    const files = mediaFiles(p.files);
    const media = (p.data.media ?? []) as {
      file: string;
      span?: number;
      align?: string;
      hidden?: boolean;
    }[];
    const legacyItems = galleryEntries(files, media).map((e) => {
      const conf = media.find((m) => m.file === e.file);
      return {
        file: e.file,
        span: conf?.span ?? 6,
        align: conf?.align ?? 'center',
        hidden: e.hidden,
      };
    });
    it(`${p.slug} : mêmes médias, même ordre, mêmes largeurs, pleine largeur sur mobile`, () => {
      const before = normalizeGallery({ files, media: media as never });
      const after = normalizeGallery({
        files,
        media: media as never,
        blocks: fromLegacy(legacyItems),
      });
      const flat = (r: typeof before) => r.blocks.flatMap((b) => b.items.map((i) => i.file));
      expect(flat(after)).toEqual(flat(before));
      for (const item of after.blocks.flatMap((b) => b.items)) {
        const conf = media.find((m) => m.file === item.file);
        expect(item.span).toEqual({ desktop: conf?.span ?? 6, tablet: conf?.span ?? 6, mobile: 1 });
      }
      expect(after.blocks.filter((b) => b.type === 'unplaced')).toHaveLength(0);
    });
  }
});
