// Ladezeit-Messung (T071, SC-003): Firefox (ffbrowser.mjs, nie Chrome) lädt den Produktions-Build (dist/)
// über einen lokalen Drossel-Server (Node, ohne Abhängigkeit), der „Fast 4G“ nachbildet:
//   9 Mbit/s Downlink (gemeinsam für alle Verbindungen), 170 ms RTT (Anfrage → erstes Byte; neue Verbindung
//   zusätzlich 170 ms für den TCP-Handshake), Text-Dateien gzip -9 vorkomprimiert, Cache-Control: no-store.
// Metriken kommen per Preload-Skript (Paint-/LCP-Observer, rAF-Schleife) und aus dem Server-Log (Bytes).
//
// Aufruf: node tools/loadtime.mjs [--runs 5] [--scenario desktop|mobile|nojs|reduced|en|all] [--headed]
//                                 [--no-throttle] [--no-build] [--json out.json]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let runs = 5, scenario = 'all', headed = false, throttle = true, build = true, jsonOut = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--runs') runs = Number(args[++i]);
  else if (a === '--scenario') scenario = args[++i];
  else if (a === '--headed') headed = true;
  else if (a === '--no-throttle') throttle = false;
  else if (a === '--no-build') build = false;
  else if (a === '--json') jsonOut = args[++i];
  else { console.error('Unbekanntes Argument: ' + a); process.exit(2); }
}
const RTT = 170, BYTES_PER_S = 9_000_000 / 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (build) {
  const r = spawnSync('npm', ['run', 'build'], {cwd: root, stdio: 'ignore'});
  if (r.status !== 0) { console.error('Build fehlgeschlagen'); process.exit(1); }
}

// ---------- Drossel-Server ----------
const dist = path.join(root, 'dist');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon'};
const COMPRESS = new Set(['.html', '.js', '.css', '.svg', '.json']);
const cache = new Map();
function lookup(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return null;
  if (!cache.has(f)) {
    const ext = path.extname(f);
    const raw = fs.readFileSync(f);
    cache.set(f, {type: TYPES[ext] || 'application/octet-stream', body: COMPRESS.has(ext) ? zlib.gzipSync(raw, {level: 9}) : raw,
      gz: COMPRESS.has(ext), rawLen: raw.length});
  }
  return cache.get(f);
}
let nextFree = 0;                 // gemeinsame Downlink-Warteschlange (ms, performance.now-Basis)
let log = [];                     // {url, bytes, tStart, tEnd}
let t0srv = performance.now();
const CHUNK = 8192;
const server = http.createServer(async (req, res) => {
  const tStart = performance.now() - t0srv;
  const e = lookup(req.url);
  const fresh = !req.socket.__used;
  req.socket.__used = true;
  if (throttle) await sleep(RTT * (fresh ? 2 : 1));
  if (!e) { res.writeHead(404); res.end('nicht gefunden'); return; }
  const gz = e.gz && /gzip/.test(req.headers['accept-encoding'] || '');
  const body = gz ? e.body : (e.gz ? zlib.gunzipSync(e.body) : e.body);
  res.writeHead(200, {'Content-Type': e.type, 'Content-Length': body.length, 'Cache-Control': 'no-store', ...(gz ? {'Content-Encoding': 'gzip'} : {})});
  for (let o = 0; o < body.length; o += CHUNK) {
    const c = body.subarray(o, o + CHUNK);
    if (throttle) {
      const n = performance.now();
      nextFree = Math.max(nextFree, n) + (c.length / BYTES_PER_S) * 1000;
      const wait = nextFree - n - 15;   // höchstens ~15 ms Vorlauf
      if (wait > 0) await sleep(wait);
    }
    if (!res.write(c)) await new Promise((r) => res.once('drain', r));
  }
  res.end();
  log.push({url: req.url, bytes: body.length + 200 /* Header grob */, tStart, tEnd: performance.now() - t0srv});
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// ---------- Messung im Browser ----------
const PRELOAD = String(() => {
  const L = (window.__lt = {fcp: null, lcp: null, lcpEl: null, lcpUrl: null, shiftCls: 0, gaps: [], t: {}, rects: {}, maxShift: 0, shifts: 0, raf: 0});
  const now = () => performance.now();
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') L.fcp = e.startTime; })
      .observe({type: 'paint', buffered: true});
  } catch (e) { /* */ }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) { L.lcp = e.startTime; L.lcpEl = e.element ? (e.element.id || e.element.tagName) : null; L.lcpUrl = e.url || null; L.lcpSize = e.size; }
    }).observe({type: 'largest-contentful-paint', buffered: true});
  } catch (e) { /* */ }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) L.shiftCls += e.value; L.clsApi = true; })
      .observe({type: 'layout-shift', buffered: true});
  } catch (e) { /* */ }
  const mark = (k) => { if (L.t[k] === undefined) L.t[k] = now(); };
  const html = () => document.documentElement;
  let last = 0;
  const sel = {title: '#hero-title', lead: '.hero__lead', lang: '[data-lang-switch]'};
  const loop = (ts) => {
    L.raf++;
    const t = now();
    if (last) L.gaps.push([Math.round(t), Math.round(t - last)]);
    last = t;
    const h = html();
    const title = document.querySelector(sel.title);
    if (title) {
      const cs = getComputedStyle(title);
      const r = title.getBoundingClientRect();
      if (r.width > 0 && cs.visibility !== 'hidden') mark('titleInDom');
      if (r.width > 0 && r.top < innerHeight && r.bottom > 0) mark('titleInView');
      if (r.width > 0 && r.top < innerHeight && r.bottom > 0 && Number(cs.opacity) > 0.99 && !h.classList.contains('intro')) mark('titleVisible');
      // Verschiebung (Proxy für CLS, falls layout-shift fehlt): Positionsänderung nach dem ersten Auftauchen
      for (const k of Object.keys(sel)) {
        const el = document.querySelector(sel[k]);
        if (!el) continue;
        const b = el.getBoundingClientRect();
        const p = L.rects[k];
        if (p && L.t.titleInDom !== undefined && (Math.abs(b.top - p.top) > 1 || Math.abs(b.left - p.left) > 1 || Math.abs(b.height - p.height) > 1)) {
          L.shifts++;
          (L.shiftLog ||= []).push({k, t: Math.round(t), from: [Math.round(p.top), Math.round(p.left), Math.round(p.height)], to: [Math.round(b.top), Math.round(b.left), Math.round(b.height)]});
          L.maxShift = Math.max(L.maxShift, Math.abs(b.top - p.top), Math.abs(b.left - p.left), Math.abs(b.height - p.height));
        }
        L.rects[k] = {top: b.top, left: b.left, height: b.height};
      }
    }
    const lang = document.querySelector(sel.lang);
    if (lang) {
      const b = lang.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (b.width > 0 && hit && (hit === lang || lang.contains(hit))) mark('langClickable');
    }
    if (h.classList.contains('lenis')) mark('lenis');
    if (!h.classList.contains('intro')) mark('introGone');
    if (h.classList.contains('scene-ready')) mark('sceneReady');
    if (document.readyState !== 'loading') mark('dcl');
    if (document.readyState === 'complete') mark('load');
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
});

const SCEN = {
  desktop: {w: 1440, h: 900, dpr: 1, prefs: {}, url: '/index.html', needScene: true, js: true},
  mobile: {w: 390, h: 844, dpr: 3, prefs: {'dom.w3c_touch_events.enabled': 1, 'layout.css.devPixelsPerPx': '-1'}, url: '/index.html', needScene: true, js: true},
  reduced: {w: 1440, h: 900, dpr: 1, prefs: {'ui.prefersReducedMotion': 1}, url: '/index.html', needScene: false, js: true},
  nojs: {w: 1440, h: 900, dpr: 1, prefs: {'javascript.enabled': false}, url: '/index.html', needScene: false, js: false},
  en: {w: 1440, h: 900, dpr: 1, prefs: {}, url: '/en/index.html', needScene: true, js: true},
};
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

async function oneRun(sc) {
  const prefs = {'browser.cache.disk.enable': false, 'browser.cache.memory.enable': false, 'browser.cache.offline.enable': false, ...sc.prefs};
  const b = await launch({width: sc.w, height: sc.h, deviceScaleFactor: sc.dpr, headless: !headed, prefs});
  try {
    const page = await b.newPage();
    await sleep(1500);
    log = []; t0srv = performance.now(); nextFree = 0;
    const url = `http://127.0.0.1:${port}${sc.url}`;
    const out = {};
    if (sc.js) {
      await page.addPreloadScript(PRELOAD);
      const nav = performance.now();
      page.goto(url, {wait: 'none'}).catch(() => {});
      await page.waitForFunction(() => !!window.__lt?.t.load, undefined, {timeout: 60000});
      if (sc.needScene) await page.waitForFunction(() => !!window.__lt.t.sceneReady, undefined, {timeout: 60000}).catch(() => { out.sceneTimeout = true; });
      await sleep(2000);   // Nachlauf: späte LCP-/Verschiebungs-Ereignisse
      const d = await page.evaluate(() => {
        const L = window.__lt;
        const res = performance.getEntriesByType('resource').map((e) => ({n: e.name.replace(location.origin, ''), t: e.initiatorType, re: e.responseEnd, ts: e.transferSize, st: e.startTime}));
        const nav = performance.getEntriesByType('navigation')[0];
        const gaps = L.gaps;
        return {fcp: L.fcp, lcp: L.lcp, lcpEl: L.lcpEl, lcpUrl: L.lcpUrl, cls: L.clsApi ? L.shiftCls : null, maxShift: L.maxShift, shifts: L.shifts, shiftLog: L.shiftLog || [],
          t: L.t, res, gaps, dcl: nav.domContentLoadedEventEnd, loadEv: nav.loadEventEnd, ttfb: nav.responseStart, fonts: document.fonts.size};
      });
      Object.assign(out, d);
      const operable = [sc.needScene ? d.t.titleVisible : d.t.titleInDom, d.t.langClickable, sc.js && sc.needScene ? d.t.lenis : 0].filter((v) => v !== undefined);
      const tv = sc.needScene ? d.t.titleVisible : d.t.titleInDom;
      const hasAll = tv !== undefined && d.t.langClickable !== undefined && (!sc.needScene || d.t.lenis !== undefined);
      out.operable = hasAll ? Math.max(...operable) : null;
      // TBT-Proxy: rAF-Lücken > 50 ms zwischen FCP und „bedienbar“ (Firefox hat keine Long-Task-API)
      const from = d.fcp ?? 0, to = out.operable ?? d.t.load;
      out.tbt = d.gaps.filter(([t, g]) => t >= from && t <= to && g > 50).reduce((s, [, g]) => s + (g - 50), 0);
      out.maxGap = d.gaps.filter(([t]) => t >= from && t <= to).reduce((m, [, g]) => Math.max(m, g), 0);
      out.maxGapAll = d.gaps.reduce((m, [, g]) => Math.max(m, g), 0);
      const bytesAt = (t) => d.res.filter((r) => r.re <= t).reduce((s, r) => s + (r.ts || 0), 0);
      const sceneT = d.t.sceneReady ?? d.t.load;
      out.bytesOperable = bytesAt(out.operable ?? d.t.load);
      out.bytesScene = bytesAt(sceneT);
      out.bytesLoad = bytesAt(d.t.load);
      // Anfragen bis operable: Kette
    } else {
      // Ohne JS gibt es kein Skript im Seitenkontext (evaluate hängt): zwei getrennte Kaltladungen, vom Node-Prozess gestoppt
      const t1 = performance.now();
      await page.goto(url, {wait: 'interactive'});
      out.dclNode = performance.now() - t1;
      await sleep(800);
      log = []; nextFree = 0; t0srv = performance.now();
      const t2 = performance.now();
      await page.goto(url + '?b', {wait: 'complete'}).catch(() => {});
      out.loadNode = performance.now() - t2;
      await sleep(500);
    }
    // Bytes aus dem Server-Log (alle Anfragen dieses Laufs), nach Typ
    out.srvBytes = log.reduce((s, r) => s + r.bytes, 0);
    out.srvReq = log.length;
    const kind = (u) => /\.html$|\/$/.test(u.split('?')[0]) ? 'html' : /\.css/.test(u) ? 'css' : /\.js/.test(u) ? 'js' : /\.woff2/.test(u) ? 'font' : /\.(webp|png|jpg|svg)/.test(u) ? 'img' : 'other';
    out.byKind = {};
    for (const r of log) { const k = kind(r.url); out.byKind[k] = (out.byKind[k] || 0) + r.bytes; }
    out.log = log.map((r) => ({...r, tStart: Math.round(r.tStart), tEnd: Math.round(r.tEnd)}));
    out.errors = page.errors.map((e) => e.message);
    return out;
  } finally {
    await b.close();
  }
}

const names = scenario === 'all' ? Object.keys(SCEN) : [scenario];
const all = {meta: {date: new Date().toISOString(), runs, throttle, rtt: RTT, mbit: 9, headed}, scenarios: {}};
for (const n of names) {
  const sc = SCEN[n];
  all.scenarios[n] = [];
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`${n} ${i + 1}/${runs} … `);
    try {
      const r = await oneRun(sc);
      all.scenarios[n].push(r);
      const f = (v) => (v == null ? '–' : Math.round(v));
      console.log(sc.js ? `FCP ${f(r.fcp)} LCP ${f(r.lcp)} (${r.lcpEl}) bedienbar ${f(r.operable)} scene ${f(r.t.sceneReady)} load ${f(r.t.load)} TBT ${f(r.tbt)} KB ${f(r.srvBytes / 1024)}`
        : `DCL ${f(r.dclNode)} load ${f(r.loadNode)} KB ${f(r.srvBytes / 1024)}`);
    } catch (e) { console.log('FEHLER ' + e.message); all.scenarios[n].push({error: e.message}); }
  }
}
server.close();
server.closeAllConnections?.();
if (jsonOut) { fs.mkdirSync(path.dirname(jsonOut), {recursive: true}); fs.writeFileSync(jsonOut, JSON.stringify(all)); }

// Kurzauswertung
for (const n of names) {
  const ok = all.scenarios[n].filter((r) => !r.error);
  const row = (k, f = (r) => r[k]) => { const v = ok.map(f).filter((x) => x != null); return v.length ? `${Math.round(med(v))} / ${Math.round(Math.max(...v))}` : '–'; };
  console.log(`${n}: Median / schlechtester (ms)  FCP ${row('fcp')}  LCP ${row('lcp')}  bedienbar ${row('operable')}  scene ${row('x', (r) => r.t?.sceneReady)}  load ${row('x', (r) => r.t?.load)}  TBT ${row('tbt')}  KB ${row('x', (r) => r.srvBytes / 1024)}`);
}
process.exit(0);
