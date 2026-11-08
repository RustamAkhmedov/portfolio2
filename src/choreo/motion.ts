/*
 * Bewegungs-Tokens für GSAP (docs/design.md, Abschnitt Bewegung). Zeiten kommen aus tokens.css,
 * Easings/Scrub stehen dort nur als Kommentar und sind hier die einzige Stelle im Code.
 */

/** ScrollTrigger-Glättung der Explosion (Sekunden) */
export const SCRUB = 0.6;
/** Ease, mit der die Scroll-Position nachgezogen wird (wie GSAPs scrub) */
export const SCRUB_EASE = 'power3';

/** Liest eine Zeit-Variable (z. B. `--d-intro: 900ms`) in Millisekunden. */
export function cssMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : n;
}

/** Liest eine Längen-Variable in px (z. B. `--s-2: 8px`). */
export function cssPx(name: string, fallback: number): number {
  const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(n) ? n : fallback;
}
