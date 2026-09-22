#!/usr/bin/env node
/**
 * Restaure une sauvegarde créée par scripts/snapshot.mjs.
 *
 *   npm run sauvegarde:restaurer                                  liste les sauvegardes
 *   npm run sauvegarde:restaurer -- <nom>                         SIMULATION : ce qui changerait (rien n'est écrit)
 *   npm run sauvegarde:restaurer -- <nom> --confirmer             restauration réelle
 *
 * Garanties :
 *  - rien n'est écrit sans --confirmer ;
 *  - l'état actuel est d'abord sauvegardé automatiquement (« avant-restauration ») ;
 *  - AUCUN fichier n'est supprimé : les fichiers modifiés sont réécrits, les fichiers disparus recréés ;
 *  - les médias sont vérifiés par empreinte SHA-256 ; ils ne sont restaurés que si la sauvegarde les contient (--medias).
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSnapshot, sha256 } from './snapshot.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backupsDir = join(root, 'backups');

async function compare(entries) {
  const result = { identical: [], modified: [], missing: [] };
  for (const entry of entries) {
    const current = join(root, entry.path);
    if (!existsSync(current)) result.missing.push(entry);
    else if ((await sha256(current)) !== entry.sha256) result.modified.push(entry);
    else result.identical.push(entry);
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const name = args.find((a) => !a.startsWith('--'));
  const confirm = args.includes('--confirmer');

  if (!name) {
    const list = existsSync(backupsDir) ? (await readdir(backupsDir)).sort() : [];
    console.log(
      list.length ? `Sauvegardes disponibles :\n  ${list.join('\n  ')}` : 'Aucune sauvegarde.',
    );
    return;
  }

  const dir = join(backupsDir, name);
  if (!existsSync(join(dir, 'inventaire.json')))
    throw new Error(`Sauvegarde introuvable : ${name}`);
  const inventory = JSON.parse(await readFile(join(dir, 'inventaire.json'), 'utf8'));

  const files = await compare(inventory.files);
  const media = await compare(inventory.media);

  console.log(`Sauvegarde « ${inventory.label} » du ${inventory.createdAt}\n`);
  console.log(
    `Fichiers texte : ${files.identical.length} identiques, ${files.modified.length} modifiés, ${files.missing.length} disparus`,
  );
  for (const f of files.modified) console.log(`  ~ ${f.path}`);
  for (const f of files.missing) console.log(`  + ${f.path}`);
  console.log(
    `Médias : ${media.identical.length} identiques, ${media.modified.length} modifiés, ${media.missing.length} disparus`,
  );
  for (const f of media.modified) console.log(`  ~ ${f.path}`);
  for (const f of media.missing) console.log(`  + ${f.path}`);
  if ((media.modified.length || media.missing.length) && !inventory.mediaCopied) {
    console.log(
      '  ⚠ Cette sauvegarde ne contient pas de copie des médias : ils ne peuvent pas être restaurés d’ici.',
    );
  }

  const toRestore = [
    ...[...files.modified, ...files.missing].map((f) => ({
      from: join(dir, 'fichiers', f.path),
      to: f.path,
    })),
    ...(inventory.mediaCopied
      ? [...media.modified, ...media.missing].map((f) => ({
          from: join(dir, 'medias', f.path),
          to: f.path,
        }))
      : []),
  ];

  if (!toRestore.length) {
    console.log('\nRien à restaurer : le projet correspond à la sauvegarde.');
    return;
  }
  if (!confirm) {
    console.log(
      `\nSIMULATION — ${toRestore.length} fichier(s) seraient restaurés. Ajouter --confirmer pour le faire.`,
    );
    return;
  }

  console.log('\nSauvegarde de l’état actuel avant restauration…');
  // des médias vont être réécrits : leur version actuelle est copiée elle aussi
  const overwritesMedia = inventory.mediaCopied && media.modified.length > 0;
  await createSnapshot(`avant-restauration-${name}`.slice(0, 80), { withMedia: overwritesMedia });
  for (const { from, to } of toRestore) {
    await mkdir(dirname(join(root, to)), { recursive: true });
    await copyFile(from, join(root, to));
    console.log(`  restauré : ${to}`);
  }
  console.log(
    `\n${toRestore.length} fichier(s) restauré(s). Redémarrer \`npm run dev\` si le serveur tourne.`,
  );
}

main().catch((error) => {
  console.error('Échec de la restauration :', error.message ?? error);
  process.exit(1);
});
