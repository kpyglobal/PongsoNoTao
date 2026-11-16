/**
 * Simulate ambient NPC wandering for a stretch of time and fail if anyone
 * ends up inside a building or stuck against a wall.
 */
import { canStand, hitsSolid, NPC_RADIUS } from '../../src/world/collision';
import { NpcSystem } from '../../src/entities/npcs';
import { loadContentNode } from './content-node';
import { addQuestPlaces, type PlaceLike } from '../../src/world/places';
import type { Period, Season } from '../../src/core/timeSeason';

export interface NpcFault {
  id: string;
  why: string;
  x: number;
  z: number;
}

export interface NpcReport {
  actors: number;
  seconds: number;
  periods: Period[];
  faults: NpcFault[];
  /** longest walk toward one waypoint without arriving (s), and who */
  longestLeg: { id: string; seconds: number };
  /** farthest any NPC got from the nearest of its route spots (m), and who */
  farthest: { id: string; d: number };
}

export function runNpcAudit(opts: { seconds?: number; dt?: number } = {}): NpcReport {
  const seconds = opts.seconds ?? 90;
  const dt = opts.dt ?? 0.1;
  const db = loadContentNode();
  const places: Record<string, PlaceLike> = JSON.parse(JSON.stringify(db.places));
  addQuestPlaces(places);
  const sys = new NpcSystem(null, db.npcs, places);
  const periods: Period[] = ['day', 'dusk', 'night', 'dawn'];
  const season: Season = 'rayon';
  const faults: NpcFault[] = [];
  const seen = new Set<string>();
  const note = (id: string, why: string, x: number, z: number) => {
    const k = `${id}|${why}|${x.toFixed(1)},${z.toFixed(1)}`;
    if (seen.has(k)) return;
    seen.add(k);
    faults.push({ id, why, x, z });
  };
  let longestLeg = { id: '', seconds: 0 };
  let farthest = { id: '', d: 0 };
  for (const period of periods) {
    sys.applySchedule(period, season);
    const stuckFor = new Map<string, number>();
    /** seconds walking toward the same waypoint without reaching it ("walks one way forever") */
    const legFor = new Map<string, { wp: number; t: number }>();
    const last = new Map<string, { x: number; z: number }>();
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      sys.tickMoves(dt);
      for (const a of sys.actors) {
        if (!canStand(a.x, a.z, NPC_RADIUS) || hitsSolid(a.x, a.z, NPC_RADIUS * 0.85)) {
          note(a.def.id, 'inside building or unwalkable', a.x, a.z);
        }
        const dh = Math.min(...a.waypoints.map((w) => Math.hypot(a.x - w.x, a.z - w.z)));
        if (dh > farthest.d) farthest = { id: a.def.id, d: dh };
        if (dh > (a.def.id === 'geologist' ? 28 : 16)) note(a.def.id, 'wandered far from its spots', a.x, a.z);
        const leg = legFor.get(a.def.id);
        if (a.wait > 0 || !leg || leg.wp !== a.wpIndex) legFor.set(a.def.id, { wp: a.wpIndex, t: 0 });
        else {
          leg.t += dt;
          if (leg.t > longestLeg.seconds) longestLeg = { id: a.def.id, seconds: leg.t };
          if (leg.t > 30) { note(a.def.id, 'walking 30 s without reaching its spot', a.x, a.z); leg.t = -1e9; }
        }
        const prev = last.get(a.def.id);
        last.set(a.def.id, { x: a.x, z: a.z });
        if (a.wait > 0 || a.pace === 'escort') {
          stuckFor.set(a.def.id, 0);
          continue;
        }
        const moved = prev ? Math.hypot(a.x - prev.x, a.z - prev.z) : 1;
        const t = a.waypoints[a.wpIndex];
        const going = t && Math.hypot(t.x - a.x, t.z - a.z) > 0.5;
        if (going && moved < 0.01) stuckFor.set(a.def.id, (stuckFor.get(a.def.id) ?? 0) + dt);
        else stuckFor.set(a.def.id, 0);
        if ((stuckFor.get(a.def.id) ?? 0) > 3.5) note(a.def.id, 'stuck against a wall', a.x, a.z);
      }
    }
  }
  return { actors: sys.actors.length, seconds, periods, faults, longestLeg, farthest };
}
