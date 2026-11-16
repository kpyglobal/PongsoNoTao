/**
 * 0.1.5 shared motion: one zoom to / from the 圖鑑手札 button (top right). Used by every unlock card (postcard,
 * recipe scroll, printed photo, quest page: they shrink into the button when closed) and by the notebook itself
 * (it grows out of the button when opened and shrinks back into it when closed).
 * Reduced motion: a short fade instead. The game also turns the motion off for automated runs (fxOn()).
 */

/** the 0.1.5 card / notebook motion layer is on (off for headless test runs unless the URL asks for it with ?cards=1) */
export function fxOn(): boolean {
  try {
    if (new URLSearchParams(location.search).has('cards')) return true;
    return !navigator.webdriver;
  } catch {
    return true;
  }
}

export function reducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** the notebook button (falls back to the top-right corner when the HUD is hidden) */
function target(btn: HTMLElement | null): { x: number; y: number; w: number; h: number } {
  const r = btn?.getBoundingClientRect();
  if (r && r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  return { x: window.innerWidth - 40, y: 28, w: 60, h: 30 };
}

/** translation part of the element's own CSS transform (e.g. translate(-50%, -50%) centring) */
function baseShift(el: HTMLElement): { x: number; y: number; t: string } {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { x: 0, y: 0, t: '' };
  const m = /matrix\(([^)]+)\)/.exec(t);
  if (!m) return { x: 0, y: 0, t };
  const v = m[1].split(',').map(Number);
  return { x: v[4] || 0, y: v[5] || 0, t };
}

/**
 * zoom `el` into the button ('close') or out of it ('open'); resolves when done.
 * The element keeps its own layout transform; the zoom is composed in front of it.
 */
export function zoomButton(el: HTMLElement, btn: HTMLElement | null, dir: 'open' | 'close', ms: number): Promise<void> {
  if (!el.isConnected || typeof el.animate !== 'function') return Promise.resolve();
  if (!fxOn()) return Promise.resolve();
  if (reducedMotion()) {
    if (dir === 'open') return Promise.resolve();
    const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
    return a.finished.then(() => undefined, () => undefined);
  }
  const r = el.getBoundingClientRect();
  const b = target(btn);
  const base = baseShift(el);
  const s = Math.max(0.03, Math.min(b.w / Math.max(1, r.width), b.h / Math.max(1, r.height)));
  const dx = b.x - (r.left + r.width / 2) + (1 - s) * base.x;
  const dy = b.y - (r.top + r.height / 2) + (1 - s) * base.y;
  const rest = `translate(0px, 0px) scale(1) ${base.t}`.trim();
  const small = `translate(${dx}px, ${dy}px) scale(${s}) ${base.t}`.trim();
  const frames: Keyframe[] = dir === 'close'
    ? [{ transform: rest, opacity: 1 }, { transform: small, opacity: 0.55, offset: 0.85 }, { transform: small, opacity: 0 }]
    : [{ transform: small, opacity: 0 }, { transform: small, opacity: 0.6, offset: 0.08 }, { transform: rest, opacity: 1 }];
  const a = el.animate(frames, {
    duration: ms,
    easing: dir === 'close' ? 'cubic-bezier(0.55, 0, 0.75, 0.2)' : 'cubic-bezier(0.16, 1, 0.3, 1)',
    fill: 'forwards',
  });
  return a.finished.then(() => {
    if (dir === 'open') a.cancel();
    if (dir === 'close') pulse(btn);
  }, () => undefined);
}

/** a short glow on the button when something lands in it */
export function pulse(btn: HTMLElement | null): void {
  if (!btn) return;
  btn.classList.remove('nb-got');
  void btn.offsetWidth;
  btn.classList.add('nb-got');
  window.setTimeout(() => btn.classList.remove('nb-got'), 700);
}
