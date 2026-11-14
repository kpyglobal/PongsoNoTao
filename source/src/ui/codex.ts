/**
 * 背包／圖鑑 notebook page: bag counts with the pixel icons, 圖鑑 entries with the watercolor illustration
 * (loaded only when the entry is opened), and the unlocked outfits with a 穿上／換回 button.
 * Missing art → a drawn placeholder (first character in a circle), never a broken image.
 */
import type { ItemDef, OutfitDef } from '../content/types';
import { Inventory } from '../systems/inventory';
import { h, nbMore, nbTitle, type NbItem, type NbPage } from './notebook';

export interface CodexVM {
  inv: Inventory;
  /** outfits the party has unlocked, with who wears what */
  outfits: { def: OutfitDef; role: 'm' | 'f' | 't'; worn: boolean }[];
  roleZh: Record<'m' | 'f' | 't', string>;
  onWear: (role: 'm' | 'f' | 't', id: string | null) => void;
}

function art(url: string, cls: string, label: string): HTMLElement {
  const fig = h('figure', `cx-art ${cls}`);
  const img = document.createElement('img');
  img.alt = label;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.onerror = () => {
    img.remove();
    fig.classList.add('missing');
    fig.append(h('span', 'cx-ph', label.slice(0, 1)));
  };
  img.src = url;
  fig.append(img);
  return fig;
}

export function codexPage(vm: CodexVM): NbPage {
  const items: NbItem[] = [];
  for (const { def, n } of vm.inv.bag()) {
    items.push({
      key: `bag:${def.id}`,
      title: `${def.name.zh} ×${n}`,
      tao: def.name.tao,
      mark: 'done',
      data: { item: def.id },
      render: (box) => entry(box, def, `背包｜${categoryZh(def)}`, n),
    });
  }
  for (const o of vm.outfits) {
    items.push({
      key: `outfit:${o.role}:${o.def.id}`,
      title: o.def.name.zh,
      tao: vm.roleZh[o.role],
      mark: o.worn ? 'done' : 'none',
      data: { outfit: o.def.id },
      render: (box) => {
        nbTitle(box, `服裝｜${vm.roleZh[o.role]}`, o.def.name.zh);
        box.append(h('p', 'nd-body', o.def.kind === 'traditional'
          ? '族人親手做給你們的衣服。解鎖後在島上任何地方都可以穿；請珍惜，不要拿來開玩笑。'
          : '旅人的小飾品，是族女教你縫的。旅人不穿族人的傳統服飾。'));
        const b = h('button', 'nd-act', o.worn ? '換回平常的衣服' : '穿上') as HTMLButtonElement;
        b.type = 'button';
        b.addEventListener('click', () => vm.onWear(o.role, o.worn ? null : o.def.id));
        box.append(b);
      },
    });
  }
  const codex = vm.inv.codex();
  for (const c of codex) {
    items.push({
      key: `cx:${c.def.id}`,
      title: c.known ? c.def.name.zh : '？？？',
      tao: c.known ? c.def.name.tao : undefined,
      mark: c.known ? 'done' : 'locked',
      data: { codex: c.def.id },
      render: (box) => {
        if (!c.known) {
          nbTitle(box, `圖鑑｜${c.category}`, '？？？');
          box.append(h('p', 'nd-body muted', '還沒見過。在島上採集、交換或遠遠觀察後，就會記在這裡。'));
          return;
        }
        entry(box, c.def, `圖鑑｜${c.category}`, c.n);
      },
    });
  }
  const known = codex.filter((c) => c.known).length;
  return { heading: '背包與圖鑑', sub: `圖鑑 ${known} / ${codex.length}｜背包 ${vm.inv.bag().length} 種`, items };
}

function categoryZh(d: ItemDef): string {
  return { tool: '裝備', ingredient: '食材', material: '材料', accessory: '飾品', observe: '觀察紀錄' }[d.category] ?? '';
}

function entry(box: HTMLElement, d: ItemDef, kicker: string, n: number): void {
  const head = h('div', 'cx-head');
  head.append(art(Inventory.iconUrl(d), 'cx-icon', d.name.zh));
  box.append(head);
  nbTitle(box, kicker, d.name.zh, d.name.tao || undefined);
  if (d.collectible && n > 0) box.append(h('div', 'nd-label', `背包裡有 ${n} 份`));
  box.append(h('p', 'nd-body', d.description));
  box.append(art(Inventory.illustrationUrl(d), 'cx-illus', d.name.zh));
  box.append(h('p', 'nd-body', d.codex));
  if (d.nutrition) box.append(nbMore('營養', [h('p', 'nd-body', d.nutrition)]));
}
