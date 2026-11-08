import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error reines JS-Modul ohne Typen
import pages from './tools/vite-plugin-pages.mjs';

// Lateinische Schnitte beider Schriften früh laden: der Browser entdeckt sie sonst erst nach dem Parsen des CSS (T071).
// Spart Wartezeit und die Verschiebung beim Schriftwechsel (Archivo: Hero, Martian Mono: Zeichnungskopf).
function preloadMainFont(): Plugin {
  return {
    name: 'preload-main-font',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => /(archivo|martian-mono)-latin-(wdth-)?(standard-)?normal-[^/]*\.woff2$/.test(f));
        const depth = ctx.path.replace(/^\//, '').split('/').length - 1;
        return files.map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: '../'.repeat(depth) + file },
          injectTo: 'head-prepend' as const,
        }));
      },
    },
  };
}

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [pages(), preloadMainFont()],
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(root, 'index.html'),
        en: path.resolve(root, 'en/index.html'),
      },
    },
  },
});
