/**
 * 圖鑑手札 as a real notebook (2026-11 redesign).
 * Desktop: a two-page spread — left page = short list (title + tiny status mark), right page = one item's details.
 * Mobile: one page; tapping an item flips to its detail page, ← goes back. Lists are paged, not scrolled.
 */

export type NbMark = 'active' | 'done' | 'locked' | 'none';

export interface NbItem {
  key: string;
  title: string;
  /** Tao / Latin word shown small next to the title (Literata) */
  tao?: string;
  mark: NbMark;
  /** extra data-* for tests (e.g. data-qid) */
  data?: Record<string, string>;
  tracked?: boolean;
  render: (box: HTMLElement) => void;
}

export interface NbPage {
  /** page heading on the left page */
  heading: string;
  /** small line under the heading (counts, legend) */
  sub?: string;
  items: NbItem[];
  /** optional element tucked under the list (filters, warnings) */
  tools?: HTMLElement | null;
  /** optional note always shown on the left page above the list */
  note?: HTMLElement | null;
  empty?: string;
  /** item opened when nothing is selected yet */
  preferKey?: string;
}

const MARK: Record<NbMark, string> = { active: '●', done: '✓', locked: '', none: '' };

export class Notebook {
  private sel = new Map<string, string>();
  private pageNo = new Map<string, number>();
  private flipped = false;
  private tab = '';

  constructor(
    private list: HTMLElement,
    private head: HTMLElement,
    private detail: HTMLElement,
    private book: HTMLElement,
    private pager: HTMLElement,
  ) {
    book.querySelector('#nb-back')?.addEventListener('click', () => this.flip(false));
    // rotation / resize: re-page the list to the new height
    let t = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (this.last && this.list.isConnected && this.list.clientHeight > 0) {
          this.pageNo.delete(this.last.tab);
          this.show(this.last.tab, this.last.pg);
        }
      }, 180);
    });
  }

  private last: { tab: string; pg: NbPage } | null = null;

  get isFlipped(): boolean {
    return this.flipped;
  }

  flip(on: boolean): void {
    this.flipped = on;
    this.book.classList.toggle('flipped', on);
  }

  /** tab changed: back to the list page on mobile */
  resetFlip(): void {
    this.flip(false);
  }

  select(tab: string, key: string): void {
    this.sel.set(tab, key);
  }

  /** rows that fit on the left page (paging instead of long scrolling) */
  private perPage(reserve: number): number {
    const h = this.list.clientHeight - reserve - 6;
    const row = parseFloat(getComputedStyle(this.book).getPropertyValue('--nb-row')) || 40;
    return h > row * 3 ? Math.max(4, Math.floor(h / row)) : 10;
  }

  show(tab: string, pg: NbPage): void {
    this.last = { tab, pg };
    if (tab !== this.tab) {
      this.tab = tab;
      this.flip(false);
    }
    // heading
    const h = document.createElement('h3');
    h.className = 'nb-heading';
    h.textContent = pg.heading;
    const parts: HTMLElement[] = [h];
    if (pg.sub) {
      const s = document.createElement('div');
      s.className = 'nb-sub';
      s.textContent = pg.sub;
      parts.push(s);
    }
    if (pg.note) parts.push(pg.note);
    this.head.replaceChildren(...parts);

    // selection
    const items = pg.items;
    let key = this.sel.get(tab);
    if (!key || !items.some((i) => i.key === key)) key = pg.preferKey && items.some((i) => i.key === pg.preferKey) ? pg.preferKey : items.find((i) => i.mark !== 'locked')?.key ?? items[0]?.key;
    if (key) this.sel.set(tab, key);

    // list page (measure after the heading and the tucked tools are in place)
    const ul = document.createElement('ul');
    ul.className = 'nb-items';
    this.list.replaceChildren(ul);
    if (pg.tools) this.list.append(pg.tools);
    const per = this.perPage(pg.tools?.offsetHeight ?? 0);
    const pages = Math.max(1, Math.ceil(items.length / per));
    let p = this.pageNo.get(tab);
    if (p === undefined) {
      const idx = items.findIndex((i) => i.key === key);
      p = idx >= 0 ? Math.floor(idx / per) : 0;
    }
    p = Math.min(Math.max(0, p), pages - 1);
    this.pageNo.set(tab, p);
    for (const it of items.slice(p * per, p * per + per)) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `nb-item st-${it.mark}${it.key === key ? ' on' : ''}${it.tracked ? ' tracked' : ''}`;
      b.dataset.key = it.key;
      for (const [k, v] of Object.entries(it.data ?? {})) b.dataset[k] = v;
      const t = document.createElement('span');
      t.className = 'nb-t';
      t.textContent = it.mark === 'locked' ? '？？？' : it.title;
      b.append(t);
      if (it.tao && it.mark !== 'locked') {
        const tao = document.createElement('span');
        tao.className = 'nb-tao';
        tao.lang = 'tao';
        tao.textContent = it.tao;
        b.append(tao);
      }
      const m = document.createElement('span');
      m.className = 'nb-mark';
      m.textContent = MARK[it.mark];
      m.setAttribute('aria-label', it.mark === 'active' ? '進行中' : it.mark === 'done' ? '完成' : it.mark === 'locked' ? '未解鎖' : '');
      b.append(m);
      b.addEventListener('click', () => {
        this.sel.set(tab, it.key);
        this.list.querySelectorAll('.nb-item.on').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        this.renderDetail(it);
        this.flip(true);
      });
      li.append(b);
      ul.append(li);
    }
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'nb-empty';
      li.textContent = pg.empty ?? '這一頁還是空白的。';
      ul.append(li);
    }

    // pager
    this.pager.replaceChildren();
    if (pages > 1) {
      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'nb-pg prev';
      prev.textContent = '‹';
      prev.setAttribute('aria-label', '上一頁');
      prev.disabled = p === 0;
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'nb-pg next';
      next.textContent = '›';
      next.setAttribute('aria-label', '下一頁');
      next.disabled = p >= pages - 1;
      const n = document.createElement('span');
      n.className = 'nb-pg-n';
      n.textContent = `${p + 1} / ${pages}`;
      prev.addEventListener('click', () => {
        this.pageNo.set(tab, p! - 1);
        this.show(tab, pg);
      });
      next.addEventListener('click', () => {
        this.pageNo.set(tab, p! + 1);
        this.show(tab, pg);
      });
      this.pager.append(prev, n, next);
    }

    const cur = items.find((i) => i.key === key);
    if (cur) this.renderDetail(cur);
    else this.detail.replaceChildren();
  }

  /** move the list to the page holding `key` next time (filters changed etc.) */
  resetPage(tab: string): void {
    this.pageNo.delete(tab);
  }

  private renderDetail(it: NbItem): void {
    const box = document.createElement('div');
    box.className = `nb-detail-in st-${it.mark}`;
    it.render(box);
    this.detail.replaceChildren(box);
    this.detail.scrollTop = 0;
  }
}

/* ---------- small builders shared by the tabs ---------- */

export function h(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** detail title block: kicker, big title, Tao word */
export function nbTitle(box: HTMLElement, kicker: string, title: string, tao?: string): void {
  if (kicker) box.append(h('div', 'nd-kicker', kicker));
  box.append(h('h4', 'nd-title', title));
  if (tao) {
    const t = h('div', 'nd-tao', tao);
    t.lang = 'tao';
    box.append(t);
  }
}

/** "more" behind a tap (extra hints, clinic notes) */
export function nbMore(label: string, body: HTMLElement[]): HTMLElement {
  const wrap = h('div', 'nd-more');
  const b = h('button', 'nd-more-btn', label) as HTMLButtonElement;
  b.type = 'button';
  b.setAttribute('aria-expanded', 'false');
  const inner = h('div', 'nd-more-body');
  inner.hidden = true;
  inner.append(...body);
  b.addEventListener('click', () => {
    inner.hidden = !inner.hidden;
    b.setAttribute('aria-expanded', inner.hidden ? 'false' : 'true');
  });
  wrap.append(b, inner);
  return wrap;
}

/** a source line behind ⓘ */
export function nbSource(text: string): HTMLElement {
  const wrap = h('div', 'nd-src');
  const b = h('button', 'nd-src-btn', 'ⓘ 來源') as HTMLButtonElement;
  b.type = 'button';
  b.setAttribute('aria-label', '來源');
  const t = h('div', 'nd-src-text', text);
  t.hidden = true;
  b.addEventListener('click', () => {
    t.hidden = !t.hidden;
  });
  wrap.append(b, t);
  return wrap;
}
