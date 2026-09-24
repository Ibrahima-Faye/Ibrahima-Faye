import type { DomainSlug } from './domains';
import type { ToolIconName } from '@/lib/tool-icons';

/**
 * Outils connus — reconnus dans le champ `technologies` des fiches projet (insensible à la casse).
 *
 * RÈGLE : un outil n'est affiché que s'il est cité dans un projet publié, ou ajouté explicitement dans
 * l'administration (Contenu du site → Expertises → Outils). Aucun niveau, aucun pourcentage.
 *
 * - `kind: 'software' | 'board'` → carte « Outil » (logiciel, carte électronique) ;
 * - `kind: 'hardware' | 'technique'` → simple mention « Matériel & techniques » dans le domaine.
 * - `domain` : domaine de repli ; sinon la catégorie affichée vient des projets qui l'utilisent.
 * - `usage` : ce à quoi l'outil sert dans les projets (tiré des rôles décrits dans les fiches).
 */
export interface ToolDef {
  id: string;
  name: string;
  aliases: readonly string[];
  kind: 'software' | 'board' | 'hardware' | 'technique';
  icon: ToolIconName;
  domain: DomainSlug;
  usage?: string;
}

export const TOOLS: readonly ToolDef[] = [
  {
    id: 'sketchup',
    name: 'SketchUp',
    aliases: ['sketchup'],
    kind: 'software',
    icon: 'sketchup',
    domain: '3d-architecture',
    usage: 'Modélisation 3D architecturale',
  },
  {
    id: 'vray',
    name: 'V-Ray',
    aliases: ['v-ray', 'vray'],
    kind: 'software',
    icon: 'render',
    domain: '3d-architecture',
    usage: 'Rendu et visualisation photoréaliste',
  },
  {
    id: 'fusion-360',
    name: 'Fusion 360',
    aliases: ['fusion 360', 'fusion360', 'autodesk fusion'],
    kind: 'software',
    icon: 'autodesk',
    domain: 'prototypage',
    usage: 'Conception mécanique et modélisation 3D',
  },
  {
    id: 'esp32',
    name: 'ESP32',
    aliases: ['esp32'],
    kind: 'board',
    icon: 'espressif',
    domain: 'electronique-electrotechnique',
    usage: 'Commande embarquée et programmation',
  },
  {
    id: 'arduino',
    name: 'Arduino',
    aliases: ['arduino'],
    kind: 'board',
    icon: 'arduino',
    domain: 'electronique-electrotechnique',
    usage: 'Prototypage électronique et programmation',
  },
  {
    id: 'nema-17',
    name: 'Moteurs pas à pas NEMA 17',
    aliases: ['nema 17', 'nema17'],
    kind: 'hardware',
    icon: 'motor',
    domain: 'automatisation',
  },
  {
    id: 'mg996r',
    name: 'Servomoteurs MG996R',
    aliases: ['mg996r'],
    kind: 'hardware',
    icon: 'motor',
    domain: 'robotique',
  },
  {
    id: 'servo',
    name: 'Servomoteurs',
    aliases: ['servomoteurs', 'servomoteur', 'servo', 'servos'],
    kind: 'hardware',
    icon: 'motor',
    domain: 'robotique',
  },
  {
    id: 'vision',
    name: 'Vision par ordinateur',
    aliases: ['computer vision', 'vision par ordinateur'],
    kind: 'technique',
    icon: 'camera',
    domain: 'robotique',
  },
  {
    id: 'camera',
    name: 'Caméra',
    aliases: ['cam', 'caméra', 'camera'],
    kind: 'hardware',
    icon: 'camera',
    domain: 'robotique',
  },
  {
    id: 'laser',
    name: 'Laser',
    aliases: ['laser'],
    kind: 'hardware',
    icon: 'laser',
    domain: 'robotique',
  },
];
