/**
 * Chargement des réglages centralisés (src/settings/*.json) — voir src/schemas/settings.ts.
 * Un fichier absent ou invalide n'empêche jamais le site de s'afficher : il est ignoré (avertissement)
 * et le site garde son apparence d'origine.
 */
import { SETTINGS_SCHEMAS, type SettingsName } from '@/schemas/settings';
import type { ThemeSettings } from '@/lib/studio/theme';
import type { LayoutSettings, NavigationSettings } from '@/lib/studio/layout';
import type { AnimationsSettings } from '@/lib/studio/animations';

const files = import.meta.glob<unknown>('/src/settings/*.json', { eager: true, import: 'default' });

function read<T>(name: SettingsName): T {
  const raw = files[`/src/settings/${name}.json`];
  if (raw === undefined) return {} as T;
  const parsed = SETTINGS_SCHEMAS[name].safeParse(raw);
  if (!parsed.success) {
    console.warn(`[réglages] src/settings/${name}.json invalide, ignoré : ${parsed.error.message}`);
    return {} as T;
  }
  return parsed.data as T;
}

export interface SiteSettings {
  theme: ThemeSettings;
  layout: LayoutSettings;
  navigation: NavigationSettings;
  animations: AnimationsSettings;
}

export const settings: SiteSettings = {
  theme: read('theme'),
  layout: read('layout'),
  navigation: read('navigation'),
  animations: read('animations'),
};
