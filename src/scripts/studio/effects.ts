/**
 * Rendu des effets de l'Animation Studio (GSAP). Une fonction par famille d'effets ;
 * chaque effet renvoie de quoi se nettoyer (écouteurs), les tweens sont repris par le contexte GSAP.
 * Ajouter un effet : l'entrée dans src/lib/studio/animations.ts + son cas ici.
 */
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { AnimParams, AnimationDef, TargetKind, Trigger } from '@/lib/studio/animations';

export type Resolved = AnimParams & { animation: AnimationDef; trigger: Trigger };

type Cleanup = () => void;
const noop: Cleanup = () => {};

/** Unités animées : les enfants pour une liste, sinon l'élément lui-même. */
function units(el: HTMLElement, kind: TargetKind): HTMLElement[] {
  if (kind === 'items') {
    const children = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
    return children.length ? children : [el];
  }
  return [el];
}

function scrollTrigger(
  el: HTMLElement,
  p: Resolved,
): gsap.plugins.ScrollTriggerInstanceVars | undefined {
  if (p.trigger === 'load') return undefined;
  if (p.trigger === 'scrub')
    return { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true };
  return {
    trigger: el,
    start: `top ${p.start}%`,
    toggleActions: p.repeat ? 'play reverse play reverse' : 'play none none none',
    once: !p.repeat,
  };
}

/** Décalage de départ selon la direction (« slide up » = vient du bas). */
function offset(direction: string, distance: number) {
  switch (direction) {
    case 'down':
      return { y: -distance };
    case 'left':
      return { x: distance };
    case 'right':
      return { x: -distance };
    default:
      return { y: distance };
  }
}

const CLIP_FROM: Record<string, string> = {
  up: 'inset(100% 0% 0% 0%)',
  down: 'inset(0% 0% 100% 0%)',
  left: 'inset(0% 0% 0% 100%)',
  right: 'inset(0% 100% 0% 0%)',
};

function entrance(el: HTMLElement, p: Resolved, kind: TargetKind): Cleanup {
  const targets = units(el, kind);
  const id = p.animation.id;
  let from: gsap.TweenVars = { opacity: p.opacity };
  let to: gsap.TweenVars = { opacity: 1 };

  if (id.startsWith('slide-')) {
    from = { ...offset(id.slice(6), p.distance), opacity: p.opacity };
    to = { x: 0, y: 0, opacity: 1 };
  } else if (id === 'scale-in' || id === 'scale-out') {
    from = { scale: p.scale, opacity: p.opacity };
    to = { scale: 1, opacity: 1 };
  } else if (id === 'blur-reveal') {
    from = { filter: `blur(${p.blur}px)`, opacity: 0, y: p.distance * 0.3 };
    to = { filter: 'blur(0px)', opacity: 1, y: 0 };
  } else if (id === 'clip-reveal') {
    from = { clipPath: CLIP_FROM[p.direction] ?? CLIP_FROM.up };
    to = { clipPath: 'inset(0% 0% 0% 0%)' };
  } else if (id === 'mask-reveal') {
    from = { clipPath: 'circle(0% at 50% 50%)' };
    to = { clipPath: 'circle(75% at 50% 50%)' };
  }

  gsap.fromTo(targets, from, {
    ...to,
    duration: p.duration,
    delay: p.delay,
    ease: p.ease,
    stagger: targets.length > 1 ? p.stagger : 0,
    scrollTrigger: scrollTrigger(el, p),
    clearProps: p.repeat ? undefined : 'transform,filter,clipPath',
  });
  return noop;
}

function imageReveal(el: HTMLElement, p: Resolved): Cleanup {
  const media = el.querySelector<HTMLElement>('img, video, canvas') ?? el;
  const tl = gsap.timeline({ delay: p.delay, scrollTrigger: scrollTrigger(el, p) });
  tl.fromTo(
    el,
    { clipPath: CLIP_FROM[p.direction] ?? CLIP_FROM.up },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: p.duration, ease: p.ease },
  );
  if (media !== el)
    tl.fromTo(media, { scale: p.scale }, { scale: 1, duration: p.duration * 1.3, ease: p.ease }, 0);
  return noop;
}

function text(el: HTMLElement, p: Resolved): Cleanup {
  const id = p.animation.id;
  const type = p.animation.split ?? 'lines';
  const masked = id === 'text-reveal' || id === 'char-reveal';
  gsap.set(el, { opacity: 1 });
  SplitText.create(el, {
    type: type === 'chars' ? 'words,chars' : type,
    mask: masked ? (type === 'chars' ? 'chars' : 'lines') : undefined,
    autoSplit: true,
    onSplit(self) {
      self.masks.forEach((mask) => {
        const m = mask as HTMLElement;
        m.style.overflow = 'clip';
        m.style.overflowClipMargin = '0.16em';
      });
      const parts = type === 'chars' ? self.chars : type === 'words' ? self.words : self.lines;
      let from: gsap.TweenVars;
      if (id === 'text-reveal') from = { yPercent: p.direction === 'down' ? -110 : 110 };
      else if (id === 'char-reveal') from = { yPercent: 115, rotate: p.rotation };
      else if (id === 'word-reveal')
        from = {
          opacity: p.opacity,
          filter: `blur(${p.blur}px)`,
          y: p.trigger === 'scrub' ? 0 : 12,
        };
      else from = { y: p.distance * 0.5, opacity: p.opacity };

      if (p.trigger === 'scrub')
        return gsap.from(parts, {
          ...from,
          ease: 'none',
          stagger: p.stagger,
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 50%', scrub: 0.6 },
        });
      return gsap.from(parts, {
        ...from,
        duration: p.duration,
        delay: p.delay,
        ease: p.ease,
        stagger: p.stagger,
        scrollTrigger: scrollTrigger(el, p),
      });
    },
  });
  return noop;
}

function scrub(el: HTMLElement, p: Resolved): Cleanup {
  const id = p.animation.id;
  const st = { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true };
  if (id === 'parallax') {
    const amount = p.speed * 90;
    const axis = p.direction === 'left' || p.direction === 'right' ? 'x' : 'y';
    const sign = p.direction === 'down' || p.direction === 'right' ? -1 : 1;
    gsap.fromTo(
      el,
      { [axis]: -amount * sign },
      { [axis]: amount * sign, ease: 'none', scrollTrigger: st },
    );
  } else if (id === 'zoom-scroll') {
    gsap.fromTo(el, { scale: 1 }, { scale: p.scale, ease: 'none', scrollTrigger: st });
  } else if (id === 'horizontal') {
    const sign = p.direction === 'right' ? -1 : 1;
    gsap.fromTo(
      el,
      { x: p.distance * sign },
      { x: -p.distance * sign, ease: 'none', scrollTrigger: st },
    );
  } else if (id === 'fade-out') {
    gsap.to(el, {
      opacity: p.opacity,
      ease: p.ease,
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
    });
  }
  return noop;
}

function sectionTransition(el: HTMLElement, p: Resolved): Cleanup {
  const from = {
    scale: p.scale,
    opacity: p.opacity,
    filter: `blur(${p.blur}px)`,
    borderRadius: '2rem',
    transformOrigin: '50% 0%',
  };
  const to = { scale: 1, opacity: 1, filter: 'blur(0px)', borderRadius: '0rem' };
  if (p.trigger === 'scrub')
    gsap.fromTo(el, from, {
      ...to,
      ease: p.ease,
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 35%', scrub: true },
    });
  else
    gsap.fromTo(el, from, {
      ...to,
      duration: p.duration,
      ease: p.ease,
      scrollTrigger: scrollTrigger(el, p),
      clearProps: 'transform,filter,borderRadius',
    });
  return noop;
}

function marquee(el: HTMLElement, p: Resolved): Cleanup {
  // bandeau CSS du site : vitesse et sens réglés par variables (voir .marquee-track)
  if (el.classList.contains('marquee-track')) {
    el.style.setProperty(
      '--marquee-duration',
      `${Math.max(4, 60 / Math.max(0.05, Math.abs(p.speed)))}s`,
    );
    el.style.setProperty('--marquee-direction', p.direction === 'right' ? 'reverse' : 'normal');
    return () => {
      el.style.removeProperty('--marquee-duration');
      el.style.removeProperty('--marquee-direction');
    };
  }
  // autre élément : léger va-et-vient horizontal continu
  const sign = p.direction === 'right' ? 1 : -1;
  gsap.to(el, {
    x: sign * 40,
    duration: 6 / Math.max(0.05, p.speed),
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });
  return noop;
}

const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

function hover(el: HTMLElement, p: Resolved, kind: TargetKind): Cleanup {
  if (!finePointer()) return noop;
  const id = p.animation.id;
  const targets = kind === 'items' ? units(el, kind) : [el];
  const cleanups: Cleanup[] = [];
  let filterId = '';
  if (id === 'image-distortion') filterId = distortionFilter();

  for (const target of targets) {
    const on = (type: string, fn: (e: PointerEvent) => void) => {
      target.addEventListener(type, fn as EventListener);
      cleanups.push(() => target.removeEventListener(type, fn as EventListener));
    };
    if (id === 'magnetic') {
      const xTo = gsap.quickTo(target, 'x', { duration: p.duration, ease: 'power3' });
      const yTo = gsap.quickTo(target, 'y', { duration: p.duration, ease: 'power3' });
      on('pointermove', (e) => {
        const r = target.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * p.intensity);
        yTo((e.clientY - (r.top + r.height / 2)) * p.intensity * 1.3);
      });
      on('pointerleave', () => {
        xTo(0);
        yTo(0);
      });
    } else if (id === 'hover-scale' || id === 'hover-lift') {
      const vars = id === 'hover-scale' ? { scale: p.scale } : { y: -p.distance };
      on('pointerenter', () =>
        gsap.to(target, { ...vars, duration: p.duration, ease: p.ease, overwrite: 'auto' }),
      );
      on('pointerleave', () =>
        gsap.to(target, { scale: 1, y: 0, duration: p.duration, ease: p.ease, overwrite: 'auto' }),
      );
    } else if (id === 'hover-tilt') {
      gsap.set(target, { transformPerspective: 900 });
      on('pointermove', (e) => {
        const r = target.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -2 * p.rotation;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 2 * p.rotation;
        gsap.to(target, {
          rotateX: rx,
          rotateY: ry,
          duration: p.duration,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      });
      on('pointerleave', () =>
        gsap.to(target, {
          rotateX: 0,
          rotateY: 0,
          duration: p.duration,
          ease: 'power3.out',
          overwrite: 'auto',
        }),
      );
    } else if (id === 'image-distortion') {
      const media = target.querySelector<HTMLElement>('img, video') ?? target;
      const map = document.querySelector<SVGFEDisplacementMapElement>(
        `#${filterId} feDisplacementMap`,
      );
      media.style.filter = `url(#${filterId})`;
      cleanups.push(() => (media.style.filter = ''));
      const state = { scale: 0 };
      const render = () => map?.setAttribute('scale', String(state.scale));
      on('pointerenter', () =>
        gsap.to(state, {
          scale: p.intensity * 60,
          duration: p.duration * 0.4,
          ease: 'power2.out',
          onUpdate: render,
        }),
      );
      on('pointerleave', () =>
        gsap.to(state, { scale: 0, duration: p.duration, ease: 'power3.out', onUpdate: render }),
      );
    }
  }
  return () => cleanups.forEach((fn) => fn());
}

/** Filtre SVG de distorsion (une seule fois par page). */
function distortionFilter(): string {
  const id = 'studio-distortion';
  if (!document.getElementById(id)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    document.body.append(svg);
  }
  return id;
}

/** Applique un effet à un élément. */
export function applyEffect(el: HTMLElement, p: Resolved, kind: TargetKind): Cleanup {
  switch (p.animation.category) {
    case 'text':
      return text(el, p);
    case 'hover':
      return hover(el, p, kind);
    case 'loop':
      return marquee(el, p);
    case 'section':
      return sectionTransition(el, p);
    case 'scroll':
      return scrub(el, p);
    default:
      return p.animation.id === 'image-reveal' ? imageReveal(el, p) : entrance(el, p, kind);
  }
}
