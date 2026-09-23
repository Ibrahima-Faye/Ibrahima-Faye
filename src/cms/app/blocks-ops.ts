/**
 * Opérations de l'éditeur de blocs — fonctions pures : elles renvoient une NOUVELLE liste de blocs
 * (rien n'est modifié en place), ce qui rend chaque geste de l'éditeur simple, testable et réversible.
 *
 * Garanties :
 *  - les `id` existants ne changent jamais ; les nouveaux sont uniques ;
 *  - les champs inconnus d'un bloc ou d'un élément sont conservés ;
 *  - retirer un élément ne supprime jamais le fichier (il reste dans la médiathèque) ;
 *  - aucun bloc n'est supprimé sans demande explicite (`removeBlock`).
 */
import type { Block, BlockItem, Device, PerDevice } from '@/schemas/blocks';
import { resolveColumns, resolvePerView, resolveSpan } from '@/lib/gallery/normalize';

export type EditableType = 'single' | 'grid' | 'carousel';

/* ------------------------------------------------------------------ identifiants */
export function collectIds(blocks: readonly Block[]): Set<string> {
  const used = new Set<string>();
  for (const b of blocks) {
    if (b.id) used.add(b.id);
    for (const i of b.items ?? []) if (i.id) used.add(i.id);
  }
  return used;
}

export function newId(prefix: 'b' | 'i', used: Set<string>): string {
  let id: string;
  do id = `${prefix}-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`;
  while (used.has(id));
  used.add(id);
  return id;
}

const withItems = (block: Block): BlockItem[] => block.items ?? [];

/* ------------------------------------------------------------------ valeurs par défaut */
const DEFAULTS: Record<EditableType, Partial<Block>> = {
  single: {},
  grid: { columns: { desktop: 3, tablet: 2, mobile: 1 } },
  carousel: {
    perView: { desktop: 1, tablet: 1, mobile: 1 },
    loop: false,
    autoplay: 0,
    controls: ['arrows', 'dots'],
  },
};

export function createBlock(type: EditableType, used: Set<string>): Block {
  return { id: newId('b', used), type, ...structuredClone(DEFAULTS[type]), items: [] };
}

/* ------------------------------------------------------------------ blocs */
export function insertBlock(
  blocks: readonly Block[],
  block: Block,
  index = blocks.length,
): Block[] {
  const next = [...blocks];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
  return next;
}

export function removeBlock(blocks: readonly Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id);
}

export function moveBlock(blocks: readonly Block[], from: number, to: number): Block[] {
  if (from === to || from < 0 || from >= blocks.length) return [...blocks];
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!);
  return next;
}

/** Copie juste après l'original, avec de nouveaux identifiants (bloc et éléments). */
export function duplicateBlock(blocks: readonly Block[], id: string): Block[] {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return [...blocks];
  const used = collectIds(blocks);
  const copy = structuredClone(blocks[index]!);
  copy.id = newId('b', used);
  copy.items = withItems(copy).map((item) => ({ ...item, id: newId('i', used) }));
  return insertBlock(blocks, copy, index + 1);
}

export function updateBlock(
  blocks: readonly Block[],
  id: string,
  patch: Partial<Block> | ((block: Block) => Block),
): Block[] {
  return blocks.map((b) =>
    b.id === id ? (typeof patch === 'function' ? patch(b) : { ...b, ...patch }) : b,
  );
}

/** Change le type d'un bloc en gardant ses médias ; les réglages propres à l'ancien type restent (inoffensifs). */
export function convertBlock(blocks: readonly Block[], id: string, type: EditableType): Block[] {
  return updateBlock(blocks, id, (b) => {
    const next: Block = { ...structuredClone(DEFAULTS[type]), ...b, type };
    if (type === 'grid' && !b.columns) next.columns = structuredClone(DEFAULTS.grid.columns);
    if (type === 'carousel' && !b.perView)
      next.perView = structuredClone(DEFAULTS.carousel.perView);
    return next;
  });
}

/* ------------------------------------------------------------------ éléments */
export function addItems(
  blocks: readonly Block[],
  blockId: string,
  files: readonly string[],
  index?: number,
): Block[] {
  const used = collectIds(blocks);
  return updateBlock(blocks, blockId, (b) => {
    const items = [...withItems(b)];
    const added = files.map((file) => ({ id: newId('i', used), file }));
    items.splice(index ?? items.length, 0, ...added);
    return { ...b, items };
  });
}

/** Déplace un élément (dans un bloc ou vers un autre) ; il garde son id et ses réglages. */
export function moveItem(
  blocks: readonly Block[],
  from: { block: string; index: number },
  to: { block: string; index: number },
): Block[] {
  const source = blocks.find((b) => b.id === from.block);
  const item = source ? withItems(source)[from.index] : undefined;
  if (!item) return [...blocks];
  const removed = updateBlock(blocks, from.block, (b) => ({
    ...b,
    items: withItems(b).filter((_, i) => i !== from.index),
  }));
  return updateBlock(removed, to.block, (b) => {
    const items = [...withItems(b)];
    items.splice(Math.max(0, Math.min(to.index, items.length)), 0, item);
    return { ...b, items };
  });
}

export function removeItem(blocks: readonly Block[], blockId: string, itemId: string): Block[] {
  return updateBlock(blocks, blockId, (b) => ({
    ...b,
    items: withItems(b).filter((i) => i.id !== itemId),
  }));
}

export function updateItem(
  blocks: readonly Block[],
  blockId: string,
  itemId: string,
  patch: Partial<BlockItem>,
): Block[] {
  return updateBlock(blocks, blockId, (b) => ({
    ...b,
    items: withItems(b).map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
  }));
}

/* ------------------------------------------------------------------ colonnes, spans, médias visibles */
const asObject = <T>(
  value: PerDevice<T> | undefined,
  full: Record<Device, T>,
): Record<Device, T> =>
  typeof value === 'object' && value !== null ? { ...full, ...value } : full;

/**
 * Colonnes d'un appareil. Les spans de cet appareil sont ramenés en proportion
 * (ex. 12 → 3 colonnes : une image « 1/2 » passe de 6 à 2), jamais au-delà de la grille.
 */
export function setColumns(
  blocks: readonly Block[],
  id: string,
  device: Device,
  count: number,
): Block[] {
  return updateBlock(blocks, id, (b) => {
    const before = resolveColumns(b.columns);
    const columns = { ...before, [device]: count };
    const items = withItems(b).map((item) => {
      const span = resolveSpan(item.span, before);
      const scaled = Math.max(
        1,
        Math.min(count, Math.round((span[device] * count) / before[device])),
      );
      return { ...item, span: { ...span, [device]: scaled } };
    });
    return { ...b, columns, items };
  });
}

export function setSpan(
  blocks: readonly Block[],
  blockId: string,
  itemId: string,
  device: Device,
  span: number,
): Block[] {
  return updateBlock(blocks, blockId, (b) => {
    const columns = resolveColumns(b.columns);
    return {
      ...b,
      items: withItems(b).map((i) =>
        i.id === itemId
          ? {
              ...i,
              span: {
                ...resolveSpan(i.span, columns),
                [device]: Math.max(1, Math.min(columns[device], span)),
              },
            }
          : i,
      ),
    };
  });
}

export function setPerView(
  blocks: readonly Block[],
  id: string,
  device: Device,
  value: number,
): Block[] {
  return updateBlock(blocks, id, (b) => ({
    ...b,
    perView: { ...asObject(b.perView, resolvePerView(b.perView)), [device]: value },
  }));
}

/* ------------------------------------------------------------------ conversion depuis la composition historique */
/**
 * « Organiser en blocs » : UN bloc grille de 12 colonnes qui reproduit exactement la composition historique
 * (mêmes médias, même ordre, mêmes largeurs ; pleine largeur sur mobile). Les médias masqués restent masqués.
 */
export function fromLegacy(
  items: readonly { file: string; span: number; align: string; hidden: boolean }[],
): Block[] {
  const used = new Set<string>();
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return [];
  return [
    {
      id: newId('b', used),
      type: 'grid',
      columns: { desktop: 12, tablet: 12, mobile: 1 },
      items: visible.map((i) => ({
        id: newId('i', used),
        file: i.file,
        span: { desktop: i.span, tablet: i.span, mobile: 1 },
        ...(i.align && i.align !== 'center' ? { align: i.align as BlockItem['align'] } : {}),
      })),
    },
  ];
}

/** Nombre d'emplacements par fichier (badges de la médiathèque). */
export function usage(blocks: readonly Block[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const b of blocks)
    for (const i of b.items ?? []) count.set(i.file, (count.get(i.file) ?? 0) + 1);
  return count;
}
