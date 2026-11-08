/*
 * Hero-Intro: der eine freie Moment (docs/design.md, Bewegung). Name und Zeile steigen per SplitText
 * Zeile für Zeile aus einer Maske, Dauer --d-intro, Stagger 40 ms, Ease power3.out (--ease-out).
 *
 * Ohne JS ist der Text normal sichtbar. Das Inline-Skript im <head> setzt `html.intro` (nur mit WebGL und
 * ohne reduzierte Bewegung), CSS hält den Text bis zum Start unsichtbar; spätestens nach 2,5 s nimmt das
 * Inline-Skript die Klasse selbst wieder weg (falls dieses Modul nie lädt).
 */
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { cssMs } from './motion';

gsap.registerPlugin(SplitText);

const STAGGER = 0.04;
const EASE = 'power3.out';

/** Startet das Intro einmalig; liefert eine Aufräumfunktion (bricht ab und stellt das Markup wieder her). */
export function playIntro(): () => void {
  const root = document.documentElement;
  const reveal = (): void => root.classList.remove('intro');
  const targets = [document.getElementById('hero-title'), document.querySelector<HTMLElement>('.hero__lead')].filter(
    (el): el is HTMLElement => !!el,
  );
  if (!targets.length || !root.classList.contains('intro')) {
    reveal();
    return () => {};
  }

  let ctx: gsap.Context | null = null;
  let cancelled = false;
  // Zeilen erst nach dem Laden der Schriften bestimmen, sonst stimmen die Umbrüche nicht.
  const fonts = document.fonts?.ready ?? Promise.resolve();
  void fonts.then(() => {
    if (cancelled) return;
    ctx = gsap.context(() => {
      const split = SplitText.create(targets, { type: 'lines', mask: 'lines', linesClass: 'intro-line' });
      gsap.from(split.lines, {
        yPercent: 105,
        duration: cssMs('--d-intro', 900) / 1000,
        ease: EASE,
        stagger: STAGGER,
        onComplete: () => split.revert(),
      });
    });
    reveal();
  });

  return () => {
    cancelled = true;
    ctx?.revert();
    reveal();
  };
}
