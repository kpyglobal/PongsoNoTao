import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
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
