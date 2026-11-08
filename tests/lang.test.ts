// T061: Sprachumschalter hängt den Abschnitts-Anker an (rein aus den Marken) und räumt auf.
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initLangSwitch, langHref, sectionAtScroll, type LangSwitch } from '../src/choreo/lang';
import { anchorY, SECTIONS, type Marks } from '../src/choreo/score';

const marks: Marks = {
  vh: 900,
  lidEnd: 720,
  explodeEnd: 1400,
  rowsStart: 1300,
  rowsEnd: 1900,
  projStart: 2400,
  projEnd: 2700,
  stepsEnd: 5400,
  sections: [0, 1, 2, 3].map((i) => {
    const pinStart = 6100 + 1400 * i;
    return { inStart: pinStart - 700, pinStart, pinEnd: pinStart + 540 };
  }),
  outroStart: 11000,
  outroEnd: 12000,
};

describe('sectionAtScroll', () => {
  it('Hero und frühe Explosion: null', () => {
    expect(sectionAtScroll(marks, 0)).toBeNull();
    expect(sectionAtScroll(marks, 700)).toBeNull();
    expect(sectionAtScroll(marks, NaN)).toBeNull();
  });
  it('jede Anker-Position liefert ihren Abschnitt', () => {
    for (const id of ['bom', 'projekte', ...SECTIONS.map((s) => s.id), 'outro']) {
      expect(sectionAtScroll(marks, anchorY(marks, id)!)).toBe(id);
    }
  });
  it('Pin-Beginn, Pin-Ende, Verzeichnis, Seitenende', () => {
    expect(sectionAtScroll(marks, marks.projEnd)).toBe('projekte');
    expect(sectionAtScroll(marks, marks.stepsEnd + 200)).toBe('projekte');
    expect(sectionAtScroll(marks, marks.sections[0]!.pinEnd)).toBe('skills');
    expect(sectionAtScroll(marks, marks.sections[3]!.pinEnd + 100)).toBe('kontakt');
    expect(sectionAtScroll(marks, marks.outroEnd + 500)).toBe('outro');
  });
  it('Reihenfolge steigt monoton', () => {
    const order = ['bom', 'projekte', 'skills', 'ueber', 'lebenslauf', 'kontakt', 'outro'];
    let last = -1;
    for (let y = 0; y <= 12500; y += 25) {
      const id = sectionAtScroll(marks, y);
      const i = id ? order.indexOf(id) : -1;
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
  });
});

describe('langHref', () => {
  it('hängt an, ersetzt, lässt weg', () => {
    expect(langHref('../en/', 'skills')).toBe('../en/#skills');
    expect(langHref('/en/#alt', 'kontakt')).toBe('/en/#kontakt');
    expect(langHref('/en/#alt', null)).toBe('/en/');
  });
});

describe('initLangSwitch', () => {
  let ls: LangSwitch;
  let a: HTMLAnchorElement;
  let b: HTMLAnchorElement;
  beforeEach(() => {
    document.body.innerHTML = '<a data-lang-switch href="en/">en</a><a data-lang-switch href="en/">en</a>';
    [a, b] = [...document.querySelectorAll<HTMLAnchorElement>('a')] as [HTMLAnchorElement, HTMLAnchorElement];
    ls = initLangSwitch();
  });
  afterEach(() => ls.destroy());

  it('Standard-href ohne Marken und ohne Abschnitt im Bild', () => {
    expect(a.getAttribute('href')).toBe('en/');
  });
  it('setzt href aus den Marken, vor dem Klick aktuell', () => {
    ls.setMarks(() => marks);
    expect(a.getAttribute('href')).toBe('en/');
    window.scrollTo = (() => {}) as typeof window.scrollTo;
    Object.defineProperty(window, 'scrollY', { value: marks.sections[1]!.pinStart, configurable: true });
    a.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(a.getAttribute('href')).toBe('en/#ueber');
    expect(b.getAttribute('href')).toBe('en/#ueber');
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    a.dispatchEvent(new Event('contextmenu', { bubbles: true }));
    expect(a.getAttribute('href')).toBe('en/');
  });
  it('DOM-Ersatz ohne Marken: Abschnitt in der oberen Bildhälfte', () => {
    document.body.insertAdjacentHTML('beforeend', '<section id="skills"></section>');
    const el = document.getElementById('skills')!;
    el.getBoundingClientRect = () => ({ top: 10 }) as DOMRect;
    a.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(a.getAttribute('href')).toBe('en/#skills');
  });
  it('destroy stellt den Standard-href wieder her und hört auf', () => {
    ls.setMarks(() => marks);
    Object.defineProperty(window, 'scrollY', { value: marks.outroEnd, configurable: true });
    ls.update();
    expect(a.getAttribute('href')).toBe('en/#outro');
    ls.destroy();
    expect(a.getAttribute('href')).toBe('en/');
    a.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(a.getAttribute('href')).toBe('en/');
  });
});
