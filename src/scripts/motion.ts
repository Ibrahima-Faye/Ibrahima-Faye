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
 *   data-connector           Écosystème : noyau d’identité, flux lumineux, pôles ClicGraph / JeeFSYS
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
  // (sauf si l'Animation Studio a repris la section ou le fond : data-anim-owned)
  const scrollTrigger = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
  if (content && !hero.hasAttribute('data-anim-owned'))
    gsap.to(content, { yPercent: -14, opacity: 0.05, ease: 'none', scrollTrigger });
  if (canvas && !canvas.closest('[data-anim-owned]'))
    gsap.to(canvas, { yPercent: 12, scale: 1.06, ease: 'none', scrollTrigger });
}

/**
 * Écosystème : noyau d'identité (Ibrahima Faye) → deux pôles (ClicGraph, JeeFSYS).
 * Entrée : noyau (échelle + flou + opacité), halo qui se stabilise, flux lumineux dessinés vers les pôles,
 * pôles puis domaines en décalé. Ensuite : légère parallaxe à la souris, lueur qui suit le pointeur sur
 * chaque pôle (pointeur fin uniquement). Si l'Animation Studio a repris ce bloc, il décide seul.
 */
function setupEcosystem(): () => void {
  const root = document.querySelector<HTMLElement>('[data-connector]');
  if (!root || root.hasAttribute('data-anim-owned') || root.closest('[data-anim-owned]'))
    return () => {};
  const core = root.querySelector<HTMLElement>('[data-core]');
  const halo = root.querySelector<HTMLElement>('[data-core-halo]');
  const rings = root.querySelector<SVGElement>('[data-core-rings]');
  const mark = root.querySelector<HTMLElement>('[data-core-mark]');
  const name = root.querySelector<HTMLElement>('.eco-core-name');
  const links = q<SVGPathElement>('[data-link]', root);
  const pulses = q<SVGPathElement>('[data-pulse]', root);
  const terminals = q<SVGCircleElement>('.eco-terminal', root);
  const poles = q('[data-panel]', root);

  const tl = gsap.timeline({
    scrollTrigger: { trigger: root, start: 'top 78%', once: true },
    defaults: { ease: 'expo.out' },
  });
  if (core)
    tl.fromTo(
      core,
      { opacity: 0, scale: 0.72, filter: 'blur(14px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.5, clearProps: 'filter' },
      0,
    );
  if (halo)
    tl.fromTo(
      halo,
      { opacity: 0, scale: 1.7 },
      { opacity: 1, scale: 1, duration: 2.2, ease: 'power2.out', clearProps: 'opacity' },
      0.1,
    );
  if (rings)
    tl.fromTo(rings, { opacity: 0, rotate: -50 }, { opacity: 1, rotate: 0, duration: 2 }, 0.15);
  if (mark)
    tl.fromTo(mark, { scale: 0.6, rotate: -20 }, { scale: 1, rotate: 0, duration: 1.4 }, 0.25);
  if (name) tl.fromTo(name, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1 }, 0.7);
  if (links.length) {
    gsap.set(links, { strokeDasharray: '1 1' });
    tl.fromTo(
      links,
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', stagger: 0.12 },
      0.75,
    );
    // les filaments reprennent leur pointillé une fois dessinés
    tl.add(() =>
      links.forEach(
        (l) => l.classList.contains('eco-filament') && l.style.removeProperty('stroke-dasharray'),
      ),
    );
  }
  if (terminals.length)
    tl.fromTo(terminals, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.12 }, 1.9);
  if (pulses.length)
    tl.fromTo(
      pulses,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.8, clearProps: 'opacity,visibility' },
      1.9,
    );
  poles.forEach((pole, i) => {
    tl.fromTo(
      pole,
      { opacity: 0, y: 44, filter: 'blur(10px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, clearProps: 'transform,filter' },
      1.05 + i * 0.2,
    );
    const domains = q('.eco-domain', pole);
    if (domains.length)
      tl.fromTo(
        domains,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, clearProps: 'transform' },
        1.55 + i * 0.2,
      );
  });

  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  // parallaxe : le noyau et les pôles glissent en sens opposés, très légèrement
  const layers = q('[data-parallax-depth]', root).map((el) => ({
    depth: Number(el.dataset.parallaxDepth) || 0,
    x: gsap.quickTo(el, 'x', { duration: 1.1, ease: 'power3' }),
    y: gsap.quickTo(el, 'y', { duration: 1.1, ease: 'power3' }),
  }));
  const onMove = (e: PointerEvent) => {
    const r = root.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    layers.forEach((l) => {
      l.x(nx * 14 * l.depth);
      l.y(ny * 10 * l.depth);
    });
  };
  const onLeave = () => layers.forEach((l) => (l.x(0), l.y(0)));
  // lueur qui suit le pointeur dans chaque pôle
  const onPole = (e: PointerEvent) => {
    const pole = e.currentTarget as HTMLElement;
    const r = pole.getBoundingClientRect();
    pole.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    pole.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);
  poles.forEach((p) => p.addEventListener('pointermove', onPole));
  return () => {
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    poles.forEach((p) => p.removeEventListener('pointermove', onPole));
  };
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
      const cleanEcosystem = setupEcosystem();
      const cleanMagnetic = setupMagnetic();
      const cleanRefresh = setupRefresh();
      return () => {
        cleanEcosystem();
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
