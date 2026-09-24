/** Expertises « compétence → projet » : domaines, outils, matériel (src/lib/tools.ts). */
import { describe, expect, it } from 'vitest';
import { domainViews, findTool, toolViews, type ProjectRef } from '@/lib/tools';

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

describe('outils des projets', () => {
  it('reconnaît les technologies sans tenir compte de la casse', () => {
    expect(findTool('fusion 360')?.id).toBe('fusion-360');
    expect(findTool('V-RAY')?.id).toBe('vray');
    expect(findTool('Blender')).toBeUndefined();
  });

  it('relie chaque domaine à ses projets, outils et matériel', () => {
    const views = domainViews(projects, { automatisation: 'Automatisation industrielle' });
    const auto = views.get('automatisation')!;
    expect(auto.projects.map((p) => p.id)).toEqual(['etiquetage']);
    expect(auto.tools).toEqual(['ESP32', 'Arduino', 'Fusion 360']);
    // le nom du domaine cité comme technologie n'est pas répété
    expect(auto.extras).toEqual(['Moteurs pas à pas NEMA 17']);
    // une technologie inconnue du registre reste affichée telle quelle
    expect(views.get('robotique')!.extras).toEqual(['Vision par ordinateur', 'Capteur maison']);
    expect(views.get('design-graphique')!.projects).toEqual([]);
  });

  it('n’affiche que les logiciels et cartes réellement cités, sans pourcentage', () => {
    const tools = toolViews(projects);
    expect(tools.map((t) => t.id)).toEqual(['sketchup', 'vray', 'fusion-360', 'esp32', 'arduino']);
    const fusion = tools.find((t) => t.id === 'fusion-360')!;
    expect(fusion.domains).toEqual(['robotique', 'automatisation']);
    expect(fusion.projects.map((p) => p.id)).toEqual(['etiquetage', 'tourelle']);
    expect(fusion.icon).toEqual({ builtin: 'autodesk' });
    expect(Object.keys(fusion)).not.toContain('level');
  });

  it('applique les réglages de l’administration (ordre, icône, masquage, ajout)', () => {
    const tools = toolViews(projects, {
      tools: {
        items: [
          { id: 'outil-1', name: 'Cura', domain: 'impression-3d-fabrication', icon: 'printer' },
          { id: 'vray', icon: '/identite/vray.svg', usage: 'Rendus' },
          { id: 'arduino', visible: false },
          { id: 'blender' },
        ],
      },
    });
    expect(tools.map((t) => t.id)).toEqual(['outil-1', 'vray', 'sketchup', 'fusion-360', 'esp32']);
    expect(tools[0]).toMatchObject({
      name: 'Cura',
      domains: ['impression-3d-fabrication'],
      icon: { builtin: 'printer' },
      projects: [],
    });
    expect(tools[1]).toMatchObject({ icon: { src: '/identite/vray.svg' }, usage: 'Rendus' });
  });

  it('un outil connu jamais cité n’apparaît que s’il est ajouté explicitement', () => {
    expect(toolViews([]).length).toBe(0);
    expect(toolViews([], { tools: { items: [{ id: 'sketchup' }] } }).length).toBe(0);
    const added = toolViews([], { tools: { items: [{ id: 'sketchup', name: 'SketchUp Pro' }] } });
    expect(added[0]).toMatchObject({ name: 'SketchUp Pro', domains: ['3d-architecture'] });
  });
});
