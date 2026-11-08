// Firefox headless über WebDriver BiDi (System-Firefox, reines Node, keine Abhängigkeiten).
// Nur Firefox verwenden, nie Chrome/Chromium (siehe CLAUDE.md).
//
// import {launch} from './ffbrowser.mjs';
// const browser = await launch({width: 1440, height: 900});
// const page = await browser.newPage();           // page.on('console'|'pageerror', fn), page.messages, page.errors
// await page.goto('http://localhost:5173/');
// await page.setViewport(390, 844, 2);
// await page.screenshot({path: 'test-results/shots/x.png'});
// await browser.close();
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wrap = (fn, arg) =>
  `(async () => { try { const r = await (${fn})(${arg === undefined ? '' : JSON.stringify(arg)});` +
  ` return r === undefined ? '__undef' : JSON.stringify(r); } catch (e) { return '__err' + String(e && e.stack || e); } })()`;

export async function launch({width = 1440, height = 900, deviceScaleFactor = 1, firefox = process.env.FIREFOX || 'firefox', extraArgs = []} = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-ff-'));
  const ff = spawn(firefox, ['--headless', '--no-remote', '--remote-debugging-port=0', '--profile', profile,
    `--width=${width}`, `--height=${height}`, ...extraArgs], {stdio: ['ignore', 'ignore', 'pipe']});
  let exited = false;
  ff.on('exit', () => { exited = true; });
  ff.on('error', () => { exited = true; });

  // Port aus Firefox' stderr lesen: "WebDriver BiDi listening on ws://127.0.0.1:PORT"
  let wsUrl = null, errBuf = '';
  ff.stderr.on('data', (d) => {
    errBuf += d;
    const m = errBuf.match(/WebDriver BiDi listening on (ws:\/\/[^\s]+)/);
    if (m) wsUrl = m[1];
  });
  for (let i = 0; i < 200 && !wsUrl && !exited; i++) await sleep(100);

  const cleanup = async () => {
    if (!exited) {
      ff.kill('SIGTERM');
      for (let i = 0; i < 30 && !exited; i++) await sleep(100);
      if (!exited) ff.kill('SIGKILL');
      for (let i = 0; i < 20 && !exited; i++) await sleep(100);
    }
    fs.rmSync(profile, {recursive: true, force: true});
  };

  let sock;
  for (let i = 0; wsUrl && i < 50 && !sock; i++) {
    for (const u of [wsUrl + '/session', wsUrl]) {
      try {
        const s = new WebSocket(u);
        await new Promise((r, j) => { s.onopen = r; s.onerror = j; });
        sock = s;
        break;
      } catch { /* nächster Versuch */ }
    }
    if (!sock) await sleep(200);
  }
  if (!sock) { await cleanup(); throw new Error('Firefox BiDi: keine Verbindung\n' + errBuf.slice(-500)); }

  let id = 0;
  const pend = new Map();
  const listeners = {console: [], pageerror: []};
  const messages = [];   // {type, text}
  const errors = [];     // {message}
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
    if (d.method === 'log.entryAdded') {
      const p = d.params;
      if (p.type === 'javascript' && p.level === 'error') {
        const e = {message: p.text};
        errors.push(e);
        listeners.pageerror.forEach((f) => f(e));
      } else {
        const e = {type: p.level === 'warn' ? 'warning' : p.level, text: p.text};
        messages.push(e);
        listeners.console.forEach((f) => f(e));
      }
    }
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id;
    pend.set(i, (d) => (d.type === 'error' ? j(new Error(`${method}: ${d.error} ${d.message}`)) : r(d.result)));
    sock.send(JSON.stringify({id: i, method, params}));
  });

  try {
    await send('session.new', {capabilities: {}});
    await send('session.subscribe', {events: ['log.entryAdded']});
  } catch (e) { await cleanup(); throw e; }
  const ctx = (await send('browsingContext.getTree', {})).contexts[0].context;

  const evaluate = async (fn, arg) => {
    const expr = typeof fn === 'function' ? wrap(fn, arg) : wrap(`() => (${fn})`, undefined);
    const r = await send('script.evaluate', {expression: expr, target: {context: ctx}, awaitPromise: true, resultOwnership: 'none'});
    if (r.type === 'exception') throw new Error(r.exceptionDetails?.text || 'evaluate failed');
    const v = r.result.value;
    if (v === '__undef') return undefined;
    if (typeof v === 'string' && v.startsWith('__err')) throw new Error(v.slice(5));
    return JSON.parse(v);
  };

  const page = {
    messages, errors,
    on: (ev, f) => { listeners[ev]?.push(f); },
    clearLogs: () => { messages.length = 0; errors.length = 0; },
    goto: (url, {wait = 'complete'} = {}) => send('browsingContext.navigate', {context: ctx, url, wait}),
    reload: () => send('browsingContext.reload', {context: ctx, wait: 'complete'}),
    setViewport: (w, h, dpr = deviceScaleFactor) =>
      send('browsingContext.setViewport', {context: ctx, viewport: {width: w, height: h}, devicePixelRatio: dpr}),
    evaluate,
    waitForFunction: async (fn, arg, {timeout = 30000} = {}) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        try { if (await evaluate(fn, arg)) return; } catch { /* weiter pollen */ }
        await sleep(100);
      }
      throw new Error('waitForFunction timeout');
    },
    sleep,
    screenshot: async ({path: p, fullPage = false, type, quality} = {}) => {
      const format = type === 'jpeg' ? {type: 'image/jpeg', quality: (quality ?? 90) / 100} : {type: 'image/png'};
      const r = await send('browsingContext.captureScreenshot', {context: ctx, format, origin: fullPage ? 'document' : 'viewport'});
      const buf = Buffer.from(r.data, 'base64');
      if (p) { fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, buf); }
      return buf;
    },
  };

  await page.setViewport(width, height, deviceScaleFactor).catch(() => {});

  return {
    newPage: async () => page,
    page,
    close: async () => {
      try { await send('session.end', {}); } catch { /* egal */ }
      try { sock.close(); } catch { /* egal */ }
      await cleanup();
    },
  };
}

export const firefox = {launch};
