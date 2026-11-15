/**
 * Autosave: party, quest state, inventory and the journal, in localStorage.
 * Export / import (file or save code) lives in game.ts and uses validateSave() too.
 */
import type { GameStateJSON } from './state';
import type { QuestSaveJSON } from '../quests/engine';
import type { Role } from '../quests/types';

export const SAVE_KEY = 'tao-rpg:save:v1';
export const SAVE_BACKUP_KEY = 'tao-rpg:save:backup';
const ROLES: readonly string[] = ['m', 'f', 't'];

export interface SaveJSON {
  v: 1;
  savedAt: number;
  /** quests.json revision the save was written against (informational) */
  contentRev?: string;
  /** world layout revision (src/world/legacy.ts WORLD_REV); missing = 1, the 0.1.0–0.1.3 island */
  world?: number;
  state: GameStateJSON;
  party: { controlled: Role; pos: Record<Role, { x: number; z: number }>; scooter: boolean };
  quests: QuestSaveJSON;
}

const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);

/** bring an older save shape up to the current version; null when it cannot be read */
export function migrate(j: unknown): SaveJSON | null {
  if (!isObj(j)) return null;
  switch (j.v) {
    case 1:
      return j as unknown as SaveJSON;
    default:
      return null; // unknown or newer version
  }
}

/** shape check (M2): anything that boot / resume dereferences must be there and sane */
export function validateSave(j: unknown): SaveJSON | null {
  const s = migrate(j);
  if (!s) return null;
  if (typeof s.savedAt !== 'number' || !Number.isFinite(s.savedAt)) return null;
  if (!isObj(s.state) || !isObj(s.party) || !isObj(s.quests)) return null;
  const q = s.quests as unknown as Record<string, unknown>;
  if (!Array.isArray(q.done) || !isObj(q.active)) return null;
  const p = s.party as unknown as Record<string, unknown>;
  if (!ROLES.includes(p.controlled as string) || !isObj(p.pos)) return null;
  for (const r of ROLES) {
    const pt = (p.pos as Record<string, unknown>)[r];
    if (!isObj(pt) || !Number.isFinite(pt.x) || !Number.isFinite(pt.z)) return null;
  }
  return s;
}

function backupRaw(raw: string): void {
  try {
    if (localStorage.getItem(SAVE_BACKUP_KEY) !== raw) localStorage.setItem(SAVE_BACKUP_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function readSave(): SaveJSON | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = validateSave(JSON.parse(raw));
    // S1: never let the next autosave silently destroy a save we could not read
    if (!s) backupRaw(raw);
    return s;
  } catch {
    if (raw) backupRaw(raw);
    return null;
  }
}

export function writeSave(s: SaveJSON): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false; // private mode / quota: keep playing without a save
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
