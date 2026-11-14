/** Tiny helpers that turn the data in styleConfig.ts into colours (keeps the consumers one-liners). */
import * as THREE from 'three';
import type { Season } from '../core/timeSeason';
import { SEASON_KIND, SEASON_LOOK, type Mix, type SeasonLook } from './styleConfig';

export function seasonLook(s: Season): SeasonLook { return SEASON_LOOK[SEASON_KIND[s]]; }
/** colour.lerp(mix colour, amount) in place */
export function applyMix(c: THREE.Color, m: Mix): THREE.Color { return c.lerp(new THREE.Color(m[0]), m[1]); }
