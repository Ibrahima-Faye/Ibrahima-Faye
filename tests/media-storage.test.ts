import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { remoteKey, remoteUrl, resolveOutputUrl } from '@/lib/media-storage';
import * as pipeline from '../integrations/local-cms/media/pipeline.mjs';

describe('stockage des versions web : local | remote', () => {
  const base = {
    folder: 'wonderpark',
    file: 'img 5685.mp4',
    output: '_web/img 5685.mp4/distant/video.mp4',
  };

  it('clé distante : <projet>/<original>/<version>, sans le dossier distant/', () => {
    expect(remoteKey(base.folder, base.file, base.output)).toBe(
      'wonderpark/img 5685.mp4/video.mp4',
    );
    expect(remoteUrl('https://media.exemple.com/', base.folder, base.file, base.output)).toBe(
      'https://media.exemple.com/wonderpark/img%205685.mp4/video.mp4',
    );
  });

  it('version locale : URL publiée avec le site', () => {
    expect(
      resolveOutputUrl({ ...base, storage: 'local', dev: false, localUrl: '/_astro/v.mp4' }),
    ).toBe('/_astro/v.mp4');
    // entrée ancienne sans champ storage = locale
    expect(resolveOutputUrl({ ...base, dev: false, localUrl: '/_astro/v.mp4' })).toBe(
      '/_astro/v.mp4',
    );
  });

  it('version distante : URL du stockage externe quand il est configuré', () => {
    expect(
      resolveOutputUrl({ ...base, storage: 'remote', base: 'https://cdn.exemple.com', dev: false }),
    ).toBe('https://cdn.exemple.com/wonderpark/img%205685.mp4/video.mp4');
  });

  it('version distante sans stockage configuré : copie locale en dev, rien sur le site publié', () => {
    expect(resolveOutputUrl({ ...base, storage: 'remote', base: '', dev: true })).toBe(
      '/src/content/projects/wonderpark/_web/img%205685.mp4/distant/video.mp4',
    );
    expect(resolveOutputUrl({ ...base, storage: 'remote', base: ' ', dev: false })).toBeUndefined();
  });
});

describe('pipeline : rangement local / distant (seuil 25 Mio)', () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('seuil = 25 Mio (limite par fichier de Cloudflare Pages)', () => {
    expect(pipeline.LOCAL_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(pipeline.REMOTE_DIR).toBe('distant');
  });

  it('anciennes entrées : grosse vidéo déplacée dans distant/, petites versions laissées, rien ré-encodé', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pipeline-stockage-'));
    const folder = path.join(dir!, '_web', 'long.mp4');
    await mkdir(folder, { recursive: true });
    const big = Buffer.alloc(pipeline.LOCAL_MAX_BYTES + 1, 7);
    await writeFile(path.join(folder, 'video.mp4'), big);
    await writeFile(path.join(folder, 'poster.jpg'), 'affiche');
    const manifest = {
      version: 1,
      items: {
        'long.mp4': {
          status: 'ok',
          outputs: { video: '_web/long.mp4/video.mp4', poster: '_web/long.mp4/poster.jpg' },
          sizes: { video: big.length, poster: 7 },
        },
        'deja-range.mp4': {
          status: 'ok',
          storage: { video: 'local' },
          outputs: { video: '_web/x/video.mp4' },
        },
      },
    };
    expect(await pipeline.migrateStorage(dir!, manifest)).toBe(true);
    const entry = manifest.items['long.mp4'] as Record<string, unknown>;
    expect(entry.storage).toEqual({ video: 'remote', poster: 'local' });
    expect(entry.outputs).toEqual({
      video: '_web/long.mp4/distant/video.mp4',
      poster: '_web/long.mp4/poster.jpg',
    });
    expect(existsSync(path.join(folder, 'video.mp4'))).toBe(false);
    expect((await readFile(path.join(folder, 'distant', 'video.mp4'))).equals(big)).toBe(true);
    // déjà rangé : inchangé ; second passage : plus rien à faire
    expect(manifest.items['deja-range.mp4'].outputs.video).toBe('_web/x/video.mp4');
    expect(await pipeline.migrateStorage(dir!, manifest)).toBe(false);
  });

  it('nouvelle version web : storage renseigné pour chaque sortie, original intact', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pipeline-stockage-'));
    const sharp = (await import('sharp')).default;
    await sharp({ create: { width: 64, height: 32, channels: 3, background: '#7b4dff' } })
      .jpeg()
      .toFile(path.join(dir!, 'photo.jpg'));
    const before = await readFile(path.join(dir!, 'photo.jpg'));
    const entry = (await pipeline.processFile(dir!, 'photo.jpg')) as unknown as {
      storage: unknown;
      outputs: Record<string, string>;
    };
    expect(entry.storage).toEqual({ image: 'local', thumb: 'local' });
    expect(entry.outputs.image).toBe('_web/photo.jpg/image.jpg');
    expect(existsSync(path.join(dir!, entry.outputs.image!))).toBe(true);
    expect((await readFile(path.join(dir!, 'photo.jpg'))).equals(before)).toBe(true);
  });
});
