/**
 * Icônes des liens (réseaux, contact) — trait fin 24×24, même style que les autres icônes du site.
 * Une seule source : le site (src/components/ui/LinkIcon.astro) et l'administration (choix de l'icône).
 * Ajouter une icône = une entrée ici. Aucune dépendance externe.
 */
export const LINK_ICONS = {
  instagram: {
    label: 'Instagram',
    path: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5v.01"/>',
  },
  linkedin: {
    label: 'LinkedIn',
    path: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.2v.01M12 17v-6.5M12 13.5a2.5 2.5 0 0 1 5 0V17"/>',
  },
  github: {
    label: 'GitHub',
    path: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.4a3 3 0 0 0-.9-2.4c3-.3 6-1.4 6-6.5a5 5 0 0 0-1.4-3.5 4.7 4.7 0 0 0-.1-3.5s-1.1-.3-3.6 1.3a12.4 12.4 0 0 0-6.4 0C6.1 1.4 5 1.7 5 1.7a4.7 4.7 0 0 0-.1 3.5 5 5 0 0 0-1.4 3.5c0 5 3 6.2 6 6.5a3 3 0 0 0-.9 2.4V21"/>',
  },
  youtube: {
    label: 'YouTube',
    path: '<path d="M22 8.2a3 3 0 0 0-2.1-2.1C18.1 5.6 12 5.6 12 5.6s-6.1 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.8.5 7.9.5 7.9.5s6.1 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8z"/><path d="m10 15 5-3-5-3z"/>',
  },
  whatsapp: {
    label: 'WhatsApp',
    path: '<path d="M3.5 20.5 5 16.2A8.5 8.5 0 1 1 8.2 19z"/><path d="M9.2 8.3c.2 3.3 3.1 6.2 6.4 6.4l1.1-1.4-2.1-1-1 .8a4 4 0 0 1-2.6-2.6l.8-1-1-2.1z"/>',
  },
  facebook: {
    label: 'Facebook',
    path: '<path d="M17 2.5h-2.8A4.7 4.7 0 0 0 9.5 7.2V10H7v3.8h2.5v7.7h3.8v-7.7H16l.8-3.8h-3.5V7.5a1 1 0 0 1 1-1H17z"/>',
  },
  x: {
    label: 'X (Twitter)',
    path: '<path d="M4 4h4.6L20 20h-4.6zM19.5 4l-6.8 7.6M4.5 20l6.8-7.6"/>',
  },
  tiktok: {
    label: 'TikTok',
    path: '<path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5M14 3.5c.6 2.6 2.4 4.2 5 4.4"/>',
  },
  behance: {
    label: 'Behance',
    path: '<path d="M2.5 6.5h5a2.6 2.6 0 0 1 0 5.2h-5zM2.5 11.7h5.8a2.9 2.9 0 0 1 0 5.8H2.5zM2.5 6.5v11M14 14h7.5a3.8 3.8 0 1 0-1.1 2.7M15 7.5h5"/>',
  },
  dribbble: {
    label: 'Dribbble',
    path: '<circle cx="12" cy="12" r="9"/><path d="M8.6 3.7c3.1 4.1 5.1 9 5.9 16.5M3.1 10.4c5.6.3 11.1-1.1 15.6-4.6M5.7 18.3c3.1-4.4 8.7-6 15.1-4.5"/>',
  },
  telegram: {
    label: 'Telegram',
    path: '<path d="M21 4.5 3 11.2l6.2 2.2 2.3 6.1 3.3-4.1 5.3 4z"/><path d="m9.2 13.4 11.8-8.9"/>',
  },
  mail: {
    label: 'E-mail',
    path: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  },
  phone: {
    label: 'Téléphone',
    path: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  },
  message: { label: 'Message', path: '<path d="M4 5h16v11H9l-5 4z"/>' },
  pin: {
    label: 'Localisation',
    path: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  },
  globe: {
    label: 'Site web',
    path: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  },
  link: {
    label: 'Lien',
    path: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  },
} as const;

export type LinkIconName = keyof typeof LINK_ICONS;

export const isLinkIcon = (name: unknown): name is LinkIconName =>
  typeof name === 'string' && name in LINK_ICONS;
