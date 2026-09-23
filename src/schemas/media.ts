/**
 * Formats de médias — LA source de vérité, partagée par le site, l'administration, l'API locale et les tests.
 *
 * `enabled: true`  → détecté par le site et accepté à l'envoi dans /admin.
 * `enabled: false` → format connu, mais qui attend son traitement pour le web (conversion HEIC, transcodage MOV,
 *                    GIF animé → vidéo, nettoyage SVG : étape « pipeline médias »). Il n'est ni détecté ni accepté
 *                    d'ici là : jamais de format « à moitié » pris en charge.
 *
 * ⚠️ Les motifs `import.meta.glob` de src/lib/media.ts doivent être écrits en toutes lettres (contrainte de Vite) :
 * un test vérifie qu'ils listent exactement les formats `enabled`.
 */

export type MediaKind = 'image' | 'video';

export interface MediaFormat {
  /** Extension en minuscules, sans le point. */
  ext: string;
  kind: MediaKind;
  mime: string;
  /** Nom affiché (JPG, PNG…). */
  label: string;
  enabled: boolean;
}

export const MEDIA_FORMATS = [
  { ext: 'jpg', kind: 'image', mime: 'image/jpeg', label: 'JPG', enabled: true },
  { ext: 'jpeg', kind: 'image', mime: 'image/jpeg', label: 'JPEG', enabled: true },
  { ext: 'png', kind: 'image', mime: 'image/png', label: 'PNG', enabled: true },
  { ext: 'webp', kind: 'image', mime: 'image/webp', label: 'WebP', enabled: true },
  { ext: 'avif', kind: 'image', mime: 'image/avif', label: 'AVIF', enabled: true },
  { ext: 'gif', kind: 'image', mime: 'image/gif', label: 'GIF', enabled: false },
  { ext: 'svg', kind: 'image', mime: 'image/svg+xml', label: 'SVG', enabled: false },
  { ext: 'heic', kind: 'image', mime: 'image/heic', label: 'HEIC', enabled: false },
  { ext: 'heif', kind: 'image', mime: 'image/heif', label: 'HEIF', enabled: false },
  { ext: 'mp4', kind: 'video', mime: 'video/mp4', label: 'MP4', enabled: true },
  { ext: 'webm', kind: 'video', mime: 'video/webm', label: 'WebM', enabled: true },
  { ext: 'm4v', kind: 'video', mime: 'video/x-m4v', label: 'M4V', enabled: false },
  { ext: 'mov', kind: 'video', mime: 'video/quicktime', label: 'MOV', enabled: false },
] as const satisfies readonly MediaFormat[];
