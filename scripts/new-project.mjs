#!/usr/bin/env node
/**
 * Crée un nouveau projet en une commande, sans toucher au code du site.
 *
 *   npm run projet -- "Titre du projet"
 *   npm run projet -- "Bras robotique" --categorie robotique --marque jeefsys --annee 2025
 *   npm run projet -- "Projet commun" --categorie automatisation --marque clicgraph,jeefsys
 *
 * Options : --categorie, --marque (une ou plusieurs, séparées par une virgule), --annee,
 *           --statut, --ordre, --slug (nom du dossier = adresse), --force (écraser)
 * Sans option, les questions sont posées dans le terminal.
 *
 * Le projet est créé en BROUILLON (`draft: true`) : visible en local uniquement.
 * Aucune donnée n'est inventée : seuls les champs fournis sont renseignés.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectsDir = join(root, 'src/content/projects');
const templatePath = join(root, 'docs/modele-projet/project.md');

/** Lit une liste `export const <name> = [...] as const` dans src/data (source de vérité du site). */
function readList(file, name) {
  const text = readFileSync(join(root, file), 'utf8');
  const match = text.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`));
  if (!match) throw new Error(`Liste « ${name} » introuvable dans ${file}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const categories = readList('src/data/domains.ts', 'domainSlugs');
const brands = readList('src/data/entities.ts', 'entitySlugs');
const statuses = readList('src/data/entities.ts', 'projectStatuses');

const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Écrit une valeur YAML : entre guillemets seulement si nécessaire. */
const yaml = (value) =>
  /[:#[\]{}&*!|>'"%@`,]|^\s|\s$/.test(value) ? JSON.stringify(value) : value;

/* ---------- arguments ---------- */
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = args[i + 1];
    if (key === 'force') flags.force = true;
    else if (next !== undefined && !next.startsWith('--')) flags[key] = args[++i];
    else flags[key] = '';
  } else positional.push(a);
}
const pick = (...names) => names.map((n) => flags[n]).find((v) => v !== undefined && v !== '');

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

/* ---------- questions (si des informations manquent et qu'on est dans un terminal) ---------- */
const rl = process.stdin.isTTY
  ? createInterface({ input: process.stdin, output: process.stdout })
  : null;

async function choose(label, values, { multiple = false, optional = false } = {}) {
  if (!rl) return undefined;
  console.log(`\n${label}`);
  values.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
  const hint = multiple ? ' (plusieurs : 1,3)' : '';
  const skip = optional ? ' — Entrée pour passer' : '';
  const answer = (await rl.question(`> Numéro ou nom${hint}${skip} : `)).trim();
  if (!answer) return undefined;
  return answer
    .split(',')
    .map((part) => part.trim())
    .map((part) => (/^\d+$/.test(part) ? values[Number(part) - 1] : part))
    .filter(Boolean)
    .join(',');
}

let title = positional.join(' ').trim();
if (!title && rl) title = (await rl.question('Titre du projet : ')).trim();
if (!title) fail('Il faut un titre :  npm run projet -- "Titre du projet"');

let category = pick('categorie', 'category');
if (!category) category = await choose('Catégorie (domaine) :', categories);
if (!category) fail(`Catégorie manquante. Valeurs possibles : ${categories.join(', ')}`);
if (!categories.includes(category)) {
  fail(`Catégorie « ${category} » inconnue. Valeurs possibles : ${categories.join(', ')}`);
}

let brandArg = pick('marque', 'entity', 'entite');
if (!brandArg) brandArg = await choose('Marque(s) :', brands, { multiple: true, optional: true });
const chosen = (brandArg ?? 'personal')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);
for (const b of chosen) {
  if (!brands.includes(b))
    fail(`Marque « ${b} » inconnue. Valeurs possibles : ${brands.join(', ')}`);
}

const year = pick('annee', 'year');
if (year !== undefined && !/^\d{4}$/.test(year)) fail('L’année doit avoir 4 chiffres, ex. 2025.');
const status = pick('statut', 'status');
if (status !== undefined && !statuses.includes(status)) {
  fail(`Statut « ${status} » inconnu. Valeurs possibles : ${statuses.join(', ')}`);
}
const order = pick('ordre', 'order');
if (order !== undefined && Number.isNaN(Number(order))) fail('L’ordre doit être un nombre.');

const slug = pick('slug') ?? slugify(title);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  fail(`Nom de dossier / adresse invalide : « ${slug} » (minuscules, chiffres et tirets).`);
}
rl?.close();

/* ---------- création ---------- */
const dir = join(projectsDir, slug);
if (existsSync(dir) && !flags.force) {
  fail(
    `Le projet « ${slug} » existe déjà (${relative(root, dir)}). Utilise --force pour l’écraser.`,
  );
}

let text = readFileSync(templatePath, 'utf8');
const replaceLine = (pattern, line) => {
  if (!pattern.test(text)) {
    fail(`Le modèle (${relative(root, templatePath)}) a changé : ligne introuvable ${pattern}`);
  }
  text = text.replace(pattern, line);
};
replaceLine(/^title: .*$/m, `title: ${yaml(title)}`);
replaceLine(/^category: .*$/m, `category: ${category}`);
replaceLine(/^entity: .*$/m, `entity: ${chosen.length > 1 ? `[${chosen.join(', ')}]` : chosen[0]}`);
if (year) replaceLine(/^# year: .*$/m, `year: ${year}`);
if (status) replaceLine(/^# status: .*$/m, `status: ${status}`);
if (order) replaceLine(/^# order: .*$/m, `order: ${order}`);

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'project.md'), text.replace(/\r?\n/g, '\n'));

console.log(`
✓ Projet créé : ${relative(root, join(dir, 'project.md'))}
  Titre     : ${title}
  Adresse   : /projets/${slug}/
  Catégorie : ${category}
  Marque(s) : ${chosen.join(', ')}
  État      : brouillon (visible en local uniquement)

Suite :
  1. Dépose cover.jpg + tes images / vidéos dans  ${relative(root, dir)}/
  2. Complète project.md (année, description, rôle, résultat…) — faits vérifiés uniquement
  3. Supprime la ligne « draft: true » pour publier
`);
