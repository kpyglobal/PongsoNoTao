/**
 * 0.1.5 背包 page as an RPG item grid: category tabs, one cell per item / dish / outfit with its count,
 * cells not found yet are greyed with ？. Tapping a cell shows its card (postcard / recipe scroll) on the right
 * page (on phones the page flips), with the longer notes and the 穿上／換回 button under it.
 */
import { el } from './cards';

export interface GridCell {
  key: string;
  /** ingredient | dish | material | tool | accessory | outfit | observe */
  cat: string;
  icon: string;
  name: string;
  tao: string;
  /** bag count (null = not a bag item: observations, dishes, outfits) */
  n: number | null;
  known: boolean;
  /** small mark: 穿著中 etc. */
  badge?: string;
  /** right page: the card view + notes */
  detail: (box: HTMLElement) => void;
}

export interface GridHost {
  head: HTMLElement;
  list: HTMLElement;
  pager: HTMLElement;
  detail: HTMLElement;
  flip: (on: boolean) => void;
}

const TABS: [string, string][] = [
  ['all', '全部'], ['ingredient', '食材'], ['dish', '料理'], ['material', '材料'], ['tool', '裝備'],
  ['accessory', '飾品'], ['outfit', '服裝'], ['observe', '觀察'],
];

export class ItemGrid {
  cat = 'all';
  sel = '';

  render(host: GridHost, cells: GridCell[], sub: string): void {
    const h3 = el('h3', 'nb-heading', '背包與圖鑑');
    host.head.replaceChildren(h3, el('div', 'nb-sub', sub));
    const tabs = el('div', 'ig-tabs');
    tabs.setAttribute('role', 'tablist');
    const present = new Set(cells.map((c) => c.cat));
    for (const [id, zh] of TABS) {
      if (id !== 'all' && !present.has(id)) continue;
      const b = el('button', `ig-tab${this.cat === id ? ' on' : ''}`, zh) as HTMLButtonElement;
      b.type = 'button';
      b.dataset.cat = id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(this.cat === id));
      b.addEventListener('click', () => {
        this.cat = id;
        this.render(host, cells, sub);
      });
      tabs.append(b);
    }
    const shown = cells.filter((c) => this.cat === 'all' || c.cat === this.cat);
    const grid = el('div', 'ig-grid');
    grid.setAttribute('role', 'grid');
    if (!shown.some((c) => c.key === this.sel)) this.sel = shown.find((c) => c.known)?.key ?? shown[0]?.key ?? '';
    for (const c of shown) {
      const b = el('button', `ig-cell${c.known ? '' : ' locked'}${c.key === this.sel ? ' on' : ''}`) as HTMLButtonElement;
      b.type = 'button';
      b.dataset.key = c.key;
      b.dataset.cat = c.cat;
      // the name is in the cell for screen readers (visually hidden; the icon shows it)
      const nm = el('span', 'ig-name', c.known ? `${c.name}${c.n ? ` ×${c.n}` : ''}` : '？？？');
      if (c.known) {
        const i = document.createElement('img');
        i.className = 'ig-ico';
        i.alt = '';
        i.decoding = 'async';
        i.loading = 'lazy';
        i.draggable = false;
        i.onerror = () => {
          i.remove();
          b.append(el('span', 'ig-ph', c.name.slice(0, 1)));
        };
        i.src = c.icon;
        b.append(i);
        if (c.n !== null && c.n > 0) b.append(el('span', 'ig-n', `${Math.min(c.n, 99)}`));
        if (c.badge) b.append(el('span', 'ig-badge', c.badge));
      } else b.append(el('span', 'ig-q', '？'));
      b.append(nm);
      b.addEventListener('click', () => {
        this.sel = c.key;
        grid.querySelectorAll('.ig-cell.on').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        this.detail(host, c);
        host.flip(true);
      });
      grid.append(b);
    }
    if (!shown.length) grid.append(el('p', 'nd-body muted', '這一頁還是空白的。'));
    host.list.replaceChildren(tabs, grid);
    host.pager.replaceChildren();
    const cur = shown.find((c) => c.key === this.sel);
    if (cur) this.detail(host, cur);
    else host.detail.replaceChildren();
  }

  private detail(host: GridHost, c: GridCell): void {
    const box = el('div', `nb-detail-in ig-detail${c.known ? '' : ' st-locked'}`);
    box.dataset.key = c.key;
    c.detail(box);
    host.detail.replaceChildren(box);
    host.detail.scrollTop = 0;
  }
}
