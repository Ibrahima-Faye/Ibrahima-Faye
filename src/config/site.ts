/**
 * Identité et coordonnées du site — tout ce qui n'est PAS une phrase traduisible.
 * (Les textes de l'interface sont dans src/i18n/ui/.)
 *
 * ⚠️ Rien n'est inventé ici : les coordonnées ci-dessous sont VIDES tant
 * qu'elles n'ont pas été renseignées. Une coordonnée vide n'est simplement pas affichée.
 *
 * Photo portrait : déposer `src/assets/portrait.jpg` (ou .png / .webp / .avif) — détectée automatiquement.
 *
 * Nom affiché et symbole : modifiables dans l'administration (Studio → Thème → Identité,
 * src/settings/theme.json) ; les valeurs ci-dessous restent la référence.
 */
import { settings } from '@/lib/settings';

const identity = settings.theme.identity ?? {};
/** Coordonnées modifiées dans l'administration (Contenu du site → Contact) : prioritaires. */
const contact = settings.content.contact ?? {};
const pick = (own: string | undefined, fallback: string) =>
  own === undefined ? fallback : own.trim();

export interface SocialLink {
  /** Nom affiché, ex. « LinkedIn » */
  label: string;
  /** URL complète, ex. https://www.linkedin.com/in/... */
  href: string;
}

export interface SiteConfig {
  /** Nom de la personne — utilisé dans le Hero, le titre, le SEO. */
  name: string;
  /** Monogramme affiché dans le header et le portrait de remplacement. */
  initials: string;
  contact: {
    /** Adresse e-mail publique (affichée et utilisée pour le lien « Écrire »). */
    email: string;
    /** Numéro affiché + lien tel:, ex. '+221 ...'. Laisser vide pour ne pas l'afficher. */
    phone: string;
    /** Lien WhatsApp complet, ex. 'https://wa.me/221XXXXXXXXX'. */
    whatsapp: string;
    /**
     * Endpoint d'un service de formulaire sans serveur (Web3Forms, Formspree, Getform…).
     * Vide = pas de formulaire affiché, seulement les coordonnées ci-dessus.
     */
    formEndpoint: string;
    /** Clé d'accès si le service en demande une (Web3Forms : access_key). */
    formAccessKey: string;
    /** Localisation affichée (ville, pays…). Vide = non affichée. */
    location: string;
  };
  /** Réseaux / profils. Ajouter, retirer ou réordonner librement. */
  socials: SocialLink[];
}

/**
 * Valeurs de référence (écrites ici, dans le code). L'administration (Studio → Identité,
 * Contenu du site → Contact) peut les remplacer ; sans réglage, ce sont elles qui s'affichent.
 */
export const siteDefaults: SiteConfig = {
  name: 'Ibrahima Faye',
  initials: 'IF',

  contact: {
    email: '',
    phone: '',
    whatsapp: '',
    formEndpoint: '',
    formAccessKey: '',
    location: '',
  },

  socials: [
    // { label: 'LinkedIn', href: 'https://www.linkedin.com/in/...' },
    // { label: 'Instagram', href: 'https://www.instagram.com/...' },
    // { label: 'GitHub', href: 'https://github.com/...' },
  ],
};

const base = siteDefaults;
export const site: SiteConfig = {
  name: identity.name?.trim() || base.name,
  initials: identity.initials?.trim() || base.initials,
  contact: {
    email: pick(contact.email, base.contact.email),
    phone: pick(contact.phone, base.contact.phone),
    whatsapp: pick(contact.whatsapp, base.contact.whatsapp),
    formEndpoint: pick(contact.formEndpoint, base.contact.formEndpoint),
    formAccessKey: pick(contact.formAccessKey, base.contact.formAccessKey),
    location: pick(contact.location, base.contact.location),
  },
  socials: contact.socials?.filter((x) => x.label?.trim() && x.href?.trim()) ?? base.socials,
};
