// Favicon-PNGs und Link-Vorschau-Bild (Open Graph) erzeugen, nur mit System-Firefox (tools/ffbrowser.mjs).
// Aufruf: node tools/brand.mjs [--no-build]
// Ausgabe: public/apple-touch-icon.png (180×180), public/favicon-32.png (32×32), public/img/og-card.png (1200×630)
// Quelle der Icons: public/favicon.svg. Das Laptop-Bild kommt aus der Szene (?state, ohne Beschriftungen).
// Schriften: selbst gehostete WOFF2 aus node_modules, als data:-URL in die Hilfsseite eingebettet.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = !process.argv.includes('--no-build');
const PAPER = '#E7E3D8', INK = '#1B2230', ORANGE = '#FF5F1F';
const b64 = (p) => fs.readFileSync(p).toString('base64');
const archivo = b64(path.join(root, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'));
const mono = b64(path.join(root, 'node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-wght-normal.woff2'));
const svg = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer(); s.once('error', rej);
  s.listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => res(port)); });
});

if (build && spawnSync('npx', ['vite', 'build'], {cwd: root, stdio: 'inherit'}).status !== 0) process.exit(1);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-brand-'));
const port = await freePort();
const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* beendet */ } };
process.on('exit', stop);

const html = (body, css) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:A;font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,${archivo}) format('woff2-variations')}
@font-face{font-family:M;font-weight:100 800;src:url(data:font/woff2;base64,${mono}) format('woff2-variations')}
*{margin:0;padding:0;box-sizing:border-box}html,body{background:${PAPER};overflow:hidden}${css}</style>${body}`;
const load = async (page, name, content) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, content);
  await page.goto('file://' + f);
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
  await page.sleep(300);
};

let browser, failed = false;
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* warten */ }
    if (i > 100) throw new Error('vite preview startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await launch({width: 1200, height: 630});
  const page = await browser.newPage();
  const out = (p) => path.join(root, p);

  // 1) Laptop aus der Szene (ohne Beschriftungen), Hochformat, damit er gross im Bild steht
  await page.setViewport(900, 1000, 1);
  await page.goto(base + '/?state=' + encodeURIComponent(JSON.stringify({explode: 1, lid: 1, cam: 1})));
  await page.waitForFunction(() => !!window.__v2, undefined, {timeout: 15000});
  await page.evaluate(async () => { await window.__v2.ready; });
  await page.evaluate(() => { document.documentElement.classList.add('still'); document.documentElement.style.background = '#E7E3D8'; });
  await page.sleep(800);
  const scene = (await page.screenshot()).toString('base64');
  if (page.errors.length) throw new Error(page.errors.map((e) => e.message).join('\n'));

  // 2) Link-Vorschau 1200×630
  await page.setViewport(1200, 630, 1);
  await load(page, 'og.html', html(`
<main><div class="l"><p class="k">Portfolio</p><h1>Rustam<br>Akhmedov</h1><p class="s">Informatik · Web · 3D</p></div>
<div class="r"></div><i></i></main>`, `
main{position:relative;width:1200px;height:630px;background:${PAPER};border-top:14px solid ${ORANGE}}
.l{position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
.k{font:600 26px/1 M;letter-spacing:.14em;text-transform:uppercase;color:${ORANGE};margin-bottom:28px}
h1{font:800 120px/.92 A;font-stretch:75%;letter-spacing:-.01em;color:${INK}}
.s{display:none}
.r{position:absolute;right:24px;top:14px;width:600px;height:616px;background:url(data:image/png;base64,${scene}) center/contain no-repeat}
i{position:absolute;left:0;right:0;bottom:0;height:0}`));
  await page.screenshot({path: out('public/img/og-card.png')});

  // 3) Icons aus dem SVG
  const icon = async (size, file) => {
    await page.setViewport(size, size, 1);
    await load(page, `i${size}.html`, html(`<div>${svg}</div>`, `div,svg{width:${size}px;height:${size}px;display:block}div{padding:${Math.round(size * 0.08)}px;width:${size}px}svg{width:100%;height:100%}`));
    await page.screenshot({path: out(file)});
  };
  await icon(180, 'public/apple-touch-icon.png');
  await icon(32, 'public/favicon-32.png');
  for (const f of ['public/img/og-card.png', 'public/apple-touch-icon.png', 'public/favicon-32.png']) console.log('geschrieben: ' + f);
} catch (e) { failed = true; console.error(e); }
finally { if (browser) await browser.close(); stop(); fs.rmSync(tmp, {recursive: true, force: true}); }
process.exit(failed ? 1 : 0);
