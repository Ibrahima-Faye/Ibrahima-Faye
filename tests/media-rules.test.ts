/** Formats et règles des médias : une seule source de vérité, et un site qui n'embarque jamais d'original. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  acceptAttribute,
  formatLabels,
  isBrowserReady,
  kindOf,
  mediaFiles,
  mimeOf,
  posterPairs,
  supportedFormats,
} from '@/lib/media-rules';
import { repoRoot } from './helpers';

describe('formats', () => {
  it('13 formats pris en charge : JPG, JPEG, PNG, WebP, AVIF, GIF, SVG, HEIC, HEIF · MP4, WebM, MOV, M4V', () => {
    expect(supportedFormats('image').map((f) => f.ext)).toEqual([
      'jpg',
      'jpeg',
      'png',
      'webp',
      'avif',
      'gif',
      'svg',
      'heic',
      'heif',
    ]);
    expect(supportedFormats('video').map((f) => f.ext)).toEqual(['mp4', 'webm', 'mov', 'm4v']);
    for (const f of supportedFormats()) expect(kindOf(`fichier.${f.ext}`)).toBe(f.kind);
  });

  it('formats lisibles tels quels par un navigateur (les autres attendent leur version web)', () => {
    expect(['a.jpg', 'a.png', 'a.webp', 'a.avif', 'a.mp4', 'a.webm'].every(isBrowserReady)).toBe(
      true,
    );
    expect(['a.heic', 'a.mov', 'a.m4v', 'a.svg', 'a.gif'].some(isBrowserReady)).toBe(false);
  });

  it('casse : minuscules ou MAJUSCULES seulement', () => {
    expect(kindOf('a.jpg')).toBe('image');
    expect(kindOf('a.JPG')).toBe('image');
    expect(kindOf('IMG_0001.HEIC')).toBe('image');
    expect(kindOf('a.Jpg')).toBeNull();
    expect(kindOf('clip.MOV')).toBe('video');
    expect(kindOf('project.md')).toBeNull();
    expect(kindOf('media.json')).toBeNull();
  });

  it('types MIME, attribut accept (types + extensions : les HEIC/MOV n’ont pas toujours de type connu)', () => {
    expect(mimeOf('a.png')).toBe('image/png');
    expect(mimeOf('a.mov')).toBe('video/quicktime');
    expect(mimeOf('a.heic')).toBe('image/heic');
    const accept = acceptAttribute().split(',');
    for (const ext of ['.heic', '.mov', '.m4v', '.svg', '.gif']) expect(accept).toContain(ext);
    expect(formatLabels('image')).toBe('JPG, PNG, WebP, AVIF, GIF, SVG, HEIC');
    expect(formatLabels('video')).toBe('MP4, WebM, MOV, M4V');
  });

  it('le site ne lit QUE les versions web (_web/, media.json) : aucun original ne peut entrer dans le build', () => {
    const source = readFileSync(path.join(repoRoot, 'src/lib/media.ts'), 'utf8');
    const projectGlobs = [...source.matchAll(/'(\/src\/content\/projects\/[^']+)'/g)].map(
      (m) => m[1]!,
    );
    expect(projectGlobs.length).toBeGreaterThanOrEqual(3);
    for (const glob of projectGlobs) expect(glob).toMatch(/\/_web\/|\/media\.json$/);
  });
});

describe('affiches', () => {
  it('image du même nom qu’une vidéo (casse ignorée, MOV compris)', () => {
    const { posterOf, posterFor } = posterPairs(
      mediaFiles(['demo.mp4', 'DEMO.jpg', 'autre.png', 'clip.MOV', 'clip.heic']),
    );
    expect(posterOf.get('demo.mp4')).toBe('DEMO.jpg');
    expect(posterFor.get('DEMO.jpg')).toBe('demo.mp4');
    expect(posterOf.get('clip.MOV')).toBe('clip.heic');
    expect(posterFor.has('autre.png')).toBe(false);
  });
});
