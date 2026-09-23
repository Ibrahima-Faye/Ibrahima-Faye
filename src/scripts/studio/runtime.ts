/**
 * Animation Studio — côté site. Lit les réglages (src/settings/animations.json, rendus dans la page par
 * BaseLayout), prend en charge les éléments réglés et laisse TOUS les autres à src/scripts/motion.ts.
 *
 * Prise en charge d'un élément : ses attributs d'animation d'origine (data-reveal, data-split…) sont
 * retirés le temps de la page, puis remis au nettoyage — retirer un réglage rend l'animation d'origine.
 * Appareils : gsap.matchMedia (mobile < 768 px ≤ tablette < 1024 px ≤ ordinateur) ; mouvement réduit respecté.
 */
import gsap from 'gsap';
import {
  resolveAnimation,
  targetById,
  type AnimationsSettings,
  type DeviceKey,
  type TargetKind,
} from '@/lib/studio/animations';
import { applyEffect } from './effects';

/** Attributs des animations d'origine (motion.ts). `data-hero` / `data-connector` restent : ce sont des conteneurs. */
const LEGACY = [
  'data-reveal',
  'data-split',
  'data-intro',
  'data-hero-name',
  'data-hero-line',
  'data-panel',
  'data-magnetic',
];

declare global {
  interface Window {
    /** Réglages en cours d'édition (aperçu de l'administration). */
    __studioAnimations?: AnimationsSettings;
  }
}

export function readAnimations(): AnimationsSettings {
  if (window.__studioAnimations) return window.__studioAnimations;
  try {
    return JSON.parse(document.getElementById('site-animations')?.textContent || '{}');
  } catch {
    return {};
  }
}

export function elementsFor(id: string): HTMLElement[] {
  const selector = id === 'buttons' ? '.btn' : `[data-anim="${CSS.escape(id)}"]`;
  return [...document.querySelectorAll<HTMLElement>(selector)];
}

/** Retire les attributs d'origine de l'élément (et de son contenu, sauf pour une section entière). */
function own(el: HTMLElement, kind: TargetKind): () => void {
  const saved: [Element, string, string][] = [];
  const scope: Element[] =
    kind === 'section'
      ? [el]
      : [el, ...el.querySelectorAll(LEGACY.map((attr) => `[${attr}]`).join(','))];
  for (const node of scope) {
    for (const attr of LEGACY) {
      const value = node.getAttribute(attr);
      if (value === null) continue;
      saved.push([node, attr, value]);
      node.removeAttribute(attr);
    }
  }
  el.setAttribute('data-anim-owned', '');
  return () => {
    saved.forEach(([node, attr, value]) => node.setAttribute(attr, value));
    el.removeAttribute('data-anim-owned');
  };
}

export function initStudio(config: AnimationsSettings = readAnimations()): () => void {
  const ids = Object.entries(config.targets ?? {})
    .filter(([, setting]) => setting && setting.enabled !== false)
    .map(([id]) => id);
  if (!ids.length) return () => {};

  const restores: Array<() => void> = [];
  for (const id of ids) {
    const kind = targetById(id)?.kind ?? 'block';
    for (const el of elementsFor(id)) restores.push(own(el, kind));
  }

  const mm = gsap.matchMedia();
  mm.add(
    {
      reduce: '(prefers-reduced-motion: reduce)',
      mobile: '(max-width: 47.99rem)',
      tablet: '(min-width: 48rem) and (max-width: 63.99rem)',
      desktop: '(min-width: 64rem)',
    },
    (context) => {
      const c = context.conditions ?? {};
      if (c.reduce) return;
      const device: DeviceKey = c.mobile ? 'mobile' : c.tablet ? 'tablet' : 'desktop';
      const cleanups: Array<() => void> = [];
      for (const id of ids) {
        const params = resolveAnimation(config, id, device);
        if (!params) continue; // coupé sur cet appareil : élément affiché sans animation
        const kind = targetById(id)?.kind ?? 'block';
        for (const el of elementsFor(id)) {
          try {
            cleanups.push(applyEffect(el, params, kind));
          } catch (error) {
            console.error('[studio]', id, error); // un effet en échec ne doit rien masquer
            gsap.set(el, { clearProps: 'all' });
          }
        }
      }
      return () => cleanups.forEach((fn) => fn());
    },
  );

  return () => {
    mm.revert();
    restores.forEach((fn) => fn());
  };
}
