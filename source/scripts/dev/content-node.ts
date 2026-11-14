// Node-side twin of the Vite glob in src/content/loader.ts: read content/**/*.json into the same RawContent map.
import fs from 'node:fs';
import path from 'node:path';
import { buildContent, type ContentDB, type RawContent } from '../../src/content/loader';

export function readContentRaw(root = 'content'): RawContent {
  const out: RawContent = {};
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) out[`/content/${path.relative(root, p).split(path.sep).join('/')}`] = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(root);
  return out;
}

export function loadContentNode(root = 'content'): ContentDB {
  return buildContent(readContentRaw(root));
}
