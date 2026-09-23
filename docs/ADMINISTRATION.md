# Administration locale (`/admin`)

Un mini CMS pour créer et composer tes projets **sans écrire de code**. Il fonctionne **uniquement sur ton ordinateur**,
pendant `npm run dev`. Tout ce que tu fais est enregistré dans les fichiers du site (`src/content/projects/`) :
pas de base de données, pas de serveur distant, le site publié reste 100 % statique et gratuit à héberger.

## Ouvrir l'administration

```bash
npm run dev
```

Puis ouvre **http://localhost:4321/admin** (ou `/admin/`).

> `/admin` n'existe **pas** dans le site publié : l'intégration n'est active qu'avec `npm run dev`.
> Rien de l'administration n'est envoyé sur Internet.

## Les écrans

| Écran                  | À quoi ça sert                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tableau de bord**    | Nombre de projets (publiés / brouillons), médias, projets récents, liste « À compléter » (sans couverture, sans description…).                                        |
| **Projets**            | Tous les projets, dans l'ordre d'affichage du site. Recherche, filtres (catégorie, marque, publié / brouillon), accès rapide : voir sur le site, modifier, supprimer. |
| **Nouveau projet**     | Trois choix (titre, catégorie, marque) : le dossier et la fiche sont créés, en brouillon.                                                                             |
| **Modifier un projet** | Trois onglets : **Informations**, **Galerie**, **Prévisualisation**.                                                                                                  |

### Onglet Informations

Titre, catégorie, statut, **marque** (une ou plusieurs), année, client, description courte, technologies (étiquettes),
rôle, contexte, résultat, **description détaillée** (Markdown, avec une petite barre d'outils), liens externes, texte
alternatif de la couverture.

À droite, le panneau **Publication** : interrupteur _Brouillon / Publié_, aperçu de la couverture, liste de vérification
(titre, couverture, description courte, média), « Mettre en avant sur l'accueil » et ordre d'affichage.

### Onglet Galerie — la composition

C'est un **éditeur visuel** : ce que tu vois est exactement ce qui sera publié (même grille que le site).

- **Ajouter des médias** : bouton, ou **glisser des fichiers depuis l'explorateur** n'importe où sur la galerie.
  JPG, PNG, WebP, AVIF · MP4, WebM. Plusieurs à la fois ; ils gardent l'ordre dans lequel tu les as choisis.
- **Réordonner** : attrape la poignée **⠿** d'un média et déplace-le. La page défile toute seule si tu vas vers le bord
  de l'écran. Sans souris : boutons **◀ Avancer / Reculer ▶** dans le panneau de détail.
- **Taille dans la grille** : boutons **−** / **+** sur chaque média, ou les six puces du panneau de détail :

  | Puce       | Largeur occupée   |
  | ---------- | ----------------- |
  | **1 col**  | 1/4 de la largeur |
  | **1/3**    | un tiers          |
  | **2 col**  | la moitié         |
  | **2/3**    | deux tiers        |
  | **3 col**  | 3/4               |
  | **Pleine** | toute la largeur  |

  Les médias se placent **de gauche à droite** et passent à la ligne quand elle est pleine. Exemples :
  - `2 col + 2 col` → deux images côte à côte ;
  - `3 col + 1 col`, puis `Pleine`, puis `1/3 + 1/3 + 1/3`, puis `Pleine` (vidéo) → la composition « grande + petite /
    pleine largeur / trois images / vidéo pleine largeur » ;
  - **Composition rapide** (menu en haut) : applique d'un coup « tout en pleine largeur », « 2 / 3 / 4 par ligne » ou
    « automatique (selon le ratio) », puis ajuste au cas par cas.

- **Alignement vertical** (Haut / Centre / Bas) : quand les médias d'une même ligne n'ont pas la même hauteur.
- **Couverture** : ★ sur une image (ou « Définir comme couverture » dans le panneau). Elle sert de carte sur la page
  Projets et d'image de partage. Sans choix, le site prend `cover.*`, sinon la première image.
- **Masquer** (œil) : garde le fichier dans le dossier mais le retire de la galerie publique.
- **Légende** et **texte alternatif** par média (panneau de détail).
- **Supprimer** : le fichier est déplacé dans `.trash/` (voir plus bas), après confirmation.

**Aucune image n'est jamais recadrée ni forcée à un ratio** : portrait, paysage, carré, panoramique, très large ou très
haut gardent leur proportion d'origine. Un média très haut est simplement plafonné à la hauteur de l'écran.

**Sur mobile** (< 640 px), chaque média s'affiche en pleine largeur, dans le même ordre.

### Vidéos

Elles s'ajoutent **exactement comme les images** et se placent où tu veux dans la composition.

- MP4 et WebM ; plein écran, contrôles, lecture dans la visionneuse.
- **Affiche (poster)** : générée automatiquement à l'envoi (une image de la vidéo). Pour en choisir une autre, ouvre la
  vidéo dans le panneau de détail, avance jusqu'à l'image voulue, puis **« Utiliser l'image affichée »** — ou **Importer…**
  une image.
- **Chargement paresseux** : tant que la vidéo n'est pas lue, le navigateur ne télécharge que son affiche.
- Le ratio (16:9, 9:16…) est lu automatiquement : horizontales et verticales sont gérées.

### Onglet Prévisualisation

La **vraie page publique** du projet, affichée dans un cadre « ordinateur », « tablette » ou « téléphone » (avec les
vraies règles responsives). Les modifications sont enregistrées juste avant l'affichage. « Actualiser » recharge,
« Ouvrir dans un onglet » l'ouvre en grand.

## Enregistrement

**Automatique** : chaque modification est enregistrée environ une seconde plus tard (indicateur en haut à droite :
_Enregistrement… → Enregistré_). `Ctrl + S` force l'enregistrement immédiat. En quittant un projet, tout est enregistré.

## Publier

1. Dans l'onglet Informations, passe l'interrupteur sur **Publié** (ou bouton **Publier** en haut).
2. Publie le site comme d'habitude (voir `DEPLOIEMENT.md`) :

   ```bash
   git add .
   git commit -m "Nouveau projet"
   git push
   ```

Un projet **Brouillon** n'apparaît jamais sur le site publié (mais reste visible en local).

## Où sont les données

Tout est dans le dossier du projet, modifiable aussi à la main :

```
src/content/projects/<projet>/
├── project.md            ← fiche + composition de la galerie (champ `media`, ou blocs : champ `blocks`)
├── 01-facade.jpg         ← tes images et vidéos
├── 02-plan.png
├── film.webm
└── film.jpg              ← affiche de la vidéo (même nom)
```

La composition est écrite dans `project.md` :

```yaml
cover: 01-facade.jpg
media:
  - file: 01-facade.jpg
    span: 9 # 3 = 1/4 · 4 = 1/3 · 6 = 1/2 · 8 = 2/3 · 9 = 3/4 · 12 = pleine largeur
  - file: 02-plan.png
    span: 3
    align: end # start | center | end (facultatif)
    caption: Plan de masse
  - file: film.webm
    span: 12
    ratio: 16:9 # ratio d'une vidéo (écrit automatiquement)
```

Une galerie peut aussi être organisée en **blocs** (média seul, grille, carrousel, avant / après) avec le champ `blocks` :
voir [`MODELE-DE-DONNEES.md`](MODELE-DE-DONNEES.md). Sans ce champ, rien ne change. Tant que l'éditeur visuel des blocs
n'existe pas, un projet en blocs affiche un bandeau dans l'onglet Galerie : la composition de cet onglet ne concerne
alors que les médias placés dans aucun bloc.

## Suppressions et corbeille

Supprimer un projet ou un média **déplace** les fichiers dans **`.trash/`** (à la racine du projet, ignoré par git).
Pour récupérer quelque chose : remets le dossier ou le fichier à sa place dans `src/content/projects/`. Vide `.trash/`
quand tu veux libérer de la place.

## Historique des fiches

Avant chaque réécriture d'un `project.md`, l'administration en garde la version précédente dans
**`.cms/historique/<projet>/<date>.md`** (ignoré par git). Pour revenir en arrière : recopie ce fichier à la place de
`project.md`. Un enregistrement **sans changement réel** n'écrit rien : le fichier reste identique à l'octet près.

## Sécurité

- L'API n'accepte que les requêtes venant de **cette machine**, vers `localhost`.
- Toute modification exige un en-tête que seul l'écran `/admin` envoie : une autre page web ouverte dans ton navigateur
  ne peut pas modifier tes fichiers.
- Si tu lances `npm run dev -- --host`, l'API reste refusée pour les autres appareils du réseau.

## Limites et bon à savoir

- **Astro doit tourner** (`npm run dev`) pour utiliser l'administration.
- Les fichiers font jusqu'à **2 Go** chacun ; pense aux limites d'hébergement (Cloudflare Pages : 25 Mo par fichier ;
  GitHub : 100 Mo) — compresse les vidéos.
- Les noms de fichiers envoyés sont **normalisés** (minuscules, sans accents ni espaces) : `Ma Photo N°1.JPG` →
  `ma-photo-n-1.jpg`. Un fichier nommé `cover` devient `couverture`.
- **Modifier l'adresse** d'un projet (onglet Informations) renomme son dossier : si le site est déjà en ligne,
  l'ancienne adresse ne fonctionnera plus.
- Les pages ouvertes du **site** se rechargent tout seules quand un fichier change (comportement normal d'Astro). La page
  `/admin`, elle, refuse ce rechargement pour ne jamais interrompre un envoi.
- L'enregistrement ne change que les valeurs modifiées de `project.md` : les **commentaires**, les guillemets et l'ordre
  des autres champs sont conservés, ainsi que les champs inconnus de l'administration. Les blocs (`blocks`) ne sont
  jamais retirés implicitement.
- Si `project.md` contient une erreur de syntaxe, le projet apparaît en rouge sur le tableau de bord avec le message.

## Pour les développeurs

| Élément                                      | Emplacement                                   |
| -------------------------------------------- | --------------------------------------------- |
| Intégration (dev uniquement)                 | `integrations/local-cms/index.mjs`            |
| API et accès aux fichiers                    | `integrations/local-cms/{api,store,http}.mjs` |
| Coque de la page `/admin`                    | `src/cms/admin.astro`                         |
| Interface (TypeScript, sans framework)       | `src/cms/app/` · style : `src/cms/admin.css`  |
| Modèle de composition (partagé avec le site) | `src/lib/gallery-layout.ts`                   |
| Grille de la galerie (partagée avec le site) | `src/styles/gallery-grid.css`                 |
| Schémas : projet, blocs, formats de médias   | `src/schemas/{project,blocks,media}.ts`       |
| Règles des médias (affiches, couverture…)    | `src/lib/media-rules.ts`                      |
| Galerie → blocs à afficher                   | `src/lib/gallery/normalize.ts`                |
| Tests automatiques (`npm test`)              | `tests/`                                      |

L'API charge les **mêmes modules** que le site (schémas, règles, listes de catégories) par Vite (`ssrLoadModule`) :
une règle modifiée s'applique partout. Le drag & drop utilise `sortablejs`, la lecture / écriture de `project.md`
utilise `yaml`, les tests `vitest` : dépendances de développement, jamais embarquées dans le site publié.
