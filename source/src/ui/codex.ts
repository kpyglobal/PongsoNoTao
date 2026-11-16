/**
 * 背包／圖鑑 notebook page (0.1.5: an RPG item grid, src/ui/itemGrid.ts): every item with its count, the dishes
 * learned, the unlocked outfits (with a 穿上／換回 button) and the observations. A cell's right page shows its card
 * (the same postcard / recipe scroll as the unlock card) and the longer notes.
 */
import type { OutfitDef } from '../content/types';
import { Inventory } from '../systems/inventory';
import { nbMore, nbTitle, h } from './notebook';
import { postcardEl, recipeEl } from './cards';
import { CATEGORY_ZH, itemCard, itemIcon, outfitCard, outfitIcon, recipeCard, type CardCtx } from './cardData';
import { CARD_ART } from './cards';
import type { GridCell } from './itemGrid';

export interface CodexVM {
  inv: Inventory;
  /** outfits the party has unlocked, with who wears what */
  outfits: { def: OutfitDef; role: 'm' | 'f' | 't'; worn: boolean }[];
  roleZh: Record<'m' | 'f' | 't', string>;
  onWear: (role: 'm' | 'f' | 't', id: string | null) => void;
  card: CardCtx;
  /** dishes learned (journal recipes) */
  recipesKnown: Set<string>;
}

function locked(box: HTMLElement, cat: string): void {
  nbTitle(box, CATEGORY_ZH[cat] ?? '', '？？？');
  box.append(h('p', 'nd-body muted', '還沒見過。在島上採集、交換或遠遠觀察後，就會記在這裡。'));
}

export function codexCells(vm: CodexVM): { cells: GridCell[]; sub: string } {
  const cells: GridCell[] = [];
  const order = ['ingredient', 'material', 'tool', 'accessory', 'observe'];
  const defs = [...vm.inv.defs.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  for (const d of defs.filter((x) => x.category === 'ingredient')) cells.push(itemCell(vm, d.id));
  for (const r of vm.card.recipes) {
    const known = vm.recipesKnown.has(r.id);
    cells.push({
      key: `dish:${r.id}`, cat: 'dish', icon: CARD_ART.dish(r.id), name: r.name.zh, tao: r.name.tao, n: null, known,
      detail: (box) => {
        if (!known) return locked(box, 'dish');
        const rc = recipeCard(vm.card, r.id, '料理');
        if (rc) box.append(recipeEl(rc));
        box.append(h('div', 'nd-label', '做法'), h('p', 'nd-body', r.steps));
        if (r.nutrition) box.append(nbMore(r.clinicNote ? '營養與健康（衛生所筆記）' : '營養', [h('p', 'nd-body', r.nutrition)]));
      },
    });
  }
  for (const d of defs.filter((x) => x.category !== 'ingredient')) cells.push(itemCell(vm, d.id));
  for (const o of vm.outfits) {
    cells.push({
      key: `outfit:${o.role}:${o.def.id}`, cat: 'outfit', icon: outfitIcon(o.def), name: o.def.name.zh, tao: vm.roleZh[o.role], n: null, known: true,
      badge: o.worn ? '✓' : undefined,
      detail: (box) => {
        const pc = outfitCard(vm.card, o.def.id);
        if (pc) box.append(postcardEl({ ...pc, kicker: `服裝｜${vm.roleZh[o.role]}` }));
        box.append(h('p', 'nd-body', o.def.kind === 'traditional'
          ? '族人親手做給你們的衣服。解鎖後在島上任何地方都可以穿；請珍惜，不要拿來開玩笑。'
          : '旅人的小飾品，是族女教你縫的。旅人不穿族人的傳統服飾。'));
        const b = h('button', 'nd-act', o.worn ? '換回平常的衣服' : '穿上') as HTMLButtonElement;
        b.type = 'button';
        b.dataset.outfit = o.def.id;
        b.addEventListener('click', () => vm.onWear(o.role, o.worn ? null : o.def.id));
        box.append(b);
      },
    });
  }
  const items = cells.filter((c) => c.cat !== 'outfit');
  const known = items.filter((c) => c.known).length;
  return { cells, sub: `圖鑑 ${known} / ${items.length}｜背包 ${vm.inv.bag().length} 種` };
}

function itemCell(vm: CodexVM, id: string): GridCell {
  const d = vm.inv.defs.get(id)!;
  const known = vm.inv.known(id);
  const n = d.collectible ? vm.inv.count(id) : null;
  return {
    key: `item:${id}`, cat: d.category, icon: itemIcon(d), name: d.name.zh, tao: d.name.tao, n, known,
    detail: (box) => {
      if (!known) return locked(box, d.category);
      const pc = itemCard(vm.card, id, CATEGORY_ZH[d.category] ?? '');
      if (pc) box.append(postcardEl(pc));
      if (d.collectible && (n ?? 0) > 0) box.append(h('div', 'nd-label', `背包裡有 ${n} 份`));
      if (d.codex) box.append(h('p', 'nd-body', d.codex));
      if (d.nutrition) box.append(nbMore('營養', [h('p', 'nd-body', d.nutrition)]));
    },
  };
}
