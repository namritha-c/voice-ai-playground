/**
 * Liquid-glass behaviour that CSS alone can't do.
 *
 *  1. Pointer light: a soft highlight follows the cursor across glass controls.
 *  2. Edge refraction: on Chromium, larger glass surfaces bend what is behind their rim, like a lens.
 *     Each surface gets an SVG displacement map sized to itself and used as its `backdrop-filter`.
 *     Safari and Firefox ignore SVG filters in `backdrop-filter`, so they keep the blur-and-tint glass.
 *
 * This works on the live page behind the glass (the shader background, the orb, the waves).
 * It never takes a snapshot of the page, so the glass never shows a stale copy of it.
 */

/** Surfaces that follow the pointer with a highlight. Keep in step with the `::after` rule in glass.css. */
const GLINT = '.chip,.icon-btn,.mini-btn,.sheet-btn,.fchip,.keys-chip,.card-key,.vcard,.prov-btn,.output,.card,.sheet';

/** Surfaces that refract what is behind their edge. Keep in step with the `--refract` rule in glass.css. */
const REFRACT = '.sheet,.toast,.output,.card:not(.add)';

const MAX_PIXELS = 300_000;
const MAX_FILTERS = 48;
const SVG_NS = 'http://www.w3.org/2000/svg';

export function startGlass(): () => void {
  const stops = [pointerLight(), refraction()];
  return () => stops.forEach((stop) => stop());
}

function pointerLight(): () => void {
  let frame = 0;
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const el = (e.target as Element | null)?.closest<HTMLElement>(GLINT);
    if (!el) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
      el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
    });
  };
  document.addEventListener('pointermove', move, { passive: true });
  return () => { document.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
}

/**
 * Height map of a convex rounded-rectangle lens, encoded for feDisplacementMap:
 * red and green carry the horizontal and vertical shift (128 means none). Pixels in the rim
 * sample from further in, and the pull grows steeply toward the edge, as it does on real glass.
 */
function displacementMap(w: number, h: number, radius: number, bezel: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const hx = w / 2, hy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x + 0.5 - hx, cy = y + 0.5 - hy;
      const qx = Math.abs(cx) - (hx - radius), qy = Math.abs(cy) - (hy - radius);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const outside = Math.hypot(ox, oy);
      const depth = -(outside + Math.min(Math.max(qx, qy), 0) - radius); // distance in from the edge
      let dx = 0, dy = 0;
      if (depth >= 0 && depth < bezel) {
        const t = 1 - depth / bezel;                 // 0 at the inner edge of the rim, 1 at the edge
        const pull = 1 - Math.sqrt(1 - t * t);       // circular lens profile
        let nx: number, ny: number;                  // outward normal
        if (qx > 0 || qy > 0) { nx = (Math.sign(cx) * ox) / outside; ny = (Math.sign(cy) * oy) / outside; }
        else if (qx > qy) { nx = Math.sign(cx); ny = 0; }
        else { nx = 0; ny = Math.sign(cy); }
        dx = -nx * pull;
        dy = -ny * pull;
      }
      const i = (y * w + x) * 4;
      px[i] = 128 + dx * 127; px[i + 1] = 128 + dy * 127; px[i + 2] = 128; px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function refraction(): () => void {
  const chromium = /Chrome\//.test(navigator.userAgent);
  const calm = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  if (!chromium || calm) return () => undefined;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none';
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);

  const filters = new Map<string, string>();
  let serial = 0;

  const filterFor = (w: number, h: number, radius: number, bezel: number, shift: number): string => {
    const key = `${w}x${h}r${radius}b${bezel}s${shift}`;
    const known = filters.get(key);
    if (known) return known;
    if (defs.childElementCount >= MAX_FILTERS) { defs.firstElementChild?.remove(); filters.clear(); }
    const id = `lg-${++serial}`;
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0');
    filter.setAttribute('width', String(w)); filter.setAttribute('height', String(h));
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const image = document.createElementNS(SVG_NS, 'feImage');
    image.setAttribute('href', displacementMap(w, h, radius, bezel));
    image.setAttribute('x', '0'); image.setAttribute('y', '0');
    image.setAttribute('width', String(w)); image.setAttribute('height', String(h));
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('result', 'map');
    const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
    displace.setAttribute('in', 'SourceGraphic');
    displace.setAttribute('in2', 'map');
    displace.setAttribute('scale', String(shift * 2)); // the map spans ±½ of scale
    displace.setAttribute('xChannelSelector', 'R');
    displace.setAttribute('yChannelSelector', 'G');
    filter.append(image, displace);
    defs.appendChild(filter);
    filters.set(key, id);
    return id;
  };

  const timers = new WeakMap<HTMLElement, number>();
  const fit = (el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    const w = Math.round(box.width / 4) * 4, h = Math.round(box.height / 4) * 4;
    if (w < 24 || h < 24 || w * h > MAX_PIXELS) { el.style.removeProperty('--refract'); return; }
    const raw = getComputedStyle(el).borderTopLeftRadius;
    let radius = parseFloat(raw) || 0;
    if (raw.endsWith('%')) radius = (Math.min(w, h) * radius) / 100;
    radius = Math.min(radius, Math.min(w, h) / 2);
    const bezel = Math.max(8, Math.min(radius * 0.85, 30));
    el.style.setProperty('--refract', `url(#${filterFor(w, h, radius, bezel, 14)})`);
  };

  const resize = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const el = target as HTMLElement;
      clearTimeout(timers.get(el));
      timers.set(el, window.setTimeout(() => fit(el), 120)); // wait out window drags
    }
  });

  const watched = new Set<HTMLElement>();
  const watch = (root: ParentNode) => {
    const found = root instanceof Element && root.matches(REFRACT) ? [root as HTMLElement] : [];
    root.querySelectorAll<HTMLElement>(REFRACT).forEach((el) => found.push(el));
    for (const el of found) {
      if (watched.has(el)) continue;
      watched.add(el);
      resize.observe(el);
      fit(el);
    }
  };
  const unwatch = () => {
    for (const el of watched) if (!el.isConnected) { resize.unobserve(el); watched.delete(el); }
  };

  watch(document);
  const mutations = new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof Element) watch(n); });
    if (records.some((r) => r.removedNodes.length)) unwatch();
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  return () => { mutations.disconnect(); resize.disconnect(); svg.remove(); };
}
