/**
 * Photo spots: a photo step's `spot` is a place id, a landmark id (src/world/layout.ts LANDMARKS) or a derived
 * place; content/photoSpots adds the per-quest window (time / season / periods) and flags (distanceOnly, noFlash).
 */
import type { PhotoSpotDef, Windowed } from '../content/types';

export interface SpotWorld {
  places: Record<string, { x: number; z: number; zh: string }>;
  landmarks: { id: string; x: number; z: number; zh: string }[];
}

export class PhotoSpots {
  private byQuest = new Map<string, PhotoSpotDef>();
  constructor(readonly defs: PhotoSpotDef[]) {
    for (const d of defs) if (d.quest) this.byQuest.set(d.quest, d);
  }

  forQuest(id: string): PhotoSpotDef | undefined {
    return this.byQuest.get(id);
  }

  /** extra window a photo quest must meet (null = none) */
  window(questId: string): Windowed | null {
    return this.byQuest.get(questId) ?? null;
  }

  /** world position + name of a spot id */
  resolve(w: SpotWorld, spot: string): { x: number; z: number; zh: string } | null {
    const p = w.places[spot];
    if (p) return p;
    const lm = w.landmarks.find((l) => l.id === spot);
    return lm ?? null;
  }
}
