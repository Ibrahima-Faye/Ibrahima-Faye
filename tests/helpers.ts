/** Lecture (seule) des vrais projets du site pour les tests. Rien n'est jamais écrit ici. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const projectsDir = path.join(repoRoot, 'src/content/projects');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface RealProject {
  slug: string;
  file: string;
  text: string;
  data: Record<string, any>;
  body: string;
  /** Noms des fichiers du dossier (hors project.md). */
  files: string[];
}

export function realProjects(): RealProject[] {
  return readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(projectsDir, d.name, 'project.md')))
    .map((d) => {
      const file = path.join(projectsDir, d.name, 'project.md');
      const text = readFileSync(file, 'utf8');
      const match = text.match(FRONTMATTER)!;
      return {
        slug: d.name,
        file,
        text,
        data: YAML.parse(match[1]) ?? {},
        body: match[2].replace(/^\r?\n+/, ''),
        files: readdirSync(path.join(projectsDir, d.name)).filter((n) => n !== 'project.md'),
      };
    });
}

export const EXPECTED_SLUGS = [
  'bras-robotique',
  'design-graphique',
  'electronique-esp32-arduino',
  'impression-3d',
  'residences-de-sindia',
  'salle-de-sport-complexe-sportif',
  'systeme-de-charge-automatise',
  'systeme-etiquetage-automatique',
  'tourelle-automatique-suivi-de-cible',
  'wonderpark',
];
