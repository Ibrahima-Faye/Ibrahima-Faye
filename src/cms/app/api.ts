import type { FileInfo, ProjectData, ProjectDetail, ProjectSummary } from './types';

const BASE = '/__cms';
/** En-tête exigé par le serveur pour toute modification : un autre site web ne peut pas l'envoyer. */
const HEADERS = { 'X-CMS': '1' };

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(BASE + url, {
    method,
    headers: { ...HEADERS, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* réponse non JSON */
  }
  if (!response.ok) {
    const message = (json as { error?: string })?.error ?? `Erreur ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return json as T;
}

/** Erreur renvoyée par l'API (409 = projet modifié ailleurs). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const api = {
  list: () => request<ProjectSummary[]>('GET', '/api/projects'),
  get: (slug: string) => request<ProjectDetail>('GET', `/api/projects/${slug}`),
  create: (input: Partial<ProjectData> & { title: string; category: string; slug?: string }) =>
    request<ProjectDetail>('POST', '/api/projects', input),
  /** `baseUpdatedAt` : version ouverte (conflit 409 si le fichier a changé depuis) ; `force` : écraser quand même. */
  save: (
    slug: string,
    payload: { data: ProjectData; body: string; baseUpdatedAt?: number; force?: boolean },
  ) =>
    request<{ slug: string; updatedAt: number; unchanged?: boolean }>(
      'PUT',
      `/api/projects/${slug}`,
      payload,
    ),
  remove: (slug: string) => request<{ trashed: string }>('DELETE', `/api/projects/${slug}`),
  rename: (slug: string, next: string) =>
    request<{ slug: string }>('POST', `/api/projects/${slug}/rename`, { slug: next }),
  deleteMedia: (slug: string, file: string) =>
    request<{ removed: string[] }>(
      'DELETE',
      `/api/projects/${slug}/media/${encodeURIComponent(file)}`,
    ),
};

/** Envoie un fichier (corps brut) avec suivi de progression. `poster` : nom de la vidéo dont c'est l'affiche. */
export function upload(
  slug: string,
  file: Blob,
  options: { name: string; poster?: string; onProgress?: (ratio: number) => void },
): Promise<FileInfo> {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({ name: options.name });
    if (options.poster) query.set('poster', options.poster);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/projects/${slug}/media?${query}`);
    xhr.setRequestHeader('X-CMS', '1');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && options.onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('Connexion perdue pendant l’envoi.'));
    xhr.onload = () => {
      let json: { error?: string } & Partial<FileInfo> = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* ignoré */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json as FileInfo);
      else reject(new Error(json.error ?? `Erreur ${xhr.status}`));
    };
    xhr.send(file);
  });
}

export const thumbUrl = (slug: string, file: string, width = 480, version?: number) =>
  `${BASE}/thumb/${slug}/${encodeURIComponent(file)}?w=${width}${version ? `&v=${version}` : ''}`;

export const fileUrl = (slug: string, file: string, version?: number) =>
  `${BASE}/file/${slug}/${encodeURIComponent(file)}${version ? `?v=${version}` : ''}`;
