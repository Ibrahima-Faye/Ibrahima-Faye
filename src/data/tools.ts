import type { DomainSlug } from './domains';
import type { ToolIconName } from '@/lib/tool-icons';

/**
 * Outils — SOURCE : le CV d'Ibrahima Faye (liste explicite), plus le matériel cité dans les fiches projet.
 * Aucun outil n'est ajouté sans source. Tout est modifiable dans l'administration
 * (Contenu du site → Expertises → Outils) : nom, icône, catégorie, description, niveau, ordre,
 * domaines, projets associés, visibilité — et de nouveaux outils peuvent y être ajoutés.
 *
 * - `group`   : sous-catégorie (voir TOOL_GROUPS).
 * - `domains` : domaines d'expertise où l'outil intervient (panneau de chaque domaine).
 * - `aliases` : écritures reconnues dans le champ `technologies` des fiches projet (projets associés).
 * - `usage`   : à quoi sert l'outil dans le travail — phrase courte, modifiable.
 * - Niveau : AUCUN par défaut (le CV n'en donne pas) ; il se règle dans l'administration.
 */

/** Catégories et sous-catégories (profil hybride : création ↔ technologie). */
export const TOOL_GROUPS = [
  {
    id: 'creation',
    label: 'Création & design',
    subgroups: [
      { id: '3d-cao', label: '3D / CAO' },
      { id: 'rendu', label: 'Rendu & visualisation' },
      { id: 'graphisme', label: 'Graphisme & motion' },
    ],
  },
  {
    id: 'ingenierie',
    label: 'Technologies & ingénierie',
    subgroups: [
      { id: 'automatisme', label: 'Automatisme & informatique industrielle' },
      { id: 'embarque', label: 'Électronique & systèmes embarqués' },
    ],
  },
] as const;

export type ToolSubgroup = (typeof TOOL_GROUPS)[number]['subgroups'][number]['id'];
export const TOOL_SUBGROUPS = TOOL_GROUPS.flatMap((g) =>
  g.subgroups.map((s) => ({ ...s, group: g.id, groupLabel: g.label })),
);
export const isToolSubgroup = (v: unknown): v is ToolSubgroup =>
  TOOL_SUBGROUPS.some((s) => s.id === v);

/** Niveaux (réglés dans l'administration ; la barre n'apparaît qu'une fois le niveau renseigné). */
export const TOOL_LEVELS = [
  { id: 'decouverte', label: 'Découverte', value: 0.25 },
  { id: 'utilisation', label: 'Utilisation', value: 0.5 },
  { id: 'maitrise', label: 'Maîtrise', value: 0.78 },
  { id: 'avance', label: 'Avancé', value: 1 },
] as const;
export type ToolLevel = (typeof TOOL_LEVELS)[number]['id'];
export const toolLevel = (id: unknown) => TOOL_LEVELS.find((l) => l.id === id);

export interface ToolDef {
  id: string;
  name: string;
  aliases: readonly string[];
  /** Outil (carte) ou simple mention de matériel / technique sur un domaine. */
  kind: 'tool' | 'hardware';
  icon: ToolIconName;
  group?: ToolSubgroup;
  domains: readonly DomainSlug[];
  usage?: string;
}

const tool = (
  id: string,
  name: string,
  icon: ToolIconName,
  group: ToolSubgroup,
  domains: DomainSlug[],
  usage: string,
  aliases: string[] = [],
): ToolDef => ({
  id,
  name,
  icon,
  group,
  domains,
  usage,
  kind: 'tool',
  aliases: [name.toLowerCase(), ...aliases],
});

export const TOOLS: readonly ToolDef[] = [
  /* ---------- Création & design — 3D / CAO ---------- */
  tool(
    'sketchup',
    'SketchUp',
    'sketchup',
    '3d-cao',
    ['3d-architecture'],
    'Modélisation 3D architecturale',
  ),
  tool('autocad', 'AutoCAD', 'autocad', '3d-cao', ['3d-architecture'], 'Plans et dessin technique'),
  tool(
    'revit',
    'Revit',
    'revit',
    '3d-cao',
    ['3d-architecture'],
    'Modélisation architecturale (BIM)',
    ['autodesk revit'],
  ),
  tool(
    'fusion-360',
    'Fusion 360',
    'fusion',
    '3d-cao',
    ['impression-3d-fabrication', 'robotique', 'automatisation', 'prototypage'],
    'Modélisation mécanique, pièces techniques et prototypes',
    ['fusion360', 'autodesk fusion', 'fusion'],
  ),
  tool(
    'blender',
    'Blender',
    'blender',
    '3d-cao',
    ['3d-architecture', 'impression-3d-fabrication'],
    'Modélisation et rendu 3D',
  ),
  tool(
    'cinema-4d',
    'Cinema 4D',
    'cinema4d',
    '3d-cao',
    ['3d-architecture', 'design-graphique'],
    'Modélisation et animation 3D',
    ['cinema4d', 'c4d'],
  ),
  /* ---------- Création & design — Rendu & visualisation ---------- */
  tool('vray', 'V-Ray', 'vray', 'rendu', ['3d-architecture'], 'Rendu photoréaliste', ['vray']),
  tool('lumion', 'Lumion', 'lumion', 'rendu', ['3d-architecture'], 'Visualisation architecturale'),
  tool(
    'enscape',
    'Enscape',
    'enscape',
    'rendu',
    ['3d-architecture'],
    'Visualisation architecturale en temps réel',
  ),
  /* ---------- Création & design — Graphisme & motion ---------- */
  tool(
    'photoshop',
    'Photoshop',
    'photoshop',
    'graphisme',
    ['design-graphique', '3d-architecture'],
    'Retouche et composition d’images',
    ['adobe photoshop'],
  ),
  tool(
    'illustrator',
    'Illustrator',
    'illustrator',
    'graphisme',
    ['design-graphique'],
    'Logos et identités visuelles',
    ['adobe illustrator'],
  ),
  tool(
    'premiere-pro',
    'Premiere Pro',
    'premiere',
    'graphisme',
    ['design-graphique'],
    'Montage vidéo',
    ['adobe premiere pro', 'premiere'],
  ),
  tool(
    'after-effects',
    'After Effects',
    'aftereffects',
    'graphisme',
    ['design-graphique'],
    'Motion design et animation',
    ['adobe after effects'],
  ),
  /* ---------- Technologies & ingénierie — Automatisme & informatique industrielle ---------- */
  tool(
    'tia-portal',
    'TIA Portal',
    'tia',
    'automatisme',
    ['automatisation', 'informatique-industrielle'],
    'Programmation d’automates Siemens',
    ['tia'],
  ),
  tool(
    'zelio',
    'Zelio',
    'schneider',
    'automatisme',
    ['automatisation', 'informatique-industrielle'],
    'Programmation de modules logiques Schneider',
    ['zelio soft'],
  ),
  tool(
    'proteus',
    'Proteus',
    'proteus',
    'automatisme',
    ['electronique-electrotechnique', 'informatique-industrielle'],
    'Simulation de circuits électroniques',
  ),
  tool(
    'multisim',
    'Multisim',
    'multisim',
    'automatisme',
    ['electronique-electrotechnique', 'informatique-industrielle'],
    'Simulation de circuits',
  ),
  tool(
    'schemaplic',
    'Schemaplic',
    'schematic',
    'automatisme',
    ['automatisation', 'electronique-electrotechnique'],
    'Schémas électriques et simulation d’automatismes',
  ),
  /* ---------- Technologies & ingénierie — Électronique & systèmes embarqués ---------- */
  tool(
    'arduino',
    'Arduino',
    'arduino',
    'embarque',
    ['electronique-electrotechnique', 'robotique', 'prototypage'],
    'Systèmes embarqués et prototypes',
  ),
  tool(
    'esp32',
    'ESP32',
    'espressif',
    'embarque',
    ['electronique-electrotechnique', 'robotique', 'automatisation', 'prototypage'],
    'Commande embarquée et programmation',
  ),

  /* ---------- Matériel et techniques cités dans les fiches projet (mentions, pas de carte) ---------- */
  {
    id: 'nema-17',
    name: 'Moteurs pas à pas NEMA 17',
    aliases: ['nema 17', 'nema17'],
    kind: 'hardware',
    icon: 'motor',
    domains: ['automatisation'],
  },
  {
    id: 'mg996r',
    name: 'Servomoteurs MG996R',
    aliases: ['mg996r'],
    kind: 'hardware',
    icon: 'motor',
    domains: ['robotique'],
  },
  {
    id: 'servo',
    name: 'Servomoteurs',
    aliases: ['servomoteurs', 'servomoteur', 'servo', 'servos'],
    kind: 'hardware',
    icon: 'motor',
    domains: ['robotique'],
  },
  {
    id: 'vision',
    name: 'Vision par ordinateur',
    aliases: ['computer vision', 'vision par ordinateur'],
    kind: 'hardware',
    icon: 'camera',
    domains: ['robotique'],
  },
  {
    id: 'camera',
    name: 'Caméra',
    aliases: ['cam', 'caméra', 'camera'],
    kind: 'hardware',
    icon: 'camera',
    domains: ['robotique'],
  },
  {
    id: 'laser',
    name: 'Laser',
    aliases: ['laser'],
    kind: 'hardware',
    icon: 'laser',
    domains: ['robotique'],
  },
];
