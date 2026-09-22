/** En-tête : état « scrollé », menu mobile, surlignage de la section visible. */
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
    const onToggle = () => setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true')
        setOpen(false, true);
    };
    const onLink = (e: Event) => {
      if ((e.target as HTMLElement).closest('[data-menu-link]')) setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    toggle.addEventListener('click', onToggle);
    panel.addEventListener('click', onLink);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    cleanups.push(() => {
      toggle.removeEventListener('click', onToggle);
      panel.removeEventListener('click', onLink);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      setOpen(false);
    });
  }

  // — section visible (page d'accueil) —
  const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'));
  const links = Array.from(header.querySelectorAll<HTMLElement>('[data-nav-link]'));
  if (sections.length && links.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          links.forEach((l) =>
            l.setAttribute('data-active', String(l.dataset.navLink === entry.target.id)),
          );
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    cleanups.push(() => observer.disconnect());
  }

  // — retour en haut —
  const top = document.querySelector<HTMLElement>('[data-scroll-top]');
  const onTop = (e: Event) => {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };
  top?.addEventListener('click', onTop);
  cleanups.push(() => top?.removeEventListener('click', onTop));

  return () => cleanups.forEach((fn) => fn());
}
