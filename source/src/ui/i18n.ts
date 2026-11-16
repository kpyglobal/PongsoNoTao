/**
 * Interface language (0.1.5): 中文, English, or both (中文 with a small English line under dialogue and notices).
 * The picker is two buttons, 中文 and English, that can both be on (= both). Separate from the dialogue mode (雙語 / 僅繁中 / 僅族語),
 * which still picks Tao + translation / translation only / Tao only.
 * - saved in localStorage 'tao-rpg.ui'; no saved value = from the browser language: a Chinese browser gets 中文,
 *   any other browser gets both (中文 + English)
 * - content text: every `zh` / `k` field is swapped for its `en` / `kEn` sibling once at boot (src/content/localize.ts)
 * - interface text: the Chinese the code writes is turned into English as it reaches the page (strings-en.ts),
 *   so screens keep one template; `tr()` is for text that never reaches the page (confirm boxes, the tab title)
 * - switching reloads the page (progress is saved on the way out) so every screen is built in one language
 */
import { EN } from './strings-en';

export type UiLang = 'zh' | 'en' | 'zhen';
export const UI_LANG_KEY = 'tao-rpg.ui';
const RESUME_KEY = 'tao-rpg.ui-resume';
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

export function isUiLang(v: unknown): v is UiLang {
  return v === 'zh' || v === 'en' || v === 'zhen';
}
/** no saved choice: a Chinese browser → 中文 only; English or any other language → 中文 + English */
export function browserUiLang(): UiLang {
  try {
    const l = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
    return l.startsWith('zh') ? 'zh' : 'zhen';
  } catch {
    return 'zh';
  }
}
export function readUiLang(): UiLang {
  try {
    const q = new URLSearchParams(location.search).get('ui');
    if (isUiLang(q)) return q;
    const v = localStorage.getItem(UI_LANG_KEY);
    return isUiLang(v) ? v : browserUiLang();
  } catch {
    return browserUiLang();
  }
}
let current: UiLang | null = null;
export function uiLang(): UiLang {
  return (current ??= readUiLang());
}
export const isEn = (): boolean => uiLang() === 'en';
/** 中文 + English: the interface stays Chinese, dialogue lines and notices get a small English line */
export const isBi = (): boolean => uiLang() === 'zhen';

/** save the pick and rebuild the page in that language (resume = go back into the game after the reload) */
export function setUiLang(l: UiLang, resume: boolean): void {
  if (l === uiLang()) return;
  try {
    localStorage.setItem(UI_LANG_KEY, l);
    if (resume) sessionStorage.setItem(RESUME_KEY, '1');
  } catch { /* private mode: still switch for this page load */ }
  const u = new URL(location.href);
  u.searchParams.delete('ui');
  if (!isUiLangStored(l)) u.searchParams.set('ui', l);
  location.replace(u.toString());
}
function isUiLangStored(l: UiLang): boolean {
  try { return localStorage.getItem(UI_LANG_KEY) === l; } catch { return false; }
}
/** true once after a language switch made from inside the game */
export function takeResume(): boolean {
  try {
    const v = sessionStorage.getItem(RESUME_KEY) === '1';
    sessionStorage.removeItem(RESUME_KEY);
    return v;
  } catch {
    return false;
  }
}

// ---------- translation
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
type Pat = { re: RegExp; out: string; slots: number[] };
let pats: Pat[] | null = null;
function patterns(): Pat[] {
  if (pats) return pats;
  pats = Object.entries(EN)
    .filter(([k]) => /\{\d\}/.test(k))
    .sort((a, b) => b[0].replace(/\{\d\}/g, '').length - a[0].replace(/\{\d\}/g, '').length)
    .map(([k, out]) => {
      const slots: number[] = [];
      const src = k.split(/(\{\d\})/).map((part) => {
        const m = /^\{(\d)\}$/.exec(part);
        if (m) { slots.push(Number(m[1])); return '([\\s\\S]*?)'; }
        return esc(part).replace(/\s+/g, '\\s+');
      }).join('');
      return { re: new RegExp(`^${src}$`), out, slots };
    });
  return pats;
}
/** pieces joined with these are translated one by one */
const SEPS: [string, string][] = [['\n', '\n'], ['｜', ' | '], ['；', '; '], ['：', ': '], ['，', ', '], ['、', ', '], ['・', ' · '], [' ', ' '], ['或', ' or ']];
const PUNCT: [RegExp, string][] = [[/（/g, ' ('], [/）/g, ')'], [/。/g, '. '], [/！/g, '! '], [/？/g, '? '], [/「/g, '"'], [/」/g, '"'], [/　/g, ' ']];

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
let squashed: Map<string, string> | null = null;
function exact(s: string): string | undefined {
  const hit = EN[s];
  if (hit !== undefined) return hit;
  squashed ??= new Map(Object.entries(EN).map(([k, v]) => [squash(k), v]));
  return squashed.get(squash(s));
}

function core(s: string, depth: number): string {
  if (!CJK.test(s)) return s;
  const hit = exact(s);
  if (hit !== undefined) return hit;
  const flat = squash(s);
  for (const p of patterns()) {
    const m = p.re.exec(s) ?? p.re.exec(flat);
    if (!m) continue;
    const vals: string[] = [];
    p.slots.forEach((slot, i) => { vals[slot] = depth < 4 ? toEn(m[i + 1], depth + 1) : m[i + 1]; });
    return p.out.replace(/\{(\d)\}/g, (_, d) => vals[Number(d)] ?? '');
  }
  if (depth < 4) {
    // "名稱（說明）" → each part on its own
    const par = /^([\s\S]*?)（([\s\S]*)）$/.exec(s);
    if (par) return `${toEn(par[1], depth + 1)} (${toEn(par[2], depth + 1)})`.trim();
    for (const [sep, to] of SEPS) {
      if (!s.includes(sep)) continue;
      return s.split(sep).map((x) => toEn(x, depth + 1)).join(to).replace(/ {2,}/g, ' ');
    }
  }
  return s;
}
/** Chinese UI text → English (in 中文 mode, the text unchanged). Leading/trailing spaces are kept. */
export function tr(s: string, depth = 0): string {
  return isEn() ? toEn(s, depth) : s;
}
/** content English by its Chinese (set by the content loader: every zh / k field with an en / kEn sibling) */
let contentEn: Map<string, string> | null = null;
export function setContentEn(m: Map<string, string>): void {
  contentEn = m;
}
/**
 * the English of a Chinese text whatever the interface language (for the 中文 + English mode):
 * content first, then the interface table; null when no full English exists
 */
export function english(s: string): string | null {
  if (!s || !CJK.test(s)) return null;
  const c = contentEn?.get(s) ?? contentEn?.get(squash(s));
  const out = c ?? toEn(s);
  return CJK.test(out) ? null : out;
}
function toEn(s: string, depth = 0): string {
  if (!s || !CJK.test(s)) return s;
  const lead = /^\s*/.exec(s)![0];
  const tail = /\s*$/.exec(s)![0];
  const body = s.slice(lead.length, s.length - tail.length);
  let out = core(body, depth);
  if (depth === 0) {
    for (const [re, to] of PUNCT) out = out.replace(re, to);
    out = out.replace(/ +([,.;:)])/g, '$1').replace(/\( +/g, '(').replace(/ {2,}/g, ' ').trim();
  }
  return lead + out + tail;
}

// ---------- the page
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
/** text that stays as it is in English mode (the language button itself) */
const KEEP = new Set(['中文', '中文＋English']);
/** shorter English where a long phrase would not fit (HUD season chips on phones); the full name stays in the tooltip */
const BY_ID: Record<string, string> = {
  'season-meyvanwa': 'Fish-calling', 'season-rayon': 'Flying fish', 'season-manoyotoyon': 'End of eating', 'season-off': 'Off-season',
};
/** notebook ribbons: one short word each (the page heading keeps the full name) */
const BY_TAB: Record<string, string> = { quests: 'Quests', glossary: 'Tao', food: 'Food', album: 'Album', bag: 'Bag', milestones: 'Milestones', save: 'Save' };
function fixText(n: Text): void {
  const v = n.data;
  if (!CJK.test(v) || KEEP.has(v.trim())) return;
  const p = n.parentElement;
  if (p && (p.closest('[data-keep-lang]') || p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) return;
  const tab = p?.closest('#journal-tabs [data-tab]') as HTMLElement | null;
  const t = (p?.id && BY_ID[p.id]) || (tab && BY_TAB[tab.dataset.tab ?? '']) || tr(v);
  if (t !== v) n.data = t;
}
function fixAttrs(e: Element): void {
  if (e.closest('[data-keep-lang]')) return;
  for (const a of ATTRS) {
    const v = e.getAttribute(a);
    if (v && CJK.test(v)) { const t = tr(v); if (t !== v) e.setAttribute(a, t); }
  }
}
function fixTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { fixText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) fixAttrs(root as Element);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) fixText(n as Text);
    else fixAttrs(n as Element);
  }
}

/** call once before the game builds its screens */
export function installUiLang(): void {
  const l = uiLang();
  document.documentElement.lang = l === 'en' ? 'en' : 'zh-Hant-TW';
  document.documentElement.dataset.ui = l;
  // the 中文 / English buttons (start screens + notebook settings): capture phase, before bars that keep taps to themselves
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement | null)?.closest?.('[data-ui-lang]') as HTMLElement | null;
    if (!b) return;
    const v = b.dataset.uiLang;
    if (!isUiLang(v)) return;
    e.preventDefault();
    e.stopPropagation();
    setUiLang(v, !!b.closest('.journal, .nb-settings, [data-resume-lang]'));
  }, true);
  if (l !== 'en') return;
  document.title = tr(document.title);
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', tr(desc.getAttribute('content') ?? ''));
  fixTree(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') fixText(m.target as Text);
      else if (m.type === 'attributes') fixAttrs(m.target as Element);
      else m.addedNodes.forEach(fixTree);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** 中文 / English / 中文＋English buttons: the labels are always written in both languages (never translated) */
export function uiLangToggleHtml(): string {
  const l = uiLang();
  const b = (id: UiLang, label: string): string => `<button type="button" data-ui-lang="${id}" role="radio" aria-checked="${l === id}" class="${l === id ? 'on' : ''}${id === 'zhen' ? ' is-both' : ''}" lang="${id === 'en' ? 'en' : 'zh-Hant'}">${label}</button>`;
  return `<div class="lang-toggle ui-lang-toggle" role="radiogroup" aria-label="介面語言 Interface language" data-keep-lang>${b('zh', '中文')}${b('en', 'English')}${b('zhen', '中文＋English')}</div>`;
}
