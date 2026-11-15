/**
 * Outfits: unlocked by quest rewards (`gives.outfits`, saved in the quest save), equipped per party member.
 * Equipping swaps both the walk sheet (characters/<sheet>_sheet.png + ride_ / canoe_ variants) and the portrait.
 * Data-driven even before the art exists: `ensure()` probes the files once and falls back to the base look,
 * so a missing variant never breaks the game. The traveller only gets outsider-safe accessories (never Tao
 * traditional clothing). Accessories swap the sheet too once `sheetByGender` art exists.
 * Ride / canoe sheets: a variant uses its own `ride_<sheet>` when drawn, else the base outfit's (outfitBaseSheet).
 */
import type { OutfitDef } from '../content/types';
import type { Role } from '../quests/types';
import { assetUrl } from '../core/paths';

/** variant walk sheet → the base outfit it replaces (for ride / canoe sheets that have no variant) */
const variantBase = new Map<string, string>();
export function outfitBaseSheet(sheet: string): string {
  return variantBase.get(sheet) ?? sheet.split('__')[0];
}

export interface OutfitLook {
  sheet: string;
  portrait: string;
}

export class Outfits {
  readonly byId = new Map<string, OutfitDef>();
  /** role → equipped outfit id (kept in the quest save: QuestEngine.wear) */
  get equipped(): Partial<Record<Role, string>> {
    return this.store().wear;
  }
  /** art probe results: url → exists */
  private probed = new Map<string, Promise<boolean>>();
  private ok = new Map<string, boolean>();

  constructor(readonly defs: OutfitDef[], private store: () => { wear: Partial<Record<Role, string>> }) {
    for (const d of defs) this.byId.set(d.id, d);
  }

  /** outfits a role may wear (unlocked set from the quest save) */
  available(r: Role, unlocked: Set<string>): OutfitDef[] {
    return this.defs.filter((d) => d.who.includes(r) && unlocked.has(d.id) && !(r === 't' && d.kind === 'traditional'));
  }

  equip(r: Role, id: string | null, unlocked: Set<string>): boolean {
    if (id === null) {
      delete this.equipped[r];
      return true;
    }
    const d = this.byId.get(id);
    if (!d || !d.who.includes(r) || !unlocked.has(id)) return false;
    if (r === 't' && d.kind === 'traditional') return false;
    this.equipped[r] = id;
    return true;
  }

  /**
   * the look for a role: the equipped outfit's art if it has loaded, else the base (sheet and portrait fall back
   * separately, so a drawn portrait shows even while the walk sheet is still missing).
   */
  look(r: Role, base: OutfitLook, gender: 'm' | 'f' = 'm'): OutfitLook {
    const d = this.equipped[r] ? this.byId.get(this.equipped[r]!) : undefined;
    if (!d) return base;
    const portrait = Outfits.portraitOf(d, gender);
    const sheet = Outfits.sheetOf(d, gender);
    const useSheet = !!sheet && !!this.ok.get(sheetUrl(sheet));
    if (useSheet) variantBase.set(sheet!, base.sheet);
    return {
      sheet: useSheet ? sheet! : base.sheet,
      portrait: portrait && this.ok.get(portraitUrl(portrait)) ? portrait : base.portrait,
    };
  }

  static sheetOf(d: OutfitDef, gender: 'm' | 'f'): string | undefined {
    return d.sheetByGender?.[gender] ?? d.sheet;
  }

  static portraitOf(d: OutfitDef, gender: 'm' | 'f'): string | undefined {
    return d.portraitByGender?.[gender] ?? d.portrait;
  }

  /**
   * load the art of an outfit once so look() can use it: the walk sheet through `loadSheet` (Assets.acquire, held
   * for the session), the portrait with an image probe. Missing files just leave the base look.
   */
  async ensure(id: string, loadSheet: (rel: string) => Promise<unknown>): Promise<void> {
    const d = this.byId.get(id);
    if (!d) return;
    const jobs: Promise<unknown>[] = [];
    for (const s of new Set([d.sheet, d.sheetByGender?.m, d.sheetByGender?.f])) {
      if (!s) continue;
      const u = sheetUrl(s);
      if (!this.probed.has(u)) {
        const p = loadSheet(`characters/${s}_sheet.png`).then(() => true, () => false).then((v) => (this.ok.set(u, v), v));
        this.probed.set(u, p);
      }
      jobs.push(this.probed.get(u)!);
      // 0.1.4: the outfit's own scooter / tatala sheets (optional; missing ones fall back to the base outfit's)
      for (const pre of ['ride_', 'canoe_']) {
        const rel = `characters/${pre}${s}_sheet.png`;
        if (!this.probed.has(rel)) this.probed.set(rel, loadSheet(rel).then(() => true, () => false));
        jobs.push(this.probed.get(rel)!);
      }
    }
    for (const p of new Set([d.portrait, d.portraitByGender?.m, d.portraitByGender?.f])) if (p) jobs.push(this.probe(portraitUrl(p)));
    await Promise.all(jobs);
  }

  /** base outfit of a variant sheet name (`player_trad` → `player` once worn; `player__x` → `player`) */
  static base(sheet: string): string {
    return outfitBaseSheet(sheet);
  }

  private probe(url: string): Promise<boolean> {
    let p = this.probed.get(url);
    if (!p) {
      p = new Promise<boolean>((res) => {
        const img = new Image();
        img.onload = () => res(true);
        img.onerror = () => res(false);
        img.src = url;
      }).then((v) => {
        this.ok.set(url, v);
        return v;
      });
      this.probed.set(url, p);
    }
    return p;
  }
}

const sheetUrl = (s: string): string => assetUrl(`assets/sprites/characters/${s}_sheet.png`);
const portraitUrl = (p: string): string => assetUrl(`assets/portraits/${p}.webp`);
