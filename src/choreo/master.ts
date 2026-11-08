/*
 * Baut aus der Partitur (score.ts) die GSAP-Master-Timeline. Zeiteinheit: 1 s Timeline-Zeit = 1 px Scroll.
 * Die Timeline ist pausiert und wird von timeline.ts über die (geglättete) Scroll-Position gestellt.
 * Getweent wird nur ein flaches Zahlen-Objekt (proxy), nie three.js-Objekte oder DOM.
 */
import { gsap } from 'gsap';
import type { Score } from './score';

export type Proxy = Record<string, number>;

/** Leert `tl` (oder legt eine neue an) und füllt sie aus der Partitur. Setzt `proxy` auf die Startwerte. */
export function buildMaster(score: Score, proxy: Proxy, tl?: gsap.core.Timeline): gsap.core.Timeline {
  const master = tl ?? gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  master.clear();
  master.pause(0);
  for (const k of Object.keys(proxy)) if (!(k in score.initial)) delete proxy[k];
  Object.assign(proxy, score.initial);

  for (const s of score.segments) {
    master.fromTo(
      proxy,
      { [s.key]: s.from },
      { [s.key]: s.to, duration: s.end - s.start, ease: 'none', immediateRender: false },
      s.start,
    );
  }
  for (const [name, at] of Object.entries(score.labels)) master.addLabel(name, at);
  // Gesamtdauer = Ende der Partitur, damit time() bis dorthin wirkt
  if (master.duration() < score.end) master.set({}, {}, score.end);
  return master;
}
