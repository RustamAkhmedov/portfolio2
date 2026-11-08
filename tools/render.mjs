#!/usr/bin/env node
/**
 * Template-Engine (aus v1 portiert). Rendert src/page.html + src/sections/*.html + src/content/*.json
 * zu index.html (de) und en/index.html (en).
 *
 *   node tools/render.mjs           beide Seiten schreiben
 *   node tools/render.mjs --check   Exit 1, wenn eine Seite veraltet ist
 *
 * Als Modul: renderPages() -> { pages: { 'index.html': html, 'en/index.html': html }, used, data }
 *            writePages({ check }) -> geschriebene bzw. veraltete Dateien
 *
 * Syntax (Mustache-Teilmenge): {{key}} (escaped) · {{{key}}} (roh) · {{> name}} (src/sections/name.html)
 * {{#key}}..{{/key}} · {{^key}}..{{/key}} · {{.}} · {{! Kommentar }}
 *
 * Schluessel-Suche: 1. aktuelle Schleifen-Items, 2. src/content/strings.json plus jede weitere
 * src/content/<name>.json als Liste/Objekt unter <name> (z. B. projects, parts, contact),
 * 3. @-Variablen aus site.json: @lang @file @url @base @root @altLang @altFile @altUrl @altRoot
 * @ogLocale @ogLocaleAlt. @root ist der Pfad zur Site-Wurzel ('' bzw. '../' fuer en/).
 * { "de": .., "en": .. } wird zur aktuellen Sprache aufgeloest. Unbekannter Schluessel oder
 * fehlende Uebersetzung = Build-Fehler (Constitution II), nie ein leeres Feld.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const CONTENT = path.join(SRC, 'content');

const readJson = (file) => JSON.parse(readFileSync(path.join(CONTENT, file), 'utf8'));

export function loadData() {
  const site = readJson('site.json');
  const strings = readJson('strings.json');
  for (const f of readdirSync(CONTENT).filter((n) => n.endsWith('.json')).sort()) {
    const key = f.slice(0, -5);
    if (key === 'site' || key === 'strings') continue;
    strings[key] = readJson(f);
  }
  return { site, strings, langs: Object.keys(site.languages) };
}

// ---------------------------------------------------------------------------
// Template source: partials + standalone-line stripping
// ---------------------------------------------------------------------------

const STANDALONE = /^[ \t]*(\{\{[#^/>][^}]*\}\}|\{\{!(?:(?!\}\})[\s\S])*\}\})[ \t]*\r?\n/gm;

function loadTemplate(file, seen = []) {
  if (seen.includes(file)) throw new Error(`Partial cycle: ${[...seen, file].join(' → ')}`);
  const full = path.join(SRC, file);
  if (!existsSync(full)) throw new Error(`Missing template ${path.relative(ROOT, full)}${seen.length ? ` (included from ${seen.at(-1)})` : ''}`);
  return readFileSync(full, 'utf8')
    .replace(STANDALONE, '$1')
    .replace(/\{\{!(?:(?!\}\})[\s\S])*\}\}/g, '')
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => loadTemplate(`sections/${name}.html`, [...seen, file]));
}

// ---------------------------------------------------------------------------
// Parser: flat tag stream -> tree
// ---------------------------------------------------------------------------

const TAG = /\{\{\{\s*([\w.@-]+)\s*\}\}\}|\{\{\s*([#^/]?)\s*([\w.@-]+|\.)\s*\}\}/g;

function parse(source) {
  const root = { children: [] };
  const stack = [root];
  let last = 0;
  for (const m of source.matchAll(TAG)) {
    const top = stack.at(-1);
    if (m.index > last) top.children.push({ type: 'text', value: source.slice(last, m.index) });
    last = m.index + m[0].length;
    if (m[1]) { top.children.push({ type: 'raw', name: m[1] }); continue; }
    const [, , sigil, name] = m;
    if (sigil === '#' || sigil === '^') {
      const node = { type: sigil === '#' ? 'section' : 'inverted', name, children: [] };
      top.children.push(node);
      stack.push(node);
    } else if (sigil === '/') {
      if (top.name !== name) throw new Error(`{{/${name}}} closes {{#${top.name ?? '(nothing)'}}}`);
      stack.pop();
    } else {
      top.children.push({ type: 'var', name });
    }
  }
  if (stack.length > 1) throw new Error(`Unclosed {{#${stack.at(-1).name}}}`);
  if (last < source.length) root.children.push({ type: 'text', value: source.slice(last) });
  const leftover = source.match(/\{\{[^}]*\}\}/g)?.filter((t) => !t.match(new RegExp(TAG.source)));
  if (leftover?.length) throw new Error(`Unrecognised template tag(s): ${leftover.join(' ')}`);
  return root;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function vars(site, lang) {
  const langs = Object.keys(site.languages);
  const alt = langs.find((l) => l !== lang) ?? lang;
  const cfg = site.languages[lang];
  const altCfg = site.languages[alt];
  return {
    '@lang': lang, '@file': cfg.file, '@url': site.base + cfg.file, '@base': site.base,
    '@root': cfg.root ?? '', '@altRoot': altCfg.root ?? '',
    '@altLang': alt, '@altFile': altCfg.file, '@altUrl': site.base + altCfg.file,
    '@ogLocale': cfg.ogLocale, '@ogLocaleAlt': altCfg.ogLocale
  };
}

function renderLang(tree, data, lang, used = new Set()) {
  const v = vars(data.site, lang);

  // { de, en } -> the current language; anything else is returned as is.
  function translate(value, name) {
    const keys = isPlainObject(value) ? Object.keys(value) : [];
    if (keys.length && keys.every((k) => /^[a-z]{2}$/.test(k))) {
      if (typeof value[lang] !== 'string' || value[lang].trim() === '') throw new Error(`"${name}" has no "${lang}" translation`);
      return value[lang];
    }
    return value;
  }

  function lookup(name, ctx, optional) {
    if (name === '.') return translate(ctx.at(-1), '.');
    for (let i = ctx.length - 1; i >= 0; i--) {
      if (isPlainObject(ctx[i]) && Object.hasOwn(ctx[i], name)) return translate(ctx[i][name], name);
    }
    if (Object.hasOwn(data.strings, name)) { used.add(name); return translate(data.strings[name], name); }
    if (Object.hasOwn(v, name)) return v[name];
    if (optional) return undefined;
    throw new Error(`Unknown key {{${name}}} (lang ${lang}) — add it to src/content/strings.json or the data item`);
  }

  function walk(nodes, ctx) {
    let out = '';
    for (const n of nodes) {
      if (n.type === 'text') out += n.value;
      else if (n.type === 'var') out += esc(lookup(n.name, ctx));
      else if (n.type === 'raw') out += String(lookup(n.name, ctx));
      else {
        const value = lookup(n.name, ctx, true);
        const empty = !value || (Array.isArray(value) && value.length === 0);
        if (n.type === 'inverted') { if (empty) out += walk(n.children, ctx); }
        else if (Array.isArray(value)) value.forEach((item) => { out += walk(n.children, [...ctx, item]); });
        else if (!empty) out += walk(n.children, [...ctx, value]);
      }
    }
    return out;
  }

  return walk(tree.children, []);
}

/** @returns {{ pages: Record<string, string>, used: Set<string>, data: object }} */
// Schluessel aus strings.json selbst (nicht aus eigenen Dateien) -> fuer den "ungenutzt"-Test
function strIsOwn(data, k) { return Object.hasOwn(readJson('strings.json'), k); }

export function renderPages() {
  const data = loadData();
  const tree = parse(loadTemplate('page.html'));
  const used = new Set(Object.keys(data.strings).filter((k) => k !== 'strings' && !strIsOwn(data, k)));
  const pages = {};
  for (const lang of data.langs) pages[data.site.languages[lang].file] = renderLang(tree, data, lang, used);
  return { pages, used, data };
}

export const buildAll = renderPages;

/** Schreibt die Seiten (oder prueft sie mit check). @returns {{ written: string[], stale: string[] }} */
export function writePages({ check = false } = {}) {
  const { pages } = renderPages();
  const written = [], stale = [];
  for (const [file, html] of Object.entries(pages)) {
    const target = path.join(ROOT, file);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current === html) continue;
    if (check) stale.push(file);
    else { mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, html); written.push(file); }
  }
  return { written, stale };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  try {
    const { written, stale } = writePages({ check });
    written.forEach((f) => console.log(`wrote ${f}`));
    if (check) {
      if (stale.length) {
        console.error(`out of date: ${stale.join(', ')} - erzeugte Seiten nie bearbeiten, src/ aendern und neu rendern.`);
        process.exit(1);
      }
      console.log('pages are up to date');
    }
  } catch (error) {
    console.error(`render failed: ${error.message}`);
    process.exit(1);
  }
}
