/**
 * Modèle en blocs : l'exemple validé (projet « Étiquetage », fichiers réels), puis les garanties :
 * rien ne disparaît, aucun bloc n'est supprimé, ids stables, spans bornés aux colonnes.
 */
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { normalizeGallery, resolveColumns, resolveSpan } from '@/lib/gallery/normalize';
import { mediaFiles } from '@/lib/media-rules';
import { blocksSchema, validateBlocks, type Block } from '@/schemas/blocks';
import { projectSchema } from '@/schemas/project';
import { realProjects } from './helpers';

const etiquetage = realProjects().find((p) => p.slug === 'systeme-etiquetage-automatique')!;
const files = mediaFiles(etiquetage.files);

/** L'exemple présenté et validé (docs/MODELE-DE-DONNEES.md). */
const EXAMPLE = YAML.parse(`
- id: b-ouverture
  type: single
  width: full
  items:
    - id: i-01
      file: 5978699308053761643-119.jpg
- id: b-carrousel
  type: carousel
  perView: { desktop: 1.2, tablet: 1, mobile: 1 }
  loop: true
  autoplay: 0
  controls: [arrows, dots]
  items:
    - { id: i-02, file: 5970028658141367711-121.jpg }
    - { id: i-03, file: 5970028658141367709-121.jpg }
    - { id: i-04, file: 5877295065770692714-119.jpg }
    - { id: i-05, file: 5980953598948478973-119.jpg }
- id: b-grille
  type: grid
  columns: { desktop: 3, tablet: 2, mobile: 1 }
  gap: md
  align: start
  items:
    - id: i-06
      file: convoyor.jpg
      span: { desktop: 3, tablet: 2 }
    - { id: i-07, file: page1-1.jpg }
    - { id: i-08, file: page2-1.jpg }
- id: b-video
  type: single
  width: wide
  items:
    - id: i-09
      file: video-project-2.mp4
      video: { autoplay: false, controls: true }
- id: b-mixte
  type: grid
  columns: { desktop: 3, tablet: 3, mobile: 1 }
  align: center
  items:
    - { id: i-10, file: img-0777.mp4, video: { autoplay: true, loop: true, muted: true } }
    - { id: i-11, file: 5978699308053761643-119.jpg, caption: Légende propre }
    - { id: i-12, file: img-5685.mp4, video: { autoplay: true, loop: true, muted: true } }
`) as Block[];

describe('exemple validé : 5 blocs', () => {
  it('passe le schéma du projet (avec les champs existants inchangés)', () => {
    const result = projectSchema.safeParse({ ...etiquetage.data, blocks: EXAMPLE });
    expect(result.success).toBe(true);
    expect(validateBlocks(EXAMPLE, new Map(files.map((f) => [f.name, f.kind])))).toEqual([]);
  });

  const { blocks, issues } = normalizeGallery({
    files,
    media: etiquetage.data.media,
    blocks: EXAMPLE,
  });

  it('ordre exact des blocs, sans bloc « non placés » (tout est placé)', () => {
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(blocks.map((b) => [b.id, b.type])).toEqual([
      ['b-ouverture', 'single'],
      ['b-carrousel', 'carousel'],
      ['b-grille', 'grid'],
      ['b-video', 'single'],
      ['b-mixte', 'grid'],
    ]);
  });

  it('ordre exact des médias et ids stables', () => {
    expect(blocks.flatMap((b) => b.items.map((i) => i.id))).toEqual([
      'i-01',
      'i-02',
      'i-03',
      'i-04',
      'i-05',
      'i-06',
      'i-07',
      'i-08',
      'i-09',
      'i-10',
      'i-11',
      'i-12',
    ]);
  });

  it('colonnes et spans par appareil', () => {
    const grille = blocks.find((b) => b.id === 'b-grille')!;
    expect(grille.columns).toEqual({ desktop: 3, tablet: 2, mobile: 1 });
    expect(grille.items[0]!.span).toEqual({ desktop: 3, tablet: 2, mobile: 1 });
    expect(grille.items[1]!.span).toEqual({ desktop: 1, tablet: 1, mobile: 1 });
    expect(blocks.find((b) => b.id === 'b-mixte')!.columns).toEqual({
      desktop: 3,
      tablet: 3,
      mobile: 1,
    });
    expect(blocks.find((b) => b.id === 'b-ouverture')!.columns).toEqual({
      desktop: 1,
      tablet: 1,
      mobile: 1,
    });
  });

  it('images et vidéos mélangées ; une même image réutilisée dans deux blocs', () => {
    const mixte = blocks.find((b) => b.id === 'b-mixte')!;
    expect(mixte.items.map((i) => i.kind)).toEqual(['video', 'image', 'video']);
    expect(mixte.items[1]!.caption).toBe('Légende propre');
    const uses = blocks
      .flatMap((b) => b.items)
      .filter((i) => i.file === '5978699308053761643-119.jpg');
    expect(uses).toHaveLength(2);
  });

  it('réglages propres au carrousel conservés pour son futur rendu (affiché en grille d’ici là, sans perte)', () => {
    const c = blocks.find((b) => b.id === 'b-carrousel')!;
    expect(c.items).toHaveLength(4);
    expect(c.options).toMatchObject({
      perView: { desktop: 1.2 },
      loop: true,
      controls: ['arrows', 'dots'],
    });
    expect(c.notice).toBeTruthy();
  });
});

describe('garanties', () => {
  const kinds = new Map(files.map((f) => [f.name, f.kind]));

  it('un type inconnu est conservé et affiché comme une grille (rien n’est perdu)', () => {
    const blocks = [
      {
        id: 'x',
        type: 'mosaique-3d',
        futur: { a: 1 },
        items: [{ file: 'convoyor.jpg', rotation: 12 }],
      },
    ];
    const parsed = blocksSchema.parse(blocks);
    expect(parsed[0]).toMatchObject({ type: 'mosaique-3d', futur: { a: 1 } }); // champs inconnus conservés
    expect(parsed[0]!.items![0]).toMatchObject({ rotation: 12 });
    const out = normalizeGallery({ files, blocks: parsed, unplaced: 'hide' });
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0]).toMatchObject({ layout: 'grid', type: 'mosaique-3d' });
    expect(out.blocks[0]!.notice).toMatch(/inconnu/);
    expect(out.issues.some((i) => i.level === 'warning')).toBe(true);
  });

  it('fichiers non placés : affichés à la fin (append, par défaut), dans l’ordre historique', () => {
    const out = normalizeGallery({
      files,
      media: etiquetage.data.media,
      blocks: [{ id: 'a', type: 'single', items: [{ file: 'convoyor.jpg' }] }],
    });
    expect(out.blocks.map((b) => b.id)).toEqual(['a', 'non-places']);
    expect(out.blocks[1]!.layout).toBe('legacy');
    expect(out.blocks[1]!.items).toHaveLength(10); // 11 médias de galerie − 1 placé
    expect(out.blocks[1]!.items.map((i) => i.file)).not.toContain('convoyor.jpg');
  });

  it('`unplaced: hide` masque seulement les fichiers non placés', () => {
    const out = normalizeGallery({
      files,
      blocks: [{ type: 'single', items: [{ file: 'convoyor.jpg' }] }],
      unplaced: 'hide',
    });
    expect(out.blocks).toHaveLength(1);
  });

  it('blocks: [] → tous les médias restent affichés (aucune disparition)', () => {
    const out = normalizeGallery({ files, media: etiquetage.data.media, blocks: [] });
    expect(out.blocks.flatMap((b) => b.items)).toHaveLength(11);
  });

  it('bloc masqué : non affiché, et ses fichiers ne sont pas « non placés »', () => {
    const out = normalizeGallery({
      files,
      blocks: [{ id: 'h', type: 'grid', hidden: true, items: [{ file: 'convoyor.jpg' }] }],
    });
    expect(out.blocks.map((b) => b.id)).toEqual(['non-places']);
    expect(out.blocks[0]!.items.map((i) => i.file)).not.toContain('convoyor.jpg');
  });

  it('fichier introuvable : ignoré à l’affichage + avertissement, le reste du bloc est affiché', () => {
    const blocks = [
      { id: 'g', type: 'grid', items: [{ file: 'absent.jpg' }, { file: 'convoyor.jpg' }] },
    ];
    const out = normalizeGallery({ files, blocks, unplaced: 'hide' });
    expect(out.blocks[0]!.items.map((i) => i.file)).toEqual(['convoyor.jpg']);
    expect(out.issues.map((i) => i.message).join()).toMatch(/absent\.jpg/);
  });

  it('identifiants en double : erreur (refusé à l’enregistrement)', () => {
    const issues = validateBlocks([
      { id: 'a', type: 'grid', items: [{ id: 'x', file: 'convoyor.jpg' }] },
      { id: 'a', type: 'grid', items: [{ id: 'x', file: 'page1-1.jpg' }] },
    ]);
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(2);
  });

  it('« média seul » avec 2 médias et avant/après avec une vidéo : repli en grille, tout est affiché', () => {
    const out = normalizeGallery({
      files,
      unplaced: 'hide',
      blocks: [
        { id: 's', type: 'single', items: [{ file: 'page1-1.jpg' }, { file: 'page2-1.jpg' }] },
        { id: 'c', type: 'compare', items: [{ file: 'convoyor.jpg' }, { file: 'img-0777.mp4' }] },
      ],
    });
    expect(out.blocks.map((b) => b.items.length)).toEqual([2, 2]);
    expect(out.blocks.every((b) => b.notice)).toBe(true);
    expect(
      validateBlocks(
        [{ type: 'compare', items: [{ file: 'convoyor.jpg' }, { file: 'img-0777.mp4' }] }],
        kinds,
      ),
    ).toHaveLength(1);
  });

  it('un span ne dépasse jamais les colonnes (pas de débordement, pas de contenu coupé)', () => {
    const cols = resolveColumns({ desktop: 3 });
    expect(cols).toEqual({ desktop: 3, tablet: 2, mobile: 1 });
    expect(resolveSpan(6, cols)).toEqual({ desktop: 3, tablet: 2, mobile: 1 });
    expect(resolveSpan({ desktop: 2 }, cols)).toEqual({ desktop: 2, tablet: 2, mobile: 1 });
    expect(resolveColumns(99)).toEqual({ desktop: 12, tablet: 2, mobile: 1 });
  });

  it('chaque fichier existant placé dans un bloc visible est affiché exactement là où il est placé', () => {
    const out = normalizeGallery({ files, media: etiquetage.data.media, blocks: EXAMPLE });
    const shown = out.blocks.flatMap((b) => b.items.map((i) => i.file));
    const placed = EXAMPLE.flatMap((b) => b.items!.map((i) => i.file));
    expect(shown).toEqual(placed);
  });
});
