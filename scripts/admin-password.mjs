#!/usr/bin/env node
/**
 * Définit (ou change) le mot de passe de l'administration /admin.
 *
 *   npm run admin:mot-de-passe              demande le mot de passe (saisie masquée, deux fois)
 *   npm run admin:mot-de-passe -- --afficher  affiche seulement l'empreinte (rien n'est écrit)
 *
 * Seule l'EMPREINTE scrypt est enregistrée, dans .env (ignoré par git) : CMS_ADMIN_PASSWORD_HASH=…
 * Les autres lignes de .env sont conservées ; l'ancienne version est copiée dans .env.sauvegarde.
 * Redémarrer ensuite le serveur de développement (npm run dev).
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../integrations/local-cms/password.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
const printOnly = process.argv.includes('--afficher');

/** Saisie masquée dans un terminal ; lecture de l'entrée standard sinon (scripts, tests). */
function ask(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      let data = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => (data += chunk));
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0] ?? ''));
      return;
    }
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (text) => {
      for (const char of text) {
        if (char === '\u0003') {
          process.stdout.write('\n');
          process.exit(1);
        }
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await ask(`Nouveau mot de passe (${MIN_PASSWORD_LENGTH} caractères au moins) : `);
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`✗ Trop court : ${MIN_PASSWORD_LENGTH} caractères au moins.`);
  process.exit(1);
}
if (process.stdin.isTTY) {
  const again = await ask('Confirmer le mot de passe : ');
  if (again !== password) {
    console.error('✗ Les deux saisies ne correspondent pas. Rien n’a été modifié.');
    process.exit(1);
  }
}

const hash = await hashPassword(password);
if (printOnly) {
  console.log(`CMS_ADMIN_PASSWORD_HASH=${hash}`);
  process.exit(0);
}

const line = `CMS_ADMIN_PASSWORD_HASH=${hash}`;
let text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
if (text) copyFileSync(envFile, path.join(root, '.env.sauvegarde'));
if (/^CMS_ADMIN_PASSWORD_HASH=.*$/m.test(text))
  text = text.replace(/^CMS_ADMIN_PASSWORD_HASH=.*$/m, line);
else
  text = `${text}${text && !text.endsWith('\n') ? '\n' : ''}${text ? '\n' : ''}# Administration /admin : empreinte du mot de passe (npm run admin:mot-de-passe). Jamais dans git.\n${line}\n`;
writeFileSync(envFile, text, 'utf8');
console.log('✓ Mot de passe enregistré (empreinte dans .env, ignoré par git).');
console.log('  Redémarre le serveur de développement : npm run dev');
