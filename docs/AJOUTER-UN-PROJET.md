# Comment ajouter un nouveau projet

> **Le plus simple : l'administration locale.** `npm run dev`, puis ouvre `/admin` : création, édition, galerie en
> glisser-déposer, tailles, couverture et prévisualisation, sans toucher aux fichiers. Voir [`ADMINISTRATION.md`](ADMINISTRATION.md).
> Ce guide décrit la même chose « à la main » (dossier + `project.md`).

Ajouter un projet ne demande **aucune modification de code**. On crée un dossier, on y dépose
un fichier texte et les médias, et le site fait le reste.

## En 4 étapes

1. **Créer le projet** — une commande :

   ```bash
   npm run projet -- "Titre du projet"
   ```

   Le terminal demande la catégorie et la marque (ou les donner directement, voir « Créer un projet en une commande »).
   Cela crée `src/content/projects/<nom-du-projet>/project.md`, prérempli et **en brouillon**.
   Le nom du dossier devient l'adresse de la page : `bras-robotique` → `/projets/bras-robotique/`.
   _(À la main, c'est possible aussi : copier `docs/modele-projet/` dans `src/content/projects/` et le renommer.)_

2. **Compléter `project.md`** : année, description courte, rôle, contexte, résultat, technologies…
   Tout champ laissé vide n'est simplement pas affiché.
3. **Déposer les médias** dans le même dossier : `cover.jpg` + les autres images / vidéos.
4. **Vérifier** avec `npm run dev`, retirer la ligne `draft: true`, puis publier (`git push`).

C'est tout. Le site crée automatiquement la carte, la page détaillée, le slug, la catégorie, la marque,
les informations, la galerie et la visionneuse plein écran. **Il n'y a pas de limite au nombre de projets**,
et aucun composant du site n'est à modifier.

## Créer un projet en une commande

```bash
npm run projet -- "Titre du projet"                                   # questions posées dans le terminal
npm run projet -- "Bras robotique" --categorie robotique --marque jeefsys
npm run projet -- "Projet commun" --categorie automatisation --marque clicgraph,jeefsys --annee 2025
```

| Option                           | Rôle                                                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--categorie`                    | Domaine : `3d-architecture`, `design-graphique`, `impression-3d-fabrication`, `robotique`, `automatisation`, `electronique-electrotechnique`, `prototypage` |
| `--marque`                       | `clicgraph`, `jeefsys`, `personal` — **plusieurs** séparées par une virgule                                                                                 |
| `--annee`, `--statut`, `--ordre` | Facultatifs : préremplissent ces champs                                                                                                                     |
| `--slug`                         | Nom du dossier / adresse (sinon déduit du titre : accents et espaces retirés)                                                                               |
| `--force`                        | Écraser un projet existant (par défaut, la commande refuse)                                                                                                 |

La commande vérifie les valeurs (une catégorie inconnue est refusée avec la liste des valeurs valides) et ne renseigne
que ce que tu fournis : aucune donnée inventée.

---

## Structure d'un dossier projet

```
src/content/projects/bras-robotique/
├── project.md          ← infos + description (obligatoire)
├── cover.jpg           ← image principale (recommandé)
├── image-01.jpg        ← galerie : toutes les autres images, triées par nom
├── image-02.png
├── image-03.webp
├── montage.mp4         ← vidéo
├── montage.jpg         ← (facultatif) affiche de la vidéo « montage.mp4 »
└── demo-verticale.webm ← vidéo verticale, gérée aussi
```

### Règles de détection des médias (automatiques)

| Fichier                                    | Rôle                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `cover.jpg` / `.png` / `.webp` / `.avif`   | Image principale (carte, en-tête, partage réseaux). Absente de la galerie. |
| Toute autre image                          | Galerie, **triée par nom de fichier** (`image-01`, `image-02`…).           |
| `.mp4` / `.webm`                           | Vidéo dans la galerie, triée par nom comme les images.                     |
| Image portant le **même nom** qu'une vidéo | Affiche (poster) de cette vidéo ; elle n'apparaît pas comme image.         |
| Pas de `cover.*`                           | La première image (par nom) sert d'image principale.                       |

Pour contrôler l'ordre, préfixer les noms : `01-facade.jpg`, `02-interieur.jpg`, `03-video.mp4`.

### Formats et ratios

- **Images** : JPG, PNG, WebP, AVIF, GIF, SVG, HEIC. **Vidéos** : MP4, WebM, MOV, M4V.
  Les versions web sont produites automatiquement (voir [MEDIAS.md](MEDIAS.md)) ; l'original n'est jamais modifié.
- **Tous les ratios sont acceptés** : 16:9, 4:3, 3:2, 1:1, 9:16, panoramique… Rien n'est jamais recadré :
  la galerie place chaque média à son ratio d'origine, la visionneuse l'affiche en entier.
- Le site génère lui-même les versions AVIF / WebP optimisées et les tailles adaptées à chaque écran.
  **Déposez les originaux en bonne qualité** (par exemple 2000 à 4000 px de large), pas de version « web » à préparer.
- **Vidéos** : le ratio est lu automatiquement par le navigateur. Pour éviter tout décalage au chargement,
  on peut le déclarer (voir `media` plus bas) ou ajouter une image affiche du même nom.

> **Poids des fichiers.** Les originaux restent hors Git, quel que soit leur poids. Les versions web de plus
> de 25 Mio (vidéos longues) sont rangées à part, hors Git, pour un stockage externe (Cloudflare R2…) :
> voir [MEDIAS.md](MEDIAS.md).

---

## Le fichier `project.md`

Un bloc d'informations entre deux lignes `---`, puis la description en Markdown.

```markdown
---
title: Bras robotique
category: robotique
entity: jeefsys
summary: Une phrase qui résume le projet.
year: 2025
technologies: [ESP32, Arduino, Impression 3D]
status: prototype
featured: true
---

## Le projet

Ici, la description complète, en **Markdown** : titres, listes, liens, citations…
```

### Champs

| Champ          | Obligatoire | Rôle                                                                                                    |
| -------------- | :---------: | ------------------------------------------------------------------------------------------------------- |
| `title`        |     ✅      | Nom du projet.                                                                                          |
| `category`     |     ✅      | Domaine (voir la liste ci-dessous). Affiché sur la carte et la page, sert au filtre.                    |
| `entity`       |             | **Marque** : `clicgraph`, `jeefsys` ou `personal` (défaut). Plusieurs marques : `[clicgraph, jeefsys]`. |
| `summary`      |             | Phrase d'accroche (240 caractères max) : carte + description pour Google.                               |
| `year`         |             | Année, ex. `2025`.                                                                                      |
| `technologies` |             | Liste : `[ESP32, Blender, KeyShot]`.                                                                    |
| `status`       |             | `concept`, `en-cours`, `prototype` ou `termine`.                                                        |
| `role`         |             | Ton rôle sur le projet (ex. « Conception 3D et modélisation »). Affiché dans les informations.          |
| `context`      |             | Le contexte : d'où vient le projet, quel besoin. Bloc « Contexte » en tête de page.                     |
| `result`       |             | Le résultat obtenu. Bloc « Résultat » en tête de page.                                                  |
| `client`       |             | **Uniquement si c'est vrai.** Affiché dans les informations.                                            |
| `links`        |             | Liens externes : voir ci-dessous.                                                                       |
| `featured`     |             | `true` = mis en avant sur la page d'accueil (6 maximum).                                                |
| `order`        |             | Ordre manuel (plus petit = plus haut). Sans valeur : année la plus récente d'abord.                     |
| `slug`         |             | Remplace le nom du dossier dans l'adresse. Rarement utile.                                              |
| `coverAlt`     |             | Description de l'image principale (accessibilité).                                                      |
| `draft`        |             | `true` = **brouillon** : visible seulement en local, jamais en ligne.                                   |
| `media`        |             | Réglages fins par fichier (légende, ordre…). Voir ci-dessous.                                           |

> **`role`, `context`, `result`, `client` : uniquement des faits vérifiés.** Un champ absent n'est simplement pas affiché.
> Le site n'invente jamais de contenu : mieux vaut laisser vide que deviner.

### Liens externes

```yaml
links:
  - label: Code source
    href: https://github.com/…
  - label: Vidéo complète
    href: https://www.youtube.com/watch?v=…
```

### Réglages fins de la galerie (facultatif)

Sans réglage, tout est déjà automatique. Pour ajouter une légende, un texte alternatif, forcer l'ordre
ou déclarer le ratio d'une vidéo :

```yaml
media:
  - file: image-03.jpg # ces fichiers passent en premier, dans cet ordre
    alt: Vue d'ensemble du bras en position repliée
    caption: Prototype v2, juin 2025
  - file: demo.mp4
    ratio: 9:16 # vidéo verticale : évite tout décalage au chargement
  - file: essai-rate.jpg
    hidden: true # masque ce fichier de la galerie sans le supprimer
```

---

## Ce que le site fait tout seul

- **Carte projet** sur la page d'accueil et dans `/projets/`, au ratio exact de l'image principale.
- **Page détaillée** `/projets/<slug>/` : en-tête, image principale, informations, description, galerie, projet précédent / suivant.
- **Slug** : le nom du dossier (ou `slug`), contrôlé automatiquement.
- **Filtres** par domaine et par entité (seuls ceux qui contiennent des projets apparaissent).
- **Galerie** justifiée à ratio respecté + **visionneuse plein écran** :
  ouverture animée depuis la vignette, **zoom** (molette, double-clic / double-tap, pincement, touches `+` `−` `0`,
  boutons), déplacement de l'image zoomée, bande de **miniatures**, flèches ← →, balayage tactile
  (← → pour changer de média, vers le bas pour fermer), touche `F` (plein écran), lecture des vidéos avec contrôles.
- **Référencement** : titre, description, image de partage et données structurées générés.
- **Compteurs** dans la section « Expertises » : un domaine devient cliquable dès qu'il a un projet.

## Publier ou garder en brouillon

- `draft: true` → le projet n'existe **que sur votre ordinateur** (badge « Brouillon »). Idéal pour préparer.
- Retirer la ligne `draft` (ou mettre `false`) → il est publié au prochain déploiement.

## Domaines et entités possibles

**`category`** (une seule valeur par projet) :

| Valeur                          | Domaine                              |
| ------------------------------- | ------------------------------------ |
| `3d-architecture`               | 01 · 3D & Architecture               |
| `design-graphique`              | 02 · Design graphique                |
| `impression-3d-fabrication`     | 03 · Impression 3D & Fabrication     |
| `robotique`                     | 04 · Robotique                       |
| `automatisation`                | 05 · Automatisation industrielle     |
| `electronique-electrotechnique` | 06 · Électronique & Électrotechnique |
| `prototypage`                   | 07 · Prototypage                     |

**`entity`** (la **marque**) : `clicgraph` (studio créatif), `jeefsys` (startup robotique & automatisation), `personal` (projet personnel). Un projet commun aux deux : `entity: [clicgraph, jeefsys]` ; il apparaît alors dans les filtres des deux marques.

Une valeur incorrecte est signalée par `npm run dev` et `npm run build` : le message nomme le fichier,
le champ fautif et les valeurs acceptées.

---

## Vérifier avant de publier

```bash
npm run dev      # aperçu local sur http://localhost:4321 (les brouillons y sont visibles)
npm run check    # contrôle les fichiers et les champs des projets
npm run build    # construit le site tel qu'il sera publié (brouillons exclus)
npm run preview  # ouvre le site construit
```

## Problèmes fréquents

| Symptôme                                  | Cause probable                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le projet n'apparaît pas en ligne         | `draft: true` est encore présent.                                                                                                                    |
| Le projet n'apparaît pas du tout en local | Le fichier ne s'appelle pas exactement `project.md`, ou il n'est pas directement dans `src/content/projects/<dossier>/`.                             |
| Erreur au démarrage sur un champ          | Faute de frappe dans `category` / `entity` (marque) / `status`, ou `year` écrit entre guillemets : lire le message, il indique le champ.             |
| Une image n'apparaît pas dans la galerie  | Elle s'appelle `cover.*` (réservé à l'image principale), ou porte le même nom qu'une vidéo (c'est alors son affiche), ou est marquée `hidden: true`. |
| Ordre des médias inattendu                | Le tri se fait par nom : préfixer avec `01-`, `02-`… ou utiliser `media:`.                                                                           |
| Caractères bizarres dans le texte         | Enregistrer le fichier en **UTF-8**.                                                                                                                 |

## Ajouter un nouveau domaine ou une nouvelle entité

Cela demande une petite modification de code, à faire une seule fois :

- **Domaine** : ajouter son identifiant dans `src/data/domains.ts`, son titre et sa description dans
  `src/i18n/ui/fr.ts` (clé `domains`), et son icône dans `src/components/ui/DomainIcon.astro`.
- **Entité** : `src/data/entities.ts` + `src/i18n/ui/fr.ts` (clé `entities`).

TypeScript signale tout oubli : `npm run check` liste ce qui manque.

## Placeholders et emplacements

Un **placeholder** est toujours étiqueté comme tel (« Placeholder ») : il ne peut jamais passer pour une réalisation.

- **Projet sans image** : la carte affiche un motif technique généré + l'étiquette « Placeholder ».
- **Projet sans média** : en local uniquement, la page affiche un encadré « Emplacement galerie » avec le dossier où déposer
  les fichiers. Le site publié n'affiche rien.
- **Projets préparés** (brouillons, visibles en local uniquement, structure prête, **aucun contenu inventé**) :

  | #   | Projet                                      | Dossier                               | Catégorie                       | Marque              |
  | --- | ------------------------------------------- | ------------------------------------- | ------------------------------- | ------------------- |
  | 1   | WonderPark                                  | `wonderpark`                          | 3D & Architecture               | ClicGraph           |
  | 2   | Les Résidences de Sindia                    | `residences-de-sindia`                | 3D & Architecture               | ClicGraph           |
  | 3   | Salle de sport / complexe sportif           | `salle-de-sport-complexe-sportif`     | 3D & Architecture               | ClicGraph           |
  | 4   | Bras robotique                              | `bras-robotique`                      | Robotique                       | JeeFSYS             |
  | 5   | Système d'étiquetage automatique            | `systeme-etiquetage-automatique`      | Automatisation industrielle     | JeeFSYS             |
  | 6   | Tourelle automatique à suivi de cible       | `tourelle-automatique-suivi-de-cible` | Robotique                       | JeeFSYS             |
  | 7   | Système de charge automatisé                | `systeme-de-charge-automatise`        | Automatisation industrielle     | ClicGraph + JeeFSYS |
  | 8   | Projets d'impression 3D                     | `impression-3d`                       | Impression 3D & Fabrication     | ClicGraph           |
  | 9   | Prototypage électronique et ESP32 / Arduino | `electronique-esp32-arduino`          | Électronique & Électrotechnique | JeeFSYS             |
  | 10  | Projets de design graphique                 | `design-graphique`                    | Design graphique                | ClicGraph           |

  Pour publier l'un d'eux : déposer les médias dans son dossier, compléter `project.md`, retirer `draft: true`.
  L'ordre d'affichage suit la colonne `#` (champ `order`).

## Section « Expertises » : domaines, projets et outils

La section se remplit toute seule à partir des fiches projet :

- chaque domaine liste les **projets publiés** de sa catégorie (« Démontré par ») ;
- les **outils** (logiciels, cartes électroniques) et le **matériel** cités dans `technologies` s'affichent sur le
  domaine du projet, et les outils ont leur carte (icône, catégorie, usage, projets qui les utilisent).

Outils reconnus et leurs icônes : `src/data/tools.ts` et `src/lib/tool-icons.ts`. Une technologie inconnue du
registre reste affichée comme simple mention. Ajouter, renommer, masquer un outil ou changer son icône :
**Contenu du site → Expertises → Outils** dans l'administration. Aucun niveau ni pourcentage n'est affiché.

## Composition de la galerie (`span`, `align`, `cover`)

Sans réglage, les médias se placent automatiquement (panoramiques et vidéos horizontales en pleine largeur, le reste sur
deux colonnes). Pour composer à ta façon, l'administration écrit ces champs — modifiables aussi à la main :

```yaml
cover: 01-facade.jpg # image de couverture (sinon : cover.*, sinon la 1re image)
media:
  - file: 01-facade.jpg
    span: 9 # largeur dans une grille de 12 colonnes : 3 · 4 · 6 · 8 · 9 · 12
  - file: 02-plan.png
    span: 3
    align: end # alignement vertical : start | center | end
```

`span` : 3 = 1/4 · 4 = 1/3 · 6 = 1/2 · 8 = 2/3 · 9 = 3/4 · 12 = pleine largeur. Les médias se placent dans l'ordre de la
liste, de gauche à droite. Chacun garde son ratio d'origine. Sur mobile, tout passe en pleine largeur.

## Galerie en blocs (`blocks`, facultatif)

Pour organiser la galerie en plusieurs groupes — média seul, grille (images et vidéos mélangées), carrousel,
avant / après — avec des colonnes différentes sur ordinateur, tablette et mobile : champ `blocks`, décrit avec des
exemples dans [`MODELE-DE-DONNEES.md`](MODELE-DE-DONNEES.md). Sans ce champ, la composition ci-dessus s'applique
exactement comme avant.
