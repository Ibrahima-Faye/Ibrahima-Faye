#!/usr/bin/env node
/**
 * Versions web des médias (pipeline médias) — en ligne de commande.
 *
 *   npm run medias                         SIMULATION : ce qui serait généré (rien n'est écrit)
 *   npm run medias -- --confirmer          génère ce qui manque ou a changé, dans tous les projets
 *   npm run medias -- --projet wonderpark --confirmer
 *   npm run medias -- --forcer --confirmer tout régénérer
 *
 * Les ORIGINAUX ne sont jamais modifiés ; les versions web vont dans <projet>/_web/, décrites dans <projet>/media.json.
 * Voir integrations/local-cms/media/pipeline.mjs.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpegTools } from '../integrations/local-cms/media/tools.mjs';
import {
  listOriginals,
  migrateStorage,
  processProject,
  readManifest,
  staleFiles,
} from '../integrations/local-cms/media/pipeline.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsDir = path.join(root, 'src/content/projects');
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const confirm = args.includes('--confirmer');
const force = args.includes('--forcer');
const only = option('--projet');

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

const projects = readdirSync(projectsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(projectsDir, d.name, 'project.md')))
  .map((d) => d.name)
  .filter((slug) => !only || slug === only);
if (only && !projects.length) {
  console.error(`Projet introuvable : ${only}`);
  process.exit(1);
}

const tools = await ffmpegTools();
console.log(
  tools
    ? `FFmpeg ${tools.version} trouvé.`
    : '⚠ FFmpeg introuvable : les vidéos et GIF animés ne pourront pas être traités.',
);

let total = 0;
for (const slug of projects) {
  const dir = path.join(projectsDir, slug);
  const names = await listOriginals(dir);
  if (!names.length) continue;
  const manifest = await readManifest(dir);
  const { stale } = await staleFiles(dir, manifest, names);
  const todo = force ? names : stale;
  total += todo.length;
  const unsorted = Object.values(manifest.items).filter(
    (e) => e.status === 'ok' && !e.storage,
  ).length;
  console.log(
    `\n${slug} : ${names.length} original(aux), ${todo.length} à générer${unsorted ? `, ${unsorted} à ranger (local / distant)` : ''}`,
  );
  if (confirm && !todo.length && unsorted) {
    await processProject(dir, { only: [] }); // rangement seul (sous verrou), rien n'est ré-encodé
  }
  if (!todo.length) continue;
  if (!confirm) {
    todo.forEach((n) => console.log(`  · ${n}`));
    continue;
  }
  let last = 0;
  const report = await processProject(dir, {
    force,
    onEvent: (e) => {
      if (e.type === 'start') process.stdout.write(`  ${e.file} … `);
      if (e.type === 'progress' && e.progress - last >= 0.25) {
        last = e.progress;
        process.stdout.write(`${Math.round(e.progress * 100)} % `);
      }
      if (e.type === 'done') {
        last = 0;
        const sizes = Object.entries(e.entry.sizes ?? {})
          .map(([k, v]) => `${k} ${mb(v)}`)
          .join(', ');
        console.log(`✓ ${e.entry.width}×${e.entry.height} (${sizes})`);
      }
      if (e.type === 'error') {
        last = 0;
        console.log(`✗ ${e.error}`);
      }
    },
  });
  if (report.failed.length) process.exitCode = 1;
}

// versions web réservées au stockage distant (plus de 25 Mio : hors git, hors build)
const remote = [];
for (const slug of projects) {
  const manifest = await readManifest(path.join(projectsDir, slug));
  for (const [name, entry] of Object.entries(manifest.items))
    for (const [key, where] of Object.entries(entry.storage ?? {}))
      if (where === 'remote')
        remote.push(`  ${slug}/${name} → ${key} (${mb(entry.sizes?.[key] ?? 0)})`);
}
if (remote.length)
  console.log(
    `\nStockage distant (hors git, à envoyer vers Cloudflare R2 ou équivalent) :\n${remote.join('\n')}`,
  );

if (!confirm)
  console.log(`\nSIMULATION — ${total} fichier(s) à générer. Ajouter --confirmer pour le faire.`);
else console.log(`\nTerminé.`);
