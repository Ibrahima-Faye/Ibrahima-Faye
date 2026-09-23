/**
 * File des tâches du pipeline médias (serveur de développement) : un fichier à la fois — les vidéos
 * sont lourdes pour le processeur —, dans l'ordre d'arrivée. L'état est suivi par la médiathèque de /admin.
 */
import path from 'node:path';
import { processProject } from './pipeline.mjs';

export function createJobs(projectsDir) {
  /** @type {{ slug: string, file: string }[]} */
  const queue = [];
  /** état par projet puis fichier : { state: 'queued' | 'running' | 'done' | 'error', progress, error } */
  const status = new Map();
  let running = false;

  const stateOf = (slug) => {
    if (!status.has(slug)) status.set(slug, new Map());
    return status.get(slug);
  };

  async function pump() {
    if (running) return;
    running = true;
    try {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const states = stateOf(job.slug);
        states.set(job.file, { state: 'running', progress: 0 });
        try {
          await processProject(path.join(projectsDir, job.slug), {
            only: [job.file],
            force: job.force,
            onEvent: (e) => {
              if (e.type === 'progress') states.set(job.file, { state: 'running', progress: e.progress });
              if (e.type === 'error') states.set(job.file, { state: 'error', error: e.error });
              if (e.type === 'done') states.set(job.file, { state: 'done', progress: 1 });
            },
          });
          if (states.get(job.file)?.state === 'running') states.set(job.file, { state: 'done', progress: 1 });
        } catch (error) {
          states.set(job.file, { state: 'error', error: String(error?.message ?? error) });
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    /** Ajoute des fichiers à la file (sans doublon). */
    enqueue(slug, files, { force = false } = {}) {
      const states = stateOf(slug);
      for (const file of files) {
        if (queue.some((j) => j.slug === slug && j.file === file)) continue;
        if (states.get(file)?.state === 'running') continue;
        queue.push({ slug, file, force });
        states.set(file, { state: 'queued', progress: 0 });
      }
      void pump();
    },
    /** État des tâches d'un projet (fichier → état). */
    status(slug) {
      return Object.fromEntries(stateOf(slug));
    },
    busy(slug) {
      return [...stateOf(slug).values()].some((s) => s.state === 'queued' || s.state === 'running');
    },
  };
}
