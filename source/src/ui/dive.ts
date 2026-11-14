/**
 * Underwater stills (U1 浮潛 / U2 淺水氣瓶 / U3 旅人視角): Larry's illustrations in public/assets/underwater/.
 * Only an image loader now; the old canvas composites are gone.
 *   u1.webp (母雞岩 snorkel) / u2.webp (椰油港 scuba) — one picture per spot for everyone
 *   u3_01 … u3_03.webp — the traveller's POV set
 * thumbs/ holds 480×270 copies for the album.
 */
import { assetUrl } from '../core/paths';

export type DiveKind = 'A' | 'B' | 'POV';

/** one picture per spot (same for every member, 2026-11): u1 / u2; U3 = the traveller's 3 POV photos */
export function diveImageIds(kind: DiveKind): string[] {
  if (kind === 'POV') return ['u3_01', 'u3_02', 'u3_03'];
  return [kind === 'A' ? 'u1' : 'u2'];
}

export function diveUrl(id: string, thumb = false): string {
  return assetUrl(`assets/underwater/${thumb ? 'thumbs/' : ''}${id}.webp`);
}

/** resolves when the image is decoded (or failed), so the popup never shows a half-loaded picture */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => res(img);
    img.src = url;
  });
}
