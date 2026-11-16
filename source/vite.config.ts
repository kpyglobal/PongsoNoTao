import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
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
          return undefined;
        },
      },
    },
  },
});
