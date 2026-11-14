/**
 * Soft night halo around the character sprites (player party + NPCs) so they read against the dark scene.
 * One shared uniform for every sprite material (entities/billboard.ts hooks it into its shader);
 * strength follows PERIOD_LOOK.glow and CHARACTER_GLOW in styleConfig.ts.
 */
import * as THREE from 'three';
import { CHARACTER_GLOW } from './styleConfig';

/** rgb = halo colour, a = halo opacity (0 = off) */
export const uCharGlow = { value: new THREE.Vector4(1, 1, 1, 0) };
/** x = halo width (texels), y = rim brightening */
export const uCharGlowShape = { value: new THREE.Vector2(CHARACTER_GLOW.px, 0) };

export function setCharacterGlow(k: number): void {
  const c = new THREE.Color(CHARACTER_GLOW.color);
  uCharGlow.value.set(c.r, c.g, c.b, CHARACTER_GLOW.strength * k);
  uCharGlowShape.value.set(CHARACTER_GLOW.px, CHARACTER_GLOW.rim * k);
}
