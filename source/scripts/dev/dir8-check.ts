/**
 * 0.1.4: 8-direction facing check (bundled by scripts/test-8dir.mjs). Every one of the 8 facings has its own
 * sheet row (never a mirrored row), a 4-direction sheet still maps to s / w / n / e, and every playable
 * character has its 8dir walk / scooter / canoe sheets with the base sheet as the exact top half.
 */
import * as THREE from 'three';
import { dir8FromRelative, dirFromRelative, rowOf, SpriteBillboard } from '../../src/entities/billboard';
import { EIGHT_DIR_KEYS, eightDirRel } from '../../src/core/assets';

export function runDir8(): { fails: string[]; lines: string[] } {
  const fails: string[] = [];
  const lines: string[] = [];
  const ok = (c: boolean, m: string): void => { lines.push(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
  const D = Math.PI / 180;
  // facing relative to the camera → expected direction (0 = toward the camera, +90 = screen-right)
  const want: [number, string][] = [[0, 's'], [45, 'se'], [90, 'e'], [135, 'ne'], [180, 'n'], [-135, 'nw'], [-90, 'w'], [-45, 'sw']];
  for (const [deg, d] of want) {
    ok(dir8FromRelative(deg * D) === d, `8-way ${deg}° → ${dir8FromRelative(deg * D)} (want ${d})`);
    ok(dir8FromRelative((deg + 20) * D) === d && dir8FromRelative((deg - 20) * D) === d, `8-way ${deg}° ±20° stays ${d}`);
  }
  ok(dirFromRelative(45 * D - 0.01) === 's' && dirFromRelative(90 * D) === 'e' && dirFromRelative(-90 * D) === 'w', '4-way fallback unchanged (s / e / w)');
  const walkRows = want.map(([, d]) => rowOf(d as never, false));
  const idleRows = want.map(([, d]) => rowOf(d as never, false, true));
  const poseRows = want.map(([, d]) => rowOf(d as never, true));
  ok(new Set(walkRows).size === 8 && Math.max(...walkRows) <= 11, `walk: 8 distinct rows ${walkRows.join(',')}`);
  ok(new Set(idleRows).size === 8 && new Set([...walkRows, ...idleRows]).size === 16, `idle: 8 more distinct rows ${idleRows.join(',')}`);
  ok(new Set(poseRows).size === 8 && Math.max(...poseRows) === 7, `scooter / canoe: 8 distinct rows ${poseRows.join(',')}`);
  ok(rowOf('sw', false) === 8 && rowOf('se', false) === 11 && rowOf('nw', false, true) === 13 && rowOf('ne', true) === 6, 'rows follow ASSET_MANIFEST.md (walk sw 8 … se 11, idle nw 13, canoe ne 6)');
  // a billboard detects an 8dir sheet by its height, and never mirrors (scale stays +1)
  const tex = (w: number, h: number): THREE.Texture => { const t = new THREE.Texture(); (t as { image: unknown }).image = { width: w, height: h }; return t; };
  const walk = new SpriteBillboard(tex(256, 768), { cols: 4, rows: 8, worldH: 2.65 });
  ok(!walk.eight && walk.rows === 8, 'base walk sheet: 4-way, 8 rows');
  walk.swapSheet(tex(256, 1536));
  ok(walk.eight && walk.rows === 16, 'walk 8dir sheet: 8-way, 16 rows');
  const canoe = new SpriteBillboard(tex(512, 768), { cols: 4, rows: 4, worldH: 2.65 });
  ok(canoe.eight && canoe.rows === 8, 'canoe 8dir sheet: 8-way, 8 rows');
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 10, 10); // camera to the south: camYaw 0
  for (const [deg, d] of want) {
    walk.facing = deg * D;
    walk.walking = true;
    walk.updateBillboard(cam, 0.01);
    ok(walk.dir === d && walk.mesh.scale.x > 0, `walking facing ${deg}° shows ${walk.dir} (row ${rowOf(walk.dir, false)}), not mirrored`);
  }
  for (const k of EIGHT_DIR_KEYS) for (const pre of ['', 'ride_', 'canoe_', 'canoe_modern_']) {
    const base = `characters/${pre}${k}_sheet.png`;
    ok(eightDirRel(base) === `characters/${pre}${k}_8dir_sheet.png`, `${base} → 8dir name`);
  }
  ok(eightDirRel('characters/elder_yayo_sheet.png') === null, 'NPC sheets stay 4-way');
  return { fails, lines };
}
