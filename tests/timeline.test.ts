// @vitest-environment jsdom
// T030: createTimeline() richtet Pins/Marken ein, schreibt den Startzustand und räumt in kill() alles ab
// (Voraussetzung für T040: gsap.matchMedia hängt createTimeline ein und aus).
import { describe, it, expect, vi } from 'vitest';

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
  window.scrollTo = (() => {}) as typeof window.scrollTo; // jsdom: nicht implementiert
});

import { ScrollTrigger } from 'gsap/ScrollTrigger';
// @ts-expect-error reines JS-Modul ohne Typen
import { renderPages } from '../tools/render.mjs';
import { createTimeline } from '../src/choreo/timeline';
import { state } from '../src/scene/state';

const { pages } = renderPages() as { pages: Record<string, string> };

function mountPage(): void {
  const doc = new DOMParser().parseFromString(pages['index.html'], 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
}

function fakeLabels() {
  return { update: vi.fn(), show: vi.fn(), setIn: vi.fn(), setActive: vi.fn(), setLayout: vi.fn(), dispose: vi.fn() };
}

describe('createTimeline', () => {
  it('setzt html.choreo, pinnt Hero und Projekte, schreibt den Startzustand', () => {
    mountPage();
    const labels = fakeLabels();
    const before = ScrollTrigger.getAll().length;
    const tl = createTimeline({ labels });
    expect(document.documentElement.classList.contains('choreo')).toBe(true);
    expect(ScrollTrigger.getAll().length - before).toBe(15);
    expect(ScrollTrigger.getAll().filter((t) => t.pin).map((t) => t.pin)).toEqual([
      document.getElementById('hero'),
      document.querySelector('#projekte .proj-pin'),
      ...['skills', 'ueber', 'lebenslauf', 'kontakt'].map((id) => document.getElementById(id)),
    ]);
    expect(tl.marks()).not.toBeNull();
    expect(tl.score()!.labels).toHaveProperty('projekte-5');
    // Startzustand: erstes Datenblatt sichtbar, übrige verdeckt und nicht klickbar
    const steps = [...document.querySelectorAll<HTMLElement>('[data-step]')];
    expect(steps.map((s) => s.style.opacity)).toEqual(['1', '0', '0', '0', '0', '0']);
    expect(steps[1]!.style.pointerEvents).toBe('none');
    expect(state.explode).toBe(0);
    expect(labels.setIn).toHaveBeenCalled();
    tl.kill();
  });

  it('anchorY löst Anker auf Marken auf (Pin-Beginn), unbekannte Ids auf null', () => {
    mountPage();
    const tl = createTimeline({ labels: fakeLabels() });
    const m = tl.marks()!;
    expect(tl.anchorY('projekte')).toBe(Math.max(0, Math.round(m.projEnd)));
    expect(tl.anchorY('kontakt')).toBe(Math.max(0, Math.round(m.sections[3]!.pinStart)));
    expect(tl.anchorY('gibt-es-nicht')).toBeNull();
    tl.kill();
  });

  it('Fokus auf ein verdecktes Datenblatt springt nativ zur Position des Schritts (kein Fehler ohne Layout)', () => {
    mountPage();
    const tl = createTimeline({ labels: fakeLabels() });
    const link = document.querySelectorAll<HTMLElement>('[data-step]')[2]!.querySelector<HTMLElement>('a')!;
    expect(() => link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))).not.toThrow();
    tl.kill();
  });

  it('kill() entfernt Pins, Klasse und Inline-Styles; mehrfach aufrufbar', () => {
    mountPage();
    const labels = fakeLabels();
    const before = ScrollTrigger.getAll().length;
    const tl = createTimeline({ labels });
    tl.kill();
    expect(ScrollTrigger.getAll().length).toBe(before);
    expect(document.documentElement.classList.contains('choreo')).toBe(false);
    expect(document.querySelector('.pin-spacer')).toBeNull();
    for (const el of document.querySelectorAll<HTMLElement>('[data-step], #bom tbody tr')) {
      expect(el.style.opacity).toBe('');
      expect(el.style.transform).toBe('');
    }
    expect(labels.show).toHaveBeenLastCalledWith([]);
    expect(() => tl.kill()).not.toThrow();
  });

  it('wirft ohne die Hooks aus contracts/dom.md', () => {
    document.body.innerHTML = '<main><section id="hero"></section></main>';
    expect(() => createTimeline({ labels: null })).toThrow(/fehlt/);
    document.documentElement.classList.remove('choreo');
  });
});
