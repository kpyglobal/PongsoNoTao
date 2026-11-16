// 0.1.5 English: (1) every player-facing content text has its English sibling (en / kEn), with no Chinese left in
// it and the same {…} slots; (2) every Chinese interface text in src/ (outside src/world) turns into
// English through the interface table (src/ui/strings-en.ts); (3) place names: content + the names src/world writes
// (src/world/names.ts). No browser needed.
// node scripts/test-english-content.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import ts from 'typescript';
import { walkText, enKey, SKIP_FILES, skipPath } from './content/i18n-rules.mjs';

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
const fails = [];
const check = (name, ok, info) => { if (!ok) fails.push(name); console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 600) : ''); };

// (1) content
const files = execSync('find content -name "*.json"').toString().trim().split('\n').sort().filter((f) => !SKIP_FILES.has(f));
let total = 0, chars = 0;
const missing = [], cjkLeft = [], slots = [];
const holes = (t) => [...String(t).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
for (const f of files) {
  walkText(JSON.parse(fs.readFileSync(f, 'utf8')), (obj, k, v, p) => {
    if (skipPath(f, p)) return;
    const en = obj[enKey(k)];
    (Array.isArray(v) ? v : [v]).forEach((zh, i) => {
      total++; chars += zh.length;
      const e = Array.isArray(v) ? (Array.isArray(en) ? en[i] : undefined) : en;
      if (typeof e !== 'string' || !e.trim()) missing.push(`${f}:${p}`);
      else {
        if (CJK.test(e)) cjkLeft.push(`${f}:${p}: ${e.slice(0, 40)}`);
        if (holes(zh) !== holes(e)) slots.push(`${f}:${p}`);
      }
    });
  });
}
console.log(`content: ${total} player-facing texts (${chars} Chinese characters) in ${files.length} files`);
check('content: every text has English', missing.length === 0, missing.slice(0, 20));
check('content: no Chinese inside the English', cjkLeft.length === 0, cjkLeft.slice(0, 20));
check('content: English keeps the {…} slots', slots.length === 0, slots.slice(0, 20));
// place names (content/places.json) and fast-travel labels (ui.json travel[]) are in the check above;
// villages are their Tao names (docs/en-glossary.md)
{
  const pj = JSON.parse(fs.readFileSync('content/places.json', 'utf8'));
  const tv = JSON.parse(fs.readFileSync('content/ui.json', 'utf8')).travel ?? [];
  const bad = [];
  for (const [id, p] of Object.entries(pj.places)) if (p.kind === 'tribe' && p.en !== p.tao) bad.push(`${id}: ${p.en} ≠ ${p.tao}`);
  for (const t of tv) if (pj.places[t.id]?.kind === 'tribe' && t.en !== t.tao) bad.push(`travel ${t.id}: ${t.en} ≠ ${t.tao}`);
  check('places: villages use their Tao names in English (map labels + fast travel)', bad.length === 0, bad);
}
// names the world code writes itself (src/world/names.ts): every landmark, lake, quest spot it adds, goat herd and prompt
{
  const out = ts.transpileModule(fs.readFileSync('src/world/names.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const tmpN = fs.mkdtempSync(path.join(os.tmpdir(), 'tao-names-'));
  fs.writeFileSync(path.join(tmpN, 'names.mjs'), out);
  const { WORLD_EN, hostNames, setWorldLang } = await import(path.join(tmpN, 'names.mjs'));
  fs.rmSync(tmpN, { recursive: true, force: true });
  const pj = JSON.parse(fs.readFileSync('content/places.json', 'utf8'));
  const lay = fs.readFileSync('src/world/layout.ts', 'utf8');
  const ids = new Set([...(pj.landmarks ?? []), ...(pj.derived?.ids ?? []).filter((i) => !i.startsWith('host_'))]);
  for (const m of lay.matchAll(/mkLake\('(\w+)'/g)) ids.add(m[1]);
  for (const m of lay.matchAll(/\b(?:lm|shoreLm)\('(\w+)'/g)) ids.add(m[1]);
  for (const m of fs.readFileSync('src/world/goats.ts', 'utf8').matchAll(/\['(herd_\w+)'/g)) ids.add(m[1]);
  for (const m of fs.readFileSync('src/world/populate.ts', 'utf8').matchAll(/wname\('([\w-]+)'/g)) ids.add(m[1]);
  const miss = [...ids].filter((i) => typeof WORLD_EN[i] !== 'string' || !WORLD_EN[i].trim() || CJK.test(WORLD_EN[i]));
  setWorldLang('en');
  const hn = [true, false].map((mh) => Object.values(hostNames('Yayo', mh, 'Yayo taro field')).join(' / '));
  setWorldLang('zh');
  console.log(`world names: ${ids.size} ids with English (e.g. ${WORLD_EN.hongtou_rock}); host spots: ${hn[1]}`);
  check('world code: every place name it writes has English', miss.length === 0, miss);
  check('world code: host-family spot names are English', hn.every((s) => !CJK.test(s)), hn);
}

// (2) interface: load the table + tr() (TypeScript → temp ES modules)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tao-en-'));
for (const f of ['strings-en', 'i18n']) {
  const out = ts.transpileModule(fs.readFileSync(`src/ui/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(path.join(tmp, `${f}.mjs`), out.replace(/from '\.\/strings-en'/, "from './strings-en.mjs'"));
}
globalThis.location = { search: '?ui=en', href: 'http://x/?ui=en' };
globalThis.localStorage = { getItem: () => 'en', setItem() {}, removeItem() {} };
const { tr } = await import(path.join(tmp, 'i18n.mjs'));
const { EN } = await import(path.join(tmp, 'strings-en.mjs'));
check('interface table: no Chinese inside the English', Object.values(EN).every((v) => !CJK.test(v)), Object.entries(EN).filter(([, v]) => CJK.test(v)));
check('interface table: English keeps the {…} slots', Object.entries(EN).every(([k, v]) => holes(k) === holes(v)), Object.entries(EN).filter(([k, v]) => holes(k) !== holes(v)).map(([k]) => k));

// Chinese string literals the code shows (text pieces of HTML templates, attribute values, plain strings)
const DEV_ONLY = [/^src\/content\/validate\.ts$/, /^src\/ui\/i18n\.ts$/]; // speaker tokens / the 中文 button / comments-like ids
const src = execSync('find src -name "*.ts"').toString().trim().split('\n').filter((f) => !f.startsWith('src/world/') && !f.endsWith('strings-en.ts') && !DEV_ONLY.some((r) => r.test(f))).sort();
const units = new Map();
const addU = (s, at) => { const t = s.replace(/\s+/g, ' ').trim(); if (CJK.test(t) && !units.has(t)) units.set(t, at); };
for (const f of src) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (n) => {
    let s = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) s = n.text;
    else if (ts.isTemplateExpression(n)) { s = n.head.text; n.templateSpans.forEach((sp, i) => { s += `{${i}}` + sp.literal.text; }); }
    if (s !== null && CJK.test(s)) {
      const at = `${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
      if (/[<>]/.test(s) && /<\/?[a-z]/.test(s)) {
        for (const m of s.matchAll(/>([^<]*)</g)) addU(m[1], at);
        for (const m of s.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]*)"/g)) addU(m[1], at);
        addU(s.split('<')[0], at); addU(s.split('>').pop(), at);
      } else if (!/^[#.[]/.test(s)) addU(s, at); // CSS selectors are not shown
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const left = [];
for (const [u, at] of units) {
  const sample = u.replace(/\{\d\}/g, 'X');
  let out = tr(sample);
  if (CJK.test(out) && out !== '中文' && out !== '中文＋English') left.push(`${at}  ${u.slice(0, 50)}  →  ${out.slice(0, 50)}`);
}
console.log(`interface: ${units.size} Chinese text pieces in src/ (outside src/world), table has ${Object.keys(EN).length} entries`);
check('interface: every Chinese text piece turns into English', left.length === 0, left);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails.length ? `FAILED ${fails.length}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
