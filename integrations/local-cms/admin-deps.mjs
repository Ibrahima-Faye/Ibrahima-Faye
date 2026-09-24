/**
 * Dépendances « navigateur » à pré-compiler par Vite AU DÉMARRAGE du serveur de développement.
 *
 * Pourquoi : Vite pré-compile les bibliothèques (node_modules) utilisées par le navigateur. Une bibliothèque
 * découverte seulement en cours de séance (première ouverture de /admin, navigation du routeur Astro…)
 * déclenche une recompilation qui rend « périmés » les modules déjà servis (réponse 504 « Outdated Optimize
 * Dep ») — et /admin, qui bloque volontairement les rechargements automatiques, restait alors noir.
 * Déclarées ici, elles sont compilées dès le démarrage et font partie de l'empreinte du cache de Vite :
 * plus de découverte tardive, et un cache qui ne les contient pas n'est jamais réutilisé.
 *
 * La liste de l'administration est calculée en lisant ses imports (src/cms/app/…, et les modules « @/… »
 * qu'elle utilise) : une nouvelle bibliothèque utilisée par l'admin est prise en compte sans rien modifier.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const EXTENSIONS = ['', '.ts', '.mts', '.js', '.mjs', '/index.ts', '/index.js'];
// import … from '…' (sauf « import type »), export … from '…', import '…', import('…')
const IMPORT =
  /(?:^|[\n;])\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Chemin local d'un import relatif ou « @/… », sinon null. */
function localFile(spec, from, srcDir) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else if (spec.startsWith('@/')) base = path.join(srcDir, spec.slice(2));
  else return null;
  for (const ext of EXTENSIONS) {
    const file = base + ext;
    if (existsSync(file) && /\.(m?[jt]s)$/.test(file)) return file;
  }
  return undefined; // fichier non JS (JSON, CSS…) : ignoré
}

/** Bibliothèques (spécificateurs « nus ») importées par le code navigateur de l'administration. */
export function adminBrowserDeps(root) {
  const srcDir = path.join(root, 'src');
  const queue = [path.join(srcDir, 'cms/app/main.ts')];
  const seen = new Set();
  const deps = new Set();
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(IMPORT)) {
      const spec = match[1] ?? match[2];
      const local = localFile(spec, file, srcDir);
      if (local) queue.push(local);
      else if (
        local === null &&
        !spec.includes(':') && // astro:*, virtual:*, node:*
        !builtinModules.includes(spec.split('/')[0])
      )
        deps.add(spec);
    }
  }
  return [...deps].sort();
}

/**
 * Modules du routeur d'Astro (ClientRouter, `astro:transitions/client`) utilisés par les pages du site :
 * découverts sinon à la première navigation. Seuls ceux présents dans la version installée sont retenus.
 */
export function routerBrowserDeps(root) {
  const dir = path.join(root, 'node_modules/astro/dist/virtual-modules');
  return [
    'transitions-events.js',
    'transitions-router.js',
    'transitions-swap-functions.js',
    'transitions-types.js',
  ]
    .filter((name) => existsSync(path.join(dir, name)))
    .map((name) => `astro/virtual-modules/${name}`);
}
