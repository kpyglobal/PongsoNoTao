/** Runtime device hints. Desktop visuals stay at the approved quality; iOS / coarse-pointer devices get safer WebGL caps. */

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPhone / iPad / iPod, plus iPadOS that reports as Macintosh
  return /iP(hone|ad|od)/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchend' in window;
}

export function preferredPixelRatio(): number {
  const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
  // iPhone 16 Pro is 3x; a 2x HDR MSAA framebuffer plus 2048 shadows can stall or black-screen Safari.
  if (isIOS()) return Math.min(dpr, 1.5);
  if (isCoarsePointer()) return Math.min(dpr, 1.75);
  return Math.min(dpr, 2);
}

export function preferredShadowMapSize(): number {
  return isIOS() || isCoarsePointer() ? 1024 : 2048;
}

/** Water reflector render-target size (same device rule as the shadow map: iPads / landscape phones included). */
export function preferredReflectorSize(): number {
  return isIOS() || isCoarsePointer() ? 512 : 1024;
}

/** Terrain albedo resolution. Mobile paints at half res and relies on the detail map to stay crisp. */
export function preferredTerrainPaintSize(): { width: number; height: number } {
  // 0.1.4: follows the terrain box's shape (138 × 146 m); about the same pixel count as 0.1.3
  if (typeof window === 'undefined') return { width: 1120, height: 1184 };
  if (isIOS() || isCoarsePointer()) return { width: 832, height: 880 };
  return { width: 1120, height: 1184 };
}

