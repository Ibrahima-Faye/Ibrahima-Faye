# Studio (administration → Studio)

Personnaliser le site sans toucher au code : **Thème**, **Animations**, **Sections**, **Navigation**.
À gauche les réglages, à droite la vraie page (ordinateur / tablette / mobile). Tout s'enregistre seul.

## Où sont les données

| Fichier                        | Contenu                                                         | Code                           |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------ |
| `src/settings/theme.json`      | couleurs, typographie, interface, effets, identité              | `src/lib/studio/theme.ts`      |
| `src/settings/layout.json`     | sections de l'accueil : ordre, visibilité, ancre, textes, fond… | `src/lib/studio/layout.ts`     |
| `src/settings/navigation.json` | liens de l'en-tête, défilement, lien actif                      | `src/lib/studio/layout.ts`     |
| `src/settings/animations.json` | Animation Studio                                                | `src/lib/studio/animations.ts` |

- Validation : `src/schemas/settings.ts` (site **et** administration). Fichier invalide → ignoré, site d'origine.
- **Fichier vide = site d'origine** : seules les valeurs réglées sont écrites ; « ↺ » retire un réglage.
- Historique automatique : `.cms/historique/reglages/`. Annuler / rétablir : Ctrl+Z / Ctrl+Maj+Z.
- Thème : exporter / importer en JSON (onglet Thème).

## Animations

Un élément **sans réglage garde son animation d'origine** (`src/scripts/motion.ts`). Un élément réglé est
pris en charge par `src/scripts/studio/runtime.ts` (valeurs par appareil : mobile < 768 px ≤ tablette < 1024 px).
« Mouvement réduit » (système) : aucune animation.

- **Ajouter un effet** : une entrée dans `ANIMATIONS` (`src/lib/studio/animations.ts`) + son rendu dans
  `src/scripts/studio/effects.ts`.
- **Ajouter un style prêt à l'emploi** : une entrée dans `STYLE_PRESETS`.
- **Rendre un élément animable** : `data-anim="section.element"` dans le composant + une entrée dans `ANIM_TARGETS`.

## Sections

`src/views/HomeView.astro` affiche les sections dans l'ordre réglé ; chaque composant reçoit `section`
(ancre, fond, hauteur, effets). Les textes modifiés sont des surcharges du dictionnaire (`src/i18n/ui/fr.ts`),
repérées par leur chemin : `expertises.title`, `about.paragraphs`…
Ajouter une section : son composant, sa clé dans `SECTION_KEYS` / `SECTIONS`, et dans `COMPONENTS` (HomeView).

## Aperçu

`src/scripts/studio/bridge.ts` (serveur de dev uniquement, absent du site publié) applique en direct le thème
et les animations en cours d'édition, et permet de sélectionner un élément en cliquant dans la page.
