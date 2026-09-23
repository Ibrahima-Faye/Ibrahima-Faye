/**
 * Formats de médias — LA source de vérité (src/schemas/media-formats.json), partagée par le site,
 * l'administration, l'API locale, le pipeline médias (scripts/medias.mjs) et les tests.
 *
 * Tous les formats sont acceptés à l'envoi. L'ORIGINAL n'est jamais modifié : le pipeline médias
 * (integrations/local-cms/media/) en tire des versions web dans `<projet>/_web/<fichier>/`
 * (image maîtresse ≤ 3840 px, vidéo MP4 H.264, affiche, miniature), décrites dans `<projet>/media.json`.
 * Le site publié n'utilise que ces versions web (les originaux restent sur la machine, hors de git).
 */
import formats from './media-formats.json';

export type MediaKind = 'image' | 'video';

export interface MediaFormat {
  /** Extension en minuscules, sans le point. */
  ext: string;
  kind: MediaKind;
  mime: string;
  /** Nom affiché (JPG, PNG…). */
  label: string;
}

export const MEDIA_FORMATS = formats as readonly MediaFormat[];
