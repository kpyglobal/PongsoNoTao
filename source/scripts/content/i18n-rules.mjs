/**
 * Which content strings are shown to players and therefore need an English sibling.
 * Rule: a field `zh` gets a sibling `en`; any other text field `k` (string or list of strings) gets `kEn`.
 * Shared by i18n-extract / i18n-apply / test-english-content.
 */
export const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
/** dev-only notes, reviewer queues, speaker tokens and other non-player fields */
export const SKIP_KEYS = new Set(['notes', 'note', 'review', 'loopNote', 'tatalaRolesNote', 'labourNote', 'tokens', 'externalFlags', 'source_note', 'file', 'unlockedBy']);
/** speaker tokens in dialogue lines (src/content/validate.ts) */
export const TOKENS = new Set(['@host', '@giver', '@hostf', '@host.m', '@host.f', '@hostf.m', '@hostf.f', '@m', '@f', '@t', '@npc', '@me', '旁白', '文化聲明']);
/** files left out (none since the map phase: place names and fast-travel labels have English too) */
export const SKIP_FILES = new Set([]);
/** parts of a file left out (none) */
export const SKIP_PATHS = {};
export const skipPath = (file, path) => !!SKIP_PATHS[file]?.test(path);
export const enKey = (k) => (k === 'zh' ? 'en' : `${k}En`);
export const isEnKey = (k) => k === 'en' || /[a-z0-9]En$/.test(k);

/** walk a parsed content file; calls fn(obj, key, value, path) for every player-facing CJK string field (value: string | string[]) */
export function walkText(root, fn, path = '') {
  if (Array.isArray(root)) { root.forEach((x, i) => walkText(x, fn, `${path}[${i}]`)); return; }
  if (!root || typeof root !== 'object') return;
  for (const k of Object.keys(root)) {
    if (SKIP_KEYS.has(k) || isEnKey(k)) continue;
    const v = root[k];
    const p = path ? `${path}.${k}` : k;
    if (typeof v === 'string') {
      if (!CJK.test(v)) continue;
      if (k === 'who' && TOKENS.has(v)) continue;
      fn(root, k, v, p);
    } else if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string')) {
      if (v.some((x) => CJK.test(x))) fn(root, k, v, p);
    } else walkText(v, fn, p);
  }
}
