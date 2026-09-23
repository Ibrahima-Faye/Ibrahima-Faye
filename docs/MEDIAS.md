# Médias : originaux, versions web, stockage

## Principe

- **Originaux** : déposés dans le dossier du projet (`src/content/projects/<projet>/`). Ils ne sont
  **jamais** modifiés, déplacés ni supprimés par le pipeline, et restent **hors Git**.
- **Versions web** : produites automatiquement dans `<projet>/_web/<original>/`, décrites dans
  `<projet>/media.json`. Le site n'utilise **que** ces versions.

| Original                   | Versions web                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| JPG, PNG, WebP, AVIF, HEIC | `image.jpg` (ou `image.webp` si transparence) ≤ 3840 px, `thumb.webp` — le site en tire AVIF / WebP / tailles responsive |
| SVG                        | `image.svg` nettoyé (scripts retirés)                                                                                    |
| GIF animé                  | `video.mp4` en boucle, muet                                                                                              |
| MP4, MOV, M4V, WebM        | `video.mp4` H.264 ≤ 1920 px, `mobile.mp4` ≤ 1280 px (grandes vidéos), `poster.jpg`, `thumb.webp`                         |

Aucun recadrage : chaque version garde le ratio de l'original.

## Générer

- Automatique dans `/admin` (envoi, fichier ajouté ou modifié, démarrage du serveur).
- En ligne de commande : `npm run medias` (simulation), `npm run medias -- --confirmer`,
  `--projet <slug>`, `--forcer` (tout régénérer). FFmpeg est requis pour les vidéos et GIF animés.

## Stockage : local ou distant

Chaque version web a un stockage, écrit dans `media.json` :

```json
"img-5685.mp4": {
  "outputs": { "video": "_web/img-5685.mp4/distant/video.mp4", "poster": "_web/img-5685.mp4/poster.jpg" },
  "storage": { "video": "remote", "poster": "local" }
}
```

- **`local`** (≤ 25 Mio) : versionnée dans Git et publiée avec le site.
- **`remote`** (> 25 Mio, limite par fichier de Cloudflare Pages) : copie locale dans
  `_web/<original>/distant/`, **exclue de Git et du build**, à envoyer vers un stockage externe
  (Cloudflare R2 ou équivalent). Aucune compression supplémentaire n'est appliquée pour « faire rentrer »
  une vidéo.

Sur le stockage externe, chaque fichier est attendu sous `<projet>/<original>/<version>`,
par exemple `systeme-etiquetage-automatique/img-5685.mp4/video.mp4`
(`npm run medias` liste les fichiers concernés).

Le site lit l'URL publique dans la variable **`PUBLIC_MEDIA_BASE_URL`** (voir `.env.example`) :

| Situation                      | Vidéo affichée                                                              |
| ------------------------------ | --------------------------------------------------------------------------- |
| `PUBLIC_MEDIA_BASE_URL` défini | version distante                                                            |
| serveur de dev, sans URL       | copie locale de `distant/`                                                  |
| site publié, sans URL          | version mobile si elle est locale, sinon l'affiche (le média reste visible) |

**Aucun secret dans le dépôt** : l'URL publique n'est pas un secret ; les clés d'accès R2
(pour l'envoi, étape future) iront uniquement dans `.env` (ignoré par Git) ou dans les variables
secrètes de l'hébergeur.
