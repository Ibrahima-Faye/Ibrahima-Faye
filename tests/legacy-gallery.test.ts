/**
 * Compatibilité : la composition historique (sans `blocks:`) doit rester STRICTEMENT identique.
 * On compare le nouveau code à une copie figée de l'ancien algorithme (site + administration, commit 700c019),
 * sur les 10 vrais projets et sur des cas limites.
 */
import { describe, expect, it } from 'vitest';
import { normalizeGallery } from '@/lib/gallery/normalize';
import { effectiveCover, galleryEntries, mediaFiles } from '@/lib/media-rules';
import { realProjects } from './helpers';

/* ------------------------------------------------------------------ ancien code, copié tel quel */
const natural = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
const oldBase = (file: string) => file.replace(/\.[^.]+$/, '');
const OLD_IMAGE = /\.(jpg|jpeg|png|webp|avif|JPG|JPEG|PNG|WEBP|AVIF)$/;
const OLD_VIDEO = /\.(mp4|webm|MP4|WEBM)$/;

interface OldMedia {
  file: string;
  hidden?: boolean;
  span?: number;
  align?: string;
}

/** src/lib/media.ts (getProjectMedia) avant l'étape 2 : ordre + span déclaré + align déclaré. */
function oldSite(names: string[], media: OldMedia[]) {
  const images = names.filter((n) => OLD_IMAGE.test(n));
  const videos = names.filter((n) => OLD_VIDEO.test(n));
  const settings = new Map(media.map((m) => [m.file, m]));
  const videoNames = new Set(videos.map((f) => oldBase(f).toLowerCase()));
  const galleryImages: string[] = [];
  for (const file of images) {
    const name = oldBase(file).toLowerCase();
    if (name === 'cover' && !settings.has(file)) continue;
    if (videoNames.has(name)) continue;
    galleryImages.push(file);
  }
  const files = [...galleryImages, ...videos];
  const listed = media.map((m) => m.file).filter((f) => files.includes(f));
  const rest = files.filter((f) => !listed.includes(f)).sort(natural.compare);
  const ordered = [...new Set([...listed, ...rest])].filter((f) => !settings.get(f)?.hidden);
  return ordered.map((file) => ({
    file,
    span: settings.get(file)?.span,
    align: settings.get(file)?.align,
  }));
}

/** src/lib/media.ts (getCover) avant l'étape 2. */
function oldCover(names: string[], cover?: string) {
  const images = names.filter((n) => OLD_IMAGE.test(n));
  if (cover && images.includes(cover)) return cover;
  const byName = images.find((f) => oldBase(f).toLowerCase() === 'cover');
  if (byName) return byName;
  return [...images].sort(natural.compare)[0];
}

/** Administration avant l'étape 2 : store.listFiles (affiches) + editor-state.buildItems (ordre, masqué). */
function oldAdmin(names: string[], media: OldMedia[]) {
  const kind = (n: string) => (OLD_IMAGE.test(n) ? 'image' : OLD_VIDEO.test(n) ? 'video' : null);
  const infos = names
    .filter((n) => !n.startsWith('.') && kind(n))
    .map((name) => ({ name, posterFor: undefined as string | undefined }));
  const videos = new Map(
    infos.filter((i) => kind(i.name) === 'video').map((v) => [oldBase(v.name).toLowerCase(), v]),
  );
  for (const info of infos) {
    if (kind(info.name) !== 'image') continue;
    const video = videos.get(oldBase(info.name).toLowerCase());
    if (video) info.posterFor = video.name;
  }
  const usable = infos.filter((f) => !f.posterFor);
  const byName = new Map(usable.map((f) => [f.name, f]));
  const listed = media.filter((m) => byName.has(m.file));
  const listedNames = new Set(listed.map((m) => m.file));
  const rest = usable
    .filter((f) => !listedNames.has(f.name))
    .sort((a, b) => natural.compare(a.name, b.name));
  const make = (name: string, entry?: OldMedia) => ({
    file: name,
    hidden: entry?.hidden ?? (!entry && oldBase(name).toLowerCase() === 'cover'),
  });
  return [...listed.map((m) => make(m.file, m)), ...rest.map((f) => make(f.name))];
}

/* ------------------------------------------------------------------ nouveau code */
function newSite(names: string[], media: OldMedia[]) {
  const { blocks } = normalizeGallery({ files: mediaFiles(names), media: media as never });
  expect(blocks.length).toBeLessThanOrEqual(1);
  return (blocks[0]?.items ?? []).map((i) => ({
    file: i.file,
    span: i.legacySpan,
    align: i.align,
  }));
}

describe('composition historique — les 10 vrais projets', () => {
  const projects = realProjects();

  it('10 projets sont lus', () => expect(projects).toHaveLength(10));

  for (const p of projects) {
    const media: OldMedia[] = p.data.media ?? [];
    it(`${p.slug} : même galerie (ordre, span, alignement) que l'ancien site`, () => {
      expect(newSite(p.files, media)).toEqual(oldSite(p.files, media));
    });
    it(`${p.slug} : même couverture`, () => {
      expect(effectiveCover(p.data.cover, mediaFiles(p.files))).toBe(
        oldCover(p.files, p.data.cover),
      );
    });
    it(`${p.slug} : même liste dans l'administration (ordre, masqués)`, () => {
      const now = galleryEntries(mediaFiles(p.files), media).map(({ file, hidden }) => ({
        file,
        hidden,
      }));
      expect(now).toEqual(oldAdmin(p.files, media));
    });
  }

  it('nombre total de médias affichés : 38 (9 + 7 + 3 + 11 + 8)', () => {
    const total = projects.reduce((n, p) => n + oldSite(p.files, p.data.media ?? []).length, 0);
    const now = projects.reduce((n, p) => n + newSite(p.files, p.data.media ?? []).length, 0);
    expect(total).toBe(38);
    expect(now).toBe(38);
  });
});

describe('composition historique — cas limites', () => {
  const cases: [string, string[], OldMedia[], string?][] = [
    ['tri naturel', ['image-10.jpg', 'image-2.jpg', 'image-1.jpg'], []],
    ['cover.* non listé : exclu', ['cover.jpg', 'a.jpg'], []],
    ['cover.* listé : affiché', ['cover.jpg', 'a.jpg'], [{ file: 'cover.jpg' }]],
    ['affiches de vidéos exclues (casse ignorée)', ['demo.mp4', 'DEMO.jpg', 'b.png'], []],
    ['majuscules', ['A.JPG', 'b.PNG', 'c.MP4'], []],
    ['casse mixte ignorée', ['a.Jpg', 'b.jpg'], []],
    ['masqué', ['a.jpg', 'b.jpg'], [{ file: 'b.jpg', hidden: true }]],
    [
      'ordre de media: + doublons',
      ['a.jpg', 'b.jpg', 'c.jpg'],
      [{ file: 'c.jpg', span: 12 }, { file: 'a.jpg' }, { file: 'c.jpg', span: 6 }],
    ],
    [
      'fichier listé mais absent',
      ['a.jpg'],
      [{ file: 'zz.jpg' }, { file: 'a.jpg', span: 4, align: 'start' }],
    ],
    ['formats pas encore activés ignorés', ['a.heic', 'b.mov', 'c.gif', 'd.svg', 'e.jpg'], []],
    ['couverture choisie', ['a.jpg', 'b.jpg'], [], 'b.jpg'],
    ['couverture absente → cover.*', ['a.jpg', 'cover.png'], [], 'zz.jpg'],
  ];
  for (const [label, names, media, cover] of cases) {
    it(label, () => {
      expect(newSite(names, media)).toEqual(oldSite(names, media));
      expect(effectiveCover(cover, mediaFiles(names))).toBe(oldCover(names, cover));
      // Seule différence voulue : un fichier listé DEUX fois dans `media:` apparaissait en double dans l'ancienne
      // administration (le site, lui, l'affichait une fois et l'enregistrement retirait le doublon).
      // L'administration suit désormais la règle du site : une seule fois.
      const oldOnce = oldAdmin(names, media).filter(
        (item, i, all) => all.findIndex((other) => other.file === item.file) === i,
      );
      expect(
        galleryEntries(mediaFiles(names), media).map(({ file, hidden }) => ({ file, hidden })),
      ).toEqual(oldOnce);
    });
  }

  it('doublon dans media: — l’ancienne administration montrait le fichier 2 fois, la nouvelle 1 fois (comme le site)', () => {
    const names = ['a.jpg', 'c.jpg'];
    const media = [{ file: 'c.jpg' }, { file: 'c.jpg' }];
    expect(oldAdmin(names, media).map((i) => i.file)).toEqual(['c.jpg', 'c.jpg', 'a.jpg']);
    expect(galleryEntries(mediaFiles(names), media).map((i) => i.file)).toEqual(['c.jpg', 'a.jpg']);
    expect(oldSite(names, media).map((i) => i.file)).toEqual(['c.jpg', 'a.jpg']);
  });
});
