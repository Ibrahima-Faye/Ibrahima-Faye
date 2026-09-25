/**
 * Section « Expertises » : un domaine actif à la fois.
 *
 * Tout élément portant data-domain-key="<slug>" reçoit data-active="true|false" :
 * la ligne de la liste, le cadre visuel intégré (petits écrans) et la grande scène (≥ 1280 px).
 * Le CSS décide de ce qui s'anime — les illustrations ne tournent que lorsqu'elles sont actives.
 *
 * Le domaine devient actif par :
 *  - survol (souris) ou focus clavier d'une ligne ;
 *  - position de la ligne au centre de l'écran (mobile / tactile, et pendant le scroll).
 * Rien ne s'anime tant que la section n'est pas visible.
 *
 * Le domaine actif est mémorisé dans l'entrée d'historique : après « retour », le même domaine est ouvert.
 * Barres de niveau des outils : remplies à leur entrée dans l'écran (data-filled).
 */
const STATE_KEY = 'expertisesDomain';

/** Barres de niveau : se remplissent une fois, à l'entrée dans l'écran. */
function initLevels(): () => void {
  const bars = Array.from(document.querySelectorAll<HTMLElement>('[data-level]'));
  if (!bars.length) return () => {};
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-filled', '');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  bars.forEach((bar) => observer.observe(bar));
  return () => observer.disconnect();
}

export function initExpertises(): () => void {
  const stopLevels = initLevels();
  const root = document.querySelector<HTMLElement>('[data-expertises]');
  if (!root) return stopLevels;

  const rows = Array.from(root.querySelectorAll<HTMLElement>('.domain-row'));
  const keyed = Array.from(root.querySelectorAll<HTMLElement>('[data-domain-key]'));
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-domain-video]'));
  if (!rows.length) return stopLevels;

  const keys = rows.map((row) => row.dataset.domainKey ?? '');
  const saved = (history.state as Record<string, unknown> | null)?.[STATE_KEY];
  let wanted = typeof saved === 'string' && keys.includes(saved) ? saved : keys[0]!;
  let inView = false;
  let applied: string | null = null;

  function apply() {
    const key = inView ? wanted : '';
    if (key === applied) return;
    applied = key;
    for (const el of keyed) el.setAttribute('data-active', String(el.dataset.domainKey === key));
    for (const video of videos) {
      const active = video.closest<HTMLElement>('[data-domain-key]')?.dataset.domainKey === key;
      if (active) void video.play().catch(() => {});
      else video.pause();
    }
  }

  const choose = (key: string | undefined) => {
    if (!key || key === wanted) return;
    wanted = key;
    apply();
    // mémorisé dans l'entrée d'historique (état du routeur conservé)
    history.replaceState({ ...(history.state ?? {}), [STATE_KEY]: key }, '');
  };

  const cleanups: Array<() => void> = [stopLevels];

  // survol + focus clavier
  const canHover = matchMedia('(hover: hover)').matches;
  for (const row of rows) {
    const key = row.dataset.domainKey;
    const enter = () => choose(key);
    if (canHover) row.addEventListener('pointerenter', enter);
    row.addEventListener('focusin', enter);
    cleanups.push(() => {
      row.removeEventListener('pointerenter', enter);
      row.removeEventListener('focusin', enter);
    });
  }

  // la section est-elle visible ?
  const sectionObserver = new IntersectionObserver(
    ([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      apply();
    },
    { threshold: 0.12 },
  );
  sectionObserver.observe(root);

  // ligne au centre de l'écran
  const rowObserver = new IntersectionObserver(
    (entries) => {
      // Grand écran + souris : c'est le survol qui pilote la scène (pas de concurrence avec le scroll).
      if (canHover && matchMedia('(min-width: 1280px)').matches) return;
      for (const entry of entries) {
        if (entry.isIntersecting) choose((entry.target as HTMLElement).dataset.domainKey);
      }
    },
    { rootMargin: '-42% 0px -50% 0px' },
  );
  rows.forEach((row) => rowObserver.observe(row));

  cleanups.push(() => {
    sectionObserver.disconnect();
    rowObserver.disconnect();
    videos.forEach((v) => v.pause());
  });

  return () => cleanups.forEach((fn) => fn());
}
