/**
 * En-tête : état « scrollé », menu mobile, retour en haut.
 * (Défilement vers les sections et section active : voir navigation.ts.)
 */
export function initHeader(): () => void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return () => {};

  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const panel = header.querySelector<HTMLElement>('[data-menu-panel]');
  const cleanups: Array<() => void> = [];

  // — état scrollé —
  const onScroll = () => header.setAttribute('data-scrolled', String(window.scrollY > 24));
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));

  // — menu mobile —
  if (toggle && panel) {
    const setOpen = (open: boolean, returnFocus = false) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute(
        'aria-label',
        (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ?? '',
      );
      panel.hidden = !open;
      document.documentElement.setAttribute('data-menu-open', String(open));
      if (open) panel.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
      else if (returnFocus) toggle.focus();
    };
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const onToggle = () => setOpen(!isOpen());
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') setOpen(false, true);
      // le focus reste dans le menu ouvert (bouton + liens), le reste de la page est masqué
      if (e.key === 'Tab') {
        const focusables = [toggle, ...panel.querySelectorAll<HTMLElement>('a[href]')];
        const i = focusables.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? i <= 0
            ? focusables.at(-1)
            : undefined
          : i === focusables.length - 1 || i === -1
            ? focusables[0]
            : undefined;
        if (next) {
          e.preventDefault();
          next.focus();
        }
      }
    };
    const onLink = (e: Event) => {
      if ((e.target as HTMLElement).closest('[data-menu-link]')) setOpen(false);
    };
    // navigation.ts ferme le menu AVANT de faire défiler (défilement débloqué, mise en page à jour)
    const onCloseRequest = () => isOpen() && setOpen(false);
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    toggle.addEventListener('click', onToggle);
    panel.addEventListener('click', onLink);
    document.addEventListener('keydown', onKey);
    document.addEventListener('nav:close-menu', onCloseRequest);
    window.addEventListener('resize', onResize);
    cleanups.push(() => {
      toggle.removeEventListener('click', onToggle);
      panel.removeEventListener('click', onLink);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('nav:close-menu', onCloseRequest);
      window.removeEventListener('resize', onResize);
      setOpen(false);
    });
  }

  // — retour en haut —
  const top = document.querySelector<HTMLElement>('[data-scroll-top]');
  const onTop = (e: Event) => {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  top?.addEventListener('click', onTop);
  cleanups.push(() => top?.removeEventListener('click', onTop));

  return () => cleanups.forEach((fn) => fn());
}
