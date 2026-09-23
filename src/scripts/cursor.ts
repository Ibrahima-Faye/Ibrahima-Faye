/** Curseur personnalisé (Theme Editor → Effets → Curseur) : point ou anneau qui suit le pointeur. */
import gsap from 'gsap';

export function initCursor(): () => void {
  const kind = document.documentElement.dataset.cursor;
  if (!kind || kind === 'default') return () => {};
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const el = document.createElement('div');
  el.className = 'site-cursor';
  el.dataset.kind = kind;
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const xTo = gsap.quickTo(el, 'x', { duration: reduce ? 0 : 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(el, 'y', { duration: reduce ? 0 : 0.35, ease: 'power3' });

  const move = (e: PointerEvent) => {
    xTo(e.clientX);
    yTo(e.clientY);
    const interactive = (e.target as Element | null)?.closest?.(
      'a, button, [role="button"], input, textarea, select',
    );
    el.dataset.hover = String(Boolean(interactive));
  };
  const leave = () => (el.style.opacity = '0');
  const enter = () => (el.style.opacity = '1');
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  document.addEventListener('pointerenter', enter);
  return () => {
    window.removeEventListener('pointermove', move);
    document.removeEventListener('pointerleave', leave);
    document.removeEventListener('pointerenter', enter);
    el.remove();
  };
}
