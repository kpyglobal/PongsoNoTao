#!/usr/bin/env node
// Build-time glyph coverage check: every CJK character used in src/ or content/ must exist in every
// self-hosted subset font (public/fonts/*.woff2). Fails the build (exit 1) and names the missing
// characters, so new copy never silently falls back to a system font. Fix: `npm run fonts`.
// Zero dependencies: parses the WOFF2 table directory, brotli-decodes it with node:zlib and reads `cmap`.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FONT_DIR = path.join(ROOT, 'public/fonts');
const SCAN = [path.join(ROOT, 'src'), path.join(ROOT, 'content'), path.join(ROOT, 'content-pending')].filter((d) => fs.existsSync(d));
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.json', '.html']);

// CJK radicals / symbols & punctuation / bopomofo / Han (BMP + ext.) / compatibility / vertical & fullwidth forms
const CJK = /[\u2E80-\u2FDF\u3000-\u303F\u3100-\u312F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u{20000}-\u{2FFFF}]/u;

const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (TEXT_EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/** code point → first file it was seen in */
function usedCjk() {
  const used = new Map();
  for (const dir of SCAN) {
    for (const f of walk(dir)) {
      for (const ch of fs.readFileSync(f, 'utf8')) {
        if (CJK.test(ch) && !used.has(ch.codePointAt(0))) used.set(ch.codePointAt(0), path.relative(ROOT, f));
      }
    }
  }
  return used;
}

function cmapOfWoff2(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const numTables = buf.readUInt16BE(12);
  const totalCompressed = buf.readUInt32BE(20);
  let off = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[off++];
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error('bad UIntBase128');
  };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[off++];
    let tag;
    if ((flags & 0x3f) === 0x3f) {
      tag = buf.toString('latin1', off, off + 4);
      off += 4;
    } else tag = KNOWN_TAGS[flags & 0x3f];
    const version = (flags >> 6) & 3;
    const origLength = base128();
    let length = origLength;
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    if (transformed) length = base128();
    tables.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(off, off + totalCompressed));
  let pos = 0;
  let cmap = null;
  for (const t of tables) {
    if (t.tag === 'cmap') cmap = data.subarray(pos, pos + t.length);
    pos += t.length;
  }
  if (!cmap) throw new Error('no cmap table');
  return parseCmap(cmap);
}

function parseCmap(c) {
  const covered = new Set();
  const n = c.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const sub = c.readUInt32BE(4 + i * 8 + 4);
    const format = c.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = c.readUInt16BE(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = c.readUInt16BE(ends + s * 2);
        const start = c.readUInt16BE(starts + s * 2);
        const delta = c.readInt16BE(deltas + s * 2);
        const ro = c.readUInt16BE(ranges + s * 2);
        for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
          let gid;
          if (ro === 0) gid = (cp + delta) & 0xffff;
          else {
            const g = c.readUInt16BE(ranges + s * 2 + ro + (cp - start) * 2);
            gid = g ? (g + delta) & 0xffff : 0;
          }
          if (gid) covered.add(cp);
        }
      }
    } else if (format === 12) {
      const groups = c.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const at = sub + 16 + g * 12;
        const start = c.readUInt32BE(at);
        const end = c.readUInt32BE(at + 4);
        const gid0 = c.readUInt32BE(at + 8);
        for (let cp = start; cp <= end; cp++) if (gid0 + (cp - start)) covered.add(cp);
      }
    }
  }
  return covered;
}

const used = usedCjk();
const fonts = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2') && !f.startsWith('cormorant')).sort(); // Cormorant: Latin / Tao only
if (!fonts.length) {
  console.error('check-fonts: no public/fonts/*.woff2 found');
  process.exit(1);
}
// 0.1.6: a weight may be split into <name>-core.woff2 (start screens) + <name>.woff2 (the rest): check the union
const groups = new Map();
for (const f of fonts) {
  const g = f.replace(/-core\.woff2$/, '.woff2');
  const covered = cmapOfWoff2(fs.readFileSync(path.join(FONT_DIR, f)));
  const set = groups.get(g) ?? new Set();
  for (const cp of covered) set.add(cp);
  groups.set(g, set);
}
let bad = 0;
for (const [f, covered] of groups) {
  const missing = [...used.keys()].filter((cp) => !covered.has(cp));
  if (missing.length) {
    bad++;
    console.error(`check-fonts: ${f} is missing ${missing.length} character(s):`);
    for (const cp of missing) console.error(`  ${String.fromCodePoint(cp)}  U+${cp.toString(16).toUpperCase()}  (${used.get(cp)})`);
  }
}
if (bad) {
  console.error('check-fonts: FAILED. Rebuild the subsets with `npm run fonts` (needs fontTools, see scripts/build-fonts.py).');
  process.exit(1);
}
console.log(`check-fonts: OK. ${used.size} CJK characters from src/ and content/ are in all ${groups.size} fonts (${fonts.length} files).`);
