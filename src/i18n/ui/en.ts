import type { DeepPartial } from '../index';
import type { Dictionary } from './fr';

/**
 * Anglais — PAS ENCORE ACTIVÉ.
 * Les clés absentes retombent automatiquement sur le français.
 * Procédure complète : docs/INTERNATIONALISATION.md
 */
const en: DeepPartial<Dictionary> = {
  meta: {
    lang: 'en',
    ogLocale: 'en_US',
  },
};

export default en;
