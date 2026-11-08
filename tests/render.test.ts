// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, posix } from 'node:path';
// @ts-expect-error reines JS-Modul ohne Typen
import { renderPages } from '../tools/render.mjs';

const root = resolve(__dirname, '..');
const parts = JSON.parse(readFileSync(join(root, 'src/content/parts.json'), 'utf8')) as { id: string; section?: string }[];

const { pages } = renderPages() as { pages: Record<string, string> };
const FILES = { de: 'index.html', en: 'en/index.html' } as const;
const docs = Object.fromEntries(
  Object.entries(FILES).map(([lang, file]) => [lang, new DOMParser().parseFromString(pages[file], 'text/html')]),
) as Record<keyof typeof FILES, Document>;
const langs = Object.keys(FILES) as (keyof typeof FILES)[];

/**
 * Bekannte, noch nicht gebaute Dateien (Pfad relativ zur Site-Wurzel). Jeder Eintrag nennt die Aufgabe,
 * die ihn liefert; mit dem Bau der Datei hier streichen (der Test meldet veraltete Einträge).
 */
const MISSING_OK: Record<string, string> = {};

/** Struktur ohne Texte: Tag, id, data-*, class, role/aria-hidden je Element in Dokumentreihenfolge. */
function skeleton(doc: Document) {
  return [...doc.body.querySelectorAll('*')].map((el) => {
    const attrs = [...el.attributes]
      .filter((a) => a.name === 'id' || a.name === 'class' || a.name === 'aria-hidden' || a.name.startsWith('data-'))
      .map((a) => `${a.name}=${a.value}`)
      .sort();
    return `${el.tagName.toLowerCase()}[${attrs.join(',')}]`;
  });
}

describe('render: beide Seiten', () => {
  it('erzeugt genau die zwei Seiten', () => {
    expect(Object.keys(pages).sort()).toEqual(['en/index.html', 'index.html']);
  });

  for (const lang of langs) {
    it(`${lang}: lang-Attribut und keine Template-Reste`, () => {
      expect(docs[lang].documentElement.lang).toBe(lang);
      expect(pages[FILES[lang]]).not.toMatch(/\{\{|\}\}/);
      expect(pages[FILES[lang]]).not.toMatch(/\bundefined\b|\[object Object\]/);
    });
  }

  it('de und en haben dieselbe Struktur (nur Texte verschieden)', () => {
    expect(skeleton(docs.en)).toEqual(skeleton(docs.de));
    expect(docs.en.body.textContent).not.toBe(docs.de.body.textContent);
  });
});

describe('render: Hooks aus contracts/dom.md', () => {
  for (const lang of langs) {
    describe(lang, () => {
      const d = () => docs[lang];

      it('Abschnitte: #hero, #bom, #projekte, #outro; section[data-part] passt zu parts.json', () => {
        for (const id of ['hero', 'bom', 'projekte', 'outro']) expect(d().querySelector(`section#${id}`), id).not.toBeNull();
        const withSection = parts.filter((p) => p.section);
        for (const p of withSection) {
          const el = d().getElementById(p.section!);
          expect(el, `#${p.section}`).not.toBeNull();
          expect(el!.tagName).toBe('SECTION');
          expect(el!.getAttribute('data-part')).toBe(p.id);
        }
      });

      it('#bom: eine Zeile tr[data-part] je Teil, Abschnittsteile mit Link', () => {
        const rows = [...d().querySelectorAll('#bom tr[data-part]')];
        expect(rows.map((r) => r.getAttribute('data-part'))).toEqual(parts.map((p) => p.id));
        for (const p of parts) {
          const row = d().querySelector(`#bom tr[data-part="${p.id}"]`)!;
          const link = row.querySelector('a');
          if (p.section) expect(link?.getAttribute('href'), p.id).toBe(`#${p.section}`);
          else expect(link, p.id).toBeNull();
        }
      });

      it('#projekte: 6 [data-step], Überspringen-Link, #projekte-alle mit 7 [data-project]', () => {
        expect(d().querySelectorAll('#projekte [data-step]').length).toBe(6);
        const skip = d().querySelector('#projekte a[data-skip="projekte"]');
        expect(skip).not.toBeNull();
        expect(skip!.getAttribute('href')).toBe('#skills');
        expect(d().querySelectorAll('#projekte-alle [data-project]').length).toBe(7);
        expect(d().querySelectorAll('#projekte-alle [data-step]').length).toBe(0);
        expect(d().querySelector('#projekte-alle')!.closest('#projekte')).not.toBeNull();
      });

      it('#scene, #scene-fallback, #labels', () => {
        expect(d().querySelector('#scene')?.getAttribute('aria-hidden')).toBe('true');
        const fb = d().querySelector('#scene-fallback');
        expect(fb?.tagName).toBe('PICTURE');
        expect(fb!.querySelector('img')).not.toBeNull();
        const labels = d().querySelector('#labels');
        expect(labels?.getAttribute('aria-hidden')).toBe('true');
        expect(labels!.querySelector('svg')).not.toBeNull();
        expect([...labels!.querySelectorAll('.label[data-part]')].map((l) => l.getAttribute('data-part'))).toEqual(
          parts.map((p) => p.id),
        );
      });

      it('Sprachumschalter und hreflang auf beide Seiten', () => {
        const switches = d().querySelectorAll('a[data-lang-switch]');
        expect(switches.length).toBeGreaterThan(0);
        const other = lang === 'de' ? 'en' : 'de';
        for (const a of switches) {
          expect(a.getAttribute('hreflang')).toBe(other);
          expect(a.getAttribute('lang')).toBe(other);
        }
        const alt = [...d().querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.getAttribute('hreflang')).sort();
        expect(alt).toEqual(['de', 'en']);
      });
    });
  }
});

describe('render: interne Links und Assets', () => {
  const external = /^(https?:|mailto:|tel:|data:|\/\/)/;
  const known = new Set(Object.values(FILES));

  for (const lang of langs) {
    it(`${lang}: Fragmente zeigen auf vorhandene IDs, Dateien existieren`, () => {
      const d = docs[lang];
      const pageDir = posix.dirname(FILES[lang]);
      const problems: string[] = [];
      const refs: string[] = [];
      for (const el of d.querySelectorAll('[href], [src], [srcset]')) {
        if (el.tagName === 'LINK' && el.getAttribute('rel') === 'canonical') continue;
        if (el.tagName === 'LINK' && el.getAttribute('rel') === 'alternate') continue;
        if (el.tagName === 'META') continue;
        for (const name of ['href', 'src']) if (el.hasAttribute(name)) refs.push(el.getAttribute(name)!);
        if (el.hasAttribute('srcset'))
          refs.push(...el.getAttribute('srcset')!.split(',').map((s) => s.trim().split(/\s+/)[0]));
      }
      expect(refs.length).toBeGreaterThan(10);
      for (const ref of refs) {
        if (!ref || external.test(ref)) continue;
        if (ref.startsWith('#')) {
          if (ref.length > 1 && !d.getElementById(ref.slice(1))) problems.push(`Fragment ${ref} ohne Ziel`);
          continue;
        }
        const [path] = ref.split(/[#?]/);
        const site = posix.normalize(posix.join(pageDir, path)); // relativ zur Site-Wurzel
        if (site.startsWith('..')) { problems.push(`${ref} verlässt die Site`); continue; }
        if (known.has(site as any)) continue; // erzeugte Seiten
        if (site in MISSING_OK) continue;
        if (!existsSync(join(root, 'public', site)) && !existsSync(join(root, site))) problems.push(`${ref} -> ${site} fehlt`);
      }
      expect(problems).toEqual([]);
    });
  }

  it('MISSING_OK enthält keine inzwischen vorhandenen Dateien', () => {
    const stale = Object.keys(MISSING_OK).filter((f) => existsSync(join(root, 'public', f)));
    expect(stale).toEqual([]);
  });
});
