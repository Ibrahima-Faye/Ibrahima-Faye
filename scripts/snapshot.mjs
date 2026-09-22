#!/usr/bin/env node
/**
 * Sauvegarde instantanée du projet — à lancer avant chaque étape importante.
 *
 *   npm run sauvegarde -- "avant-galerie"            code + fiches + inventaire des médias
 *   npm run sauvegarde -- "avant-medias" --medias    idem + COPIE de tous les médias (lourd)
 *
 * Crée  backups/<date>-<nom>/ :
 *   fichiers/        copie de tous les fichiers texte du projet (code, project.md, réglages, docs…)
 *   medias/          (option --medias) copie des images et vidéos
 *   inventaire.json  taille + empreinte SHA-256 de CHAQUE fichier (médias compris) : permet de vérifier
 *                    qu'aucun média n'a été modifié ou perdu, même sans les avoir copiés
 *   LISEZMOI.md      comment restaurer
 *
 * Ne modifie et ne supprime RIEN dans le projet. Restauration : scripts/restore-snapshot.mjs.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Dossiers jamais sauvegardés : générés, dépendances, historique git, sauvegardes elles-mêmes. */
export const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.astro',
  '.git',
  'backups',
  'media', // originaux (sauvegarde séparée : voir docs)
  '.cms', // secrets de l'administration
  '.vercel',
  '.netlify',
  '.wrangler',
]);

export const MEDIA_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'heic',
  'heif',
  'mp4',
  'webm',
  'mov',
  'm4v',
]);

const toPosix = (p) => p.split(sep).join('/');
const isMedia = (name) => MEDIA_EXT.has(name.split('.').pop()?.toLowerCase() ?? '');

export async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (entry.isFile()) {
      yield join(dir, entry.name);
    }
  }
}

export function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

const stampOf = (date) =>
  date.toISOString().replace('T', '_').replace(/:/g, '-').replace(/\..+$/, '');

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null; // pas encore de commit
  }
}

const formatBytes = (n) =>
  n > 1024 ** 3
    ? `${(n / 1024 ** 3).toFixed(2)} Go`
    : n > 1024 ** 2
      ? `${(n / 1024 ** 2).toFixed(1)} Mo`
      : `${Math.round(n / 1024)} Ko`;

/** Crée une sauvegarde ; renvoie son dossier. Utilisable depuis d'autres scripts. */
export async function createSnapshot(label = 'manuel', { withMedia = false, quiet = false } = {}) {
  const now = new Date();
  const safeLabel =
    String(label)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'manuel';
  const name = `${stampOf(now)}-${safeLabel}`;
  const dest = join(root, 'backups', name);
  const log = (...args) => !quiet && console.log(...args);

  const files = [];
  const media = [];
  let copiedBytes = 0;

  for await (const file of walk(root)) {
    const rel = toPosix(relative(root, file));
    const info = await stat(file);
    const entry = {
      path: rel,
      size: info.size,
      mtime: new Date(info.mtimeMs).toISOString(),
      sha256: await sha256(file),
    };
    if (isMedia(rel)) {
      media.push(entry);
      if (!withMedia) continue;
      await mkdir(dirname(join(dest, 'medias', rel)), { recursive: true });
      await copyFile(file, join(dest, 'medias', rel));
    } else {
      files.push(entry);
      await mkdir(dirname(join(dest, 'fichiers', rel)), { recursive: true });
      await copyFile(file, join(dest, 'fichiers', rel));
    }
    copiedBytes += withMedia || !isMedia(rel) ? info.size : 0;
  }

  const inventory = {
    version: 1,
    name,
    label: String(label),
    createdAt: now.toISOString(),
    gitHead: gitHead(),
    mediaCopied: withMedia,
    files,
    media,
  };
  await writeFile(join(dest, 'inventaire.json'), JSON.stringify(inventory, null, 2) + '\n', 'utf8');
  await writeFile(
    join(dest, 'LISEZMOI.md'),
    `# Sauvegarde « ${label} » — ${now.toLocaleString('fr-FR')}

- ${files.length} fichiers texte copiés dans \`fichiers/\`
- ${media.length} médias inventoriés (${formatBytes(media.reduce((n, m) => n + m.size, 0))})${
      withMedia
        ? ', copiés dans `medias/`'
        : ' — NON copiés (empreintes SHA-256 dans `inventaire.json`)'
    }
- Commit git au moment de la sauvegarde : ${inventory.gitHead ?? 'aucun'}

## Restaurer

\`\`\`sh
npm run sauvegarde:restaurer -- ${name}              # simulation : liste ce qui changerait
npm run sauvegarde:restaurer -- ${name} --confirmer  # restauration (sauvegarde automatique de l'état actuel avant)
\`\`\`

La restauration ne supprime jamais de fichier : elle réécrit les fichiers modifiés et recrée les fichiers disparus.
`,
    'utf8',
  );

  log(`Sauvegarde créée : backups/${name}/`);
  log(`  ${files.length} fichiers texte copiés`);
  log(
    `  ${media.length} médias inventoriés${withMedia ? ' et copiés' : ' (empreintes seulement)'}`,
  );
  log(`  ${formatBytes(copiedBytes)} écrits`);
  return dest;
}

// — Utilisation en ligne de commande —
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const withMedia = args.includes('--medias');
  const label = args.find((a) => !a.startsWith('--')) ?? 'manuel';
  createSnapshot(label, { withMedia }).catch((error) => {
    console.error('Échec de la sauvegarde :', error.message ?? error);
    process.exit(1);
  });
}
