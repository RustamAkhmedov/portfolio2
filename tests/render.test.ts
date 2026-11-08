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

  for (const lang of langs) {
    it(`${lang}: poster, CSS-url(), Script/Stylesheet und CV-Link lösen relativ zur Seite auf`, () => {
      const d = docs[lang];
      const pageDir = posix.dirname(FILES[lang]);
      const prefix = lang === 'en' ? '../' : '';
      const refs: string[] = [];
      for (const el of d.querySelectorAll('[poster]')) refs.push(el.getAttribute('poster')!);
      for (const el of d.querySelectorAll('[style]'))
        for (const m of el.getAttribute('style')!.matchAll(/url\(\s*['"]?([^'")]+)/g)) refs.push(m[1]);
      for (const el of d.querySelectorAll('style'))
        for (const m of el.textContent!.matchAll(/url\(\s*['"]?([^'")]+)/g)) refs.push(m[1]);
      const problems: string[] = [];
      for (const ref of refs) {
        if (external.test(ref) || ref.startsWith('#')) continue;
        const site = posix.normalize(posix.join(pageDir, ref.split(/[#?]/)[0]));
        if (!existsSync(join(root, 'public', site)) && !existsSync(join(root, site))) problems.push(`${ref} -> ${site} fehlt`);
      }
      expect(problems).toEqual([]);

      // Einstiegs-Script und Stylesheets: relativ zur Seite, Ziel im Projektroot vorhanden
      const entries = [...d.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map(
        (el) => el.getAttribute('src') ?? el.getAttribute('href')!,
      );
      expect(entries.some((e) => e.endsWith('src/main.ts'))).toBe(true);
      for (const e of entries) {
        expect(e.startsWith(prefix), e).toBe(true);
        expect(existsSync(join(root, posix.normalize(posix.join(pageDir, e)))), e).toBe(true);
      }

      // alle internen Bild-/PDF-Verweise tragen das Präfix der Seite (en: ../)
      const files = [...d.querySelectorAll('img[src], source[srcset], a[href$=".pdf"]')].map(
        (el) => el.getAttribute('src') ?? el.getAttribute('srcset') ?? el.getAttribute('href')!,
      );
      expect(files.length).toBeGreaterThan(5);
      for (const f of files) {
        expect(f.startsWith(prefix + (f.endsWith('.pdf') ? 'cv/' : 'img/')), f).toBe(true);
        if (lang === 'de') expect(f.startsWith('../'), f).toBe(false);
      }

      // Lebenslauf-Datei je Sprache (strings.json cv.file), alle Verweise gleich
      const cvFile = ({ de: 'cv/lebenslauf.pdf', en: 'cv/resume.pdf' })[lang];
      const cvLinks = [...d.querySelectorAll('a[href$=".pdf"]')].map((a) => a.getAttribute('href'));
      expect(cvLinks.length).toBeGreaterThan(0);
      expect(new Set(cvLinks)).toEqual(new Set([prefix + cvFile]));
      expect(existsSync(join(root, 'public', cvFile))).toBe(true);
    });
  }

  it('MISSING_OK enthält keine inzwischen vorhandenen Dateien', () => {
    const stale = Object.keys(MISSING_OK).filter((f) => existsSync(join(root, 'public', f)));
    expect(stale).toEqual([]);
  });
});

describe('render: Sprachbeziehung', () => {
  const site = JSON.parse(readFileSync(join(root, 'src/content/site.json'), 'utf8')) as {
    base: string;
    languages: Record<string, { file: string; root: string; ogLocale: string }>;
  };
  const abs = (l: keyof typeof FILES) => site.base + FILES[l];

  it('lang-Attribut: de-Seite de, en-Seite en', () => {
    expect(docs.de.documentElement.getAttribute('lang')).toBe('de');
    expect(docs.en.documentElement.getAttribute('lang')).toBe('en');
  });

  for (const lang of langs) {
    const other = lang === 'de' ? 'en' : 'de';
    it(`${lang}: canonical und hreflang zeigen gegenseitig aufeinander`, () => {
      const d = docs[lang];
      expect(d.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(abs(lang));
      const alt = Object.fromEntries(
        [...d.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]),
      );
      expect(alt).toEqual({ de: abs('de'), en: abs('en') });
      expect(d.querySelector('meta[property="og:url"]')!.getAttribute('content')).toBe(abs(lang));
      expect(d.querySelector('meta[property="og:locale"]')!.getAttribute('content')).toBe(site.languages[lang].ogLocale);
      expect(d.querySelector('meta[property="og:locale:alternate"]')!.getAttribute('content')).toBe(
        site.languages[other].ogLocale,
      );
    });

    it(`${lang}: a[data-lang-switch] zeigt auf die ${other}-Seite`, () => {
      const href = lang === 'de' ? 'en/index.html' : '../index.html';
      const pageDir = posix.dirname(FILES[lang]);
      const switches = [...docs[lang].querySelectorAll('a[data-lang-switch]')];
      expect(switches.length).toBeGreaterThan(0);
      for (const a of switches) {
        const h = a.getAttribute('href')!.split('#')[0];
        expect(h).toBe(href);
        expect(posix.normalize(posix.join(pageDir, h))).toBe(FILES[other]);
        expect(a.getAttribute('hreflang')).toBe(other);
        expect(a.getAttribute('lang')).toBe(other);
      }
    });

    it(`${lang}: Teilenamen und Spec-Texte stammen aus parts.json`, () => {
      const full = JSON.parse(readFileSync(join(root, 'src/content/parts.json'), 'utf8')) as {
        id: string;
        name: Record<string, string>;
        spec: Record<string, string>;
      }[];
      for (const p of full) {
        const row = docs[lang].querySelector(`#bom tr[data-part="${p.id}"]`)!;
        const text = row.textContent!.replace(/\s+/g, ' ');
        expect(text, `${p.id} name`).toContain(p.name[lang]);
        const label = docs[lang].querySelector(`#labels .label[data-part="${p.id}"]`)!;
        expect(label.querySelector('.label__name')!.textContent, `${p.id} label`).toBe(p.name[lang]);
        expect(label.querySelector('.label__spec')!.textContent, `${p.id} spec`).toBe(p.spec[lang]);
      }
    });
  }

  it('en: aria-label und alt sind übersetzt (nicht identisch mit de, außer Allowlist)', () => {
    // Eigennamen, die in beiden Sprachen gleich lauten dürfen
    const ALLOW = new Set<string>([]);
    const collect = (d: Document) =>
      [...d.querySelectorAll('[aria-label], img[alt]')].map((el) => ({
        tag: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
        value: (el.getAttribute('aria-label') ?? el.getAttribute('alt') ?? '').trim(),
      }));
    const de = collect(docs.de);
    const en = collect(docs.en);
    expect(en.length).toBe(de.length);
    expect(en.length).toBeGreaterThan(3);
    const same = en.filter((e, i) => e.value !== '' && e.value === de[i].value && !ALLOW.has(e.value)).map((e) => `${e.tag}: ${e.value}`);
    expect(same).toEqual([]);
    expect(en.filter((e, i) => (e.value === '') !== (de[i].value === ''))).toEqual([]); // leer <-> leer
  });
});

describe('render: Hero ohne Sprung (html.s3d)', () => {
  const layoutCss = readFileSync(join(root, 'src/styles/layout.css'), 'utf8');
  for (const lang of langs) {
    it(`${lang}: Inline-Skript setzt s3d nur im 3D-Pfad (nicht bei reduced/no-webgl)`, () => {
      const script = [...docs[lang].head.querySelectorAll('script:not([src])')].map((s) => s.textContent ?? '').find((t) => t.includes("'intro'")) ?? '';
      const block = script.slice(script.indexOf("if (!c.contains('reduced')"));
      expect(block).toContain("c.add('s3d')");
      expect(block).toContain("!c.contains('no-webgl')");
    });
  }

  it('CSS: Standbild liegt mit s3d nicht im Fluss; reduced/no-webgl/no-js behalten es', () => {
    expect(layoutCss).toMatch(/html\.s3d:not\(\.reduced\):not\(\.no-webgl\) #scene-fallback \{ display: none; \}/);
    const reduced = readFileSync(join(root, 'src/styles/reduced.css'), 'utf8');
    expect(reduced).toMatch(/html\.reduced #scene-fallback[^{]*\{\s*display: block;\s*position: static;/);
  });
});
