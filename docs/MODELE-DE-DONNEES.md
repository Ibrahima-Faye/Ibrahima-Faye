# Modèle de données d'un projet

Un projet = un dossier `src/content/projects/<projet>/` avec un `project.md` et ses médias. Le frontmatter de
`project.md` est validé par [`src/schemas/project.ts`](../src/schemas/project.ts) ; les blocs par
[`src/schemas/blocks.ts`](../src/schemas/blocks.ts) ; les formats de médias par
[`src/schemas/media.ts`](../src/schemas/media.ts). Ces mêmes fichiers servent au site, à `/admin` et aux tests.

```
project.md
├─ champs du projet (title, category, entity, summary, year, cover, links, draft…)
├─ media:    réglages PAR FICHIER   → ce qu'est le média (alt, légende, ratio, masqué)
├─ blocks:   MISE EN PAGE (facultatif) → où et comment il apparaît (ordre, groupes, colonnes)
└─ unplaced: fichiers hors blocs     → append (affichés à la fin, par défaut) | hide
```

## Règles qui ne changent jamais

- **Aucun recadrage** : chaque image ou vidéo garde son ratio d'origine, quels que soient colonnes, spans et appareil.
  Un span ne dépasse jamais le nombre de colonnes.
- **Rien ne disparaît** : un fichier placé dans aucun bloc s'affiche à la fin (`unplaced: append`, par défaut) ; un bloc
  d'un type inconnu ou incohérent est **conservé** dans le fichier et affiché comme une grille ; un fichier introuvable
  est seulement ignoré à l'affichage (avertissement).
- **Aucun bloc n'est supprimé automatiquement.** Retirer un média retire ses emplacements, jamais le bloc.
- **Identifiants stables** : chaque bloc et chaque élément a un `id` (attribué une fois, puis conservé).
- **Compatibilité** : sans `blocks`, la galerie est exactement celle d'avant (composition historique de `media:`).

## `media` — réglages par fichier

```yaml
media:
  - file: demo.mp4 # nom du fichier = identifiant du média
    alt: Texte alternatif
    caption: Légende
    ratio: 9:16 # vidéo : ratio déclaré
    hidden: true # masqué de la composition historique
    span: 6 # composition historique : largeur sur 12 colonnes (3 · 4 · 6 · 8 · 9 · 12)
    align: start # composition historique : start | center | end
```

## `blocks` — mise en page

L'**ordre de la liste** est l'ordre d'affichage (blocs, puis éléments de chaque bloc).

### Champs communs

| Champ     | Valeurs                                    | Défaut   | Rôle                                            |
| --------- | ------------------------------------------ | -------- | ----------------------------------------------- |
| `id`      | texte unique                               | attribué | identité stable du bloc                         |
| `type`    | `single` · `grid` · `carousel` · `compare` | —        | voir ci-dessous (un type inconnu est conservé)  |
| `title`   | texte                                      | —        | titre au-dessus du bloc                         |
| `caption` | texte                                      | —        | légende du bloc                                 |
| `width`   | `content` · `wide` · `full`                | `wide`   | largeur : texte · page · bord à bord de l'écran |
| `hidden`  | `true` / `false`                           | `false`  | masque le bloc sans le supprimer                |
| `items`   | liste                                      | —        | les médias placés                               |
| `motion`  | identifiant                                | —        | réservé à l'Animation Studio                    |

### Types

| Type       | Usage                                     | Éléments                | Options                                                       |
| ---------- | ----------------------------------------- | ----------------------- | ------------------------------------------------------------- |
| `single`   | image seule ou vidéo seule                | 1                       | `width`                                                       |
| `grid`     | groupe, grille, images + vidéos mélangées | 1 ou plus               | `columns`, `gap` (`none` · `sm` · `md` · `lg`), `align`       |
| `carousel` | carrousel                                 | 2 ou plus               | `perView`, `loop`, `autoplay` (secondes, 0 = non), `controls` |
| `compare`  | avant / après                             | exactement 2 **images** | `start` (0–100), `orientation`, `labels: [Avant, Après]`      |

> Le carrousel et l'avant / après sont **enregistrés et conservés dès maintenant** ; leur rendu interactif arrive avec
> l'éditeur de blocs. D'ici là, ils s'affichent en grille (tous leurs médias sont visibles).

### Élément (`items[]`)

| Champ     | Valeurs                                  | Rôle                                                        |
| --------- | ---------------------------------------- | ----------------------------------------------------------- |
| `id`      | texte unique                             | identité stable de l'emplacement                            |
| `file`    | nom de fichier du dossier                | le média (le même fichier peut servir dans plusieurs blocs) |
| `span`    | nombre, ou `{ desktop, tablet, mobile }` | colonnes occupées (grille), borné aux colonnes du bloc      |
| `align`   | `start` · `center` · `end`               | alignement vertical dans sa ligne                           |
| `caption` | texte                                    | légende pour CET emplacement (sinon celle de `media`)       |
| `video`   | `{ autoplay, loop, muted, controls }`    | comportement de la vidéo à cet emplacement                  |
| `poster`  | nom d'image                              | affiche choisie pour cette vidéo                            |

### Colonnes et lignes

- `columns: 3` = 3 colonnes sur ordinateur, 2 au plus sur tablette, 1 sur mobile.
  `columns: { desktop: 3, tablet: 2, mobile: 1 }` pour tout régler. De 1 à 6 (12 : grille historique).
- Appareils : **desktop** ≥ 1024 px · **tablet** 640–1023 px · **mobile** < 640 px.
- Les **lignes** se forment d'elles-mêmes (de gauche à droite, puis à la ligne). Chaque ligne prend la hauteur de ses
  médias : aucune hauteur imposée, donc aucun recadrage. `align` cale les médias en haut, au centre ou en bas.

## Exemple complet

```yaml
blocks:
  # ① image seule, bord à bord
  - id: b-ouverture
    type: single
    width: full
    items:
      - { id: i-01, file: 5978699308053761643-119.jpg }

  # ② carrousel de 4 images
  - id: b-carrousel
    type: carousel
    perView: { desktop: 1.2, tablet: 1, mobile: 1 }
    loop: true
    autoplay: 0
    controls: [arrows, dots]
    items:
      - { id: i-02, file: 5970028658141367711-121.jpg }
      - { id: i-03, file: 5970028658141367709-121.jpg }
      - { id: i-04, file: 5877295065770692714-119.jpg }
      - { id: i-05, file: 5980953598948478973-119.jpg }

  # ③ grille de 3 images : une grande, puis deux
  - id: b-grille
    type: grid
    columns: { desktop: 3, tablet: 2, mobile: 1 }
    align: start
    items:
      - { id: i-06, file: convoyor.jpg, span: { desktop: 3, tablet: 2 } }
      - { id: i-07, file: page1-1.jpg }
      - { id: i-08, file: page2-1.jpg }

  # ④ une vidéo
  - id: b-video
    type: single
    items:
      - { id: i-09, file: video-project-2.mp4, video: { autoplay: false, controls: true } }

  # ⑤ images et vidéos mélangées
  - id: b-mixte
    type: grid
    columns: { desktop: 3, tablet: 3, mobile: 1 }
    align: center
    items:
      - { id: i-10, file: img-0777.mp4, video: { autoplay: true, loop: true, muted: true } }
      - { id: i-11, file: 5978699308053761643-119.jpg, caption: Légende propre à cet emplacement }
      - { id: i-12, file: img-5685.mp4, video: { autoplay: true, loop: true, muted: true } }

unplaced: append
```

Cet exemple est vérifié par les tests automatiques (`tests/blocks.test.ts`).

## Sans `blocks` : la composition historique

Le site calcule un bloc implicite, sans rien écrire : une grille de 12 colonnes avec les `span` de `media:`, dans
l'ordre de `media:`, puis les fichiers non listés triés par nom. C'est exactement la galerie d'avant ; les tests
comparent ce calcul à l'ancien code sur les 10 projets (`tests/legacy-gallery.test.ts`).

## Formats de médias

| Activés aujourd'hui                    | Connus, en attente de leur conversion web |
| -------------------------------------- | ----------------------------------------- |
| JPG, JPEG, PNG, WebP, AVIF · MP4, WebM | GIF, SVG, HEIC, HEIF · MOV, M4V           |

Les formats en attente ne sont ni détectés ni acceptés tant que leur conversion n'existe pas (pipeline médias).
