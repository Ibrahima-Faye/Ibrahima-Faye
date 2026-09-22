import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Toutes les animations GSAP du site, pilotées par des attributs HTML :
 *
 *   data-reveal              apparition (fondu + montée), en cascade par lot
 *   data-reveal="fade"       fondu simple
 *   data-reveal="mask"       ouverture en balayage (images, cartes)
 *   data-split="lines"       titre découpé en lignes, révélé ligne par ligne
 *   data-split="scrub"       texte dont les mots s'allument au scroll
 *   data-parallax="0.4"      décalage vertical au scroll (vitesse relative)
 *   data-magnetic            bouton légèrement attiré par le pointeur
 *   data-intro / data-hero-* séquence d'entrée du Hero
 *   data-connector           trait qui relie Ibrahima à ClicGraph / JeeFSYS
 *
 * `prefers-reduced-motion: reduce` : rien de tout cela ne s'exécute et le CSS
 * laisse tout le contenu visible.
 */

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/**
 * Les masques de SplitText rognent au ras de la boîte de ligne : avec un interlignage serré
 * et un crénage négatif, accents, cédilles et bords de lettres sont coupés.
 * `overflow-clip-margin` élargit la zone visible sans changer la mise en page.
 */
function softenMasks(split: SplitText) {
  split.masks.forEach((mask) => {
    const el = mask as HTMLElement;
    el.style.overflow = 'clip';
    el.style.overflowClipMargin = '0.16em';
  });
}

function setupReveals() {
  // Éléments déjà visibles au chargement inclus : le lot se déclenche immédiatement.
  ScrollTrigger.batch(q('[data-reveal]:not([data-reveal="mask"])'), {
    start: 'top 92%',
    once: true,
    batchMax: 8,
    interval: 0.08,
    onEnter: (els) =>
      gsap.fromTo(
        els,
        { opacity: 0, y: (_, el: HTMLElement) => (el.dataset.reveal === 'fade' ? 0 : 36) },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.09,
          overwrite: true,
          clearProps: 'transform',
        },
      ),
  });

  q('[data-reveal="mask"]').forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: 'inset(0 0 100% 0)' },
      {
        clipPath: 'inset(0 0 0% 0)',
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      },
    );
  });
}

function setupSplits() {
  q('[data-split]').forEach((el) => {
    const mode = el.dataset.split;

    if (mode === 'scrub') {
      SplitText.create(el, {
        type: 'words',
        autoSplit: true,
        onSplit(self) {
          gsap.set(el, { opacity: 1 });
          return gsap.fromTo(
            self.words,
            { opacity: 0.12 },
            {
              opacity: 1,
              ease: 'none',
              stagger: 0.06,
              scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 50%', scrub: 0.6 },
            },
          );
        },
      });
      return;
    }

    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        softenMasks(self);
        gsap.set(el, { opacity: 1 });
        return gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.11,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });
}

function setupParallax() {
  q('[data-parallax]').forEach((el) => {
    const speed = parseFloat(el.dataset.parallax ?? '0.3') || 0.3;
    const scope = el.closest<HTMLElement>('[data-parallax-scope]') ?? el.parentElement ?? el;
    gsap.fromTo(
      el,
      { y: () => -speed * 90 },
      {
        y: () => speed * 90,
        ease: 'none',
        scrollTrigger: { trigger: scope, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

function setupHero() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;

  const name = hero.querySelector<HTMLElement>('[data-hero-name]');
  const lines = q('[data-hero-line]', hero);
  const fades = q('[data-intro="fade"]', hero);
  const canvas = hero.querySelector<HTMLElement>('[data-hero-canvas]');

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });

  if (canvas)
    tl.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 2.4, ease: 'power2.out' }, 0);

  if (name) {
    // `words` : garde chaque mot insécable (sinon « IBRAHIMA » se coupe au milieu sur mobile)
    const split = SplitText.create(name, { type: 'words,chars', mask: 'chars' });
    softenMasks(split);
    gsap.set(name, { opacity: 1 });
    tl.from(split.chars, { yPercent: 115, duration: 1.4, stagger: 0.035 }, 0.1);
  }

  if (lines.length) {
    gsap.set(lines, { opacity: 1 });
    tl.from(lines, { yPercent: 115, duration: 1.3, stagger: 0.14 }, 0.55);
  }

  if (fades.length) {
    tl.fromTo(
      fades,
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, clearProps: 'transform' },
      0.9,
    );
  }

  // Le contenu s'éloigne et s'estompe au scroll ; le champ 3D dérive plus lentement (profondeur).
  const content = hero.querySelector<HTMLElement>('[data-hero-content]');
  const scrollTrigger = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
  if (content) gsap.to(content, { yPercent: -14, opacity: 0.05, ease: 'none', scrollTrigger });
  if (canvas) gsap.to(canvas, { yPercent: 12, scale: 1.06, ease: 'none', scrollTrigger });
}

function setupConnector() {
  const root = document.querySelector<HTMLElement>('[data-connector]');
  if (!root) return;
  const lines = q('[data-line]', root);
  const panels = q('[data-panel]', root);

  const tl = gsap.timeline({
    scrollTrigger: { trigger: root, start: 'top 75%', once: true },
    defaults: { ease: 'power3.inOut' },
  });
  lines.forEach((line) => {
    const axis = line.dataset.line === 'bar' ? { scaleX: 0 } : { scaleY: 0 };
    const origin = line.dataset.line === 'bar' ? '50% 50%' : '50% 0%';
    gsap.set(line, { transformOrigin: origin });
    tl.fromTo(line, axis, { scaleX: 1, scaleY: 1, duration: 0.7 }, line.dataset.at ?? '>-0.2');
  });
  panels.forEach((panel, i) => {
    tl.fromTo(
      panel,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform' },
      1.1 + i * 0.15,
    );
  });
}

/** Boutons « magnétiques » — pointeur fin uniquement. */
function setupMagnetic(): () => void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const cleanups: Array<() => void> = [];

  q('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

/** Ré-évalue les positions quand les polices ou les images ont fini de charger. */
function setupRefresh(): () => void {
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  window.addEventListener('load', refresh, { once: true });
  return () => window.removeEventListener('load', refresh);
}

export function initMotion(): () => void {
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    try {
      setupSplits();
      setupHero();
      setupReveals();
      setupParallax();
      setupConnector();
      const cleanMagnetic = setupMagnetic();
      const cleanRefresh = setupRefresh();
      return () => {
        cleanMagnetic();
        cleanRefresh();
      };
    } catch (error) {
      // Filet de sécurité : si une animation échoue, le contenu doit rester visible.
      console.error('[motion]', error);
      document.documentElement.dataset.motion = 'off';
    }
  });

  return () => {
    mm.revert();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
}

export { gsap, ScrollTrigger };
