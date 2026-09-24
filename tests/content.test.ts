import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { domainSlugs } from '@/data/domains';
import {
  activeLinks,
  entityItems,
  expertiseRows,
  inlineMarkdown,
  linkHref,
  linkItems,
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

describe('Identité & Liens', () => {
  it('liens par défaut : 7 entrées vides (rien affiché), anciennes coordonnées reprises', () => {
    expect(linkItems({}).map((l) => l.id)).toEqual([
      'instagram',
      'whatsapp',
      'linkedin',
      'github',
      'youtube',
      'email',
      'telephone',
    ]);
    expect(activeLinks({})).toEqual([]);
    const legacy = linkItems({
      contact: { email: 'a@b.fr', socials: [{ label: 'Behance', href: 'https://behance.net/x' }] },
    });
    expect(legacy.find((l) => l.id === 'email')?.href).toBe('a@b.fr');
    expect(legacy.at(-1)).toMatchObject({ label: 'Behance', icon: 'behance', category: 'social' });
  });

  it('adresses complétées : e-mail, téléphone, WhatsApp, domaine ; javascript: refusé', () => {
    expect(linkHref({ href: 'moi@exemple.com', icon: 'mail' })).toBe('mailto:moi@exemple.com');
    expect(linkHref({ href: '+221 77 123 45 67', icon: 'phone' })).toBe('tel:+221771234567');
    expect(linkHref({ href: '+221 77 123 45 67', icon: 'whatsapp' })).toBe(
      'https://wa.me/221771234567',
    );
    expect(linkHref({ href: 'github.com/moi', icon: 'github' })).toBe('https://github.com/moi');
    expect(linkHref({ href: 'https://x.com/moi' })).toBe('https://x.com/moi');
    expect(linkHref({ href: 'javascript:alert(1)' })).toBeUndefined();
    expect(linkHref({ href: 'n’importe quoi' })).toBeUndefined();
  });

  it('liens actifs : masqués, vides et invalides exclus ; catégorie ; ordre conservé', () => {
    const content = {
      links: [
        {
          id: 'a',
          label: 'GitHub',
          href: 'github.com/moi',
          icon: 'github',
          category: 'social' as const,
        },
        { id: 'b', label: 'Masqué', href: 'https://a.b', visible: false },
        {
          id: 'c',
          label: 'E-mail',
          href: 'moi@exemple.com',
          icon: 'mail',
          category: 'contact' as const,
        },
        { id: 'd', label: 'Vide', href: '' },
      ],
    };
    expect(activeLinks(content).map((l) => l.id)).toEqual(['a', 'c']);
    expect(activeLinks(content, 'contact')).toMatchObject([
      { id: 'c', display: 'moi@exemple.com' },
    ]);
    expect(activeLinks(content, 'social')).toMatchObject([
      { id: 'a', url: 'https://github.com/moi' },
    ]);
  });

  it('schémas : liens et symbole de l’en-tête', () => {
    expect(
      SETTINGS_SCHEMAS.content.safeParse({ links: [{ id: 'x', label: 'X', category: 'autre' }] })
        .success,
    ).toBe(false);
    expect(
      SETTINGS_SCHEMAS.theme.safeParse({ identity: { mark: 'photo', photo: '/identite/moi.jpg' } })
        .success,
    ).toBe(true);
    expect(SETTINGS_SCHEMAS.theme.safeParse({ identity: { mark: 'avatar' } }).success).toBe(false);
  });
});
