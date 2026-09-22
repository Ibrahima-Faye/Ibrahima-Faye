/**
 * Champ filaire 3D du Hero — « terrain architectural » en perspective.
 *
 * Canvas 2D + projection maison (~200 lignes, 0 dépendance) plutôt que Three.js :
 * pour une nappe de lignes, c'est bien plus léger pour un rendu tout aussi spectaculaire.
 *
 * - réagit au pointeur (bosse qui suit la souris) ;
 * - se met en pause hors écran / onglet masqué ;
 * - `prefers-reduced-motion` : une seule image fixe, aucune boucle ;
 * - DPR plafonné, grille allégée sur mobile.
 */

type RGB = [number, number, number];

/** navy-violet → lavande (palette du site) */
const STOPS: RGB[] = [
  [74, 52, 190],
  [110, 70, 245],
  [147, 103, 255],
  [181, 140, 255],
  [228, 218, 255],
];
const BUCKETS = 7;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function colorAt(t: number): RGB {
  const p = clamp(t, 0, 1) * (STOPS.length - 1);
  const i = Math.min(Math.floor(p), STOPS.length - 2);
  const f = p - i;
  const a = STOPS[i]!;
  const b = STOPS[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function mountHeroField(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  if (!ctx || !host) return () => {};

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cols = 0;
  let rows = 0;
  // tampons réutilisés à chaque image (aucune allocation dans la boucle d'animation)
  let sx = new Float32Array(0);
  let sy = new Float32Array(0);
  let it = new Float32Array(0);
  let time = reduced ? 5 : 0;
  let raf = 0;
  let last = 0;
  let inView = true;
  let disposed = false;

  const pointer = { x: 0, z: 0.55, tx: 0, tz: 0.55 };

  function resize() {
    const rect = host!.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const small = width < 720;
    cols = small ? 30 : 56;
    rows = small ? 20 : 34;
    const size = (cols + 1) * (rows + 1);
    sx = new Float32Array(size);
    sy = new Float32Array(size);
    it = new Float32Array(size); // intensité 0..1
    draw();
  }

  /** Hauteur de la surface. x ∈ [-1, 1] ; z ∈ [0, 1] (0 = proche, 1 = lointain). */
  function surface(x: number, z: number, t: number): number {
    let y =
      Math.sin(x * 2.6 + t * 0.35) * 0.34 +
      Math.sin(z * 6 - t * 0.45) * 0.22 +
      Math.sin(x * 1.7 + z * 3.4 + t * 0.25) * 0.2;
    // arête franche qui traverse la scène, comme une ligne de toit
    y += Math.max(0, 1 - Math.abs(x + 0.35 * Math.sin(z * 3 + t * 0.2)) * 3.4) * 0.38;
    // bosse qui suit le pointeur
    const dx = x - pointer.x;
    const dz = z - pointer.z;
    y += Math.exp(-(dx * dx * 6 + dz * dz * 16)) * 0.6;
    return y;
  }

  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const focal = width * 0.62;
    const horizon = height * 0.36;
    const camH = 1.55;

    // grille projetée
    for (let j = 0; j <= rows; j++) {
      const z = j / rows;
      const zc = 1.9 + Math.pow(z, 1.55) * 10;
      const fade = 1 - Math.pow(z, 0.85) * 0.88;
      for (let i = 0; i <= cols; i++) {
        const x = (i / cols) * 2 - 1;
        const y = surface(x, z, time);
        const k = j * (cols + 1) + i;
        sx[k] = width * 0.5 + ((x * 5.6) / zc) * focal;
        sy[k] = horizon + ((camH - y * 0.95) / zc) * focal;
        it[k] = clamp(0.22 + (y + 0.4) * 0.95, 0, 1) * fade;
      }
    }

    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    const seg = (a: number, b: number) => {
      const avg = (it[a]! + it[b]!) * 0.5;
      const bucket = Math.min(BUCKETS - 1, Math.floor(avg * BUCKETS));
      paths[bucket]!.moveTo(sx[a]!, sy[a]!);
      paths[bucket]!.lineTo(sx[b]!, sy[b]!);
    };
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i < cols; i++) seg(j * (cols + 1) + i, j * (cols + 1) + i + 1);
    }
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j < rows; j++) seg(j * (cols + 1) + i, (j + 1) * (cols + 1) + i);
    }

    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (let b = 0; b < BUCKETS; b++) {
      const q = b / (BUCKETS - 1);
      const [r, g, bl] = colorAt(q);
      ctx.strokeStyle = `rgba(${r | 0}, ${g | 0}, ${bl | 0}, ${(0.07 + q * 0.5).toFixed(3)})`;
      ctx.stroke(paths[b]!);
    }

    // points lumineux sur les crêtes
    ctx.fillStyle = 'rgba(236, 230, 255, 0.85)';
    for (let k = 0; k < it.length; k += 1) {
      if (it[k]! > 0.86 && k % 3 === 0) ctx.fillRect(sx[k]! - 1, sy[k]! - 1, 2, 2);
    }
  }

  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    if (dt < (coarse ? 32 : 16)) return; // ~30 fps sur mobile
    last = now;
    time += Math.min(dt, 50) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.z += (pointer.tz - pointer.z) * 0.06;
    draw();
  }

  function start() {
    if (reduced || disposed || raf || !inView || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function onPointer(e: PointerEvent) {
    const rect = host!.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    pointer.tx = clamp(nx * 2 - 1, -1, 1);
    pointer.tz = clamp(1 - (ny - 0.3) / 0.7, 0, 1);
  }

  const onVisibility = () => (document.hidden ? stop() : start());
  const observer = new IntersectionObserver(([entry]) => {
    inView = Boolean(entry?.isIntersecting);
    inView ? start() : stop();
  });
  const resizeObserver = new ResizeObserver(() => resize());

  resize();
  observer.observe(host);
  resizeObserver.observe(host);
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduced && !coarse) window.addEventListener('pointermove', onPointer, { passive: true });
  start();

  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
  };
}
