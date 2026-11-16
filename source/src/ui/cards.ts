/**
 * 0.1.5 unlock cards — one shared card template, one shared fly-in (src/ui/fly.ts).
 * - postcard: first time a Tao word, an item, or a finished product (outfit / accessory) is unlocked.
 *   Simple Indigenous-pattern postcard; picture on the left, Tao name + name on the right.
 * - recipe: torn-paper scroll with the dish sketch and the ingredient list (icon, Tao name, name, have / need).
 *   Ingredients not found yet are greyed; their name shows ？？？ until found or taught by the 族語老師.
 * - photo: a printed photo (scenic spots, taken by the traveller).
 * - page: a quest's own notebook page (src/ui/questPage.ts).
 * Cards that trigger together wait in a queue and show one after another; tapping a card (or anywhere) closes
 * it and it flies into the 圖鑑手札 button. The same builders draw the card view inside the notebook.
 * Names follow the interface language: content names are already English in English mode; in 中文＋English
 * the English name is added as a much smaller line. Tao words are never italic.
 */
import { assetUrl } from '../core/paths';
import { english, isBi } from './i18n';
import { fxOn, reducedMotion, zoomButton } from './fly';

export const CARD_ART = {
  postcard: () => assetUrl('assets/cards/postcard.webp'),
  recipe: () => assetUrl('assets/cards/recipe.webp'),
  frame: () => assetUrl('assets/cards/frame.webp'),
  icon: (id: string) => assetUrl(`assets/cards/icons/${id}.webp`),
  dish: (recipe: string) => assetUrl(`assets/cards/icons/dish-${recipe}.webp`),
  sketch: (recipe: string) => assetUrl(`assets/cards/sketch/${recipe}.webp`),
  photo: (spot: string) => assetUrl(`assets/cards/photos/${spot}.webp`),
  thumb: (spot: string) => assetUrl(`assets/cards/thumbs/${spot}.webp`),
};

/** icons that exist in cards-v1 (item ids + a few extras) */
export const CARD_ICONS = new Set([
  'acc_bag_strap', 'acc_woven_band', 'alibangbang', 'cloth_scrap', 'coconut', 'cotton_thread', 'goat', 'headlamp', 'hermit_crab',
  'land_crab', 'lifejacket', 'lunch_bundle', 'millet', 'ovi', 'ramie_thread', 'scooter', 'scops_owl', 'seaweed', 'shellfish', 'soli',
  'sunscreen', 'taro_seedling', 'tatala', 'wakay', 'water', 'woven_cloth',
]);

/** CSS custom properties resolve url() against the stylesheet, so card art goes in as an absolute URL */
const cssUrl = (u: string): string => `url("${new URL(u, document.baseURI).href}")`;

export function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function img(src: string, cls: string, alt = ''): HTMLImageElement {
  const i = document.createElement('img');
  i.className = cls;
  i.alt = alt;
  i.decoding = 'async';
  i.draggable = false;
  i.onerror = () => i.classList.add('missing');
  i.src = src;
  return i;
}

/** Tao name (upright) + name in the interface language (+ small English in 中文＋English) */
export function nameBlock(tao: string, name: string, cls = 'tc-names'): HTMLElement {
  const box = el('div', cls);
  if (tao) {
    const t = el('div', 'tc-tao', tao);
    t.lang = 'tao';
    box.append(t);
  }
  box.append(el('div', tao ? 'tc-name' : 'tc-name solo', name));
  const en = isBi() && name !== '？？？' ? english(name) : null;
  if (en) {
    const e = el('div', 'tc-en', en);
    e.lang = 'en';
    box.append(e);
  }
  return box;
}

export interface PostcardData {
  key: string;
  /** small line on top: 新的族語詞 / 新物品 / 完成作品 … */
  kicker: string;
  /** picture on the left (icon art); none = the Tao word itself, written large */
  img?: string;
  tao: string;
  name: string;
  /** one short line under the name (what it is) */
  line?: string;
  /** several words learned at once: listed instead of one name */
  list?: { tao: string; name: string }[];
}

/** the shared card shell */
function shell(kind: string, key: string): HTMLElement {
  const c = el('div', `tc-card tc-${kind}`);
  c.dataset.card = kind;
  c.dataset.key = key;
  return c;
}

export function postcardEl(d: PostcardData): HTMLElement {
  const c = shell('postcard', d.key);
  c.style.setProperty('--bg', cssUrl(CARD_ART.postcard()));
  const pic = el('div', 'tc-pic');
  if (d.img) pic.append(img(d.img, 'tc-pic-img', d.name));
  else {
    pic.classList.add('word');
    const w = el('div', 'tc-pic-word', d.tao || d.name);
    w.lang = 'tao';
    pic.append(w);
  }
  const txt = el('div', 'tc-text');
  txt.append(el('div', 'tc-kicker', d.kicker));
  if (d.list?.length) {
    const ul = el('ul', 'tc-list');
    ul.replaceChildren(...d.list.map((w) => {
      const li = el('li');
      li.append(nameBlock(w.tao, w.name, 'tc-names small'));
      return li;
    }));
    txt.append(ul);
  } else {
    txt.append(nameBlock(d.tao, d.name));
    if (d.line) txt.append(el('p', 'tc-line', d.line));
  }
  c.append(pic, txt);
  return c;
}

export interface IngredientRow {
  id: string;
  icon: string;
  tao: string;
  name: string;
  have: number;
  need: number;
  /** found at least once (else greyed) */
  found: boolean;
  /** name known (found, or taught by the 族語老師); else ？？？ */
  named: boolean;
}

export interface RecipeData {
  key: string;
  kicker: string;
  recipe: string;
  tao: string;
  name: string;
  rows: IngredientRow[];
  note?: string;
}

export function ingredientRows(rows: IngredientRow[], cls = 'tc-ings'): HTMLElement {
  const ul = el('ul', cls);
  for (const r of rows) {
    const li = el('li', `tc-ing${r.found ? '' : ' unfound'}${r.have >= r.need ? ' enough' : ''}`);
    li.dataset.item = r.id;
    li.append(img(r.icon, 'tc-ing-ico', r.named ? r.name : ''));
    const n = el('div', 'tc-ing-n');
    if (r.tao) {
      const t = el('span', 'tc-tao', r.tao);
      t.lang = 'tao';
      n.append(t);
    }
    const nm = r.named ? r.name : '？？？';
    n.append(el('span', 'tc-ing-name', nm));
    const en = isBi() && r.named ? english(r.name) : null;
    if (en) {
      const e = el('span', 'tc-en', en);
      e.lang = 'en';
      n.append(e);
    }
    li.append(n, el('span', 'tc-count', `${Math.min(r.have, 99)}/${r.need}`));
    ul.append(li);
  }
  return ul;
}

export function recipeEl(d: RecipeData): HTMLElement {
  const c = shell('recipe', d.key);
  c.style.setProperty('--bg', cssUrl(CARD_ART.recipe()));
  const txt = el('div', 'tc-text');
  txt.append(el('div', 'tc-kicker', d.kicker), nameBlock(d.tao, d.name));
  const sk = el('div', 'tc-sketch');
  sk.append(img(CARD_ART.sketch(d.recipe), 'tc-sketch-img', d.name));
  txt.append(sk, el('div', 'tc-label', '食材'), ingredientRows(d.rows));
  if (d.note) txt.append(el('p', 'tc-line', d.note));
  c.append(txt);
  return c;
}

export interface PhotoData {
  key: string;
  spot: string;
  caption: string;
}

export function photoEl(d: PhotoData): HTMLElement {
  const c = shell('photo', d.key);
  c.style.setProperty('--frame', cssUrl(CARD_ART.frame()));
  const win = el('div', 'tc-photo-win');
  win.append(img(CARD_ART.photo(d.spot), 'tc-photo-img', d.caption));
  c.append(win, el('div', 'tc-photo-frame'), el('div', 'tc-caption', d.caption));
  return c;
}

/* ------------------------------------------------------------------ queue */

export interface CardJob {
  el: HTMLElement;
  kind: 'postcard' | 'recipe' | 'photo' | 'page';
  key: string;
  /** show before the waiting cards (a photo just taken) */
  front?: boolean;
  /** seconds before it flies away by itself */
  auto?: number;
  /** a tap while this returns true is used up (e.g. skipping the typing) */
  onTap?: () => boolean;
  onShow?: (el: HTMLElement) => void;
  after?: () => void;
  /** the small line under the card */
  hint?: string;
}

export class CardQueue {
  readonly layer: HTMLElement;
  private stage: HTMLElement;
  private hintEl: HTMLElement;
  /** 0.1.6: 「全部收下」 when more cards are waiting behind the open one */
  private allBtn: HTMLButtonElement;
  private q: CardJob[] = [];
  private cur: CardJob | null = null;
  private closing = false;
  private timer = 0;
  /** keys shown this session (tests) */
  readonly shown: string[] = [];

  constructor(root: HTMLElement, private btn: () => HTMLElement | null) {
    this.layer = el('div', 'tc-layer');
    this.layer.id = 'card-layer';
    this.layer.hidden = true;
    this.layer.setAttribute('role', 'dialog');
    this.layer.setAttribute('aria-modal', 'true');
    this.layer.setAttribute('aria-label', '新卡片');
    this.layer.tabIndex = -1;
    this.stage = el('div', 'tc-stage');
    this.hintEl = el('div', 'tc-hint');
    this.allBtn = el('button', 'tc-all') as HTMLButtonElement;
    this.allBtn.type = 'button';
    this.allBtn.id = 'btn-cards-all';
    this.allBtn.hidden = true;
    this.allBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.collectAll();
    });
    this.layer.append(el('div', 'tc-scrim'), this.stage, this.hintEl, this.allBtn);
    this.layer.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tap();
    });
    this.layer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.tap();
      }
    });
    root.append(this.layer);
  }

  get open(): boolean {
    return !!this.cur;
  }

  get pending(): number {
    return this.q.length;
  }

  get current(): CardJob | null {
    return this.cur;
  }

  push(job: CardJob): void {
    if (job.front) this.q.unshift(job);
    else this.q.push(job);
    if (this.cur) this.refreshAll();
  }

  /** show the next card if none is up; the game calls this only when no dialogue / menu is open */
  pump(): boolean {
    if (this.cur || !this.q.length) return false;
    this.show(this.q.shift()!);
    return true;
  }

  private show(job: CardJob): void {
    this.cur = job;
    this.shown.push(job.key);
    this.layer.dataset.kind = job.kind;
    this.layer.dataset.key = job.key;
    this.stage.replaceChildren(job.el);
    this.hintEl.textContent = job.hint ?? (job.kind === 'page' ? '點一下任何地方關閉' : '點一下收進手札');
    this.refreshAll();
    this.layer.hidden = false;
    this.layer.classList.remove('leaving');
    void this.layer.offsetWidth;
    this.layer.classList.add('show');
    if (fxOn() && !reducedMotion() && typeof job.el.animate === 'function') {
      job.el.animate(
        [{ transform: 'translateY(18px) scale(0.86) rotate(-1.2deg)', opacity: 0 }, { transform: 'translateY(0) scale(1) rotate(0)', opacity: 1 }],
        { duration: 380, easing: 'cubic-bezier(0.2, 1.25, 0.4, 1)' },
      );
    }
    try { this.layer.focus({ preventScroll: true }); } catch { /* old browsers */ }
    job.onShow?.(job.el);
    if (job.auto) this.timer = window.setTimeout(() => void this.close(), job.auto * 1000);
  }

  /** the 「全部收下」 button: shown while 2 or more cards are up / waiting */
  private refreshAll(): void {
    const n = (this.cur ? 1 : 0) + this.q.length;
    this.allBtn.hidden = n < 2;
    this.allBtn.textContent = `全部收下（${n}）`;
  }

  /** 0.1.6: put the open card and every waiting one into the notebook at once (they fly in together) */
  async collectAll(): Promise<void> {
    const c = this.cur;
    if (!c || this.closing) return;
    this.closing = true;
    window.clearTimeout(this.timer);
    const rest = this.q;
    this.q = [];
    this.allBtn.hidden = true;
    this.layer.classList.add('leaving');
    // the waiting cards fan out behind the open one for a moment, then everything flies to the notebook button
    const ghosts = rest.slice(0, 6).map((j, i) => {
      const g = j.el;
      g.classList.add('tc-ghost');
      g.style.setProperty('--gi', String(i + 1));
      this.stage.prepend(g);
      return g;
    });
    const btn = this.btn();
    await Promise.all([
      zoomButton(c.el, btn, 'close', 560),
      ...ghosts.map((g, i) => new Promise<void>((r) => window.setTimeout(() => void zoomButton(g, btn, 'close', 520).then(r), 70 * (i + 1)))),
    ]);
    this.stage.replaceChildren();
    this.layer.classList.remove('show', 'leaving');
    this.layer.hidden = true;
    this.cur = null;
    this.closing = false;
    for (const j of rest) this.shown.push(j.key);
    for (const j of [c, ...rest]) j.after?.();
  }

  /** tap anywhere: skip the typing first (quest page), else close */
  tap(): void {
    const c = this.cur;
    if (!c || this.closing) return;
    if (c.onTap?.()) return;
    void this.close();
  }

  /** fly the open card into the notebook button, then show the next one */
  async close(): Promise<void> {
    const c = this.cur;
    if (!c || this.closing) return;
    this.closing = true;
    window.clearTimeout(this.timer);
    this.layer.classList.add('leaving');
    await zoomButton(c.el, this.btn(), 'close', c.kind === 'page' ? 700 : 620);
    this.stage.replaceChildren();
    this.layer.classList.remove('show', 'leaving');
    this.layer.hidden = true;
    this.cur = null;
    this.closing = false;
    c.after?.();
  }

  /** drop everything (new game, load, debug closeAll) */
  clear(): void {
    window.clearTimeout(this.timer);
    this.q = [];
    const c = this.cur;
    this.cur = null;
    this.closing = false;
    this.stage.replaceChildren();
    this.layer.classList.remove('show', 'leaving');
    this.layer.hidden = true;
    void c;
  }
}
