// List Chinese string literals in src/ (outside src/world) that the English UI table does not cover yet.
// node scripts/content/ui-strings-extract.mjs [out.json]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ts from 'typescript';
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
const files = execSync('find src index.html -name "*.ts" -o -name "*.html"').toString().trim().split('\n')
  .filter((f) => !f.startsWith('src/world/') && !f.endsWith('strings-en.ts')).sort();
const out = new Map();
const add = (s, f, line) => { if (!CJK.test(s)) return; const e = out.get(s) ?? { s, at: [] }; if (e.at.length < 3) e.at.push(`${f}:${line}`); out.set(s, e); };
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.html')) { for (const m of text.matchAll(/>([^<]*[\u3400-\u9fff][^<]*)</g)) add(m[1].trim(), f, 0); for (const m of text.matchAll(/(?:content|title|aria-label|alt)="([^"]*[\u3400-\u9fff][^"]*)"/g)) add(m[1], f, 0); continue; }
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
  const visit = (n) => {
    const line = () => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) add(n.text, f, line());
    else if (ts.isTemplateExpression(n)) {
      let s = n.head.text; n.templateSpans.forEach((sp, i) => { s += `{${i}}` + sp.literal.text; }); add(s, f, line());
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const arr = [...out.values()];
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(arr, null, 1));
console.log(`${arr.length} Chinese literals`);
