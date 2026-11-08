// T053/T054: Anker-Auflösung (#id → Scroll-Position) und Fokus-Sprünge, rein aus den Marken; Klick-Verhalten in jsdom.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
});

import { anchorY, focusScrollY, SECTIONS, type Marks } from '../src/choreo/score';
import { createSmooth, hashId, type Smooth } from '../src/choreo/smooth';

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

describe('anchorY', () => {
  it('löst Anker auf Pin-Beginne und Marken auf, nicht auf DOM-Abstände', () => {
    expect(anchorY(marks, 'hero')).toBe(0);
    expect(anchorY(marks, 'bom')).toBe(marks.explodeEnd);
    expect(anchorY(marks, 'projekte')).toBe(marks.projEnd);
    SECTIONS.forEach((s, i) => expect(anchorY(marks, s.id)).toBe(marks.sections[i]!.pinStart));
    expect(anchorY(marks, 'outro')).toBe(marks.outroEnd);
  });
  it('unbekannte Ids: null', () => {
    expect(anchorY(marks, 'main')).toBeNull();
    expect(anchorY(marks, '')).toBeNull();
    expect(anchorY(marks, 'projekte-alle')).toBeNull();
  });
  it('Positionen steigen mit der Seitenreihenfolge', () => {
    const ids = ['hero', 'bom', 'projekte', ...SECTIONS.map((s) => s.id), 'outro'];
    const ys = ids.map((id) => anchorY(marks, id)!);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
});

describe('focusScrollY', () => {
  it('verdecktes Datenblatt: Mitte seiner Strecke; sichtbares: nichts', () => {
    const len = (marks.stepsEnd - marks.projEnd) / 6;
    expect(focusScrollY(marks, { kind: 'step', index: 3, count: 6 }, 3000, 0)).toBe(Math.round(marks.projEnd + 3.5 * len));
    expect(focusScrollY(marks, { kind: 'step', index: 0, count: 6 }, 3000, 1)).toBeNull();
  });
  it('Abschnitt vor seinem Pin: zum Pin-Beginn; danach: nichts (der Browser scrollt selbst)', () => {
    const pin = marks.sections[1]!.pinStart;
    expect(focusScrollY(marks, { kind: 'section', index: 1 }, pin - 300)).toBe(pin);
    expect(focusScrollY(marks, { kind: 'section', index: 1 }, pin)).toBeNull();
    expect(focusScrollY(marks, { kind: 'section', index: 1 }, pin + 200)).toBeNull();
  });
  it('Projekte-Pin (Überspringen-Link): erst ab Pin-Beginn', () => {
    expect(focusScrollY(marks, { kind: 'projekte' }, marks.projStart)).toBe(marks.projEnd);
    expect(focusScrollY(marks, { kind: 'projekte' }, marks.projEnd + 100)).toBeNull();
  });
  it('Stücklistenzeile und Schriftfeld, solange nicht eingeblendet', () => {
    expect(focusScrollY(marks, { kind: 'row' }, 900, 0)).toBe(marks.rowsEnd);
    expect(focusScrollY(marks, { kind: 'row' }, 2000, 1)).toBeNull();
    expect(focusScrollY(marks, { kind: 'outro' }, 11200, 0.2)).toBe(marks.outroEnd);
    expect(focusScrollY(marks, { kind: 'outro' }, 12000, 1)).toBeNull();
  });
});

describe('hashId', () => {
  it('dekodiert, ignoriert leere und kaputte Hashes', () => {
    expect(hashId('#projekte')).toBe('projekte');
    expect(hashId('#%C3%BCber')).toBe('über');
    expect(hashId('#')).toBeNull();
    expect(hashId('')).toBeNull();
    expect(hashId(null)).toBeNull();
    expect(hashId('#%E0%A4%A')).toBeNull();
    expect(hashId('projekte')).toBeNull();
  });
});

describe('createSmooth: Anker-Klicks', () => {
  let smooth: Smooth;
  let scrollTo: ReturnType<typeof vi.fn>;
  const link = (): HTMLAnchorElement => document.querySelector<HTMLAnchorElement>('a[href="#kontakt"]')!;
  const click = (el: Element, init: MouseEventInit = {}): MouseEvent => {
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    el.dispatchEvent(ev);
    return ev;
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <table id="bom"><tbody><tr data-part="P-05"><td><a href="#kontakt">Kontakt</a></td>
      <td><a href="#nirgends">x</a></td><td><a href="#main">main</a></td><td><a href="https://example.org/">ext</a></td></tr></tbody></table>
      <main id="main"><section id="kontakt"><h2>Kontakt</h2></section></main>`;
    history.replaceState(null, '', '/');
    smooth = createSmooth();
    scrollTo = vi.spyOn(smooth.lenis, 'scrollTo') as unknown as ReturnType<typeof vi.fn>;
    scrollTo.mockImplementation(() => {});
  });
  afterEach(() => {
    smooth.destroy();
    vi.restoreAllMocks();
  });

  it('ohne Auflösung (reduced, nicht bereit): nativer Anker, kein preventDefault', () => {
    const ev = click(link());
    expect(ev.defaultPrevented).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(location.hash).toBe('');
  });

  it('mit Auflösung: Lenis scrollTo zur Timeline-Position, Hash gesetzt, Ziel fokussiert', () => {
    smooth.setResolver((id) => (id === 'kontakt' ? 4321 : null));
    const ev = click(link());
    expect(ev.defaultPrevented).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith(4321);
    expect(location.hash).toBe('#kontakt');
    expect(document.activeElement).toBe(document.getElementById('kontakt'));
    expect(document.getElementById('kontakt')!.getAttribute('tabindex')).toBe('-1');
  });

  it('unbekannt für die Timeline, aber im DOM: Lenis scrollt zum Element', () => {
    smooth.setResolver(() => null);
    const ev = click(document.querySelector('a[href="#main"]')!);
    expect(ev.defaultPrevented).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith(document.getElementById('main'));
  });

  it('weder Auflösung noch Element, externe Links, Zusatztasten, Mittelklick: nativ', () => {
    smooth.setResolver(() => null);
    expect(click(document.querySelector('a[href="#nirgends"]')!).defaultPrevented).toBe(false);
    expect(click(document.querySelector('a[href^="https"]')!).defaultPrevented).toBe(false);
    smooth.setResolver(() => 100);
    expect(click(link(), { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(click(link(), { button: 1 }).defaultPrevented).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('Zurück-Taste: gemerkte Position, sonst Anker, sonst Seitenanfang', () => {
    smooth.setResolver((id) => (id === 'kontakt' ? 4321 : null));
    Object.defineProperty(window, 'scrollY', { value: 777, configurable: true });
    click(link());
    expect(history.state).toEqual({});
    scrollTo.mockClear();
    window.dispatchEvent(new PopStateEvent('popstate', { state: { y: 777 } }));
    expect(scrollTo).toHaveBeenCalledWith(777, { immediate: true, force: true });
    scrollTo.mockClear();
    history.replaceState(null, '', '/#kontakt');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(scrollTo).toHaveBeenCalledWith(4321, { immediate: true, force: true });
    scrollTo.mockClear();
    history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(scrollTo).toHaveBeenCalledWith(0, { immediate: true, force: true });
    delete (window as { scrollY?: number }).scrollY;
  });

  it('destroy() entfernt Klick- und popstate-Handler', () => {
    smooth.setResolver(() => 5);
    smooth.destroy();
    expect(click(link()).defaultPrevented).toBe(false);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { y: 1 } }));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
