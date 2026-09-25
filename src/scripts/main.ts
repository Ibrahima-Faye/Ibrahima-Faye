/**
 * Point d'entrée unique du JavaScript du site.
 *
 * Avec le routeur de transitions d'Astro, la page n'est jamais rechargée :
 * `astro:page-load` se déclenche à chaque page affichée, `astro:before-swap`
 * juste avant qu'elle soit remplacée → on initialise puis on nettoie proprement.
 */
import { initMotion } from './motion';
import { initHeader } from './header';
import { initNavigation } from './navigation';
import { initFilters } from './filters';
import { initLightbox, initGalleryVideos } from './lightbox';
import { initCarousels } from './carousel';
import { initContactForm } from './contact-form';
import { initExpertises } from './expertises';
import { mountHeroField } from './hero-field';
import { initCursor } from './cursor';
import { initStudio, readAnimations } from './studio/runtime';

let cleanups: Array<() => void> = [];

function dispose() {
  cleanups.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.error('[cleanup]', error);
    }
  });
  cleanups = [];
}

function init() {
  dispose();
  delete document.documentElement.dataset.motion;

  initLightbox(); // écouteurs globaux, installés une seule fois

  cleanups.push(initHeader());
  cleanups.push(initFilters());
  cleanups.push(initContactForm());
  cleanups.push(initGalleryVideos());
  cleanups.push(initCarousels());
  cleanups.push(initExpertises());

  cleanups.push(initCursor());

  // champ 3D du Hero : coupé si « particules » est désactivé dans le thème
  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (canvas && document.documentElement.dataset.particles !== 'off')
    cleanups.push(mountHeroField(canvas));

  // Animation Studio (src/settings/animations.json) : d'abord les éléments réglés, puis les animations
  // d'origine pour tout le reste. « Animations désactivées » : tout le contenu reste simplement visible.
  const animations = readAnimations();
  if (animations.enabled === false) document.documentElement.dataset.motion = 'off';
  else {
    cleanups.push(initStudio(animations));
    cleanups.push(initMotion());
  }
  // après les animations : les titres sont découpés, les positions sont celles de la page finale
  cleanups.push(initNavigation());
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', dispose);

// Aperçu du Studio (administration locale) : réglages appliqués en direct. Absent du site publié.
if (import.meta.env.DEV) {
  document.addEventListener('studio:reinit', init);
  void import('./studio/bridge');
}
