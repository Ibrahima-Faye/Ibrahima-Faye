/** Formats et règles des médias : une seule source de vérité, cohérente avec les motifs du site. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  acceptAttribute,
  enabledFormats,
  formatLabels,
  kindOf,
  mimeOf,
  posterPairs,
  mediaFiles,
} from '@/lib/media-rules';
import { MEDIA_FORMATS } from '@/schemas/media';
import { repoRoot } from './helpers';

describe('formats', () => {
  it('formats activés aujourd’hui : JPG, JPEG, PNG, WebP, AVIF, MP4, WebM (comportement inchangé)', () => {
    expect(enabledFormats().map((f) => f.ext)).toEqual([
      'jpg',
      'jpeg',
      'png',
      'webp',
      'avif',
      'mp4',
      'webm',
    ]);
  });

  it('formats connus mais en attente du pipeline : GIF, SVG, HEIC, HEIF, M4V, MOV — ni détectés ni acceptés', () => {
    const pending = MEDIA_FORMATS.filter((f) => !f.enabled).map((f) => f.ext);
    expect(pending).toEqual(['gif', 'svg', 'heic', 'heif', 'm4v', 'mov']);
    for (const ext of pending) expect(kindOf(`fichier.${ext}`)).toBeNull();
  });

  it('casse : minuscules ou MAJUSCULES seulement (comme les motifs du site)', () => {
    expect(kindOf('a.jpg')).toBe('image');
    expect(kindOf('a.JPG')).toBe('image');
    expect(kindOf('a.Jpg')).toBeNull();
    expect(kindOf('a.MP4')).toBe('video');
    expect(kindOf('project.md')).toBeNull();
  });

  it('types MIME et attribut accept', () => {
    expect(mimeOf('a.png')).toBe('image/png');
    expect(mimeOf('a.webm')).toBe('video/webm');
    expect(acceptAttribute()).toBe(
      'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm',
    );
    expect(acceptAttribute('image')).toBe('image/jpeg,image/png,image/webp,image/avif');
    expect(formatLabels('image')).toBe('JPG, PNG, WebP, AVIF');
  });

  it('les motifs import.meta.glob de src/lib/media.ts listent exactement les formats activés', () => {
    const source = readFileSync(path.join(repoRoot, 'src/lib/media.ts'), 'utf8');
    const globs = [...source.matchAll(/'\/src\/content\/projects\/\*\/\*\.\{([^}]+)\}'/g)].map(
      (m) => m[1]!.split(','),
    );
    expect(globs).toHaveLength(2);
    const [images, videos] = globs;
    const expected = (kind: 'image' | 'video') =>
      enabledFormats(kind)
        .flatMap((f) => [f.ext, f.ext.toUpperCase()])
        .sort();
    expect([...images!].sort()).toEqual(expected('image'));
    expect([...videos!].sort()).toEqual(expected('video'));
  });
});

describe('affiches', () => {
  it('image du même nom qu’une vidéo (casse ignorée)', () => {
    const { posterOf, posterFor } = posterPairs(mediaFiles(['demo.mp4', 'DEMO.jpg', 'autre.png']));
    expect(posterOf.get('demo.mp4')).toBe('DEMO.jpg');
    expect(posterFor.get('DEMO.jpg')).toBe('demo.mp4');
    expect(posterFor.has('autre.png')).toBe(false);
  });
});
