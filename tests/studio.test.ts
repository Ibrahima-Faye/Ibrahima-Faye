import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { themeToCss } from '@/lib/studio/theme';
import { ANIM_TARGETS, ANIMATIONS, STYLE_PRESETS, resolveAnimation } from '@/lib/studio/animations';
import {
  SECTION_KEYS,
  applyContent,
  navLinks,
  sectionAnchor,
  sectionOrder,
  sectionProps,
  sectionStyle,
  sectionVisible,
} from '@/lib/studio/layout';
import { SETTINGS_SCHEMAS } from '@/schemas/settings';
import * as schemas from '@/schemas/settings';
import { createSettings } from '../integrations/local-cms/settings.mjs';

describe('Theme Editor : thème → CSS', () => {
  it('thème vide = aucun CSS, aucun attribut (le site reste identique)', () => {
    expect(themeToCss({})).toEqual({ css: '', attrs: {} });
    expect(themeToCss(undefined)).toEqual({ css: '', attrs: {} });
  });

  it('couleurs → jetons existants + nuances dérivées', () => {
    const { css } = themeToCss({ colors: { accent: '#ff0066', bg: '#000000' } });
    expect(css).toContain('--color-electric-500: #ff0066;');
    expect(css).toContain('--color-electric-400: color-mix(in oklab, #ff0066, white 16%);');
    expect(css).toContain('--color-ink-950: #000000;');
  });

  it('valeurs par appareil → media queries', () => {
    const { css } = themeToCss({ typography: { baseSize: { mobile: 15, desktop: 18 } } });
    expect(css).toContain('@media (max-width: 47.99rem) { :root { --text-base: 0.9375rem; } }');
    expect(css).toContain('@media (min-width: 64rem) { :root { --text-base: 1.125rem; } }');
    expect(css).not.toContain('min-width: 48rem) and');
  });

  it('effets → attributs sur <html> ; valeurs d’origine = rien', () => {
    expect(themeToCss({ effects: { glass: false, grid: true, cursor: 'ring' } }).attrs).toEqual({
      'data-glass': 'off',
      'data-grid': 'on',
      'data-cursor': 'ring',
    });
    expect(themeToCss({ effects: { cursor: 'default', shadows: 'soft' } }).attrs).toEqual({});
  });

  it('valeurs dangereuses neutralisées (pas d’évasion du bloc CSS)', () => {
    const { css } = themeToCss({ colors: { text: 'red; } body { display:none' } });
    // accolades et points-virgules retirés : une seule règle, une seule déclaration (invalide, donc ignorée)
    expect(css.match(/[{]/g)).toHaveLength(1);
    expect(css.match(/;/g)).toHaveLength(1);
  });
});

describe('Animation Studio : résolution des réglages', () => {
  it('26 effets, 10 styles, identifiants uniques', () => {
    expect(ANIMATIONS).toHaveLength(26);
    expect(STYLE_PRESETS.map((p) => p.label)).toEqual([
      'Cinematic',
      'Smooth',
      'Minimal',
      'Luxury',
      'Tech',
      'Glitch',
      'Editorial',
      'Elastic',
      'Fast',
      'Slow',
    ]);
    expect(new Set(ANIMATIONS.map((a) => a.id)).size).toBe(26);
    expect(new Set(ANIM_TARGETS.map((t) => t.id)).size).toBe(ANIM_TARGETS.length);
  });

  it('sans réglage : rien (l’animation d’origine reste)', () => {
    expect(resolveAnimation({}, 'hero.title', 'desktop')).toBeNull();
  });

  it('fusion : base ← style du site ← élément ← appareil', () => {
    const config = {
      preset: 'fast',
      targets: {
        'expertises.title': {
          animation: 'blur-reveal',
          delay: 0.2,
          devices: { mobile: { duration: 0.3 }, tablet: { enabled: false } },
        },
      },
    };
    const desktop = resolveAnimation(config, 'expertises.title', 'desktop')!;
    expect(desktop.animation.id).toBe('blur-reveal');
    expect(desktop.duration).toBe(0.5); // style « Fast »
    expect(desktop.delay).toBe(0.2);
    expect(resolveAnimation(config, 'expertises.title', 'mobile')!.duration).toBe(0.3);
    expect(resolveAnimation(config, 'expertises.title', 'tablet')).toBeNull();
  });

  it('déclencheur limité à ceux de l’effet ; élément désactivé = rien', () => {
    const r = resolveAnimation(
      { targets: { x: { animation: 'parallax', trigger: 'hover' } } },
      'x',
      'desktop',
    )!;
    expect(r.trigger).toBe('scrub');
    expect(
      resolveAnimation(
        { targets: { x: { animation: 'fade-in', enabled: false } } },
        'x',
        'desktop',
      ),
    ).toBeNull();
    expect(
      resolveAnimation({ targets: { x: { animation: 'inconnue' } } }, 'x', 'desktop'),
    ).toBeNull();
  });
});

describe('Sections & navigation', () => {
  it('ordre : réglé, complété des sections oubliées, jamais de perte ni de doublon', () => {
    expect(sectionOrder({})).toEqual([...SECTION_KEYS]);
    // parcours : qui je suis → mon univers → ce que je sais faire → mes réalisations → contact
    expect(sectionOrder({}).filter((k) => sectionVisible({}, k))).toEqual([
      'hero',
      'marquee',
      'about',
      'ecosystem',
      'expertises',
      'projects',
      'contact',
    ]);
    expect(sectionVisible({ sections: { manifesto: { visible: true } } }, 'manifesto')).toBe(true);
    expect(sectionVisible({ sections: { about: { visible: false } } }, 'about')).toBe(false);
    expect(sectionProps({}, 'expertises', sectionOrder({})).index).toBe('03');
    expect(sectionProps({}, 'hero', sectionOrder({})).index).toBeUndefined();
    const order = sectionOrder({ order: ['contact', 'hero', 'contact', 'inconnue'] });
    expect(order.slice(0, 2)).toEqual(['contact', 'hero']);
    expect(new Set(order).size).toBe(SECTION_KEYS.length);
  });

  it('ancre : réglée si valide, sinon celle d’origine', () => {
    expect(sectionAnchor({}, 'about')).toBe('a-propos');
    expect(sectionAnchor({ sections: { about: { anchor: 'qui-suis-je' } } }, 'about')).toBe(
      'qui-suis-je',
    );
    expect(sectionAnchor({ sections: { about: { anchor: 'Pas Valide!' } } }, 'about')).toBe(
      'a-propos',
    );
  });

  it('style de section vide = aucun style (rendu d’origine)', () => {
    expect(sectionStyle({})).toEqual({ style: '', attrs: {} });
    const s = sectionStyle({
      background: { mode: 'color', color: '#112233' },
      height: 'screen',
      effects: false,
    });
    expect(s.style).toContain('background:#112233');
    expect(s.style).toContain('min-height:100svh');
    expect(s.attrs).toMatchObject({ 'data-section-bg': 'custom', 'data-section-fx': 'off' });
  });

  it('textes : seules les valeurs existantes du même type sont remplacées', () => {
    const dict = { a: { title: 'T', lines: ['x', 'y'] } };
    const out = applyContent(dict, {
      'a.title': 'Nouveau',
      'a.lines': ['1'],
      'a.inconnu': 'z',
      'b.c': 'd',
    });
    expect(out).toEqual({ a: { title: 'Nouveau', lines: ['1'] } });
    expect(dict.a.title).toBe('T'); // l'original n'est pas modifié
    expect(applyContent(dict, {})).toBe(dict);
  });

  it('navigation : liens d’origine sans réglage', () => {
    expect(navLinks({}).map((l) => l.id)).toEqual([
      'a-propos',
      'ecosysteme',
      'expertises',
      'projets',
      'contact',
    ]);
    expect(
      navLinks({ links: [{ id: 'contact', target: 'contact', label: 'Écrire' }] })[0],
    ).toMatchObject({
      label: 'Écrire',
      button: true,
    });
  });
});

describe('Schémas des réglages', () => {
  it('les 4 fichiers livrés sont valides', async () => {
    for (const name of schemas.SETTINGS_NAMES) {
      const raw = JSON.parse(await readFile(`src/settings/${name}.json`, 'utf8'));
      expect(SETTINGS_SCHEMAS[name].safeParse(raw).success).toBe(true);
    }
  });

  it('valeurs hors bornes refusées ; champs inconnus conservés', () => {
    expect(
      SETTINGS_SCHEMAS.animations.safeParse({
        targets: { x: { animation: 'fade-in', duration: 99 } },
      }).success,
    ).toBe(false);
    const parsed = SETTINGS_SCHEMAS.theme.safeParse({ futur: { webgl: true } });
    expect(parsed.success && (parsed.data as Record<string, unknown>).futur).toEqual({
      webgl: true,
    });
  });
});

describe('API locale des réglages', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });
  const setup = async () => {
    root = await mkdtemp(path.join(tmpdir(), 'reglages-'));
    await mkdir(path.join(root, 'src/settings'), { recursive: true });
    await writeFile(path.join(root, 'src/settings/theme.json'), '{\n  "version": 1\n}\n');
    return createSettings(root, { load: async () => schemas });
  };

  it('enregistre, n’écrit rien si inchangé, garde l’historique, détecte les conflits', async () => {
    const settings = await setup();
    const first = await settings.read('theme');
    const saved = await settings.save('theme', {
      data: { colors: { accent: '#ff0066' } },
      baseUpdatedAt: first.updatedAt,
    });
    expect(saved.unchanged).toBeUndefined();
    expect(JSON.parse(await readFile(path.join(root!, 'src/settings/theme.json'), 'utf8'))).toEqual(
      {
        version: 1,
        colors: { accent: '#ff0066' },
      },
    );
    expect(await readdir(path.join(root!, '.cms/historique/reglages'))).toHaveLength(1);
    const again = await settings.save('theme', { data: { colors: { accent: '#ff0066' } } });
    expect(again.unchanged).toBe(true);
    await expect(settings.save('theme', { data: {}, baseUpdatedAt: 1 })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      settings.save('theme', { data: { typography: { lineHeight: 9 } } }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(settings.read('inconnu')).rejects.toMatchObject({ status: 404 });
  });

  it('identité : SVG nettoyé, formats limités, jamais d’écrasement', async () => {
    const settings = await setup();
    const req = (text: string) => Readable.from([Buffer.from(text)]);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect/></svg>';
    const a = await settings.saveIdentity(req(svg), 'Logo.svg');
    const b = await settings.saveIdentity(req(svg), 'logo.svg');
    expect(a.path).toBe('/identite/logo.svg');
    expect(b.path).toBe('/identite/logo-2.svg');
    const written = await readFile(path.join(root!, 'public/identite/logo.svg'), 'utf8');
    expect(written).not.toMatch(/script|onload/);
    await expect(settings.saveIdentity(req('x'), 'virus.exe')).rejects.toMatchObject({
      status: 400,
    });
  });
});
