/**
 * Outils externes du pipeline médias : FFmpeg / FFprobe (vidéos, GIF animés, affiches).
 * Recherche : variables FFMPEG_PATH / FFPROBE_PATH, puis le PATH, puis l'installation winget (Windows).
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** Chemin complet d'un exécutable, ou `null`. */
async function locate(name, envVar) {
  if (process.env[envVar] && existsSync(process.env[envVar])) return process.env[envVar];
  try {
    const { stdout } = await exec(process.platform === 'win32' ? 'where' : 'which', [name]);
    const first = stdout.split(/\r?\n/).find(Boolean);
    if (first && existsSync(first.trim())) return first.trim();
  } catch {
    /* absent du PATH */
  }
  // Windows : paquet winget « Gyan.FFmpeg »
  const packages = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages')
    : '';
  if (packages && existsSync(packages)) {
    for (const dir of readdirSync(packages).filter((d) => d.startsWith('Gyan.FFmpeg'))) {
      const root = path.join(packages, dir);
      for (const build of readdirSync(root)) {
        const exe = path.join(root, build, 'bin', `${name}.exe`);
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

let cached;
/** { ffmpeg, ffprobe, version } ou `null` si FFmpeg n'est pas installé. */
export async function ffmpegTools() {
  if (cached !== undefined) return cached;
  const [ffmpeg, ffprobe] = await Promise.all([
    locate('ffmpeg', 'FFMPEG_PATH'),
    locate('ffprobe', 'FFPROBE_PATH'),
  ]);
  if (!ffmpeg || !ffprobe) return (cached = null);
  const { stdout } = await exec(ffmpeg, ['-hide_banner', '-version']);
  const version = /ffmpeg version (\S+)/.exec(stdout)?.[1] ?? 'inconnue';
  return (cached = { ffmpeg, ffprobe, version });
}

/** Analyse d'un fichier vidéo (JSON de ffprobe). */
export async function probe(file) {
  const tools = await ffmpegTools();
  if (!tools) throw new Error('FFmpeg est introuvable (installer : winget install Gyan.FFmpeg).');
  const { stdout } = await exec(
    tools.ffprobe,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

/**
 * Lance FFmpeg. `duration` (s) permet de suivre la progression (0 → 1) via `onProgress`.
 * Les erreurs remontent avec la fin du journal de FFmpeg (compréhensible pour déboguer).
 */
export async function runFfmpeg(args, { duration, onProgress } = {}) {
  const tools = await ffmpegTools();
  if (!tools) throw new Error('FFmpeg est introuvable (installer : winget install Gyan.FFmpeg).');
  return new Promise((resolve, reject) => {
    const child = spawn(
      tools.ffmpeg,
      ['-hide_banner', '-nostdin', '-y', '-progress', 'pipe:1', '-nostats', ...args],
      { windowsHide: true },
    );
    let log = '';
    child.stderr.on('data', (d) => {
      log = (log + d).slice(-4000);
    });
    child.stdout.on('data', (d) => {
      const m = /out_time_us=(\d+)/.exec(String(d));
      if (m && duration && onProgress) onProgress(Math.min(1, Number(m[1]) / 1e6 / duration));
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg a échoué (code ${code}) : ${log.trim().split('\n').slice(-3).join(' ')}`)),
    );
  });
}
