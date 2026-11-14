/**
 * Rendering quality tier. Desktop keeps the approved full look; iOS / coarse-pointer devices get a lighter
 * budget that keeps the same style (reflections, bloom, tilt-shift, shadows) at lower cost.
 * `?quality=high` or `?quality=mobile` overrides the detection (for comparisons and tests).
 */
import * as THREE from 'three';
import { isCoarsePointer, isIOS } from './device';

export type QualityTier = 'high' | 'mobile';

export interface Quality {
  tier: QualityTier;
  /** re-render the water reflection every Nth frame (1 = every frame) */
  reflectorEvery: number;
  /** one combined tilt-shift pass (disc blur) instead of two separable full-screen passes */
  tiltCombined: boolean;
  /** bloom render-target scale relative to the drawing buffer */
  bloomScale: number;
  /** does the island terrain mesh cast shadows (it still receives them) */
  terrainCastShadow: boolean;
  shadowType: THREE.ShadowMapType;
}

function detectTier(): QualityTier {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('quality');
    if (q === 'high' || q === 'mobile') return q;
  }
  return isIOS() || isCoarsePointer() ? 'mobile' : 'high';
}

function make(tier: QualityTier): Quality {
  if (tier === 'mobile') {
    return { tier, reflectorEvery: 2, tiltCombined: true, bloomScale: 0.5, terrainCastShadow: false, shadowType: THREE.PCFShadowMap };
  }
  return { tier, reflectorEvery: 1, tiltCombined: false, bloomScale: 1, terrainCastShadow: true, shadowType: THREE.PCFSoftShadowMap };
}

let cached: Quality | null = null;

export function quality(): Quality {
  if (!cached) cached = make(detectTier());
  return cached;
}
