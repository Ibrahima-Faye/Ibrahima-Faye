/**
 * API de l'administration (integrations/local-cms/store.mjs), sur une COPIE TEMPORAIRE des 10 project.md :
 * les vrais fichiers ne sont jamais touchés.
 *
 *  - enregistrer sans rien changer n'écrit rien (fichier identique à l'octet près) ;
 *  - une modification ne change que la valeur modifiée (commentaires et mise en forme conservés)
 *    et garde la version précédente dans .cms/historique/ ;
 *  - les blocs (ids, types inconnus, champs inconnus) sont conservés et jamais retirés implicitement.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { createStore } from '../integrations/local-cms/store.mjs';
import { realProjects } from './helpers';

const projects = realProjects();
let root: string;
let store: any;

/** Charge un module du site comme le fait Vite dans l'intégration. */
const load = (id: string) => import(/* @vite-ignore */ `..${id}`);

const mdPath = (slug: string) => path.join(root, 'src/content/projects', slug, 'project.md');
const read = (slug: string) => readFileSync(mdPath(slug), 'utf8');
const history = (slug: string) => {
  const dir = path.join(root, '.cms/historique', slug);
  return existsSync(dir) ? readdirSync(dir) : [];
};

/** Données telles que l'éditeur de /admin les renvoie (voir src/cms/app/editor-state.ts, payload()). */
function editorPayload(data: Record<string, any>) {
  return {
    ...data,
    entity: [data.entity ?? 'personal'].flat(),
    media: (data.media ?? []).map((m: any) => ({
      file: m.file,
      span: m.span,
      align: m.align ?? 'center',
      alt: m.alt || undefined,
      caption: m.caption || undefined,
      ratio: m.ratio,
      hidden: m.hidden || undefined,
    })),
  };
}

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'cms-store-'));
  for (const p of projects) {
    cpSync(p.file, path.join(root, 'src/content/projects', p.slug, 'project.md'), {
      recursive: true,
    });
  }
  store = createStore(root, { load });
  await store.ready();
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('enregistrer sans modification ne change rien', () => {
  for (const p of projects) {
    it(`${p.slug} : données relues → identique à l'octet près, aucun historique`, async () => {
      const detail = await store.getProject(p.slug);
      const result = await store.saveProject(p.slug, { data: detail.data, body: detail.body });
      expect(result.unchanged).toBe(true);
      expect(read(p.slug)).toBe(p.text);
      expect(history(p.slug)).toEqual([]);
    });
    it(`${p.slug} : données telles que l'éditeur les renvoie → identique à l'octet près`, async () => {
      const detail = await store.getProject(p.slug);
      const result = await store.saveProject(p.slug, {
        data: editorPayload(detail.data),
        body: detail.body,
      });
      expect(result.unchanged).toBe(true);
      expect(read(p.slug)).toBe(p.text);
    });
  }
});

describe('une modification ne change que ce qui est modifié', () => {
  it('fiche « modèle » commentée (bras-robotique) : seul le titre change, commentaires conservés, historique écrit', async () => {
    const slug = 'bras-robotique';
    const before = read(slug);
    const detail = await store.getProject(slug);
    await store.saveProject(slug, {
      data: { ...detail.data, title: 'Titre modifié' },
      body: detail.body,
    });
    const after = read(slug);
    const diff = after.split('\n').filter((line, i) => line !== before.split('\n')[i]);
    expect(diff).toEqual(['title: Titre modifié']);
    expect(after.split('\n')).toHaveLength(before.split('\n').length);
    expect(history(slug)).toHaveLength(1);
    const kept = readFileSync(path.join(root, '.cms/historique', slug, history(slug)[0]!), 'utf8');
    expect(kept).toBe(before);
  });

  it('historique : une copie avant la 1re modification, pas une par enregistrement automatique', async () => {
    const slug = 'impression-3d';
    const original = read(slug);
    for (const title of ['Essai 1', 'Essai 2', 'Essai 3']) {
      const detail = await store.getProject(slug);
      await store.saveProject(slug, { data: { ...detail.data, title }, body: detail.body });
    }
    expect(history(slug)).toHaveLength(1);
    const kept = readFileSync(path.join(root, '.cms/historique', slug, history(slug)[0]!), 'utf8');
    expect(kept).toBe(original); // l'état d'avant la séance
  });

  it('écraser une version modifiée ailleurs (force) : elle est TOUJOURS copiée dans l’historique', async () => {
    const slug = 'impression-3d';
    const external = read(slug).replace(/^title: .*$/m, 'title: Modifié à la main');
    expect(external).toContain('title: Modifié à la main');
    writeFileSync(mdPath(slug), external);
    const detail = await store.getProject(slug);
    await store.saveProject(slug, {
      data: { ...detail.data, title: 'Ma version' },
      body: detail.body,
      force: true,
    });
    const copies = history(slug).map((f) =>
      readFileSync(path.join(root, '.cms/historique', slug, f), 'utf8'),
    );
    expect(copies.some((c) => c.includes('Modifié à la main'))).toBe(true);
  });

  it('fiche gérée par l’admin (wonderpark) : seul le titre change', async () => {
    const slug = 'wonderpark';
    const before = read(slug);
    const detail = await store.getProject(slug);
    await store.saveProject(slug, {
      data: { ...editorPayload(detail.data), title: 'Autre titre' },
      body: detail.body,
    });
    const changed = read(slug)
      .split('\n')
      .filter((line, i) => line !== before.split('\n')[i]);
    expect(changed).toEqual(['title: Autre titre']);
  });

  it('corps de texte absent de la requête : conservé (jamais effacé)', async () => {
    const slug = 'tourelle-automatique-suivi-de-cible';
    const detail = await store.getProject(slug);
    await store.saveProject(slug, { data: { ...detail.data, year: 2025 } });
    expect(read(slug)).toContain('## Architecture du système');
  });
});

describe('blocs', () => {
  const slug = 'systeme-etiquetage-automatique';
  const blocks = [
    { id: 'b-1', type: 'single', items: [{ id: 'i-1', file: 'convoyor.jpg' }] },
    {
      id: 'b-2',
      type: 'mosaique-future',
      reglage: { x: 1 },
      items: [{ id: 'i-2', file: 'page1-1.jpg', extra: true }],
    },
    { type: 'grid', columns: { desktop: 3 }, items: [{ file: 'page2-1.jpg' }] },
  ];

  it('enregistrés tels quels (types et champs inconnus compris) ; ids manquants attribués', async () => {
    const detail = await store.getProject(slug);
    await store.saveProject(slug, { data: { ...detail.data, blocks }, body: detail.body });
    const saved = (await store.getProject(slug)).data.blocks;
    expect(saved[0]).toEqual(blocks[0]);
    expect(saved[1]).toEqual(blocks[1]);
    expect(saved[2].id).toMatch(/^b-[0-9a-f]{6}$/);
    expect(saved[2].items[0].id).toMatch(/^i-[0-9a-f]{6}$/);
    expect(saved[2].columns).toEqual({ desktop: 3 });
  });

  it('ids stables : un nouvel enregistrement ne change rien', async () => {
    const before = read(slug);
    const detail = await store.getProject(slug);
    const result = await store.saveProject(slug, {
      data: editorPayload(detail.data),
      body: detail.body,
    });
    expect(result.unchanged).toBe(true);
    expect(read(slug)).toBe(before);
  });

  it('jamais retirés implicitement : une requête sans « blocks » les conserve', async () => {
    const detail = await store.getProject(slug);
    const { blocks: _omit, ...withoutBlocks } = detail.data;
    await store.saveProject(slug, { data: { ...withoutBlocks, year: 2025 }, body: detail.body });
    expect((await store.getProject(slug)).data.blocks).toHaveLength(3);
  });

  it('les autres champs du fichier ne bougent pas', async () => {
    const data = YAML.parse(read(slug).split('---')[1]!);
    const original = projects.find((p) => p.slug === slug)!.data;
    expect(data.media).toEqual(original.media);
    expect(data.summary).toBe(original.summary);
  });

  it('identifiants en double : refusé (400), fichier inchangé', async () => {
    const before = read(slug);
    const detail = await store.getProject(slug);
    const dup = [
      { id: 'd', type: 'grid', items: [{ file: 'convoyor.jpg' }] },
      { id: 'd', type: 'grid', items: [{ file: 'page1-1.jpg' }] },
    ];
    await expect(
      store.saveProject(slug, { data: { ...detail.data, blocks: dup }, body: detail.body }),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(read(slug)).toBe(before);
  });

  it('forme invalide : refusé (400) avec un message en français', async () => {
    const detail = await store.getProject(slug);
    await expect(
      store.saveProject(slug, {
        data: { ...detail.data, blocks: [{ type: 'grid', items: [{ span: 2 }] }] },
        body: detail.body,
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/Blocs invalides/) });
  });
});
