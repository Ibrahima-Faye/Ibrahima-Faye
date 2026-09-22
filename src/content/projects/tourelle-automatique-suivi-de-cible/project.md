---
# Fiche gérée par l’administration locale (/admin). Modifiable aussi à la main : le site lit ce fichier tel quel.

title: Tourelle automatique à suivi de cible
category: robotique
entity: jeefsys
summary: Prototype de tourelle automatisée capable de détecter, suivre et orienter son système de visée vers une cible grâce à une caméra et une commande embarquée.
year: 2026
status: prototype
technologies:
  - ESP32
  - CAM
  - Servomoteurs
  - Computer Vision
  - Laser
  - Fusion 360
role: Conception mécanique, modélisation 3D, électronique, programmation embarquée et intégration du système de suivi.
result: Prototype fonctionnel permettant l’orientation automatisée d’une tourelle en fonction de la position détectée par le système de vision.
client: Personnel
order: 6
media:
  - file: 555.png
    span: 6
  - file: 666.png
    span: 6
  - file: 5877295065770692709-119.jpg
    span: 6
  - file: 5877295065770692710-119.jpg
    span: 6
  - file: 5877295065770692708-119.jpg
    span: 12
  - file: page1-1.jpg
    span: 6
  - file: page2-1.jpg
    span: 6
  - file: img-4353.mp4
    span: 12
    ratio: 1072:1904
draft: false
---

Tourelle automatique à suivi de cible est un prototype robotique développé par JeeFSYS autour de la vision embarquée et du contrôle de mouvement.

## Architecture du système

Le prototype combine :

- une caméra ESP32-CAM pour la détection ;
- une unité ESP32 pour le traitement et la commande ;
- des servomoteurs pour les mouvements d’orientation ;
- un module PCA9685 pour la gestion des servomoteurs ;
- une structure mécanique conçue et modélisée en 3D.

## Fonctionnement

La caméra fournit les informations nécessaires à la localisation de la cible. Le système analyse sa position et commande les axes de la tourelle afin d'orienter automatiquement le mécanisme.

## Conception

La structure mécanique a été conçue en 3D avant l'intégration des composants électroniques et des actionneurs.

## Réalisation

Conception mécanique, prototypage, électronique et programmation réalisés dans le cadre des projets robotiques JeeFSYS.
