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
    title: 'Des disciplines qui se répondent.',
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
    toolsTitle: 'De la création à l’ingénierie.',
    toolsIntro:
      'Les logiciels et les cartes que j’utilise, de la modélisation et du rendu jusqu’à la programmation d’automates et de systèmes embarqués.',
    usedIn: 'Utilisé dans',
    levelLabel: 'Niveau',
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
    'informatique-industrielle': {
      title: 'Informatique industrielle & Réseaux',
      description:
        'Programmation d’équipements industriels, automates et réseaux ; simulation de circuits et d’installations avant la mise en service.',
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
        'Mon studio créatif dédié au rendu 3D et à la conception technique : 3D, architecture, visualisation, design graphique, impression 3D et fabrication.',
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
      'Mon profil est hybride : la création numérique d’un côté, la technologie de l’autre. ClicGraph et JeeFSYS organisent ces deux dimensions — et un même projet peut passer de l’une à l’autre.',
    domainsLabel: 'Univers',
    seeProjects: 'Voir les projets {name}',
    bridgeTitle: 'ClicGraph × JeeFSYS',
    /** Parcours d'un projet entre les deux univers (modifiable). */
    flow: [
      {
        title: 'Concevoir & visualiser',
        text: 'Modélisation 3D, rendu, design graphique : l’idée prend forme.',
        side: 'clicgraph',
      },
      {
        title: 'Prototyper & fabriquer',
        text: 'Modélisation mécanique, impression 3D : l’objet devient réel.',
        side: 'both',
      },
      {
        title: 'Animer & automatiser',
        text: 'Électronique, programmation, automatismes : le système fonctionne.',
        side: 'jeefsys',
      },
    ],
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
      'informatique-industrielle': 'Informatique industrielle',
      prototypage: 'Prototypage',
    },
  },

  about: {
    eyebrow: 'À propos',
    title: 'Ibrahima Faye',
    role: 'Technicien supérieur en informatique industrielle · Concepteur 3D',
    /**
     * Biographie — sources : CV (titre, spécialités, expérience depuis 2018, formation) et ancien portfolio
     * (Dakar, ClicGraph, cybersécurité). Rien d'autre.
     */
    paragraphs: [
      'Je travaille entre deux mondes : la conception numérique et les systèmes techniques. Technicien supérieur en informatique industrielle, réseaux et automatisme, je suis aussi graphiste et concepteur 3D. Je suis basé à Dakar.',
      'Ma formation est technique : un baccalauréat T2 en électrotechnique et électronique, puis un diplôme de technicien supérieur au CNQP. Depuis 2018, je travaille aussi comme graphiste et concepteur 3D indépendant.',
      'Ce travail m’a amené sur des projets très différents : visualisations architecturales avec des architectes, des designers d’intérieur et des urbanistes, équipements urbains et espaces publics, publicité, environnements immersifs, produits, pièces techniques, prototypes — jusqu’à des moules sur mesure pour la pâtisserie.',
      'Aujourd’hui, je relie ces deux parcours : je modélise, j’imprime en 3D et je prototype, puis je programme des équipements industriels et des systèmes embarqués Arduino et ESP32. ClicGraph, mon studio créatif dédié au rendu 3D et à la conception technique, et JeeFSYS, tourné vers la robotique et l’automatisation, portent ces deux facettes.',
      'Je poursuis une licence en cybersécurité à l’UN-CHK, pour renforcer la protection des systèmes et l’intégration sécurisée des technologies intelligentes.',
    ],
    portraitAlt: 'Portrait d’Ibrahima Faye',
    /** Fiche d'identité (modifiable : Contenu du site → À propos). */
    facts: [
      {
        label: 'Formation',
        value: 'Technicien supérieur en informatique industrielle, réseaux & automatisme (CNQP)',
      },
      { label: 'Création', value: 'Graphiste & concepteur 3D indépendant depuis 2018' },
      { label: 'En cours', value: 'Licence en cybersécurité — UN-CHK' },
      { label: 'Basé à', value: 'Dakar' },
      { label: 'Univers', value: 'ClicGraph · JeeFSYS' },
    ],
    /** Parcours (modifiable : Contenu du site → À propos). kind : formation | experience. */
    timelineLabel: 'Parcours',
    timelineFormation: 'Formation',
    timelineExperience: 'Expérience',
    timeline: [
      {
        id: 'bac',
        kind: 'formation',
        period: 'Baccalauréat',
        title: 'Baccalauréat technique T2 — Électrotechnique · Électronique',
        text: 'Lycée Seydina Limamou Laye',
      },
      {
        id: 'cnqp',
        kind: 'formation',
        period: 'Diplôme',
        title: 'Technicien supérieur en informatique industrielle, réseaux & automatisme',
        text: 'CNQP',
      },
      {
        id: 'licence',
        kind: 'formation',
        period: 'En cours',
        title: 'Licence en cybersécurité',
        text: 'UN-CHK',
      },
      {
        id: 'independant',
        kind: 'experience',
        period: 'Depuis 2018',
        title: 'Graphiste & concepteur 3D indépendant',
        text: 'Projets architecturaux et industriels, publicité, environnements immersifs, produits, pièces techniques et prototypes, supports graphiques et techniques — avec des architectes, des designers d’intérieur et des urbanistes.',
      },
      {
        id: 'specialites',
        kind: 'experience',
        period: 'Spécialités',
        title: 'Automatisation, informatique industrielle & prototypage',
        text: 'Automatisation des systèmes, programmation d’équipements industriels, systèmes embarqués Arduino / ESP32, modélisation mécanique, impression 3D et solutions robotiques.',
      },
    ],
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
