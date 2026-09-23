import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { domainSlugs } from '@/data/domains';
import {
  entityItems,
  expertiseRows,
  inlineMarkdown,
  markdownBlocks,
  safeHref,
} from '@/lib/studio/content';
import { SETTINGS_SCHEMAS } from '@/schemas/settings';
import * as schemas from '@/schemas/settings';
import { createSettings } from '../integrations/local-cms/settings.mjs';

describe('Contenu du site : modèle', () => {
  it('sans réglage : les 7 expertises dans l’ordre d’origine, ClicGraph puis JeeFSYS', () => {
    expect(expertiseRows({}).map((r) => r.slug)).toEqual([...domainSlugs]);
    expect(expertiseRows({}).every((r) => r.icon === r.slug && !r.extra)).toBe(true);
    expect(entityItems({}).map((e) => e.id)).toEqual(['clicgraph', 'jeefsys']);
  });

  it('expertises : ordre, masquage, icône ; aucune perte', () => {
    const rows = expertiseRows({
      expertises: {
        items: [
          { slug: 'robotique', icon: 'prototypage' },
          { slug: 'design-graphique', visible: false },
          { slug: 'inconnu' },
        ],
      },
    });
    expect(rows[0]).toMatchObject({ slug: 'robotique', icon: 'prototypage' });
    expect(rows.some((r) => r.slug === 'design-graphique')).toBe(false);
    expect(rows).toHaveLength(domainSlugs.length - 1);
  });

  it('écosystème : entités ajoutées, ordre, masquage', () => {
    const items = entityItems({
      ecosystem: {
        items: [
          { id: 'jeefsys' },
          { id: 'entite-1', name: 'Atelier' },
          { id: 'clicgraph', visible: false },
          { id: 'sans-nom' },
        ],
      },
    });
    expect(items.map((i) => i.id)).toEqual(['jeefsys', 'entite-1']);
    expect(items[1]!.builtin).toBe(false);
  });

  it('liens : seulement http(s), mailto, tel, /, #', () => {
    expect(safeHref('/#projets')).toBe('/#projets');
    expect(safeHref('https://exemple.com')).toBe('https://exemple.com');
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref(' ')).toBeUndefined();
  });

  it('Markdown léger : gras, italique, liens sûrs, HTML échappé', () => {
    expect(inlineMarkdown('Texte **fort** et *doux*')).toBe(
      'Texte <strong>fort</strong> et <em>doux</em>',
    );
    expect(inlineMarkdown('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(inlineMarkdown('[site](https://a.b)')).toContain('href="https://a.b"');
    expect(inlineMarkdown('[piège](javascript:alert(1))')).not.toContain('href');
    // les textes actuels du site (sans Markdown) ressortent à l'identique
    expect(
      inlineMarkdown(
        'Je suis Ibrahima Faye. Je crée à la croisée du numérique et du physique : je conçois en 3D.',
      ),
    ).toBe(
      'Je suis Ibrahima Faye. Je crée à la croisée du numérique et du physique : je conçois en 3D.',
    );
    expect(markdownBlocks('Un\n\n- a\n- b\n\nDeux\nlignes')).toEqual([
      { type: 'p', html: ['Un'] },
      { type: 'ul', html: ['a', 'b'] },
      { type: 'p', html: ['Deux<br />lignes'] },
    ]);
  });

  it('schéma : fichier livré valide, bloc de type inconnu refusé', async () => {
    const { readFile } = await import('node:fs/promises');
    expect(
      SETTINGS_SCHEMAS.content.safeParse(
        JSON.parse(await readFile('src/settings/content.json', 'utf8')),
      ).success,
    ).toBe(true);
    expect(
      SETTINGS_SCHEMAS.content.safeParse({ about: { blocks: [{ id: 'b', type: 'video' }] } })
        .success,
    ).toBe(false);
  });
});

describe('Contenu du site : historique des versions', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });

  it('enregistrement manuel : chaque version précédente est gardée et relisible', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'contenu-'));
    await mkdir(path.join(root, 'src/settings'), { recursive: true });
    await writeFile(path.join(root, 'src/settings/content.json'), '{\n  "version": 1\n}\n');
    const settings = createSettings(root, { load: async () => schemas });
    await settings.save('content', { data: { texts: { 'hero.eyebrow': 'A' } }, snapshot: true });
    await new Promise((r) => setTimeout(r, 20));
    await settings.save('content', { data: { texts: { 'hero.eyebrow': 'B' } }, snapshot: true });
    const versions = await settings.history('content');
    expect(versions).toHaveLength(2);
    const previous = await settings.readHistory('content', versions[0]!.id);
    expect(previous.data).toEqual({ version: 1, texts: { 'hero.eyebrow': 'A' } });
    await expect(settings.readHistory('content', '../theme.json')).rejects.toMatchObject({
      status: 400,
    });
  });
});
