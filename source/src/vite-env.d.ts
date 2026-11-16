/// <reference types="vite/client" />

/** package.json version, injected by vite.config.ts */
declare const __APP_VERSION__: string;

/** 0.1.6: the English fields of content/*.json (vite.config.ts contentSplit) */
declare module 'virtual:tao-content-en' {
  const en: Record<string, unknown>;
  export default en;
}

/** 0.1.6: art warmed in the background (vite.config.ts assetPipeline) */
declare module 'virtual:tao-prefetch' {
  const files: { background: string[] };
  export default files;
}
