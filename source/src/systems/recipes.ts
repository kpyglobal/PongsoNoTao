/**
 * Recipes: what the active recipe quests still need, where each ingredient comes from (item `sources`), and the
 * keeper (the village woman / elder who teaches the dish once the ingredients are collected — the teach step is
 * the recipe quest's own talk step in content/quests/recipes.json).
 */
import type { ItemDef, RecipeDef } from '../content/types';
import type { QuestDef, QuestStep, Req } from '../quests/types';

export interface RecipeCtx {
  active: Map<string, number>;
  get: (id: string) => QuestDef | undefined;
  step: (q: QuestDef) => QuestStep | null;
  count: (item: string) => number;
}

export class Recipes {
  readonly byId = new Map<string, RecipeDef>();
  constructor(
    readonly defs: RecipeDef[],
    private items: Map<string, ItemDef>,
    private npcName: (id: string) => string,
    private placeName: (id: string) => string,
    private nodePlace: (node: string) => { label: string; place: string } | null,
  ) {
    for (const r of defs) this.byId.set(r.id, r);
  }

  /** item reqs inside an `until` */
  static itemReqs(r: Req | undefined, out: { item: string; min: number }[] = []): { item: string; min: number }[] {
    if (!r || typeof r === 'string') return out;
    if ('all' in r) r.all.forEach((x) => Recipes.itemReqs(x, out));
    else if ('item' in r) out.push({ item: r.item, min: r.min });
    return out;
  }

  /** ingredients the active recipe quests still need (item → missing count) */
  needed(c: RecipeCtx): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [qid] of c.active) {
      const q = c.get(qid);
      const st = q ? c.step(q) : null;
      if (!q?.recipe || !st?.until) continue;
      for (const r of Recipes.itemReqs(st.until)) {
        const miss = r.min - c.count(r.item);
        if (miss > 0) out[r.item] = Math.max(out[r.item] ?? 0, miss);
      }
    }
    return out;
  }

  /** shop NPC → needed items it sells */
  shopWants(npc: string, need: Record<string, number>): { id: string; n: number; zh: string }[] {
    const out: { id: string; n: number; zh: string }[] = [];
    for (const [id, n] of Object.entries(need)) {
      const d = this.items.get(id);
      if (d?.sources?.some((s) => s.kind === 'shop' && s.npc === npc)) out.push({ id, n, zh: d.name.zh });
    }
    return out;
  }

  /** zh-TW "where to get it" for an ingredient */
  how(id: string): string {
    const d = this.items.get(id);
    const parts = (d?.sources ?? []).map((s) => {
      if (s.kind === 'shop') return `${s.npc ? this.npcName(s.npc) : '店裡'}買得到`;
      if (s.kind === 'minigame') return s.id === 'fish' ? '飛魚季到開元港的捕飛魚體驗' : '任一部落的水芋田（採收）';
      if (s.kind === 'gather' || s.kind === 'observe') {
        const n = s.node ? this.nodePlace(s.node) : null;
        return n ? `${this.placeName(n.place)}（${n.label}）` : '野外採集';
      }
      return '';
    }).filter(Boolean);
    return parts.join('；') || '問問部落的人';
  }

  /** a keeper's recipes whose quest is active: invite (not collected yet) / ready (teach now) */
  keeperState(npc: string, c: RecipeCtx): { recipe: RecipeDef; missing: Record<string, number> } | null {
    for (const r of this.defs) {
      if (r.keeper !== npc || !r.quest || !c.active.has(r.quest)) continue;
      const missing: Record<string, number> = {};
      for (const [id, n] of Object.entries(r.ingredients)) if (c.count(id) < n) missing[id] = n - c.count(id);
      return { recipe: r, missing };
    }
    return null;
  }
}
