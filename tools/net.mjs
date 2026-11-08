// Welche Dateien lädt die Seite wirklich? (T070) Firefox gegen `vite preview` (Produktions-Build, vorher `npm run build`).
// Aufruf: node tools/net.mjs [--lang de|en] [--size 1440x900]. Listet Resource-Timing-Einträge nach Typ mit Übertragungsgröße.
import {spawn} from 'node:child_process';
import {launch} from './ffbrowser.mjs';

const a = process.argv.slice(2);
const arg = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const lang = arg('--lang', 'de');
const [w, h] = arg('--size', '1440x900').split('x').map(Number);
const port = 4399;
const srv = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {stdio: 'ignore'});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/`); break; } catch { await sleep(200); } }
  browser = await launch({width: w, height: h});
  const page = await browser.newPage();
  await page.setViewport(w, h, 1).catch(() => {});
  await page.goto(`http://127.0.0.1:${port}/` + (lang === 'en' ? 'en/' : ''));
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForFunction(() => document.documentElement.classList.contains('scene-ready') || document.documentElement.classList.contains('no-webgl'), {timeout: 15000}).catch(() => {});
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(2500);
  const list = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => ({n: r.name.replace(location.origin, ''), t: r.initiatorType, enc: r.encodedBodySize, xfer: r.transferSize})));
  let sum = {};
  for (const r of list) { const k = r.n.split('.').pop(); sum[k] = (sum[k] || 0) + r.enc; console.log(String(r.enc).padStart(8), r.t.padEnd(8), r.n); }
  console.log('Summe encodedBodySize je Endung:', JSON.stringify(sum));
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight));
  console.log('geladene FontFaces:', fonts.join(' | '));
} finally { await browser?.close(); srv.kill(); }
