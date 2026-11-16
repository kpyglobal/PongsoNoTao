/**
 * English content (0.1.5): every text field `zh` has an `en` sibling and every other text field `k` a `kEn`
 * sibling (rules: scripts/content/i18n-rules.mjs). In English mode the raw content is copied once at boot with
 * each field replaced by its sibling, so the rest of the game reads `zh` / `text` / … as before.
 * A field with no sibling (or an empty one) keeps its Chinese.
 */
import type { RawContent } from './loader';

const isEnKey = (k: string): boolean => k === 'en' || /[a-z0-9]En$/.test(k);
const enKey = (k: string): string => (k === 'zh' ? 'en' : `${k}En`);

function swap(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(swap);
  if (!v || typeof v !== 'object') return v;
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    const cur = o[k];
    if (isEnKey(k)) { out[k] = cur; continue; }
    const en = o[enKey(k)];
    if (typeof cur === 'string' && typeof en === 'string' && en.trim()) out[k] = en;
    else if (Array.isArray(cur) && Array.isArray(en) && cur.every((x) => typeof x === 'string'))
      out[k] = cur.map((x, i) => (typeof en[i] === 'string' && (en[i] as string).trim() ? en[i] : x));
    else out[k] = swap(cur);
  }
  return out;
}

/** 中文 + English mode: Chinese → English for every content text that has a sibling (dialogue lines, quest names …) */
export function contentEnDict(raw: RawContent): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (isEnKey(k)) continue;
      const cur = o[k];
      const en = o[enKey(k)];
      if (typeof cur === 'string' && typeof en === 'string' && en.trim()) { if (!out.has(cur)) out.set(cur, en); }
      else if (Array.isArray(cur) && Array.isArray(en)) cur.forEach((x, i) => { if (typeof x === 'string' && typeof en[i] === 'string' && !out.has(x)) out.set(x, en[i] as string); });
      else walk(cur);
    }
  };
  for (const v of Object.values(raw)) walk(v);
  return out;
}

export function localizeContent(raw: RawContent, lang: 'zh' | 'en' | 'zhen'): RawContent {
  if (lang !== 'en') return raw;
  const out: RawContent = {};
  for (const [path, v] of Object.entries(raw)) out[path] = swap(v);
  return out;
}
