/**
 * Navigation vers les sections de la page d'accueil (Expertises, Projets, Écosystème, À propos, Contact).
 *
 * Un seul contrôleur pour tous les liens « /#section » (en-tête, menu mobile, boutons, pied de page) :
 *  - même page       → défilement fluide jusqu'à la section, placée juste sous l'en-tête fixe,
 *                      quelle que soit la position de départ ; l'adresse devient « /#section » sans
 *                      ajouter d'entrée à l'historique ;
 *  - autre page      → retour à l'accueil (routeur d'Astro), puis placement exact sur la section
 *                      une fois la page stabilisée (polices, découpage des titres, images) ;
 *  - adresse directe → « /#contact » ouvert dans un nouvel onglet arrive lui aussi au bon endroit ;
 *  - section active  → calculée d'après la position de défilement ; aucune dans le Hero et le Manifeste ;
 *  - menu mobile     → fermé (et défilement débloqué) AVANT le déplacement ;
 *  - accessibilité   → le focus passe sur la section atteinte ; mouvement réduit = déplacement instantané.
 *
 * Les sections gérées sont celles des liens `[data-nav-link]` de l'en-tête.
 * Le décalage sous l'en-tête vient du CSS (`scroll-padding-top`, voir global.css).
 */
import { navigate } from 'astro:transitions/client';

const LINK = '[data-nav-link]';
/** Position de la « ligne de lecture » qui désigne la section active (fraction de la hauteur visible). */
const READING_LINE = 0.35;
/** Tolérance (px) avant de corriger la position d'arrivée. */
const TOLERANCE = 2;

/** Section à atteindre après un changement de page (clic sur « Projets » depuis une page projet). */
let pending: string | null = null;
/** Première page affichée depuis le chargement du navigateur (et non via le routeur). */
let firstLoad = true;

const root = document.documentElement;
const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const offset = () => parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight);
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Position de défilement qui place la section juste sous l'en-tête (bornée à la fin de page). */
function targetTop(el: HTMLElement): number {
  const top = el.getBoundingClientRect().top + window.scrollY - offset();
  return Math.round(Math.min(Math.max(0, top), maxScroll()));
}

/** Identifiants de section connus de l'en-tête. */
function sectionIds(): Set<string> {
  return new Set(
    [...document.querySelectorAll<HTMLElement>(`[data-header] ${LINK}`)]
      .map((link) => link.dataset.navLink ?? '')
      .filter(Boolean),
  );
}

/** Marque le lien actif (en-tête + menu mobile). `null` = aucun. */
function setActive(id: string | null) {
  for (const link of document.querySelectorAll<HTMLElement>(LINK)) {
    const on = link.dataset.navLink === id;
    link.setAttribute('data-active', String(on));
    if (on) link.setAttribute('aria-current', 'location');
    else if (link.getAttribute('aria-current') === 'location') link.removeAttribute('aria-current');
  }
}

/** Attend la fin d'un défilement : `scrollend`, ou 150 ms sans mouvement (2,5 s au plus). */
function scrollSettled(): Promise<void> {
  return new Promise((resolve) => {
    let timer = 0;
    const done = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', done);
      clearTimeout(timer);
      clearTimeout(guard);
      resolve();
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = window.setTimeout(done, 150);
    };
    const guard = window.setTimeout(done, 2500);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', done, { once: true });
    onScroll();
  });
}

/**
 * Surveille une action de l'utilisateur (molette, toucher, clavier) : s'il reprend la main,
 * on ne corrige plus sa position.
 */
function watchUser() {
  let touched = false;
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  const mark = () => (touched = true);
  events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
  return {
    get touched() {
      return touched;
    },
    stop: () => events.forEach((e) => window.removeEventListener(e, mark)),
  };
}

/** Donne le focus à la section atteinte, sans la faire défiler (lecteurs d'écran, clavier). */
function focusSection(el: HTMLElement) {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** Remplace l'adresse par « …#id » sans créer d'entrée d'historique (l'état du routeur est conservé). */
function replaceHash(id: string) {
  const url = `${location.pathname}${location.search}#${encodeURIComponent(id)}`;
  if (location.hash !== `#${id}`) history.replaceState(history.state, '', url);
}

/** Défilement (fluide si autorisé) jusqu'à la section, puis correction si la page a bougé entre-temps. */
async function scrollToSection(id: string, state: NavState) {
  const el = document.getElementById(id);
  if (!el) return;
  state.lockedOn = id;
  setActive(id);
  const user = watchUser();
  try {
    const smooth = !prefersReducedMotion();
    for (let attempt = 0; attempt < 3; attempt++) {
      const top = targetTop(el);
      if (Math.abs(window.scrollY - top) <= TOLERANCE) break;
      // première passe fluide ; les corrections (page qui a bougé) sont instantanées si l'écart est faible
      const behavior =
        smooth && (attempt === 0 || Math.abs(window.scrollY - top) > 40) ? 'smooth' : 'instant';
      window.scrollTo({ top, behavior });
      if (behavior === 'smooth') await scrollSettled();
      else await frame();
      if (user.touched) break;
    }
    focusSection(el);
  } finally {
    user.stop();
    state.lockedOn = null;
    state.update();
  }
}

/**
 * Placement exact sur une section d'une page qui vient d'arriver : immédiatement, puis à nouveau
 * quand les polices, le découpage des titres et les images ont fini de modifier la mise en page.
 * S'arrête dès que l'utilisateur fait défiler lui-même.
 */
async function settleOn(id: string, state: NavState) {
  const el = document.getElementById(id);
  if (!el) return;
  state.lockedOn = id;
  setActive(id);
  const user = watchUser();
  const place = () => {
    if (!user.touched) window.scrollTo({ top: targetTop(el), behavior: 'instant' });
  };
  try {
    place();
    await document.fonts?.ready;
    await frame();
    await frame();
    place();
    if (document.readyState !== 'complete') {
      await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
      await frame();
      place();
    }
    // dernier contrôle : ScrollTrigger / SplitText recalculent après le chargement
    await new Promise((resolve) => setTimeout(resolve, 250));
    place();
    if (!user.touched) focusSection(el);
  } finally {
    user.stop();
    state.lockedOn = null;
    state.update();
  }
}

interface NavState {
  /** Pendant un déplacement programmé, la section visée reste active (pas de clignotement). */
  lockedOn: string | null;
  update: () => void;
}

// Changement de page vers l'accueil : placer la section dès que le nouveau contenu est en place,
// avant même la fin de la transition (évite de voir le haut de page).
document.addEventListener('astro:after-swap', () => {
  if (!pending) return;
  const el = document.getElementById(pending);
  if (el) window.scrollTo({ top: targetTop(el), behavior: 'instant' });
});

export function initNavigation(): () => void {
  const ids = sectionIds();
  const sections = [...ids]
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  const cleanups: Array<() => void> = [];

  /* ---------- section active (uniquement sur une page qui contient ces sections) ---------- */
  let raf = 0;
  const state: NavState = {
    lockedOn: null,
    update: () => {
      if (!sections.length || state.lockedOn) return;
      const line = offset() + (window.innerHeight - offset()) * READING_LINE;
      let active: string | null = null;
      for (const section of sections) {
        const box = section.getBoundingClientRect();
        if (box.top <= line && box.bottom > line) active = section.id;
      }
      // tout en bas de page : la dernière section visible (ex. Contact, trop courte pour atteindre la ligne)
      if (!active && window.scrollY >= maxScroll() - TOLERANCE) {
        const visible = sections.filter((s) => s.getBoundingClientRect().top < window.innerHeight);
        active = visible.at(-1)?.id ?? null;
      }
      setActive(active);
    },
  };
  if (sections.length) {
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(state.update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    cleanups.push(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    });
    state.update();
  }

  /* ---------- clics sur les liens de section ---------- */
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    const id = decodeURIComponent(url.hash.slice(1));
    if (url.origin !== location.origin || !ids.has(id)) return;

    const samePage = url.pathname === location.pathname && url.search === location.search;
    if (samePage && !document.getElementById(id)) return; // section absente : comportement normal

    // Avant le routeur d'Astro (phase de capture) : il ignore les clics déjà traités.
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('nav:close-menu'));

    if (samePage) {
      replaceHash(id);
      // une image plus tard : le menu est fermé et le défilement débloqué (la mise en page a pu changer)
      requestAnimationFrame(() => void scrollToSection(id, state));
    } else {
      pending = id;
      void navigate(`${url.pathname}${url.search}`);
    }
  };
  document.addEventListener('click', onClick, { capture: true });
  cleanups.push(() => document.removeEventListener('click', onClick, { capture: true }));

  /* ---------- arrivée sur la page ---------- */
  const navigationType = (
    performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  )?.type;
  const arrival =
    pending ??
    // adresse directe « /#contact » (pas un rechargement : le navigateur restaure alors la position)
    (firstLoad && navigationType !== 'reload' ? decodeURIComponent(location.hash.slice(1)) : '');
  pending = null;
  firstLoad = false;
  if (arrival && ids.has(arrival) && document.getElementById(arrival)) {
    replaceHash(arrival);
    void settleOn(arrival, state);
  }

  return () => cleanups.forEach((fn) => fn());
}
