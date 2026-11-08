// Vite-Plugin: rendert index.html und en/index.html aus src/page.html, src/sections und src/content.
import path from 'node:path';
import { writePages, ROOT } from './render.mjs';

const WATCHED = ['src/page.html', 'src/sections', 'src/content'].map((p) => path.join(ROOT, p));

function isSource(file) {
  const f = path.normalize(file);
  return WATCHED.some((w) => f === w || f.startsWith(w + path.sep));
}

export default function pages() {
  let strict = true;
  const render = (logger) => {
    try {
      const { written } = writePages();
      if (written.length) logger?.info(`pages: ${written.join(', ')}`);
      return true;
    } catch (error) {
      if (strict) throw error;
      logger?.error(`pages: render failed - ${error.message}`);
      return false;
    }
  };

  return {
    name: 'portfolio-pages',
    // frueh und synchron, damit die Input-Dateien vor Vites Aufloesung existieren
    config(_, { command }) {
      strict = command === 'build';
      render();
    },
    buildStart() {
      render(this.environment?.logger ?? undefined);
    },
    configureServer(server) {
      strict = false;
      for (const w of WATCHED) server.watcher.add(w);
      const onChange = (file) => {
        if (!isSource(file)) return;
        if (render(server.config.logger)) server.ws.send({ type: 'full-reload', path: '*' });
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
