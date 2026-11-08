/*
 * Sprachumschalter (T061, contracts/dom.md „Sprachen“): `a[data-lang-switch]` führt auf die andere Sprachseite und
 * hängt den Anker des gerade sichtbaren Abschnitts an (`#skills` …; im Hero keiner). Der href wird laufend
 * nachgeführt (scroll, gedrosselt), dazu direkt vor Klick/Mittelklick/Kontextmenü/Fokus, damit auch
 * „Link kopieren“ und Strg-Klick stimmen. Auf der Zielseite springt die Timeline (T053) zur Marke.
 * Ohne JS bleibt der Standard-Link ohne Anker.
 */
import type { Marks } from './score';
import { SECTIONS } from './score';

/** Anker-Ids in Seitenreihenfolge (ohne Hero) */
const ORDER = ['bom', 'projekte', ...SECTIONS.map((s) => s.id), 'outro'] as const;

/**
 * Abschnitt, der bei Scroll-Position `y` im Bild ist (reine Funktion der Marken, nicht des DOM: Pin-Spacer!).
 * Jeder Abschnitt gilt ab der Mitte seiner Einfahrt (Anfahrt bis Anker-Position `anchorY`) bis zur Mitte der
 * nächsten. Hero und Explosion: null.
 */
export function sectionAtScroll(m: Marks, y: number): string | null {
  if (!Number.isFinite(y)) return null;
  const starts: Array<[string, number]> = [
    ['bom', (m.lidEnd + m.explodeEnd) / 2],
    ['projekte', (m.projStart + m.projEnd) / 2],
    ...SECTIONS.map((s, i): [string, number] => {
      const sec = m.sections[i];
      return [s.id, sec ? (Math.max(sec.inStart, i ? (m.sections[i - 1]?.pinEnd ?? 0) : m.stepsEnd) + sec.pinStart) / 2 : Infinity];
    }),
    ['outro', (m.outroStart + m.outroEnd) / 2],
  ];
  let id: string | null = null;
  for (const [name, from] of starts) if (y >= from) id = name;
  return id;
}

/** DOM-Ersatz (reduzierte Bewegung, keine Timeline): letzter Abschnitt, dessen Oberkante in der oberen Bildhälfte liegt. */
export function sectionInViewport(doc: Document = document): string | null {
  const win = doc.defaultView;
  const limit = (win?.innerHeight ?? 0) * 0.5;
  let id: string | null = null;
  for (const name of ORDER) {
    const el = doc.getElementById(name);
    if (el && el.getBoundingClientRect().top <= limit) id = name;
  }
  return id;
}

/** `base` (href ohne Anker) + optionaler Anker */
export function langHref(base: string, id: string | null): string {
  const clean = base.split('#')[0] ?? base;
  return id ? `${clean}#${encodeURIComponent(id)}` : clean;
}

export interface LangSwitch {
  /** Quelle der Marken (Timeline); null/Rückgabe null = DOM-Ersatz */
  setMarks(fn: (() => Marks | null) | null): void;
  /** href aller Umschalter sofort aktualisieren */
  update(): void;
  destroy(): void;
}

export function initLangSwitch(doc: Document = document): LangSwitch {
  const win = doc.defaultView ?? window;
  const links = [...doc.querySelectorAll<HTMLAnchorElement>('a[data-lang-switch]')];
  const bases = new Map(links.map((a) => [a, a.getAttribute('href') ?? ''] as const));
  let getMarks: (() => Marks | null) | null = null;
  let raf = 0;

  const update = (): void => {
    const m = getMarks?.() ?? null;
    const id = m ? sectionAtScroll(m, win.scrollY) : sectionInViewport(doc);
    for (const a of links) {
      const base = bases.get(a);
      if (!base) continue;
      const href = langHref(base, id);
      if (a.getAttribute('href') !== href) a.setAttribute('href', href);
    }
  };
  const schedule = (): void => {
    if (raf) return;
    raf = win.requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  };
  const onLink = (e: Event): void => {
    if ((e.target as Element | null)?.closest?.('a[data-lang-switch]')) update();
  };

  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  const evs = ['pointerdown', 'pointerover', 'focusin', 'click', 'auxclick', 'contextmenu', 'keydown'] as const;
  for (const ev of evs) doc.addEventListener(ev, onLink, true);
  update();

  return {
    setMarks(fn) {
      getMarks = fn;
      update();
    },
    update,
    destroy() {
      win.removeEventListener('scroll', schedule);
      win.removeEventListener('resize', schedule);
      for (const ev of evs) doc.removeEventListener(ev, onLink, true);
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      for (const [a, base] of bases) a.setAttribute('href', base);
    },
  };
}
