// Write English siblings into content/ from translation tables (JSON objects { "中文": "English" }).
// node scripts/content/i18n-apply.mjs table1.json [table2.json …] [--force]
// Only fills empty siblings unless --force. Prints what is still missing.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { walkText, enKey, SKIP_FILES, skipPath } from './i18n-rules.mjs';
const args = process.argv.slice(2);
const force = args.includes('--force');
const dict = {};
for (const f of args.filter((a) => !a.startsWith('--'))) Object.assign(dict, JSON.parse(fs.readFileSync(f, 'utf8')));
const files = execSync('find content -name "*.json"').toString().trim().split('\n').sort().filter((f) => !SKIP_FILES.has(f));
let filled = 0, missing = 0;
/** insert key nk right after key k (keeps the file readable: zh then en) */
function putAfter(obj, k, nk, val) {
  if (nk in obj) { obj[nk] = val; return; }
  const entries = Object.entries(obj);
  for (const key of Object.keys(obj)) delete obj[key];
  for (const [key, v] of entries) { obj[key] = v; if (key === k) obj[nk] = val; }
}
function format(file, j) {
  if (file.endsWith('milestones.json')) {
    return `{\n  "milestones": [\n${j.milestones.map((m) => `    ${JSON.stringify(m).replace(/","/g, '", "').replace(/":/g, '": ').replace(/,"(\w+)":/g, ', "$1":').replace(/^\{"/, '{ "').replace(/\}$/, ' }')}`).join(',\n')}\n  ]\n}\n`;
  }
  return JSON.stringify(j, null, 2) + '\n';
}
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const j = JSON.parse(src);
  walkText(j, (obj, k, v, p) => {
    if (skipPath(f, p)) return;
    const nk = enKey(k);
    if (Array.isArray(v)) {
      const cur = Array.isArray(obj[nk]) ? obj[nk] : [];
      const next = v.map((s, i) => (!force && cur[i]) || dict[s] || cur[i] || '');
      next.forEach((s) => (s ? null : missing++));
      if (JSON.stringify(next) !== JSON.stringify(obj[nk])) { putAfter(obj, k, nk, next); filled++; }
    } else {
      const cur = typeof obj[nk] === 'string' ? obj[nk] : '';
      const val = (!force && cur.trim()) ? cur : (dict[v] ?? cur);
      if (!val) missing++;
      if (val !== obj[nk]) { putAfter(obj, k, nk, val); filled++; }
    }
  });
  const out = format(f, j);
  if (out !== src) fs.writeFileSync(f, out);
}
console.log(`filled ${filled} fields; ${missing} still missing English`);
