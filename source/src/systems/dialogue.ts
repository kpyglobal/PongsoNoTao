/**
 * NPC chat when no quest step runs (content/dialogue). Two kinds of set:
 * - legacy node: `lines` (+ speaker / unlocks) — elder_home, clinic_nutrition, fish_* …
 * - NPC set: greet + one duty line + one idle group picked by time / season, `after.<quest>` once a quest is
 *   done (newest wins), and for recipe keepers `keeper` (invite → missing {need} → teach → after).
 * Picking is pure; Game turns the lines into the dialogue box.
 */
import type { DialogueLine, DialogueSet, SeasonTag, TimeWindow } from '../content/types';

export interface ChatCtx {
  time: Exclude<TimeWindow, 'any'>;
  season: SeasonTag;
  done: (quest: string) => boolean;
  /** recipe keeper state for this NPC: null = no recipe quest running */
  keeper?: { learned: boolean; active: boolean; missing: string } | null;
  /** rotate idle / duty lines between talks */
  turn: number;
}

const fill = (ls: DialogueLine[], need: string): DialogueLine[] => ls.map((l) => ({ ...l, zh: l.zh.replace('{need}', need) }));

export class Dialogue {
  constructor(readonly sets: Map<string, DialogueSet>) {}

  get(id: string): DialogueSet | undefined {
    return id === 'origins' ? undefined : this.sets.get(id);
  }

  /** legacy node with lines (or undefined) */
  node(id: string): DialogueSet | undefined {
    const n = this.get(id);
    return n && Array.isArray(n.lines) ? n : undefined;
  }

  /** origin intro lines (legacy origins block) */
  origin(id: string): DialogueLine | undefined {
    return (this.sets.get('origins') as unknown as Record<string, DialogueLine> | undefined)?.[id];
  }

  /** chat lines for an NPC set (empty = nothing to say) */
  chat(id: string, c: ChatCtx): DialogueLine[] {
    const s = this.get(id);
    if (!s) return [];
    if (s.lines) return s.lines;
    const out: DialogueLine[] = [];
    if (s.keeper && c.keeper) {
      const k = c.keeper;
      if (k.active) return k.missing ? [...(c.turn === 0 ? s.keeper.invite : []), ...fill(s.keeper.missing, k.missing)] : s.keeper.teach;
      if (k.learned) out.push(...s.keeper.after);
    }
    // after-quest lines: the last listed quest that is done wins
    const after = Object.entries(s.after ?? {}).filter(([q]) => c.done(q)).pop();
    if (after) return [...(s.greet ?? []).slice(0, 1), ...after[1]];
    if (c.turn === 0 && s.greet) out.unshift(...s.greet);
    if (s.duty?.length) out.push(s.duty[c.turn % s.duty.length]);
    const groups = (s.idle ?? []).filter((g) => (!g.when?.time || g.when.time === 'any' || g.when.time === c.time) && (!g.when?.seasons?.length || g.when.seasons.includes(c.season)));
    const g = groups.length ? groups[c.turn % groups.length] : s.idle?.[0];
    if (g?.lines.length) out.push(g.lines[c.turn % g.lines.length]);
    return out;
  }
}
