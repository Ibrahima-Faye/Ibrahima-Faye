import fr, { type Dictionary } from './ui/fr';
import en from './ui/en';
import { settings } from '@/lib/settings';
import { applyContent } from '@/lib/studio/layout';

export type { Dictionary };
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Langues pour lesquelles un dictionnaire existe (même partiel). */
export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];

/** Langues réellement publiées : ajouter 'en' ici (+ ses pages) pour l'activer. */
export const enabledLocales: readonly Locale[] = ['fr'];

export const defaultLocale: Locale = 'fr';

const dictionaries: Record<Locale, DeepPartial<Dictionary>> = { fr, en };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Fusion profonde : la langue demandée écrase le français, clé par clé. */
function merge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override ?? base) as T;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] = key in base ? merge((base as Record<string, unknown>)[key], value) : value;
  }
  return result as T;
}

const cache = new Map<Locale, Dictionary>();

/** Textes modifiés depuis l'administration (src/settings/layout.json + slogan du thème), appliqués au français. */
function customized(base: Dictionary): Dictionary {
  const tagline = settings.theme.identity?.tagline?.trim();
  return applyContent(base, {
    ...(tagline ? { 'meta.jobTitle': tagline } : {}),
    ...settings.layout.content,
  });
}

/** Dictionnaire complet et typé pour une langue. */
export function useTranslations(locale: Locale = defaultLocale): Dictionary {
  let dict = cache.get(locale);
  if (!dict) {
    const base = customized(fr);
    dict = locale === defaultLocale ? base : merge(base, dictionaries[locale]);
    cache.set(locale, dict);
  }
  return dict;
}

/** Remplace {variable} dans une chaîne : format('{n} projets', { n: 3 }). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

/** Pluriel simple : plural(dict.projectsCount, 2). */
export function plural(forms: { one: string; other: string }, n: number): string {
  return format(n === 1 || n === 0 ? forms.one : forms.other, { n });
}

/** Préfixe une URL avec la langue (sauf la langue par défaut). */
export function localizedPath(path: string, locale: Locale = defaultLocale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === defaultLocale ? clean : `/${locale}${clean === '/' ? '/' : clean}`;
}

/** Détecte la langue depuis une URL (/en/... → 'en', sinon langue par défaut). */
export function getLocaleFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return (locales as readonly string[]).includes(first ?? '') && first !== defaultLocale
    ? (first as Locale)
    : defaultLocale;
}
