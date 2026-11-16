/**
 * 0.1.4: the 0.1.0–0.1.3 village frames (the old oval island), kept only to carry old positions onto
 * the new map: a saved party position, or an old hand-placed point near a village, keeps its place
 * relative to the nearest village (along the coast u, toward the sea w).
 */
export interface OldVillage { id: string; cx: number; cz: number; fx: number; fz: number }

const OLD_C = { x: 1.5, z: 4 };
function old(id: string, cx: number, cz: number, bias = 0): OldVillage {
  const a = Math.atan2(cz - OLD_C.z, cx - OLD_C.x) + bias;
  return { id, cx, cz, fx: Math.cos(a), fz: Math.sin(a) };
}

export const OLD_VILLAGES: OldVillage[] = [
  old('yayo', -26.6, -6, 0.15),
  old('iraraley', -2, -38, 0.05),
  old('iranmeylek', 20.4, -18.2, 0.05),
  old('ivalino', 26.8, 9.6, 0.0),
  old('imorod', 6, 32, 0.0),
  old('iratay', -20, 22, -0.25),
];

/** world layout revision written into saves (1 = the 0.1.0–0.1.3 oval island, 2 = the 0.1.4 island, 3 = the 0.1.5 bigger island, 4 = 0.1.6: 紅頭 / 漁人 a little further apart) */
export const WORLD_REV = 4;

/** old world point → { nearest old village, local u (clockwise along the coast), w (toward the sea) } */
export function oldLocal(x: number, z: number): { id: string; u: number; w: number; dist: number } {
  let best: OldVillage = OLD_VILLAGES[0];
  let bd = Infinity;
  for (const v of OLD_VILLAGES) {
    const d = Math.hypot(x - v.cx, z - v.cz);
    if (d < bd) { bd = d; best = v; }
  }
  const dx = x - best.cx;
  const dz = z - best.cz;
  return { id: best.id, u: dx * -best.fz + dz * best.fx, w: dx * best.fx + dz * best.fz, dist: bd };
}
