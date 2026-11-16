/**
 * 0.1.6 loading: art the game shows later (cards, portraits, album thumbnails, the next village's music and people)
 * is fetched quietly in the background while playing, two files at a time, so it is in the browser cache by the
 * time a card or the notebook opens. Nothing here blocks the game; failures are ignored (the screen loads it
 * again when it needs it). Skipped on Data Saver.
 */
import { assetUrl } from '../core/paths';
import FILES from 'virtual:tao-prefetch';

type Listener = (done: number, total: number) => void;

const seen = new Set<string>();
const queue: string[] = [];
let running = 0;
let done = 0;
let total = 0;
let listener: Listener | null = null;

function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === '2g' || c.effectiveType === 'slow-2g');
}

function pump(): void {
  while (running < 2 && queue.length) {
    const url = queue.shift()!;
    running++;
    const opts: RequestInit & { priority?: string } = { priority: 'low', credentials: 'same-origin' };
    fetch(url, opts)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .finally(() => {
        running--;
        done++;
        listener?.(done, total);
        if (done >= total) { done = 0; total = 0; }
        pump();
      });
  }
}

/** queue files (paths under the site root, e.g. assets/cards/icons/goat.webp); each one is fetched once */
export function warm(paths: readonly string[]): void {
  if (saveData()) return;
  for (const p of paths) {
    const url = assetUrl(p);
    if (seen.has(url)) continue;
    seen.add(url);
    queue.push(url);
    total++;
  }
  if (total) listener?.(done, total);
  pump();
}

/** the light progress chip (HUD) */
export function onWarmProgress(fn: Listener): void {
  listener = fn;
}

/** cards, portraits and album thumbnails: started once the island is up */
export function warmBackground(): void {
  warm(FILES.background);
}

/** a village's people (NPC atlas), music and photo-spot pictures, when the player heads toward it */
export function warmVillage(paths: readonly string[]): void {
  warm(paths);
}

/** test hook */
export function warmStats(): { queued: number; seen: number; running: number } {
  return { queued: queue.length, seen: seen.size, running };
}
