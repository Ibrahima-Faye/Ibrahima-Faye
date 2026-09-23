/**
 * Où se trouve une version web — avec le site (`local`) ou sur un stockage externe (`remote`).
 *
 * Le pipeline médias (integrations/local-cms/media/pipeline.mjs) décide pour chaque version, dans
 * <projet>/media.json : `storage: { video: 'remote', mobile: 'local', … }`. Une version « remote »
 * (plus de 25 Mio) garde une copie locale dans `_web/<original>/distant/`, exclue de git et du build.
 *
 * Stockage externe (Cloudflare R2 ou équivalent) : seule son URL PUBLIQUE est connue du site,
 * `PUBLIC_MEDIA_BASE_URL` ; chaque fichier y est rangé sous `<projet>/<original>/<version>`.
 * Aucune clé d'accès n'est nécessaire pour lire ; elles ne doivent jamais être dans le dépôt.
 */
export type MediaStorage = 'local' | 'remote';

/** Emplacement d'un fichier sur le stockage externe : `<projet>/<original>/<version>`. */
export function remoteKey(folder: string, file: string, output: string): string {
  return [folder, file, output.split('/').pop() ?? output].join('/');
}

/** URL publique d'un fichier sur le stockage externe. */
export function remoteUrl(base: string, folder: string, file: string, output: string): string {
  const key = remoteKey(folder, file, output).split('/').map(encodeURIComponent).join('/');
  return `${base.replace(/\/+$/, '')}/${key}`;
}

export interface OutputLocation {
  storage?: MediaStorage;
  /** Dossier du projet (= adresse de sa page). */
  folder: string;
  /** Fichier d'origine (identifiant stable du média). */
  file: string;
  /** Chemin de la version dans le projet (`_web/<original>/…`), tel qu'écrit dans media.json. */
  output: string;
  /** `PUBLIC_MEDIA_BASE_URL` (vide : stockage externe non configuré). */
  base?: string;
  /** Serveur de dev : la copie locale d'une version distante peut être lue directement. */
  dev: boolean;
  /** URL de la version publiée avec le site (versions locales). */
  localUrl?: string;
}

/**
 * URL d'une version web, ou `undefined` si elle n'est pas disponible ici
 * (version distante, stockage externe non configuré, site publié).
 */
export function resolveOutputUrl(o: OutputLocation): string | undefined {
  if ((o.storage ?? 'local') === 'local') return o.localUrl;
  if (o.base?.trim()) return remoteUrl(o.base.trim(), o.folder, o.file, o.output);
  if (o.dev)
    return `/src/content/projects/${o.folder}/${o.output.split('/').map(encodeURIComponent).join('/')}`;
  return undefined;
}
