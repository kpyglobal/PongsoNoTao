/**
 * Inventory (背包) + 圖鑑 (codex). Counts live in the quest save (QuestEngine.items) so quest gates read them
 * directly; "seen" items (also observed animals that never go in the bag) are `item:<id>` in QuestEngine.collect.
 * Art: pixel icon assets/items/icons/<icon key>.png (icon_<id>), watercolor illustration assets/items/<key>.webp (illus_<id>) — both loaded
 * only when the 背包／圖鑑 page shows them; a missing file falls back to a drawn placeholder (see ui/codex.ts).
 */
import { assetUrl } from '../core/paths';
import type { ItemDef } from '../content/types';

export interface InventoryStore {
  items: Record<string, number>;
  collect: Set<string>;
  /** quest flags (observe entries with `unlockFlag`) */
  flags?: Set<string>;
}

const CATEGORY_ZH: Record<ItemDef['category'], string> = {
  tool: '裝備', ingredient: '食材', material: '材料', accessory: '飾品', observe: '觀察紀錄',
};


export class Inventory {
  constructor(
    readonly defs: Map<string, ItemDef>,
    private store: () => InventoryStore,
  ) {}

  count(id: string): number {
    return this.store().items[id] ?? 0;
  }

  /** 0.1.5 cards: called the first time an item becomes known (found, bought, given or observed) */
  onFirst: ((id: string) => void) | null = null;

  /** put n in the bag (observe-only items are just marked seen); returns the new count */
  add(id: string, n = 1): number {
    const s = this.store();
    const was = this.known(id);
    s.collect.add(`item:${id}`);
    const d = this.defs.get(id);
    if (d && !d.collectible) {
      if (!was) this.onFirst?.(id);
      return 0;
    }
    s.items[id] = (s.items[id] ?? 0) + n;
    if (!was) this.onFirst?.(id);
    return s.items[id];
  }

  /** mark seen without putting anything in the bag (a quest shows or gives it) */
  see(id: string): void {
    const was = this.known(id);
    this.store().collect.add(`item:${id}`);
    if (!was && this.defs.has(id)) this.onFirst?.(id);
  }

  take(id: string, n = 1): boolean {
    const s = this.store();
    if ((s.items[id] ?? 0) < n) return false;
    s.items[id] -= n;
    return true;
  }

  /** seen at least once (bag, gift, observation) */
  known(id: string): boolean {
    const s = this.store();
    if (s.collect.has(`item:${id}`) || (s.items[id] ?? 0) > 0) return true;
    // observe entries can also unlock from a quest flag (e.g. goat ← saw_goats from IO-M1)
    const f = this.defs.get(id)?.unlockFlag;
    return !!f && !!s.flags?.has(f);
  }

  observe(id: string): boolean {
    const s = this.store();
    const was = this.known(id);
    const fresh = !s.collect.has(`item:${id}`);
    s.collect.add(`item:${id}`);
    if (!was) this.onFirst?.(id);
    return fresh;
  }

  name(id: string): string {
    return this.defs.get(id)?.name.zh ?? id;
  }

  /** bag contents (count > 0), content order */
  bag(): { def: ItemDef; n: number }[] {
    return [...this.defs.values()].filter((d) => d.collectible && this.count(d.id) > 0).map((d) => ({ def: d, n: this.count(d.id) }));
  }

  /** every codex entry with its known flag, grouped by category order */
  codex(): { def: ItemDef; known: boolean; n: number; category: string }[] {
    const order: ItemDef['category'][] = ['ingredient', 'material', 'tool', 'accessory', 'observe'];
    return [...this.defs.values()]
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
      .map((d) => ({ def: d, known: this.known(d.id), n: this.count(d.id), category: CATEGORY_ZH[d.category] ?? d.category }));
  }

  static iconUrl(d: ItemDef): string {
    return assetUrl(`assets/items/icons/${d.icon}.png`);
  }

  static illustrationUrl(d: ItemDef): string {
    return assetUrl(`assets/items/${d.illustration}.webp`);
  }
}
