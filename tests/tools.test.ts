/** Expertises : outils du CV ↔ domaines ↔ projets, réglages de l'administration (src/lib/tools.ts). */
import { describe, expect, it } from 'vitest';
import { TOOLS } from '@/data/tools';
import { domainViews, findTool, toolGroups, toolViews, type ProjectRef } from '@/lib/tools';

const projects: ProjectRef[] = [
  {
    id: 'villa',
    title: 'Villa',
    href: '/projets/villa/',
    category: '3d-architecture',
    technologies: ['SketchUp', 'V-Ray'],
  },
  {
    id: 'etiquetage',
    title: 'Étiquetage',
    href: '/projets/etiquetage/',
    category: 'automatisation',
    technologies: ['ESP32', 'Arduino', 'NEMA 17', 'Fusion 360', 'Automatisation industrielle'],
  },
  {
    id: 'tourelle',
    title: 'Tourelle',
    href: '/projets/tourelle/',
    category: 'robotique',
    technologies: ['esp32', 'Computer Vision', 'Fusion 360', 'Capteur maison'],
  },
];

const CV = [
  'SketchUp',
  'AutoCAD',
  'Revit',
  'Fusion 360',
  'Blender',
  'Cinema 4D',
  'V-Ray',
  'Lumion',
  'Enscape',
  'Photoshop',
  'Illustrator',
  'Premiere Pro',
  'After Effects',
  'TIA Portal',
  'Zelio',
  'Proteus',
  'Multisim',
  'Schemaplic',
  'Arduino',
  'ESP32',
];

describe('outils du CV', () => {
  it('le registre contient exactement les outils du CV, chacun avec son icône', () => {
    const tools = TOOLS.filter((t) => t.kind === 'tool');
    expect(tools.map((t) => t.name)).toEqual(CV);
    expect(new Set(tools.map((t) => t.icon)).size).toBe(tools.length);
    expect(tools.every((t) => t.group && t.usage && t.domains.length > 0)).toBe(true);
  });

  it('reconnaît les technologies des fiches sans tenir compte de la casse', () => {
    expect(findTool('fusion 360')?.id).toBe('fusion-360');
    expect(findTool('V-RAY')?.id).toBe('vray');
    expect(findTool('Adobe Photoshop')?.id).toBe('photoshop');
    expect(findTool('Capteur maison')).toBeUndefined();
  });

  it('affiche tous les outils du CV, sans niveau par défaut, reliés aux projets qui les citent', () => {
    const tools = toolViews(projects);
    expect(tools.map((t) => t.name)).toEqual(CV);
    expect(tools.every((t) => t.level === undefined)).toBe(true);
    const fusion = tools.find((t) => t.id === 'fusion-360')!;
    expect(fusion.projects.map((p) => p.id)).toEqual(['etiquetage', 'tourelle']);
    expect(fusion.icon).toEqual({ builtin: 'fusion' });
    expect(tools.find((t) => t.id === 'photoshop')!.projects).toEqual([]);
  });

  it('regroupe : Création & design puis Technologies & ingénierie', () => {
    const groups = toolGroups(toolViews(projects));
    expect(groups.map((g) => g.label)).toEqual(['Création & design', 'Technologies & ingénierie']);
    expect(groups[0]!.subgroups.map((s) => s.label)).toEqual([
      '3D / CAO',
      'Rendu & visualisation',
      'Graphisme & motion',
    ]);
    expect(groups[1]!.subgroups.map((s) => s.tools.length)).toEqual([5, 2]);
  });

  it('applique l’administration : ordre, niveau, catégorie, domaines, projets, icône, masquage, ajout', () => {
    const tools = toolViews(projects, {
      tools: {
        items: [
          { id: 'outil-1', name: 'Cura', group: '3d-cao', domains: ['impression-3d-fabrication'] },
          { id: 'sketchup', level: 'maitrise', projects: ['tourelle', 'inconnu'] },
          { id: 'vray', icon: '/identite/vray.svg', usage: 'Rendus' },
          { id: 'arduino', visible: false },
          { id: 'zelio', level: 'n-importe-quoi', domains: ['automatisation'] },
        ],
      },
    });
    expect(tools.slice(0, 3).map((t) => t.id)).toEqual(['outil-1', 'sketchup', 'vray']);
    expect(tools.some((t) => t.id === 'arduino')).toBe(false);
    expect(tools[0]).toMatchObject({ name: 'Cura', domains: ['impression-3d-fabrication'] });
    expect(tools[1]!.level).toMatchObject({ id: 'maitrise', label: 'Maîtrise' });
    expect(tools[1]!.projects.map((p) => p.id)).toEqual(['villa', 'tourelle']);
    expect(tools[2]).toMatchObject({ icon: { src: '/identite/vray.svg' }, usage: 'Rendus' });
    const zelio = tools.find((t) => t.id === 'zelio')!;
    expect(zelio.level).toBeUndefined();
    expect(zelio.domains).toEqual(['automatisation']);
  });

  it('relie chaque domaine à ses projets, ses outils et le matériel cité', () => {
    const tools = toolViews(projects);
    const views = domainViews(projects, tools, { automatisation: 'Automatisation industrielle' });
    const auto = views.get('automatisation')!;
    expect(auto.projects.map((p) => p.id)).toEqual(['etiquetage']);
    expect(auto.tools.map((t) => t.id)).toEqual(
      expect.arrayContaining(['fusion-360', 'tia-portal', 'zelio', 'esp32']),
    );
    expect(auto.extras).toEqual(['Moteurs pas à pas NEMA 17']);
    expect(views.get('robotique')!.extras).toEqual(['Vision par ordinateur', 'Capteur maison']);
    expect(views.get('informatique-industrielle')!.tools.map((t) => t.id)).toEqual([
      'tia-portal',
      'zelio',
      'proteus',
      'multisim',
    ]);
  });
});
