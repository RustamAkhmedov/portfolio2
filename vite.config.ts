import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error reines JS-Modul ohne Typen
import pages from './tools/vite-plugin-pages.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [pages()],
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(root, 'index.html'),
        en: path.resolve(root, 'en/index.html'),
      },
    },
  },
});
