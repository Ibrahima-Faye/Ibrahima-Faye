# Déploiement (GitHub → Vercel, Cloudflare Pages ou Netlify)

Le site est **100 % statique** : `npm run build` produit un dossier `dist/` de fichiers HTML / CSS / JS / images.
Il fonctionne tel quel sur les trois hébergeurs, gratuitement, avec HTTPS automatique. Aucun serveur, aucun adaptateur.

## 1. Mettre le projet sur GitHub

```bash
git add .
git commit -m "Portfolio d'Ibrahima Faye"
# créer un dépôt vide sur github.com (sans README), puis :
git remote add origin https://github.com/<compte>/<depot>.git
git push -u origin main
```

Le `.gitignore` exclut déjà `node_modules/`, `dist/`, `.astro/` et les fichiers `.env`.

## 2. Choisir l'hébergeur

Les réglages sont les mêmes partout : **framework Astro**, commande **`npm run build`**, dossier de sortie **`dist`**,
Node **22 ou plus** (le fichier `.nvmrc` l'indique).

|                            | Vercel                                               | Cloudflare Pages                                                          | Netlify                                            |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Créer le projet            | vercel.com → _Add New… → Project_ → choisir le dépôt | dash.cloudflare.com → _Workers & Pages → Create → Pages → Connect to Git_ | app.netlify.com → _Add new site → Import from Git_ |
| Détection                  | Astro détecté automatiquement                        | Preset « Astro »                                                          | Détecté via `netlify.toml`                         |
| Fichier de réglages fourni | `vercel.json`                                        | `public/_headers`                                                         | `netlify.toml` + `public/_headers`                 |
| Limite par fichier         | voir sa documentation                                | **25 Mo** par fichier                                                     | voir sa documentation                              |
| Quotas de l'offre gratuite | à vérifier (et conditions d'usage commercial)        | à vérifier                                                                | à vérifier                                         |

Chaque `git push` sur `main` redéploie le site. Les autres branches obtiennent une URL d'aperçu.

> **Pour choisir** : comparer, au moment de la décision, les quotas de bande passante et les conditions d'usage
> (notamment commercial, puisque ClicGraph et JeeFSYS sont des activités professionnelles) sur la page tarifs de chaque
> hébergeur. Les vidéos et les grandes images pèsent sur la bande passante. Rien dans le code ne dépend de ce choix.

## 3. Renseigner l'adresse du site

Le site a besoin de connaître son adresse publique pour le référencement (URL canonique, sitemap, images de partage).
Dans les réglages du projet chez l'hébergeur, ajouter la variable d'environnement :

```
SITE_URL = https://votre-domaine.com
```

Sans elle, le build utilise les variables natives de l'hébergeur (Netlify `URL`, Cloudflare `CF_PAGES_URL`,
Vercel `VERCEL_PROJECT_PRODUCTION_URL`), ce qui fonctionne pour l'adresse `*.vercel.app` / `*.pages.dev` / `*.netlify.app`.
**Une fois le domaine définitif branché, définir `SITE_URL`.** Ajouter aussi dans `public/robots.txt` la ligne
`Sitemap: https://votre-domaine.com/sitemap-index.xml`.

## 4. Brancher un nom de domaine

_Domains_ (Vercel) / _Custom domains_ (Cloudflare Pages) / _Domain management_ (Netlify) → saisir le domaine → suivre les
instructions DNS. Le certificat HTTPS est émis automatiquement.

## Avant la mise en ligne — liste de contrôle

- [ ] Coordonnées renseignées dans `src/config/site.ts` (e-mail, réseaux, éventuellement formulaire).
- [ ] Photo de portrait déposée : `src/assets/portrait.jpg` (facultatif ; sans elle, un monogramme s'affiche).
- [ ] Projets réels ajoutés, sans `draft: true` (voir `AJOUTER-UN-PROJET.md`).
- [ ] `SITE_URL` défini chez l'hébergeur.
- [ ] `npm run check` et `npm run build` passent sans erreur.
- [ ] Vidéos compressées (voir les limites de taille ci-dessus).

## Formulaire de contact (facultatif)

Le site étant statique, le formulaire s'appuie sur un service externe gratuit (Web3Forms, Formspree, Getform…).
Créer un compte, récupérer l'adresse d'envoi (et éventuellement une clé d'accès), puis renseigner
`contact.formEndpoint` (et `contact.formAccessKey`) dans `src/config/site.ts`. Sans endpoint, le formulaire
n'est simplement pas affiché : seuls les liens de contact renseignés apparaissent.
