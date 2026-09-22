# Ajouter l'anglais (ou une autre langue)

Le site est en français, sans préfixe dans l'adresse (`/`, `/projets/`). L'architecture est déjà prête pour
d'autres langues : **aucun texte n'est écrit en dur dans les composants**, tout vient d'un dictionnaire.

## Comment c'est organisé

| Élément               | Emplacement                                                          |
| --------------------- | -------------------------------------------------------------------- |
| Textes de l'interface | `src/i18n/ui/fr.ts` (référence), `src/i18n/ui/en.ts` (à compléter)   |
| Fonctions utilitaires | `src/i18n/index.ts` (`useTranslations`, `localizedPath`…)            |
| Contenu des pages     | `src/views/*.astro` : reçoivent la langue en paramètre               |
| Routes                | `src/pages/` : de simples fichiers de 3 lignes qui appellent une vue |

`useTranslations('en')` renvoie le dictionnaire anglais **fusionné avec le français** : une phrase non traduite
retombe automatiquement sur le français, le site ne casse jamais.

## Activer l'anglais en 5 étapes

1. **Traduire** `src/i18n/ui/en.ts` : recopier les clés de `fr.ts` avec le texte anglais
   (le fichier peut être rempli progressivement).
2. **Déclarer la langue** :
   - `src/i18n/index.ts` → `enabledLocales = ['fr', 'en']` (active les balises `hreflang`) ;
   - `astro.config.mjs` → `i18n.locales: ['fr', 'en']`.
3. **Créer les routes anglaises** en copiant les pages sous `src/pages/en/` :

   ```astro
   ---
   // src/pages/en/index.astro
   import HomeView from '@/views/HomeView.astro';
   ---

   <HomeView locale="en" />
   ```

   Idem pour `en/projets/index.astro` et `en/projets/[slug].astro` (en passant `locale="en"`).
   Pour des adresses anglaises (`/en/projects/`), ajuster `localizedPath` dans `src/i18n/index.ts`.

4. **Ajouter un sélecteur de langue** dans `src/components/layout/Header.astro`
   (les liens s'obtiennent avec `localizedPath(path, 'en')`).
5. **Traduire les projets** : voir ci-dessous.

## Contenu des projets en anglais

Le titre, le résumé et la description d'un projet sont écrits dans `project.md`, en français.
Deux approches possibles le moment venu :

- **Champs dupliqués** (le plus simple) : ajouter `title_en`, `summary_en` dans le schéma
  (`src/content.config.ts`) et les afficher selon la langue.
- **Fichier par langue** : `project.en.md` à côté de `project.md`, avec un chargeur qui indexe les deux
  (`pattern: '*/project*.md'` et un identifiant qui inclut la langue).

Les médias et les métadonnées techniques (domaine, entité, année, technologies) sont communs aux langues.
