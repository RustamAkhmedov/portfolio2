// Vorschau der ersten Lebenslauf-Seite je Sprache als WebP erzeugen (public/img/cv-preview-de.webp, -en.webp).
// Aufruf: node tools/cv-preview.mjs   (npm run cv-preview)
// Braucht die Systemwerkzeuge pdftoppm (poppler) und magick (ImageMagick); nichts davon wird installiert.
// Die PDFs liegen in public/cv/ (strings.json cv.file). Ziel: 560 px breit, je Bild <= 60 KB.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobs = [
  {lang: 'de', pdf: 'public/cv/lebenslauf.pdf'},
  {lang: 'en', pdf: 'public/cv/resume.pdf'},
];
const WIDTH = 560, MAX = 60 * 1024;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-cv-'));
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {stdio: 'inherit'});
  if (r.error || r.status !== 0) { console.error(`${cmd} fehlgeschlagen (installiert?)`); process.exit(1); }
};

for (const {lang, pdf} of jobs) {
  const base = path.join(tmp, lang);
  run('pdftoppm', ['-f', '1', '-l', '1', '-r', '150', '-png', '-singlefile', path.join(root, pdf), base]);
  const out = path.join(root, `public/img/cv-preview-${lang}.webp`);
  let q = 80, size = Infinity;
  while (q >= 40) {
    run('magick', [base + '.png', '-resize', `${WIDTH}x`, '-define', 'webp:method=6', '-quality', String(q), out]);
    size = fs.statSync(out).size;
    if (size <= MAX) break;
    q -= 10;
  }
  const dim = spawnSync('magick', ['identify', '-format', '%wx%h', out]).stdout.toString();
  console.log(`${path.relative(root, out)}: ${dim}, ${(size / 1024).toFixed(1)} KB (q=${q})`);
  if (size > MAX) { console.error('zu groß'); process.exit(1); }
}
fs.rmSync(tmp, {recursive: true, force: true});
