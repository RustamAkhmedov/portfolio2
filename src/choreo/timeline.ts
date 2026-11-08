/*
 * Scroll-Choreografie (T030, research.md R4): eine Master-Timeline mit Scrub schreibt nur Zahlen in den
 * SceneState (setState) und ins Overlay (Labels, Stücklisten-Zeilen, Projekt-Datenblätter).
 *
 *   Hero gepinnt: lid 0→1 → Explosion + Kamera hero→total (Hero scrollt weg, Stückliste rückt nach),
 *   Labels zeichnen sich gestaffelt → Stückliste füllt sich Zeile für Zeile → #projekte rückt herein
 *   (Kamera zum Display, Fokus lid) → .proj-pin gepinnt, je [data-step] eine kurze Strecke, screen zählt
 *   hoch → Pin endet, #projekte-alle scrollt normal.
 *
 * Aufbau: ScrollTrigger misst nur Marken (Pins + Bereiche, in Seitenreihenfolge angelegt). Nach jedem
 * refresh entsteht daraus die Partitur (score.ts) und die pausierte Master-Timeline (master.ts,
 * 1 s = 1 px). Die Scroll-Position wird mit SCRUB (0,6 s, power3) nachgezogen und stellt die Timeline;
 * Sprünge > Lengths.snap Viewport-Höhen werden sofort übernommen (Anker, Pos1/Ende).
 * Alles hängt in einem gsap.context(); kill() räumt Pins, Tweens, Listener und Inline-Styles ab
 * (T040 hängt createTimeline() in gsap.matchMedia ein).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import partsData from '../content/parts.json';
import { setState } from '../scene/state';
import type { Labels } from '../scene/labels';
import { buildMaster, type Proxy } from './master';
import { SCRUB, SCRUB_EASE, cssPx } from './motion';
import { buildScore, DESKTOP, inKey, rowKey, stepKey, type Lengths, type Marks, type Score } from './score';

export { playIntro } from './intro';

gsap.registerPlugin(ScrollTrigger);

export interface TimelineContext {
  /** Label-Overlay der Szene (null, wenn #labels fehlt) */
  labels: Labels | null;
  /** Sprung-Funktion (Lenis); ohne: window.scrollTo */
  scrollTo?: (y: number) => void;
  /** Strecken; Standard DESKTOP (T041: Handy) */
  lengths?: Lengths;
}

export interface ChoreoTimeline {
  master: gsap.core.Timeline;
  /** aktuelle Marken und Partitur (null vor dem ersten refresh) */
  marks(): Marks | null;
  score(): Score | null;
  kill(): void;
}

interface PartInfo {
  key: string;
  explode: { order: number };
}

export function createTimeline(ctx: TimelineContext): ChoreoTimeline {
  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const bom = document.getElementById('bom');
  const pinEl = document.querySelector<HTMLElement>('#projekte .proj-pin');
  if (!hero || !bom || !pinEl) throw new Error('timeline: #hero, #bom oder #projekte .proj-pin fehlt');
  const rows = [...bom.querySelectorAll<HTMLElement>('tbody tr[data-part]')];
  const steps = [...pinEl.querySelectorAll<HTMLElement>('[data-step]')];

  const parts = partsData as unknown as PartInfo[];
  const partKeys = parts.map((p) => p.key);
  const labelOrder = [...parts].sort((a, b) => a.explode.order - b.explode.order).map((p) => p.key);
  const L = ctx.lengths ?? DESKTOP;
  const labels = ctx.labels;
  const vh = (): number => window.innerHeight;
  const rowShift = cssPx('--s-2', 8);
  const jump = ctx.scrollTo ?? ((y: number) => window.scrollTo({ top: y, behavior: 'instant' }));

  // Layout für die Choreografie (Hero füllt den Schirm, Datenblätter gestapelt) vor dem Messen
  root.classList.add('choreo');

  const proxy: Proxy = {};
  const head = { y: window.scrollY };
  let score: Score | null = null;
  let marks: Marks | null = null;

  // ---------- Overlay/State schreiben (nur bei Änderung) ----------
  const last: Record<string, number> = {};
  let lastActive: string | null | undefined;
  const changed = (key: string): number | undefined => {
    const v = proxy[key];
    if (v === undefined || v === last[key]) return undefined;
    last[key] = v;
    return v;
  };
  function apply(): void {
    const f = Math.round(proxy.focus ?? -1);
    const focus = f >= 0 ? (partKeys[f] ?? null) : null;
    setState({
      lid: proxy.lid,
      explode: proxy.explode,
      cam: proxy.cam,
      focusMix: proxy.focusMix,
      screen: proxy.screen,
      focus,
    });
    if (labels) {
      for (const k of partKeys) {
        const v = changed(inKey(k));
        if (v !== undefined) labels.setIn(k, v);
      }
      const active = focus && (proxy.focusMix ?? 0) > 0.5 ? focus : null;
      if (active !== lastActive) {
        labels.setActive(active);
        lastActive = active;
      }
    }
    rows.forEach((el, i) => {
      const v = changed(rowKey(i));
      if (v === undefined) return;
      el.style.opacity = String(v);
      el.style.transform = v >= 1 ? '' : `translate3d(0, ${((1 - v) * rowShift).toFixed(2)}px, 0)`;
    });
    steps.forEach((el, i) => {
      const v = changed(stepKey(i));
      if (v === undefined) return;
      el.style.opacity = String(v);
      el.style.pointerEvents = v > 0.5 ? '' : 'none';
    });
  }

  let master!: gsap.core.Timeline;
  let follow!: gsap.QuickToFunc;
  const render = (): void => {
    if (!score) return;
    master.time(Math.min(Math.max(head.y, 0), master.duration()));
    apply();
  };
  function seek(y: number): void {
    if (!score) return;
    if (Math.abs(y - head.y) > L.snap * vh()) {
      follow(y, y); // Sprung: ohne Zwischenzustände
      head.y = y;
      render();
    } else follow(y);
  }

  let heroPin!: ScrollTrigger;
  let bomIn!: ScrollTrigger;
  let rowsIn!: ScrollTrigger;
  let projIn!: ScrollTrigger;
  let projPin!: ScrollTrigger;

  let refreshedAt = { w: 0, h: 0 };
  function onRefresh(): void {
    refreshedAt = { w: window.innerWidth, h: window.innerHeight };
    marks = {
      vh: vh(),
      lidEnd: heroPin.end,
      explodeEnd: bomIn.end,
      rowsStart: rowsIn.start,
      rowsEnd: rowsIn.end,
      projStart: projIn.start,
      projEnd: projPin.start,
      stepsEnd: projPin.end,
    };
    score = buildScore({ marks, partKeys, labelOrder, rows: rows.length, steps: steps.length, lengths: L });
    buildMaster(score, proxy, master);
    for (const k of Object.keys(last)) delete last[k];
    lastActive = undefined;
    const y = window.scrollY;
    follow(y, y);
    head.y = y;
    render();
  }

  // Fokus per Tastatur auf ein verdecktes Datenblatt: zu dessen Schritt springen
  function onFocusIn(e: FocusEvent): void {
    if (!marks) return;
    const step = (e.target as Element | null)?.closest?.<HTMLElement>('[data-step]');
    const i = step ? steps.indexOf(step) : -1;
    if (i < 0 || (proxy[stepKey(i)] ?? 0) > 0.99) return;
    const len = (marks.stepsEnd - marks.projEnd) / steps.length;
    jump(Math.round(marks.projEnd + (i + 0.5) * len));
  }

  const gctx = gsap.context(() => {
    master = gsap.timeline({ paused: true });
    follow = gsap.quickTo(head, 'y', { duration: SCRUB, ease: SCRUB_EASE, onUpdate: render });

    // Marken in Seitenreihenfolge (Pins zuerst messen sich selbst, spätere Marken enthalten deren Abstand)
    heroPin = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => `+=${Math.round(L.lid * vh())}`,
      pin: true,
    });
    bomIn = ScrollTrigger.create({ trigger: bom, start: 'top bottom', end: 'top 25%' });
    rowsIn = ScrollTrigger.create({ trigger: bom.querySelector('tbody') ?? bom, start: 'top 85%', end: 'bottom 75%' });
    projIn = ScrollTrigger.create({ trigger: pinEl, start: 'top 70%', end: 'top top' });
    projPin = ScrollTrigger.create({
      trigger: pinEl,
      start: 'top top',
      end: () => `+=${Math.round(steps.length * L.step * vh())}`,
      pin: true,
    });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => seek(self.scroll()) });
  });

  ScrollTrigger.addEventListener('refresh', onRefresh);
  pinEl.addEventListener('focusin', onFocusIn);
  ScrollTrigger.refresh();

  // Spätere Layout-Änderungen: Schriften, Bilder
  let alive = true;
  const refresh = (): void => {
    if (alive) ScrollTrigger.refresh();
  };
  void document.fonts?.ready.then(refresh);
  if (document.readyState !== 'complete') window.addEventListener('load', refresh, { once: true });
  // ScrollTrigger verschiebt den Resize-refresh bis zum nächsten Scroll-Ende, wenn kurz vorher gescrollt
  // wurde (auch durch den eigenen refresh). Ohne erneutes Scrollen blieben Pins dann alt: nachholen.
  let resizeTimer = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (window.innerWidth !== refreshedAt.w || window.innerHeight !== refreshedAt.h) refresh();
    }, 400);
  };
  window.addEventListener('resize', onResize);

  // Anker in der URL (z. B. vom Sprachumschalter): nach dem Einrichten der Pins neu anspringen
  const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (target) jump(Math.round(target.getBoundingClientRect().top + window.scrollY));

  return {
    master,
    marks: () => marks,
    score: () => score,
    kill() {
      if (!alive) return;
      alive = false;
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      pinEl.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('load', refresh);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
      gctx.revert();
      for (const el of [...rows, ...steps]) {
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
        el.style.removeProperty('pointer-events');
      }
      labels?.show([]);
      labels?.setActive(null);
      root.classList.remove('choreo');
      score = null;
      marks = null;
    },
  };
}
