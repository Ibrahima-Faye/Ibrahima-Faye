import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Filtres de la page /projets/ (domaine + entité), synchronisés avec l'URL :
 *   /projets/?domaine=robotique&entite=jeefsys
 * Aucun rechargement : on masque / affiche les cartes déjà présentes dans la page.
 */
export function initFilters(): () => void {
  const root = document.querySelector<HTMLElement>('[data-filters]');
  const grid = document.querySelector<HTMLElement>('[data-projects-grid]');
  if (!root || !grid) return () => {};

  const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-project-card]'));
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const empty = document.querySelector<HTMLElement>('[data-empty-filtered]');
  const count = document.querySelector<HTMLElement>('[data-count]');
  const reset = document.querySelector<HTMLElement>('[data-reset-filters]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state: Record<string, string> = { domaine: '', entite: '' };
  const params = new URLSearchParams(location.search);
  for (const key of Object.keys(state)) {
    const value = params.get(key) ?? '';
    // on n'accepte que des valeurs qui existent réellement dans la page
    if (buttons.some((b) => b.dataset.filter === key && b.dataset.value === value))
      state[key] = value;
  }

  const template = count?.dataset.one !== undefined ? count.dataset : undefined;

  function render(animate: boolean) {
    let visible = 0;
    const shown: HTMLElement[] = [];
    for (const card of cards) {
      const ok =
        (!state.domaine || card.dataset.category === state.domaine) &&
        (!state.entite || (card.dataset.entity ?? '').split(' ').includes(state.entite));
      card.hidden = !ok;
      if (ok) {
        visible += 1;
        shown.push(card);
      }
    }
    for (const b of buttons) {
      const key = b.dataset.filter!;
      b.setAttribute('aria-pressed', String((state[key] ?? '') === (b.dataset.value ?? '')));
    }
    if (empty) empty.hidden = visible > 0;
    if (count && template) {
      const text = visible === 1 || visible === 0 ? template.one! : template.other!;
      count.textContent = text.replace('{n}', String(visible));
    }
    if (reset) reset.hidden = !state.domaine && !state.entite;

    if (animate && !reduced && shown.length) {
      gsap.fromTo(
        shown,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'expo.out',
          stagger: 0.05,
          clearProps: 'transform',
        },
      );
    }
    ScrollTrigger.refresh();
  }

  function syncUrl() {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v) next.set(k, v);
    const qs = next.toString();
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`,
    );
  }

  const onClick = (e: Event) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (button) {
      state[button.dataset.filter!] = button.dataset.value ?? '';
      syncUrl();
      render(true);
      return;
    }
    if ((e.target as HTMLElement).closest('[data-reset-filters]')) {
      state.domaine = '';
      state.entite = '';
      syncUrl();
      render(true);
    }
  };

  document.addEventListener('click', onClick);
  render(false);
  return () => document.removeEventListener('click', onClick);
}
