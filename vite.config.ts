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

// Firefox benutzt eine local()-Ersatzschrift (@font-face in tokens.css) nur, wenn sie schon geladen ist; solange der Webfont
// lädt, nimmt es sonst system-ui und die Maße (size-adjust) greifen nicht. Der Aufruf nach dem Stylesheet (steht im <head>
// vor dem ersten Rendern) lädt die Ersatzfaces sofort. Ohne JS bleibt es bei der Systemschrift bis zum Wechsel.
function loadFallbackFonts(): Plugin {
  const faces = ['400 1em "Archivo Fallback"', '700 1em "Archivo Fallback"', '800 1em "Archivo Fallback"', '1em "Martian Mono Fallback"'];
  return {
    name: 'load-fallback-fonts',
    transformIndexHtml: {
      order: 'post',
      handler() {
        const code = `try{${JSON.stringify(faces)}.forEach(function(f){document.fonts.load(f)})}catch(e){}`;
        return [{ tag: 'script', children: code, injectTo: 'head' as const }];
      },
    },
  };
}

// Szene-Kette vorladen (Nachbesserung nach Phase 11): main → media → timeline/gsap → scene → screen → smooth → directory
// war ein Wasserfall, jede Stufe kostete eine Round-Trip-Zeit. Die Chunks werden gleich beim Parsen angefordert.
// Nur bei html.s3d (Inline-Skript im <head>: JS, keine reduzierte Bewegung, WebGL da): reduzierte Bewegung, no-js und
// no-webgl laden keine unnötigen Bytes. Relative Pfade, auch in en/.
// Reihenfolge = Priorität: Firefox öffnet höchstens 6 Verbindungen je Host (HTTP/1.1), der Rest wartet. Die großen Chunks
// auf dem Weg zu `scene-ready` zuerst, Lenis (smooth) und das Verzeichnis zuletzt.
const PRELOAD_ORDER = ['scene-', 'screen-', 'media-', 'gsap-', 'timeline-', 'ScrollTrigger-', 'parts-', 'smooth-', 'directory-'];
const rank = (file: string): number => {
  const i = PRELOAD_ORDER.findIndex((p) => path.basename(file).startsWith(p));
  return i < 0 ? PRELOAD_ORDER.length : i;
};

function preloadSceneChunks(): Plugin {
  return {
    name: 'preload-scene-chunks',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return [];
        const files = Object.values(ctx.bundle)
          .filter((o) => o.type === 'chunk' && !o.isEntry && !html.includes(o.fileName)) // Einstieg steht schon als <script>
          .map((o) => o.fileName)
          .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
        if (!files.length) return [];
        const depth = ctx.path.replace(/^\//, '').split('/').length - 1;
        const prefix = '../'.repeat(depth);
        const code =
          `(function(){if(!document.documentElement.classList.contains('s3d'))return;` +
          `${JSON.stringify(files)}.forEach(function(f){var l=document.createElement('link');` +
          `l.rel='modulepreload';l.href=${JSON.stringify(prefix)}+f;document.head.appendChild(l);});})();`;
        return [{ tag: 'script', children: code, injectTo: 'head' as const }];
      },
    },
  };
}

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [pages(), preloadMainFont(), loadFallbackFonts(), preloadSceneChunks()],
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(root, 'index.html'),
        en: path.resolve(root, 'en/index.html'),
      },
    },
  },
});
