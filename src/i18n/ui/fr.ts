import type { DomainSlug } from '@/data/domains';
import type { EntitySlug, ProjectStatus } from '@/data/entities';

/**
 * Tous les textes de l'interface, en français (langue principale).
 * Ce fichier définit aussi la FORME du dictionnaire : en.ts doit la respecter.
 *
 * Voix : première personne quand Ibrahima parle de lui.
 * Règle : ne rien inventer (clients, résultats, réalisations).
 */

interface DomainCopy {
  title: string;
  /** Une phrase, sobre — décrit le domaine, pas un résultat. */
  description: string;
}

interface EntityCopy {
  name: string;
  /** Rôle court, ex. « Mon studio créatif » */
  role: string;
  description: string;
}

const fr = {
  meta: {
    lang: 'fr',
    ogLocale: 'fr_FR',
    siteTitle: 'Ibrahima Faye — Créateur technologique',
    titleTemplate: '%s — Ibrahima Faye',
    description:
      'Portfolio d’Ibrahima Faye : création numérique, 3D, robotique, automatisation et électronique. ClicGraph · JeeFSYS.',
    jobTitle: 'Créateur technologique',
    projectsTitle: 'Projets',
    projectsDescription:
      'Les projets d’Ibrahima Faye : 3D, architecture, visualisation, design graphique, fabrication, robotique, automatisation et électronique.',
    notFoundTitle: 'Page introuvable',
  },

  a11y: {
    skipToContent: 'Aller au contenu',
    mainNav: 'Navigation principale',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    home: 'Ibrahima Faye — accueil',
    backToTop: 'Retour en haut',
    externalLink: '(s’ouvre dans un nouvel onglet)',
  },

  nav: {
    expertises: 'Expertises',
    projects: 'Projets',
    ecosystem: 'Écosystème',
    about: 'À propos',
    contact: 'Contact',
  },

  hero: {
    eyebrow: 'Créateur technologique',
    lines: ['Je conçois.', 'Je fabrique.', 'J’automatise.'],
    subtitle: 'Création numérique · 3D · Robotique · Automatisation · Électronique',
    ctaProjects: 'Voir mes projets',
    ctaContact: 'Me contacter',
    scroll: 'Défiler',
    entitiesLabel: 'Studio ClicGraph · Startup JeeFSYS',
  },

  manifesto: {
    eyebrow: 'Démarche',
    statement:
      'Je développe des projets à la croisée de la création numérique, de la conception 3D, de la fabrication, de l’électronique, de la robotique et de l’automatisation. À travers ClicGraph et JeeFSYS, je transforme mes idées en visualisations, prototypes, systèmes et solutions concrètes.',
    equation: ['Créativité', 'Conception', 'Technologie', 'Fabrication'],
  },

  expertises: {
    eyebrow: 'Expertises',
    title: 'Ce que je pratique.',
    intro:
      'Je passe d’un modèle 3D à une pièce imprimée, d’un rendu à un circuit, d’un prototype à un système qui tourne seul. Chaque domaine renvoie aux projets qui le montrent.',
    projectsCount: { one: '{n} projet', other: '{n} projets' },
    seeProjects: 'Voir les projets',
    illustration: 'Illustration technique',
    placeholderDomain: 'Emplacement média',
    /** Projets publiés du domaine (« compétence → projet »). */
    provenBy: 'Démontré par',
    noProject: 'Projets en cours de documentation',
    /** Matériel et techniques cités dans les fiches projet du domaine. */
    alsoUsed: 'Matériel & techniques',
    toolsEyebrow: 'Outils',
    toolsTitle: 'Les outils de mes projets.',
    toolsIntro:
      'Logiciels et cartes électroniques cités dans mes fiches projet — sans niveau ni pourcentage : les projets parlent d’eux-mêmes.',
    usedIn: 'Utilisé dans',
  },

  domains: {
    '3d-architecture': {
      title: '3D & Architecture',
      description:
        'Modélisation 3D, visualisation et rendu photoréaliste d’espaces, de volumes et d’ensembles architecturaux, de l’idée à l’image.',
    },
    'design-graphique': {
      title: 'Design graphique',
      description:
        'Identités, supports et compositions visuelles pensés pour communiquer avec précision.',
    },
    'impression-3d-fabrication': {
      title: 'Impression 3D & Fabrication',
      description:
        'Passer du modèle numérique à l’objet physique : impression 3D, fabrication et finition.',
    },
    robotique: {
      title: 'Robotique',
      description: 'Conception de systèmes robotisés : mécanique, motorisation et pilotage.',
    },
    automatisation: {
      title: 'Automatisation industrielle',
      description:
        'Automatiser des tâches et des processus industriels pour les rendre fiables et reproductibles.',
    },
    'electronique-electrotechnique': {
      title: 'Électronique & Électrotechnique',
      description: 'Circuits, capteurs, commande et systèmes embarqués (ESP32, Arduino, etc.).',
    },
    prototypage: {
      title: 'Prototypage',
      description: 'Construire, tester, corriger : transformer une idée en prototype fonctionnel.',
    },
  } satisfies Record<DomainSlug, DomainCopy>,

  projects: {
    eyebrow: 'Projets',
    title: 'Réalisations',
    pageTitle: 'Projets',
    intro:
      'Visualisations, prototypes, systèmes : chaque projet est rattaché au domaine qu’il démontre et aux outils utilisés.',
    seeAll: 'Tous les projets',
    backHome: 'Accueil',
    empty: 'Les projets sont en cours de documentation. Revenez bientôt.',
    emptyFiltered: 'Aucun projet ne correspond à ce filtre.',
    resetFilters: 'Réinitialiser les filtres',
    filterAll: 'Tous',
    filterDomain: 'Domaine',
    filterEntity: 'Marque',
    resultsCount: { one: '{n} projet', other: '{n} projets' },
    draftBadge: 'Brouillon',
    draftNotice:
      'Brouillon : visible uniquement en développement. Il n’apparaîtra pas dans le site publié.',
    noDescription: 'La description de ce projet sera publiée prochainement.',
    // Page de détail
    back: 'Tous les projets',
    labelEntity: 'Marque',
    labelDomain: 'Domaine',
    labelYear: 'Année',
    labelStatus: 'Statut',
    labelClient: 'Client',
    labelRole: 'Rôle',
    labelContext: 'Contexte',
    labelResult: 'Résultat',
    labelTechnologies: 'Technologies',
    labelLinks: 'Liens',
    gallery: 'Galerie',
    galleryEmpty: 'Les médias de ce projet seront ajoutés prochainement.',
    placeholder: 'Placeholder',
    placeholderCover: 'Image principale à venir',
    slotTitle: 'Emplacement galerie',
    slotText:
      'Aucun média pour l’instant. Dépose des images (JPG, PNG, WebP, AVIF) et des vidéos (MP4, WebM) dans le dossier ci-dessous : la galerie se remplit toute seule.',
    next: 'Projet suivant',
    previous: 'Projet précédent',
    playVideo: 'Lire la vidéo',
    imageAlt: '{title} — image {n}',
    videoAlt: '{title} — vidéo {n}',
    coverAlt: '{title}',
  },

  statuses: {
    concept: 'Concept',
    'en-cours': 'En cours',
    prototype: 'Prototype',
    termine: 'Terminé',
  } satisfies Record<ProjectStatus, string>,

  entities: {
    clicgraph: {
      name: 'ClicGraph',
      role: 'Mon studio créatif',
      description:
        'Là où mes idées prennent forme : 3D, architecture, visualisation, rendu photoréaliste, design graphique, impression 3D, fabrication et prototypage.',
    },
    jeefsys: {
      name: 'JeeFSYS',
      role: 'Ma startup robotique & automatisation',
      description:
        'Là où mes idées s’animent : robotique, automatisation, électronique, systèmes embarqués, prototypage et solutions technologiques.',
    },
    personal: {
      name: 'Projet personnel',
      role: 'Ibrahima Faye',
      description: '',
    },
  } satisfies Record<EntitySlug, EntityCopy>,

  ecosystem: {
    eyebrow: 'Écosystème',
    title: 'Deux univers complémentaires.',
    intro:
      'Mon profil est hybride : la création numérique d’un côté, la technologie de l’autre. ClicGraph et JeeFSYS en sont les deux dimensions.',
    domainsLabel: 'Univers',
    seeProjects: 'Voir les projets {name}',
    bridgeTitle: 'ClicGraph × JeeFSYS',
    bridgeText: 'Deux univers, une même approche : transformer une idée en solution concrète.',
    /** Mots-clés de chaque univers (liste : src/data/entities.ts → entityUniverse). */
    keywords: {
      creation: 'Création numérique',
      '3d': '3D',
      architecture: 'Architecture',
      visualisation: 'Visualisation',
      'design-graphique': 'Design graphique',
      'impression-3d': 'Impression 3D',
      fabrication: 'Fabrication',
      robotique: 'Robotique',
      automatisation: 'Automatisation',
      electronique: 'Électronique',
      embarque: 'Systèmes embarqués',
      prototypage: 'Prototypage',
    },
  },

  about: {
    eyebrow: 'À propos',
    title: 'Ibrahima Faye',
    role: 'Créateur technologique',
    paragraphs: [
      'Je crée à la croisée du numérique et du physique : je conçois en 3D, je visualise, je fabrique, puis j’automatise.',
      'Mes projets relient la conception 3D, la fabrication, l’électronique, la robotique et l’automatisation. À travers ClicGraph et JeeFSYS, je transforme mes idées en visualisations, prototypes, systèmes et solutions concrètes.',
    ],
    portraitAlt: 'Portrait d’Ibrahima Faye',
    /** Fiche d'identité (valeurs tirées des données du site : domaines, entités). */
    facts: {
      profile: 'Profil',
      creation: 'Création numérique',
      technology: 'Technologie',
      universe: 'Univers',
    },
    /** Parcours / formation : affiché seulement s'il est renseigné (Contenu du site → À propos). */
    timelineLabel: 'Parcours',
    stepsLabel: 'Mon approche',
    steps: [
      { title: 'Concevoir', text: 'Imaginer, modéliser, dessiner.' },
      { title: 'Visualiser', text: 'Rendre l’idée visible avant qu’elle existe.' },
      { title: 'Fabriquer', text: 'Passer du numérique au physique.' },
      { title: 'Automatiser', text: 'Faire fonctionner le système de lui-même.' },
    ],
  },

  contact: {
    eyebrow: 'Contact',
    title: 'Une idée à concevoir, fabriquer ou automatiser ?',
    text: 'Parlons-en.',
    email: 'E-mail',
    phone: 'Téléphone',
    whatsapp: 'WhatsApp',
    location: 'Localisation',
    write: 'Écrire',
    form: {
      name: 'Nom',
      email: 'E-mail',
      message: 'Message',
      send: 'Envoyer',
      sending: 'Envoi…',
      success: 'Merci, votre message est bien parti. Je reviens vers vous rapidement.',
      error: 'L’envoi a échoué. Réessayez, ou écrivez-moi directement par e-mail.',
    },
    devNotice:
      'Aucune coordonnée n’est encore renseignée. Renseigne-les dans src/config/site.ts (cette note n’apparaît qu’en développement).',
  },

  footer: {
    rights: '© {year} Ibrahima Faye. Tous droits réservés.',
    explore: 'Explorer',
    universe: 'Univers',
    backToTop: 'Haut de page',
    socials: 'Réseaux',
  },

  lightbox: {
    label: 'Visionneuse de médias',
    close: 'Fermer',
    previous: 'Média précédent',
    next: 'Média suivant',
    fullscreen: 'Plein écran',
    exitFullscreen: 'Quitter le plein écran',
    counter: '{n} / {total}',
    open: 'Ouvrir en grand',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    zoomReset: 'Taille d’origine',
    thumbnails: 'Miniatures',
    goTo: 'Aller au média {n}',
    hint: 'Molette ou double-clic pour zoomer · ← → pour naviguer',
  },
  carousel: {
    label: 'carrousel',
    slide: 'diapositive',
  },

  notFound: {
    title: 'Cette page n’existe pas.',
    text: 'Le lien est peut-être erroné, ou le projet a changé d’adresse.',
    cta: 'Retour à l’accueil',
  },
};

export type Dictionary = typeof fr;
export default fr;
