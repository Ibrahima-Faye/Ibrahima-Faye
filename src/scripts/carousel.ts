/**
 * Carrousels (blocs `carousel`) et vidéos en lecture automatique des galeries.
 *
 * Carrousel = défilement horizontal natif (scroll-snap) : le doigt, le pavé tactile et la molette horizontale
 * fonctionnent sans script. Ce script ajoute :
 *  - flèches ‹ › (désactivées aux extrémités, sauf en boucle), points de position, flèches du clavier ;
 *  - glisser à la souris (sans ouvrir la visionneuse à la fin du geste) ;
 *  - défilement automatique (`data-autoplay` secondes) : en pause au survol, au focus, hors de l'écran,
 *    et jamais si l'utilisateur a demandé moins d'animations.
 *
 * Vidéos `data-autoplay` : muettes, lues seulement quand elles sont visibles (économise données et batterie).
 */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupCarousel(root: HTMLElement): () => void {
  const found = root.querySelector<HTMLElement>('.gc-track');
  if (!found) return () => {};
  const track: HTMLElement = found;
  const slides = Array.from(track.querySelectorAll<HTMLElement>('.gc-slide'));
  const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-carousel-dot]'));
  const loop = root.hasAttribute('data-loop');
  const cleanups: Array<() => void> = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => {
    el.addEventListener(type, fn as EventListener, options);
    cleanups.push(() => el.removeEventListener(type, fn as EventListener, options));
  };

  const behavior = (): ScrollBehavior => (reducedMotion() ? 'instant' : 'smooth');
  const maxScroll = () => track.scrollWidth - track.clientWidth;

  /** Diapositive dont le bord gauche est le plus proche du bord gauche visible. */
  function current(): number {
    const left = track.getBoundingClientRect().left;
    let best = 0;
    let distance = Infinity;
    slides.forEach((slide, i) => {
      const d = Math.abs(slide.getBoundingClientRect().left - left);
      if (d < distance) [best, distance] = [i, d];
    });
    return best;
  }

  function goTo(index: number) {
    const i = loop
      ? (index + slides.length) % slides.length
      : Math.max(0, Math.min(slides.length - 1, index));
    const slide = slides[i];
    if (!slide) return;
    const left = slide.offsetLeft - slides[0]!.offsetLeft;
    track.scrollTo({ left: Math.min(left, maxScroll()), behavior: behavior() });
  }

  function step(direction: 1 | -1) {
    const atEnd = track.scrollLeft >= maxScroll() - 2;
    const atStart = track.scrollLeft <= 2;
    if (loop && direction === 1 && atEnd) return goTo(0);
    if (loop && direction === -1 && atStart) return goTo(slides.length - 1);
    goTo(current() + direction);
  }

  let raf = 0;
  function update() {
    const i = track.scrollLeft >= maxScroll() - 2 ? slides.length - 1 : current();
    dots.forEach((dot, d) => dot.setAttribute('aria-current', String(d === i)));
    if (!loop) {
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= maxScroll() - 2;
    }
  }
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  };
  listen(track, 'scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  cleanups.push(() => window.removeEventListener('resize', onScroll));
  update();

  if (prev) listen(prev, 'click', () => step(-1));
  if (next) listen(next, 'click', () => step(1));
  dots.forEach((dot) => listen(dot, 'click', () => goTo(Number(dot.dataset.carouselDot))));
  listen(track, 'keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  });

  // — glisser à la souris (le tactile utilise le défilement natif) —
  let drag: { x: number; left: number; moved: boolean } | null = null;
  listen(track, 'pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
  });
  listen(track, 'pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
    }
    track.scrollLeft = drag.left - dx;
  });
  const endDrag = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    track.classList.remove('is-dragging');
    goTo(current()); // aimante sur la diapositive la plus proche
    // le « clic » qui termine le geste ne doit pas ouvrir la visionneuse
    const block = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    track.addEventListener('click', block, { capture: true, once: true });
    setTimeout(() => track.removeEventListener('click', block, { capture: true }), 0);
  };
  listen(track, 'pointerup', endDrag);
  listen(track, 'pointercancel', endDrag);

  // — défilement automatique —
  const seconds = Number(root.dataset.autoplay) || 0;
  if (seconds > 0 && slides.length > 1 && !reducedMotion()) {
    let timer = 0;
    let visible = false;
    let paused = false;
    const tick = () => {
      if (!visible || paused || document.hidden) return;
      const atEnd = track.scrollLeft >= maxScroll() - 2;
      if (atEnd && !loop) goTo(0);
      else step(1);
    };
    const restart = () => {
      clearInterval(timer);
      timer = window.setInterval(tick, seconds * 1000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
      },
      { threshold: 0.5 },
    );
    observer.observe(root);
    const pause = () => (paused = true);
    const resume = () => {
      paused = false;
      restart();
    };
    listen(root, 'pointerenter', pause);
    listen(root, 'pointerleave', resume);
    listen(root, 'focusin', pause);
    listen(root, 'focusout', resume);
    restart();
    cleanups.push(() => {
      clearInterval(timer);
      observer.disconnect();
    });
  }

  return () => {
    cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
  };
}

/** Vidéos en lecture automatique : jouées quand elles sont visibles, en pause sinon. */
function setupAutoplayVideos(): () => void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-autoplay]'));
  if (!videos.length || reducedMotion()) return () => {};
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          video.muted = true; // exigé par les navigateurs pour la lecture automatique
          void video.play().catch(() => {});
        } else video.pause();
      }
    },
    { threshold: 0.4 },
  );
  videos.forEach((v) => observer.observe(v));
  return () => {
    observer.disconnect();
    videos.forEach((v) => v.pause());
  };
}

export function initCarousels(): () => void {
  const cleanups = Array.from(document.querySelectorAll<HTMLElement>('[data-carousel]')).map(
    setupCarousel,
  );
  cleanups.push(setupAutoplayVideos());
  return () => cleanups.forEach((fn) => fn());
}
