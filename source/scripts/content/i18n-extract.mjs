// List every player-facing Chinese content string that still has no English (unique, with where it appears).
// node scripts/content/i18n-extract.mjs [out.json]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { walkText, enKey, SKIP_FILES, skipPath } from './i18n-rules.mjs';
const files = execSync('find content -name "*.json"').toString().trim().split('\n').sort().filter((f) => !SKIP_FILES.has(f));
const out = new Map();
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  walkText(j, (obj, k, v, p) => {
    if (skipPath(f, p)) return;
    const en = obj[enKey(k)];
    const list = Array.isArray(v) ? v : [v];
    list.forEach((s, i) => {
      const have = Array.isArray(v) ? Array.isArray(en) && en[i] : typeof en === 'string' && en.trim();
      if (have) return;
      const e = out.get(s) ?? { n: 0, at: [] };
      e.n++; if (e.at.length < 2) e.at.push(`${f.replace('content/', '')}:${p}`);
      out.set(s, e);
    });
  });
}
const arr = [...out].map(([zh, e]) => ({ zh, n: e.n, at: e.at }));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(arr, null, 1));
console.log(`${arr.length} unique strings missing English, ${arr.reduce((a, b) => a + b.n, 0)} fields, ${arr.reduce((a, b) => a + b.zh.length, 0)} chars`);
