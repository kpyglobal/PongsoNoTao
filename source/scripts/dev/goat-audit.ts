/** Exercise real goat movement, never teleporting it to make the test pass. */
import { GoatHerds } from '../../src/world/goats';
import { canStand } from '../../src/world/collision';
import { getHeight } from '../../src/world/height';
import { loadContentNode } from './content-node';
import { addQuestPlaces } from '../../src/world/places';
export function runGoatAudit() {
  const p = JSON.parse(JSON.stringify(loadContentNode().places));
  addQuestPlaces(p);
  const h = new GoatHerds(p);
  const faults = new Set<string>();
  const initial = h.herdInfo();
  let moved = 0, maxSpread = 0;
  for (const herd of initial) {
    const before = h.herdInfo().find((a) => a.id === herd.id)!;
    for (let n = 0; n < 2400; n++) {
      const current = h.herdInfo().find((a) => a.id === herd.id)!;
      h.update(0.05, current.centre.x, current.centre.z);
      if (n % 40 !== 0) continue;
      for (const a of h.herdInfo()) for (const g of a.goats) {
        if (!canStand(g.x, g.z, 0.22) || getHeight(g.x, g.z) <= 0.28) faults.add(`${a.id}: not on dry walkable ground (${g.x},${g.z}) n=${n} stand=${canStand(g.x, g.z, 0.22)} h=${getHeight(g.x, g.z).toFixed(2)}`);
        const spread = Math.hypot(g.x - a.centre.x, g.z - a.centre.z);
        maxSpread = Math.max(maxSpread, spread);
        if (spread > 9) faults.add(`${a.id}: herd spread > 9 m`);
      }
    }
    const after = h.herdInfo().find((a) => a.id === herd.id)!;
    if (after.goats.some((g, i) => Math.hypot(g.x - before.goats[i].x, g.z - before.goats[i].z) > 0.2)) moved++;
    else faults.add(`${herd.id}: no movement after 120 s`);
  }
  const coats = initial.reduce((a, h) => ({ black: a.black + h.coats.black, brown: a.brown + h.coats.brown, white: a.white + h.coats.white }), { black: 0, brown: 0, white: 0 });
  if (coats.black <= (coats.black + coats.brown + coats.white) * 0.6) faults.add('black goats must be > 60%');
  return { herds: initial.length, moved, secondsPerHerd: 120, coats, maxSpread, faults: [...faults] };
}
