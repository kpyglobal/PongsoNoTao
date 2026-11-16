/**
 * Dialogue language control (雙語 / 僅繁中 / 僅族語). Shown on the start screens and
 * in the 圖鑑手札 settings, not inside in-game dialogue boxes.
 */
import type { LangMode } from '../core/state';

export const LANG_OPTIONS: { id: LangMode; label: string }[] = [
  { id: 'both', label: '雙語' },
  { id: 'zh', label: '僅繁中' },
  { id: 'tao', label: '僅族語' },
];

export function langToggleHtml(): string {
  const btns = LANG_OPTIONS.map((o) => `<button type="button" data-lang="${o.id}" role="radio" aria-checked="false">${o.label}</button>`).join('');
  return `<div class="lang-toggle" role="radiogroup" aria-label="對話語言">${btns}</div>`;
}

export function syncLangToggles(root: ParentNode, lang: LangMode): void {
  root.querySelectorAll('.lang-toggle button[data-lang]').forEach((b) => {
    const on = (b as HTMLElement).dataset.lang === lang;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
}

/** Start-screen language buttons sit in a bar that keeps its taps to itself; they report the pick here. */
let picked: ((m: LangMode) => void) | null = null;
export function onLangPick(fn: (m: LangMode) => void): void {
  picked = fn;
}
export function pickLang(m: LangMode): void {
  picked?.(m);
}
