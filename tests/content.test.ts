import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const strings = read('src/content/strings.json') as Record<string, unknown>;
const parts = read('src/content/parts.json') as any[];
const projects = read('src/content/projects.json') as any[];
const contactPath = 'src/content/contact.json';

const isI18n = (v: unknown): v is { de: unknown; en: unknown } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && ('de' in v || 'en' in v);

/** Sammelt alle {de,en}-Objekte mit Pfad. */
function collectI18n(v: unknown, path: string, out: [string, any][] = []) {
  if (isI18n(v)) out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => collectI18n(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) collectI18n(x, `${path}.${k}`, out);
  return out;
}

function walk(dir: string, ext: RegExp, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(f)) out.push(p);
  }
  return out;
}

const httpsOnly = (u: unknown) => typeof u === 'string' && /^https:\/\//.test(u);

describe('Regel 1: {de,en}-Werte vollständig', () => {
  const files = ['strings', 'parts', 'projects', 'contact'];
  for (const f of files) {
    it(`${f}.json: beide Sprachen, nicht leer`, () => {
      const items = collectI18n(read(`src/content/${f}.json`), f);
      expect(items.length).toBeGreaterThan(0);
      for (const [path, v] of items) {
        for (const lang of ['de', 'en']) {
          expect(typeof v[lang], `${path}.${lang}`).toBe('string');
          expect(v[lang].trim().length, `${path}.${lang} leer`).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('Regel 2: keine ungenutzten strings.json-Schlüssel', () => {
  const sources = [
    join(root, 'index.html'),
    ...walk(join(root, 'src'), /\.(html|ts)$/),
  ].filter(existsSync);
  const text = sources.map((p) => readFileSync(p, 'utf8')).join('\n');
  it('jeder Schlüssel kommt in einem Template/Code vor', () => {
    const unused = Object.keys(strings).filter((k) => !text.includes(k));
    expect(unused).toEqual([]);
  });
});

describe('Regel 3: parts.json', () => {
  const html = [
    ...walk(join(root, 'src'), /\.html$/),
  ].map((p) => readFileSync(p, 'utf8')).join('\n');
  const ids = new Set([...html.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((m) => m[1]));

  it('IDs eindeutig und lückenlos P-01…P-08', () => {
    expect(parts.map((p) => p.id)).toEqual(
      Array.from({ length: 8 }, (_, i) => `P-0${i + 1}`),
    );
  });
  it('jede section existiert als <section id>', () => {
    for (const p of parts) {
      if (p.section === null) continue;
      expect(ids.has(p.section), `${p.id}: section "${p.section}"`).toBe(true);
    }
  });
  it('dir ist nicht der Nullvektor, dist > 0', () => {
    for (const p of parts) {
      const d = p.explode?.dir;
      expect(Array.isArray(d) && d.length === 3 && d.every(Number.isFinite), `${p.id}: dir`).toBe(true);
      expect(Math.hypot(d[0], d[1], d[2]), `${p.id}: dir Nullvektor`).toBeGreaterThan(0);
      expect(p.explode.dist, `${p.id}: dist`).toBeGreaterThan(0);
    }
  });
});

describe('Regel 4: projects.json', () => {
  it('13 Einträge, 6 featured, Namen eindeutig', () => {
    expect(projects).toHaveLength(13);
    expect(projects.filter((p) => p.featured === true)).toHaveLength(6);
    expect(new Set(projects.map((p) => p.name)).size).toBe(13);
  });
  it('thumb existiert unter public/', () => {
    for (const p of projects)
      expect(existsSync(join(root, 'public', p.thumb)), `${p.name}: ${p.thumb}`).toBe(true);
  });
  it('repo oder demo vorhanden, nur https', () => {
    for (const p of projects) {
      expect(!!(p.repo || p.demo), `${p.name}: repo/demo fehlt`).toBe(true);
      for (const k of ['repo', 'demo'])
        if (p[k] !== undefined) expect(httpsOnly(p[k]), `${p.name}.${k}`).toBe(true);
    }
  });
});

describe('Live-Demo (T080)', () => {
  it('genau fretlearn, Weitland, NSCS, OnlineIDE, Sudoku haben demo (github.io)', () => {
    const names = projects.filter((p: any) => p.demo).map((p: any) => p.name).sort();
    expect(names).toEqual(['NSCS', 'OnlineIDE', 'Sudoku', 'Weitland', 'fretlearn']);
    for (const p of projects.filter((p: any) => p.demo))
      expect(p.demo, p.name).toMatch(/^https:\/\/rustamakhmedov\.github\.io\//);
  });
});

describe('Regel 5: contact.json', () => {
  const ports = ['TB4-1', 'TB4-2', 'HDMI', 'USB-A-1', 'USB-A-2', 'microSD', 'Audio'];
  it('href gültig, port erlaubt', () => {
    const contact = read(contactPath) as any[];
    expect(contact.length).toBeGreaterThan(0);
    for (const c of contact) {
      const ok =
        typeof c.href === 'string' &&
        (c.href.startsWith('mailto:') ||
          httpsOnly(c.href) ||
          existsSync(join(root, 'public', c.href.replace(/^\//, ''))));
      expect(ok, `${c.type}: href "${c.href}"`).toBe(true);
      expect(ports, `${c.type}: port "${c.port}"`).toContain(c.port);
    }
  });
});

describe('Regel 6: Lebenslauf-PDFs je Sprache', () => {
  it('cv.file de/en existieren unter public/', () => {
    const cv = strings['cv.file'] as { de: string; en: string };
    for (const lang of ['de', 'en'] as const)
      expect(existsSync(join(root, 'public', cv[lang])), `cv.file.${lang}: ${cv[lang]}`).toBe(true);
  });

  it('cv.preview de/en existieren unter public/ und sind <= 60 KB', () => {
    const pv = strings['cv.preview'] as { de: string; en: string };
    for (const lang of ['de', 'en'] as const) {
      const f = join(root, 'public', pv[lang]);
      expect(existsSync(f), `cv.preview.${lang}: ${pv[lang]}`).toBe(true);
      expect(statSync(f).size, `cv.preview.${lang} Größe`).toBeLessThanOrEqual(60 * 1024);
    }
  });
});
