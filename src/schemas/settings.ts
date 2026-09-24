/**
 * Réglages centralisés du site (src/settings/*.json), validés par le site ET par l'administration.
 *
 *   theme.json        couleurs, typographie, interface, effets, identité   (src/lib/studio/theme.ts)
 *   layout.json       sections de l'accueil : ordre, visibilité, textes…   (src/lib/studio/layout.ts)
 *   navigation.json   liens de l'en-tête, défilement, lien actif          (src/lib/studio/layout.ts)
 *   animations.json   Animation Studio                                     (src/lib/studio/animations.ts)
 *   content.json      contenu du site : textes, expertises, entités, contact… (src/lib/studio/content.ts)
 *
 * Tout est facultatif : un fichier vide (ou absent) = le site d'origine.
 * Objets « loose » : un réglage inconnu (version future) est conservé, jamais supprimé.
 */
import { z } from 'astro/zod';

const num = z.number().finite();
const responsive = z.union([
  num,
  z.looseObject({ desktop: num.optional(), tablet: num.optional(), mobile: num.optional() }),
]);
const color = z.string().max(120);

export const themeSchema = z.looseObject({
  version: z.number().optional(),
  colors: z.record(z.string(), color).optional(),
  typography: z
    .looseObject({
      display: z.string().optional(),
      body: z.string().optional(),
      headingWeight: num.min(100).max(900).optional(),
      bodyWeight: num.min(100).max(900).optional(),
      baseSize: responsive.optional(),
      lineHeight: num.min(1).max(2.5).optional(),
      headingTracking: num.min(-0.2).max(0.3).optional(),
      bodyTracking: num.min(-0.2).max(0.3).optional(),
      scale: responsive.optional(),
    })
    .optional(),
  ui: z.looseObject({}).optional(),
  effects: z.looseObject({}).optional(),
  identity: z
    .looseObject({
      name: z.string().max(80).optional(),
      initials: z.string().max(6).optional(),
      tagline: z.string().max(160).optional(),
      logo: z.string().max(200).optional(),
      favicon: z.string().max(200).optional(),
      photo: z.string().max(200).optional(),
      mark: z.enum(['monogram', 'photo', 'logo']).optional(),
    })
    .optional(),
});

const sectionSchema = z.looseObject({
  visible: z.boolean().optional(),
  anchor: z.string().max(60).optional(),
  background: z
    .looseObject({
      mode: z.enum(['default', 'none', 'color', 'gradient']).optional(),
      color: color.optional(),
      color2: color.optional(),
      angle: num.optional(),
    })
    .optional(),
  height: z.string().optional(),
  spacing: responsive.optional(),
  effects: z.boolean().optional(),
  wordmark: z.boolean().optional(),
});

export const layoutSchema = z.looseObject({
  version: z.number().optional(),
  order: z.array(z.string()).optional(),
  sections: z.record(z.string(), sectionSchema).optional(),
  content: z
    .record(z.string(), z.union([z.string().max(4000), z.array(z.string().max(4000))]))
    .optional(),
});

export const navigationSchema = z.looseObject({
  version: z.number().optional(),
  links: z
    .array(
      z.looseObject({
        id: z.string().min(1).max(60),
        label: z.string().max(60).optional(),
        target: z.string().min(1).max(300),
        mobileLabel: z.string().max(60).optional(),
        visible: z.boolean().optional(),
        button: z.boolean().optional(),
      }),
    )
    .optional(),
  scroll: z
    .looseObject({
      behavior: z.enum(['smooth', 'instant']).optional(),
      readingLine: num.min(0.05).max(0.95).optional(),
    })
    .optional(),
  active: z
    .looseObject({
      enabled: z.boolean().optional(),
      style: z.enum(['text', 'underline', 'dot']).optional(),
    })
    .optional(),
  mobile: z.looseObject({ numbered: z.boolean().optional() }).optional(),
});

const animParams = {
  duration: num.min(0).max(20).optional(),
  delay: num.min(0).max(20).optional(),
  ease: z.string().max(60).optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  distance: num.min(-2000).max(2000).optional(),
  scale: num.min(0).max(5).optional(),
  opacity: num.min(0).max(1).optional(),
  blur: num.min(0).max(100).optional(),
  rotation: num.min(-360).max(360).optional(),
  intensity: num.min(0).max(5).optional(),
  speed: num.min(-10).max(10).optional(),
  stagger: num.min(0).max(5).optional(),
  start: num.min(0).max(100).optional(),
  repeat: z.boolean().optional(),
};

export const animationsSchema = z.looseObject({
  version: z.number().optional(),
  enabled: z.boolean().optional(),
  preset: z.string().optional(),
  targets: z
    .record(
      z.string(),
      z.looseObject({
        animation: z.string().min(1),
        trigger: z.string().optional(),
        preset: z.string().optional(),
        enabled: z.boolean().optional(),
        ...animParams,
        devices: z
          .record(
            z.string(),
            z.looseObject({
              enabled: z.boolean().optional(),
              animation: z.string().optional(),
              ...animParams,
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

const text = z.string().max(8000);
const shortText = z.string().max(300);
const link = z.looseObject({ label: shortText, href: shortText });

export const contentSchema = z.looseObject({
  version: z.number().optional(),
  texts: z.record(z.string(), z.union([text, z.array(text)])).optional(),
  links: z
    .array(
      z.looseObject({
        id: z.string().min(1).max(60),
        label: shortText,
        href: shortText.optional(),
        icon: z.string().max(40).optional(),
        category: z.enum(['social', 'contact', 'other']).optional(),
        visible: z.boolean().optional(),
      }),
    )
    .optional(),
  hero: z
    .looseObject({
      description: text.optional(),
      primaryHref: shortText.optional(),
      secondaryHref: shortText.optional(),
    })
    .optional(),
  expertises: z
    .looseObject({
      items: z
        .array(
          z.looseObject({
            slug: z.string(),
            visible: z.boolean().optional(),
            extra: text.optional(),
            icon: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  ecosystem: z
    .looseObject({
      items: z
        .array(
          z.looseObject({
            id: z.string().min(1).max(60),
            name: shortText.optional(),
            role: shortText.optional(),
            description: text.optional(),
            logo: shortText.optional(),
            icon: z.string().optional(),
            href: shortText.optional(),
            button: z.boolean().optional(),
            buttonLabel: shortText.optional(),
            visible: z.boolean().optional(),
            domains: z.array(z.string()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  tools: z
    .looseObject({
      items: z
        .array(
          z.looseObject({
            id: z.string().min(1).max(60),
            name: shortText.optional(),
            icon: shortText.optional(),
            usage: shortText.optional(),
            domain: z.string().optional(),
            visible: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  about: z
    .looseObject({
      steps: z.array(z.looseObject({ title: shortText, text: text })).optional(),
      timeline: z
        .array(
          z.looseObject({
            id: z.string().min(1).max(60),
            period: shortText.optional(),
            title: shortText,
            text: text.optional(),
          }),
        )
        .optional(),
      blocks: z
        .array(
          z.looseObject({
            id: z.string().min(1).max(60),
            type: z.enum(['heading', 'text', 'list', 'quote', 'image', 'button']),
            text: text.optional(),
            items: z.array(text).optional(),
            src: shortText.optional(),
            alt: shortText.optional(),
            label: shortText.optional(),
            href: shortText.optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  contact: z
    .looseObject({
      email: shortText.optional(),
      phone: shortText.optional(),
      whatsapp: shortText.optional(),
      location: shortText.optional(),
      intro: text.optional(),
      socials: z.array(link).optional(),
      formEndpoint: shortText.optional(),
      formAccessKey: shortText.optional(),
    })
    .optional(),
  footer: z
    .looseObject({
      description: text.optional(),
      links: z.array(link).optional(),
      socials: z.boolean().optional(),
    })
    .optional(),
});

export const SETTINGS_SCHEMAS = {
  theme: themeSchema,
  layout: layoutSchema,
  navigation: navigationSchema,
  animations: animationsSchema,
  content: contentSchema,
} as const;

export type SettingsName = keyof typeof SETTINGS_SCHEMAS;
export const SETTINGS_NAMES = Object.keys(SETTINGS_SCHEMAS) as SettingsName[];
