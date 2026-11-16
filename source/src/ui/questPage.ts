/**
 * 0.1.5 quest page: accepting a new quest opens the notebook straight on that quest's own page.
 * The goal and the hint type out quickly (tap to show all at once); the things the quest needs are listed like
 * the recipe card (icon, Tao name, name, have / need). Tap anywhere to close; it shrinks into the 圖鑑手札 button.
 * 中文＋English: every Chinese paragraph is followed by its English paragraph, so both have the same number of lines.
 */
import { Typewriter } from './typewriter';
import { english, isBi, isEn, tr } from './i18n';
import { el, ingredientRows, type CardJob, type IngredientRow } from './cards';

export interface QuestPageData {
  id: string;
  /** 主線／支線／相簿水下 */
  line: string;
  name: string;
  roles: string[];
  giver?: string;
  objective: string;
  hint?: string;
  hintTao?: string;
  rows?: IngredientRow[];
}

/** one paragraph in the interface language(s); returns the elements to type */
function para(box: HTMLElement, raw: string, cls: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  const p = el('p', `qp-p ${cls}`, isEn() ? tr(raw) : raw);
  if (isEn()) p.dataset.keepLang = '';
  box.append(p);
  out.push(p);
  if (isBi()) {
    const en = english(raw);
    if (en) {
      const e = el('p', `qp-en ${cls}`, en);
      e.lang = 'en';
      box.append(e);
      out.push(e);
    }
  }
  return out;
}

export function questPageEl(d: QuestPageData): { el: HTMLElement; typed: HTMLElement[] } {
  const c = el('div', 'tc-card tc-page');
  c.dataset.card = 'page';
  c.dataset.key = `q:${d.id}`;
  c.dataset.qid = d.id;
  const head = el('div', 'qp-head');
  head.append(el('span', 'qp-badge', '新任務'), el('span', 'qp-kicker', `${d.line}｜${d.id}`));
  c.append(head, el('h3', 'qp-title', d.name));
  if (isBi()) {
    const en = english(d.name);
    if (en) {
      const e = el('div', 'qp-title-en', en);
      e.lang = 'en';
      c.append(e);
    }
  }
  const chips = el('div', 'qp-chips');
  for (const r of d.roles) chips.append(el('span', 'qp-chip', r));
  if (d.giver) chips.append(el('span', 'qp-chip giver', d.giver));
  c.append(chips);
  const typed: HTMLElement[] = [];
  c.append(el('div', 'qp-label', '目標'));
  typed.push(...para(c, d.objective, 'qp-obj'));
  if (d.hint) {
    c.append(el('div', 'qp-label', '提示'));
    if (d.hintTao) {
      const t = el('p', 'qp-tao', d.hintTao);
      t.lang = 'tao';
      c.append(t);
    }
    typed.push(...para(c, d.hint, 'qp-hint'));
  }
  if (d.rows?.length) {
    c.append(el('div', 'qp-label', '需要的東西'), ingredientRows(d.rows, 'tc-ings qp-ings'));
  }
  return { el: c, typed };
}

export function questPageJob(d: QuestPageData, after?: () => void): CardJob {
  const { el: page, typed } = questPageEl(d);
  // fast typing (tests may slow it down to catch it mid-way)
  const tw = new Typewriter((window as { __taoTypeMs?: number }).__taoTypeMs ?? 14, false);
  return {
    el: page,
    kind: 'page',
    key: `q:${d.id}`,
    onShow: () => tw.start(typed),
    onTap: () => tw.finish(),
    after,
  };
}
