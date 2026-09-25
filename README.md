# Ibrahima Faye — Portfolio officiel

Portfolio d'**Ibrahima Faye**, créateur technologique : création numérique, conception 3D, fabrication,
électronique, robotique et automatisation. **ClicGraph** (studio créatif) et **JeeFSYS** (startup robotique &
automatisation) font partie de son univers professionnel.

Site statique, en français, prêt pour l'anglais. Astro · TypeScript · Tailwind CSS · GSAP · Content Collections.

## Démarrage

Prérequis : **Node.js 22 ou plus** (`node --version`).

```bash
npm install        # une seule fois
npm run dev        # aperçu local : http://localhost:4321 (brouillons visibles) + administration : /admin
npm run build      # construit le site dans dist/ (brouillons exclus)
npm run preview    # sert le site construit
npm run projet -- "Titre"   # crée un nouveau projet (dossier + fiche préremplie)
npm run check      # contrôle TypeScript, composants Astro et champs des projets
npm run format     # met en forme le code (Prettier)
```

## Ce qu'il y a à faire soi-même

| Quoi                                                                   | Où                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Gérer les projets sans code** (administration locale)                | [`docs/ADMINISTRATION.md`](docs/ADMINISTRATION.md) — `npm run dev` puis `/admin` |
| **Ajouter un projet** (le plus fréquent) : `npm run projet -- "Titre"` | [`docs/AJOUTER-UN-PROJET.md`](docs/AJOUTER-UN-PROJET.md)                         |
| Renseigner e-mail, réseaux, formulaire                                 | `src/config/site.ts`                                                             |
| Ajouter une photo de portrait                                          | déposer `src/assets/portrait.jpg`                                                |
| Modifier un texte du site                                              | `src/i18n/ui/fr.ts`                                                              |
| Mettre en ligne                                                        | [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md)                                     |
| Ajouter l'anglais                                                      | [`docs/INTERNATIONALISATION.md`](docs/INTERNATIONALISATION.md)                   |

> **Rien n'est inventé.** Les dix projets préparés (WonderPark, Les Résidences de Sindia, Salle de sport, Bras robotique, Système d'étiquetage automatique,
> Tourelle automatique, Système de charge automatisé, Impression 3D, Électronique ESP32 / Arduino, Design graphique) sont des **brouillons** : titre, domaine et entité seulement, sans description,
> sans client, sans résultat. Ils n'apparaissent qu'en local, tant que `draft: true` n'est pas retiré.

## Architecture

```
src/
├── content/projects/<slug>/     ← UN DOSSIER PAR PROJET : project.md + cover.jpg + médias
├── content.config.ts            ← schéma des projets (champs validés)
├── cms/                         ← administration locale /admin (dev uniquement, jamais publiée)
├── config/site.ts               ← identité, coordonnées, réseaux
├── data/                        ← domaines (8) et entités (ClicGraph, JeeFSYS) — source de vérité
├── i18n/                        ← dictionnaires (fr, en) et utilitaires
├── lib/
│   ├── projects.ts              ← lecture, tri, filtres, projet précédent / suivant
│   └── media.ts                 ← détection automatique des images / vidéos d'un projet
├── layouts/BaseLayout.astro     ← structure commune, SEO, transitions de page
├── views/                       ← contenu des pages (reçoivent la langue) : Home, Projets, Projet
├── pages/                       ← routes : de simples appels aux vues
├── components/
│   ├── sections/                ← Hero, À propos, Expertises, Écosystème, Projets, Contact (+ Manifeste, masqué)
│   ├── projects/                ← carte projet, visuel de remplacement
│   ├── gallery/                 ← galerie à ratio respecté + visionneuse plein écran
│   ├── layout/ · seo/ · ui/     ← en-tête, pied de page, SEO, icônes, boutons
├── scripts/                     ← animations GSAP, champ 3D du Hero, filtres, visionneuse
└── styles/global.css            ← design system (palette, typographies, utilitaires)
integrations/local-cms/          ← serveur de l'administration (actif seulement avec `npm run dev`)
docs/                            ← guides + modèle de projet
public/                          ← favicon, robots.txt, en-têtes HTTP
```

### Choix techniques

- **Astro** : HTML statique, presque aucun JavaScript par défaut → excellentes performances et SEO.
- **Content Collections** : chaque projet est un dossier ; les champs sont **validés** (une erreur de frappe est signalée
  avec le champ fautif) et les pages sont générées automatiquement.
- **Médias sans recadrage** : cadres calculés à partir du ratio réel de chaque fichier ; galerie « justifiée » en CSS pur ;
  visionneuse en `<dialog>` natif (focus piégé, Échap, clavier, plein écran) avec zoom (molette, double-tap, pincement),
  déplacement, miniatures, ouverture animée depuis la vignette et gestes tactiles.
- **Expertises** : 8 domaines, chacun avec une illustration technique animée en SVG + CSS pur (aucun WebGL), remplaçable
  par une vraie image ou vidéo (`src/assets/domaines/<domaine>.jpg|mp4`), ses outils et les projets qui le démontrent ;
  puis les outils du CV regroupés (création / ingénierie), niveaux réglables dans l'administration, sans pourcentage.
- **GSAP** (+ ScrollTrigger, SplitText) : révélations au scroll, titres découpés, parallaxe, boutons magnétiques.
  Tout est piloté par des attributs HTML (`data-reveal`, `data-split`…), documentés dans `src/scripts/motion.ts`.
  `prefers-reduced-motion` est respecté : aucune animation, tout le contenu reste visible.
- **Hero** : champ filaire 3D dessiné en **Canvas 2D** (≈ 200 lignes, sans dépendance) plutôt qu'avec Three.js, nettement
  plus léger pour ce rendu. Pause hors écran, image fixe en mouvement réduit.
  Three.js n'est volontairement pas utilisé : il n'apporterait rien ici qui justifie son poids.
- **Tailwind CSS v4** : palette et typographies déclarées une fois dans `global.css` (navy, noir bleuté, violet électrique,
  mauve, lavande, blanc cassé ; Syne, Manrope, JetBrains Mono, auto-hébergées).
- **Accessibilité** : lien d'évitement, navigation clavier, contrastes, `aria-*`, textes alternatifs, mouvement réduit.
- **SEO** : titres, descriptions, canonical, Open Graph, Twitter Cards, JSON-LD (Person, Organization, CreativeWork), sitemap.

## Licence

Code et contenus © Ibrahima Faye. Tous droits réservés.
