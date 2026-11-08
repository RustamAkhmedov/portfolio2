/*
 * Scroll-Choreografie (T030, research.md R4): eine Master-Timeline mit Scrub schreibt nur Zahlen in den
 * SceneState (setState) und ins Overlay (Labels, Stücklisten-Zeilen, Projekt-Datenblätter).
 *
 *   Hero gepinnt: lid 0→1 → Explosion + Kamera hero→total (Hero scrollt weg, Stückliste rückt nach),
 *   Labels zeichnen sich gestaffelt → Stückliste füllt sich Zeile für Zeile → #projekte rückt herein
 *   (Kamera zum Display, Fokus lid) → .proj-pin gepinnt, je [data-step] eine kurze Strecke, screen zählt
 *   hoch → Pin endet, #projekte-alle scrollt normal → #skills, #ueber, #lebenslauf, #kontakt (je eine kurze Einfahrt
 *   der Kamera zum Teil, Fokus, Labels, danach ein kurzer Pin, ist der Abschnitt höher als die Bühne, nur 1 px) →
 *   #outro (Explosion und Deckel kehren um, Kamera zurück in die Hero-Ansicht, Schriftfeld).
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
import { anchorY, buildScore, DESKTOP, focusScrollY, valueAt, type FocusRegion, inKey, portKey, rowKey, SECTIONS, skillKey, stepKey, type Lengths, type Marks, type Score } from './score';

export { playIntro } from './intro';

gsap.registerPlugin(ScrollTrigger);

export interface TimelineContext {
  /** Label-Overlay der Szene (null, wenn #labels fehlt) */
  labels: Labels | null;
  /** Sprung-Funktion (Lenis); ohne: window.scrollTo. `immediate`: ohne Animation (Fokus, Anker in der URL) */
  scrollTo?: (y: number, immediate?: boolean) => void;
  /** Strecken; Standard DESKTOP (Handy: MOBILE) */
  lengths?: Lengths;
  /** Höhe der Bühne oben in px (Handy: Szene liegt oben, Hero und Projekte pinnen darunter); Standard 0 */
  stageTop?: () => number;
}

export interface ChoreoTimeline {
  master: gsap.core.Timeline;
  /** aktuelle Marken und Partitur (null vor dem ersten refresh) */
  marks(): Marks | null;
  score(): Score | null;
  /** Scroll-Position für einen Anker `#id` (Pin-Beginn des Abschnitts), null = unbekannt oder noch keine Marken */
  anchorY(id: string): number | null;
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
  const sectionEls = SECTIONS.map((sec) => document.getElementById(sec.id));
  const outro = document.getElementById('outro');
  if (sectionEls.some((el) => !el) || !outro) throw new Error('timeline: #skills, #ueber, #lebenslauf, #kontakt oder #outro fehlt');
  const sections = sectionEls as HTMLElement[];
  const titleblock = outro.querySelector<HTMLElement>('.titleblock');
  const skillCount = document.querySelectorAll('#skills .skill-list li').length;
  const portCount = document.querySelectorAll('#kontakt .ports li').length;
  const rows = [...bom.querySelectorAll<HTMLElement>('tbody tr[data-part]')];
  const steps = [...pinEl.querySelectorAll<HTMLElement>('[data-step]')];

  const parts = partsData as unknown as PartInfo[];
  const partKeys = parts.map((p) => p.key);
  const labelKeys = [
    ...partKeys,
    ...Array.from({ length: skillCount }, (_, i) => skillKey(i)),
    ...Array.from({ length: portCount }, (_, i) => portKey(i)),
  ];
  /** Labels eines Abschnitts: das Teil plus seine Chips (Skills) bzw. Kanäle (Kontakt) */
  const sectionLabels = (part: string): string[] => [
    part,
    ...(part === 'board' ? Array.from({ length: skillCount }, (_, i) => skillKey(i)) : []),
    ...(part === 'ports' ? Array.from({ length: portCount }, (_, i) => portKey(i)) : []),
  ];
  const labelOrder = [...parts].sort((a, b) => a.explode.order - b.explode.order).map((p) => p.key);
  const L = ctx.lengths ?? DESKTOP;
  const labels = ctx.labels;
  const vh = (): number => window.innerHeight;
  const top = (): number => Math.round(ctx.stageTop?.() ?? 0);
  const rowShift = cssPx('--s-2', 8);
  const jump = ctx.scrollTo ?? ((y: number) => window.scrollTo({ top: y, behavior: 'instant' }));
  const jumpNow = (y: number): void => jump(y, true);

  // Layout für die Choreografie (Hero füllt den Schirm, Datenblätter gestapelt) vor dem Messen
  root.classList.add('choreo');

  const proxy: Proxy = {};
  const head = { y: window.scrollY };
  let score: Score | null = null;
  let marks: Marks | null = null;

  // ---------- Overlay/State schreiben (nur bei Änderung) ----------
  const last: Record<string, number> = {};
  let lastActive: string | null | undefined;
  let lastLayout: number | undefined;
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
      for (const k of labelKeys) {
        const v = changed(inKey(k));
        if (v !== undefined) labels.setIn(k, v);
      }
      const lay = Math.round(proxy.layout ?? -1);
      if (lay !== lastLayout) {
        lastLayout = lay;
        const sec = SECTIONS[lay];
        labels.setLayout(sec ? sectionLabels(sec.part) : null);
      }
      const active = focus && (proxy.focusMix ?? 0) > 0.5 ? focus : null;
      if (active !== lastActive) {
        labels.setActive(active);
        lastActive = active;
      }
    }
    const o = changed('outro');
    if (o !== undefined && titleblock) {
      titleblock.style.opacity = String(o);
      titleblock.style.transform = o >= 1 ? '' : `translate3d(0, ${((1 - o) * rowShift * 2).toFixed(2)}px, 0)`;
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
  const secIn: ScrollTrigger[] = [];
  const secPin: ScrollTrigger[] = [];
  let outroIn!: ScrollTrigger;

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
      sections: SECTIONS.map((_, i) => ({ inStart: secIn[i]!.start, pinStart: secPin[i]!.start, pinEnd: secPin[i]!.end })),
      outroStart: outroIn.start,
      outroEnd: outroIn.end,
    };
    score = buildScore({
      marks,
      partKeys,
      labelOrder,
      rows: rows.length,
      steps: steps.length,
      skills: skillCount,
      ports: portCount,
      lengths: L,
    });
    buildMaster(score, proxy, master);
    for (const k of Object.keys(last)) delete last[k];
    lastActive = undefined;
    lastLayout = undefined;
    const y = window.scrollY;
    follow(y, y);
    head.y = y;
    render();
  }

  // Fokus per Tastatur (T054): Der Browser scrollt zum DOM-Abstand des Elements. In gepinnten Abschnitten, in
  // verdeckten Datenblättern und in noch nicht eingeblendeten Zeilen ist das die falsche Stelle: dorthin springen, wo
  // der Abschnitt steht und das Element sichtbar ist (Scrub und Kamera folgen dem Scroll), dann ggf. nachscrollen.
  /** Region des Elements; `key` = Partitur-Schlüssel seiner Einblendung (Datenblatt, Zeile, Schriftfeld) */
  const regionOf = (t: HTMLElement): { region: FocusRegion; key?: string } | null => {
    const step = t.closest<HTMLElement>('[data-step]');
    const si = step ? steps.indexOf(step) : -1;
    if (si >= 0) return { region: { kind: 'step', index: si, count: steps.length }, key: stepKey(si) };
    if (pinEl.contains(t)) return { region: { kind: 'projekte' } };
    const row = t.closest<HTMLElement>('tr[data-part]');
    const ri = row ? rows.indexOf(row) : -1;
    if (ri >= 0) return { region: { kind: 'row' }, key: rowKey(ri) };
    const sec = sections.findIndex((el) => el.contains(t));
    if (sec >= 0) return { region: { kind: 'section', index: sec } };
    if (outro.contains(t)) return { region: { kind: 'outro' }, key: 'outro' };
    return null;
  };
  // Nativ springen (sofort wirksam, Lenis übernimmt die Position aus dem scroll-Ereignis)
  const nativeTo = (v: number): void => {
    window.scrollTo({ top: v, behavior: 'instant' });
    ScrollTrigger.update(); // Pins setzen, bevor die Sichtbarkeit geprüft wird
  };
  function onFocusIn(e: FocusEvent): void {
    const t = e.target as HTMLElement | null;
    if (!t || t === document.body || t.getAttribute?.('tabindex') === '-1') return; // -1: Anker-Ziel
    const hit = regionOf(t);
    if (!hit) return;
    let want: number | null = null;
    // Ob das Element sichtbar ist, entscheidet die Partitur an der aktuellen Scroll-Position (der Browser scrollt
    // oft animiert, die Position ist erst nach einigen Frames die endgültige): ein paar Frames lang prüfen,
    // bei Bedarf springen, sonst die gewählte Position gegen die Browser-Animation halten.
    const check = (): void => {
      if (!marks || !score) return;
      const y0 = window.scrollY;
      const shown = hit.key ? valueAt(score, hit.key, y0) : 1;
      const y = focusScrollY(marks, hit.region, y0, shown);
      if (y !== null) {
        nativeTo(y);
        want = y;
        // Abschnitt höher als der Schirm oder Zeile unter der Bühne: nachscrollen (scroll-padding hält die Bühne frei)
        if (hit.region.kind !== 'step' && typeof t.scrollIntoView === 'function') {
          const before = window.scrollY;
          t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          if (Math.abs(window.scrollY - before) > 1) want = Math.round(window.scrollY);
        }
      } else if (want !== null && Math.abs(window.scrollY - want) > 2) nativeTo(want);
    };
    const poll = (tries: number): void => {
      if (tries <= 0) return;
      requestAnimationFrame(() => {
        if (!alive || document.activeElement !== t) return;
        check();
        poll(tries - 1);
      });
    };
    check();
    poll(30);
  }

  const gctx = gsap.context(() => {
    master = gsap.timeline({ paused: true });
    follow = gsap.quickTo(head, 'y', { duration: SCRUB, ease: SCRUB_EASE, onUpdate: render });

    // Marken in Seitenreihenfolge (Pins zuerst messen sich selbst, spätere Marken enthalten deren Abstand)
    heroPin = ScrollTrigger.create({
      trigger: hero,
      start: () => `top top+=${top()}`,
      end: () => `+=${Math.round(L.lid * vh())}`,
      pin: true,
    });
    bomIn = ScrollTrigger.create({ trigger: bom, start: 'top bottom', end: () => (top() ? `top top+=${top() + Math.round(0.06 * vh())}` : 'top 25%') });
    rowsIn = ScrollTrigger.create({ trigger: bom.querySelector('tbody') ?? bom, start: 'top 85%', end: 'bottom 75%' });
    projIn = ScrollTrigger.create({ trigger: pinEl, start: 'top 70%', end: () => `top top+=${top()}` });
    projPin = ScrollTrigger.create({
      trigger: pinEl,
      start: () => `top top+=${top()}`,
      end: () => `+=${Math.round(steps.length * L.step * vh())}`,
      pin: true,
    });
    // Skills … Kontakt: Einfahrt (Abschnitt rückt herein), dann kurzer Pin. Ist der Abschnitt höher als der Platz
    // unter der Bühne, pinnt er nur 1 px (sonst wäre sein Ende abgeschnitten) und scrollt normal durch.
    const fits = (el: HTMLElement): boolean => el.offsetHeight <= vh() - top();
    sections.forEach((el, i) => {
      secIn[i] = ScrollTrigger.create({ trigger: el, start: 'top 90%', end: () => `top top+=${top()}` });
      secPin[i] = ScrollTrigger.create({
        trigger: el,
        start: () => `top top+=${top()}`,
        end: () => `+=${fits(el) ? Math.round(L.section * vh()) : 1}`,
        pin: true,
      });
    });
    // Outro: von „Oberkante am unteren Rand“ bis Seitenende (mit min-height füllt es den Schirm)
    outroIn = ScrollTrigger.create({ trigger: outro, start: 'top bottom', end: 'bottom bottom' });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => seek(self.scroll()) });
  });

  ScrollTrigger.addEventListener('refresh', onRefresh);
  document.addEventListener('focusin', onFocusIn);
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

  // Anker in der URL (z. B. /#kontakt, vom Sprachumschalter): nach dem Aufbau der Pins zur Position des Abschnitts,
  // nicht zu seinem DOM-Abstand. Spätere refresh (Schriften, Bilder) verschieben die Marken: bis zur ersten
  // Bedienung nachziehen.
  const hashId = (): string | null => {
    const h = location.hash;
    if (h.length < 2) return null;
    try {
      return decodeURIComponent(h.slice(1));
    } catch {
      return null;
    }
  };
  const hashY = (): number | null => {
    const id = hashId();
    if (!id) return null;
    const y = marks ? anchorY(marks, id) : null;
    if (y !== null) return y;
    const el = document.getElementById(id);
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
  };
  let followHash = true;
  let settleFrame = 0;
  // Lenis kennt die neue Dokumenthöhe (Pin-Abstände) erst nach seinem eigenen Resize und klemmt den Sprung
  // sonst zu früh (Handy: Ziel weit unten). Darum einige Frames lang nachsetzen, solange die Position abweicht.
  const settle = (tries = 12): void => {
    if (!followHash || !alive) return;
    const y = hashY();
    if (y === null || Math.abs(y - window.scrollY) <= 1) return;
    jumpNow(y);
    if (tries > 0) {
      cancelAnimationFrame(settleFrame);
      settleFrame = requestAnimationFrame(() => settle(tries - 1));
    }
  };
  const onSettleRefresh = (): void => settle();
  const stopFollow = (): void => {
    followHash = false;
  };
  const userEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  for (const ev of userEvents) window.addEventListener(ev, stopFollow, { passive: true, once: true });
  ScrollTrigger.addEventListener('refresh', onSettleRefresh);
  settle();

  return {
    master,
    marks: () => marks,
    score: () => score,
    anchorY: (id) => (marks ? anchorY(marks, id) : null),
    kill() {
      if (!alive) return;
      alive = false;
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      ScrollTrigger.removeEventListener('refresh', onSettleRefresh);
      cancelAnimationFrame(settleFrame);
      for (const ev of userEvents) window.removeEventListener(ev, stopFollow);
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('load', refresh);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
      gctx.revert();
      titleblock?.style.removeProperty('opacity');
      titleblock?.style.removeProperty('transform');
      for (const el of [...rows, ...steps]) {
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
        el.style.removeProperty('pointer-events');
      }
      labels?.show([]);
      labels?.setActive(null);
      labels?.setLayout(null);
      root.classList.remove('choreo');
      score = null;
      marks = null;
    },
  };
}
