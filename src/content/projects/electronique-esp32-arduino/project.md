---
# ─── MODÈLE DE PROJET ─────────────────────────────────────────────────────────
# Le plus simple :   npm run projet -- "Titre du projet"
#   (crée le dossier + ce fichier, prérempli ; voir docs/AJOUTER-UN-PROJET.md)
# À la main : copier ce dossier `modele-projet` dans `src/content/projects/`
#   et le renommer (minuscules, sans accents, tirets) : ex. `bras-robotique`.
#   Le NOM DU DOSSIER devient l'adresse de la page :  /projets/bras-robotique/
#
# Ensuite : remplir les champs, déposer `cover.jpg` + les médias dans le dossier,
# puis supprimer la ligne `draft: true` pour publier.
# Règle : n'écrire que des FAITS VÉRIFIÉS. Un champ vide n'est simplement pas affiché.
# ──────────────────────────────────────────────────────────────────────────────

# — Identité —
title: Prototypage électronique et ESP32 / Arduino
# 3d-architecture | design-graphique | impression-3d-fabrication | robotique
# automatisation | electronique-electrotechnique | prototypage
category: electronique-electrotechnique
# Marque : clicgraph | jeefsys | personal   —  plusieurs : [clicgraph, jeefsys]
entity: jeefsys

# — Présentation —
# summary: Description courte, une phrase (240 caractères max) : carte + Google.
# year: 2025
# status: prototype # concept | en-cours | prototype | termine
# technologies: [ESP32, Blender]
# role: Ton rôle sur le projet
# context: Le contexte : d'où vient le projet, quel besoin.
# result: Le résultat obtenu (vérifiable).

# — Optionnel —
# client: Nom du client (uniquement si c'est vrai)
# featured: true # mis en avant sur la page d'accueil (6 maximum)
order: 9
# coverAlt: Description de l'image principale
# links:
#   - label: Code source
#     href: https://github.com/…
# media: # réglages fins de la galerie (tout est automatique sans cela)
#   - file: image-01.jpg
#     alt: Texte alternatif
#     caption: Légende affichée dans la visionneuse
#   - file: demo.mp4
#     ratio: 9:16 # vidéo verticale

# — Brouillon : visible en local uniquement. Supprimer cette ligne pour publier. —
draft: true
---

<!--
  DESCRIPTION DÉTAILLÉE — à écrire ici, en Markdown (titres ##, listes, liens, citations…).
  Tant que ce bloc ne contient que ce commentaire, aucune description n'est affichée.

  MÉDIAS — à déposer dans CE dossier (rien à déclarer, tout est détecté) :
    cover.jpg            image principale (jamais recadrée)
    image-01.jpg …       galerie, triée par nom (JPG, PNG, WebP, AVIF ; tous ratios)
    demo.mp4 / .webm     vidéos (horizontales ou verticales)
    demo.jpg             (facultatif) affiche de la vidéo « demo.mp4 »
-->
