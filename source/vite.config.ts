import { defineConfig } from 'vite';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * 0.1.6 loading: the English of the game content (every `en` / `…En` field in content/*.json) is split off the
 * Chinese. The content chunk keeps only the Chinese; `virtual:tao-content-en` holds the English fields in the same
 * shape and is loaded (src/content/loader.ts loadContentLang) only for English and 中文＋English. Switching the
 * interface language reloads the page, so a session never needs both.
 */
const isEnKey = (k: string): boolean => k === 'en' || /[a-z0-9]En$/.test(k);
function zhOnly(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(zhOnly);
  if (!v || typeof v !== 'object') return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!isEnKey(k)) out[k] = zhOnly(x);
  return out;
}
/** only the English fields (and the objects / arrays that lead to them); undefined when there are none */
function enOnly(v: unknown): unknown {
  if (Array.isArray(v)) {
    const a = v.map(enOnly);
    return a.some((x) => x !== undefined) ? a.map((x) => x ?? 0) : undefined;
  }
  if (!v || typeof v !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  let any = false;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const e = isEnKey(k) ? x : enOnly(x);
    if (e !== undefined) { out[k] = e; any = true; }
  }
  return any ? out : undefined;
}
function contentSplit(): Plugin {
  const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'content');
  const VID = 'virtual:tao-content-en';
  const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : f.endsWith('.json') ? [p] : []; });
  return {
    name: 'tao-content-split',
    enforce: 'pre',
    resolveId(id) { return id === VID ? '\0' + VID : null; },
    load(id) {
      if (id !== '\0' + VID) return null;
      const out: Record<string, unknown> = {};
      for (const f of files(root)) {
        this.addWatchFile(f);
        const e = enOnly(JSON.parse(readFileSync(f, 'utf8')));
        if (e !== undefined) out['/content/' + relative(root, f).split('\\').join('/')] = e;
      }
      return `export default ${JSON.stringify(out)};`;
    },
    transform(code, id) {
      const p = id.split('?')[0];
      if (!p.endsWith('.json') || !p.startsWith(root + '/')) return null;
      return { code: JSON.stringify(zhOnly(JSON.parse(code))), map: null };
    },
  };
}

/**
 * 0.1.6 loading: `virtual:tao-prefetch` lists the art the game warms in the background (src/systems/prefetch.ts),
 * and the build drops the sprite PNG masters that have a lossless WebP twin (the game loads the WebP).
 */
function assetPipeline(): Plugin {
  const pub = resolve(fileURLToPath(new URL('.', import.meta.url)), 'public');
  const VID = 'virtual:tao-prefetch';
  const list = (dir: string, ext = '.webp'): string[] => {
    const d = join(pub, dir);
    try { return readdirSync(d).filter((f) => f.endsWith(ext)).sort().map((f) => `${dir}/${f}`); } catch { return []; }
  };
  let outDir = 'dist';
  return {
    name: 'tao-asset-pipeline',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    resolveId(id) { return id === VID ? '\0' + VID : null; },
    load(id) {
      if (id !== '\0' + VID) return null;
      const background = [
        ...list('assets/cards'), ...list('assets/cards/icons'), ...list('assets/cards/sketch'), ...list('assets/cards/thumbs'),
        ...list('assets/portraits'), ...list('assets/underwater/thumbs'),
      ];
      return `export default ${JSON.stringify({ background })};`;
    },
    closeBundle() {
      const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
      let n = 0;
      const sprites = join(outDir, 'assets/sprites');
      try {
        for (const f of walk(sprites)) {
          if (f.endsWith('.png') && existsSync(f.slice(0, -4) + '.webp')) { unlinkSync(f); n++; }
        }
      } catch { /* no sprites folder */ }
      if (n) console.log(`tao-asset-pipeline: ${n} sprite PNG masters left out (WebP shipped)`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [contentSplit(), assetPipeline()],
  // shown on the title screen and in the notebook settings
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    // no public source maps in the shipped build (was ~2.5 MB of .map next to the game)
    sourcemap: false,
    assetsDir: 'assets',
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // three.js in its own long-lived chunk: game-code edits no longer invalidate the cached engine
        // (addons included: they only change with a three.js upgrade)
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          // game content (content/*.json) in its own chunk: a text / quest edit does not re-download the code
          if (id.includes('/content/') && id.endsWith('.json')) return 'content';
          if (id.includes('virtual:tao-content-en')) return 'content-en';
          return undefined;
        },
      },
    },
  },
});
