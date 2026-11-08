/*
 * Partitur der Scroll-Choreografie (reine Daten und Funktionen, ohne GSAP und ohne DOM).
 *
 * Eingabe sind Scroll-Marken in Pixeln (gemessen von ScrollTrigger nach jedem refresh), Ausgabe ist eine
 * Liste von Segmenten „Wert key läuft von from nach to, während die Scroll-Position von start bis end läuft“.
 * timeline.ts baut daraus die GSAP-Master-Timeline (1 Sekunde Timeline-Zeit = 1 px Scroll), `valueAt()` ist
 * die Referenz-Auswertung für Tests.
 *
 * Schlüssel: lid, explode, cam, focusMix, screen, focus (Index in partKeys, -1 = keiner),
 * `in:<key>` (Label-Einblendung je Teil), `row:<i>` (Zeile i der Stückliste), `step:<i>` (Projekt-Datenblatt i).
 * Alle Segmente sind linear (die Glättung macht der Scrub). Segmente desselben Schlüssels überlappen nie:
 * Ein später angelegtes Segment beginnt frühestens am Ende des vorigen, sein Startwert ist dessen Endwert.
 *
 * Phase 9: Skills (Board, Chips), Über mich (Akku), Lebenslauf (SSD), Kontakt (Anschlüsse) folgen nach den Projekten.
 * Je Abschnitt: Kamera fährt zum Teil (cam 3…6) und Fokus wechselt (altes Teil/Labels aus, Fokus springt in der Mitte
 * der Einfahrt, neues Teil/Labels ein), danach hält die kurze gepinnte Strecke. Outro: Explosion und Deckel kehren
 * um, Kamera zurück in die Hero-Ansicht (cam 7), Schriftfeld (`outro` 0→1).
 * Zusätzliche Schlüssel: `in:skill-<i>`, `in:port-<i>` (Labels an Chips/Anschlüssen), `outro`, `layout` (welche Labels
 * sich die Spalte teilen: -1 alle, sonst Index in SECTIONS).
 */
import { skillKey, portKey } from '../scene/label-keys';

export { skillKey, portKey };

/** Strecken in Viewport-Höhen bzw. Anteilen. Fürs Handy gilt MOBILE. */
export interface Lengths {
  /** Hero-Pin (Deckel klappt auf), in Viewport-Höhen */
  lid: number;
  /** Strecke je Projekt-Schritt, in Viewport-Höhen */
  step: number;
  /** Wechsel zwischen zwei Datenblättern (erste Hälfte aus, zweite ein), Anteil der Schritt-Strecke */
  swap: number;
  /** Labels beginnen bei diesem Anteil der Explosionsstrecke … */
  labelsFrom: number;
  /** … und sind so viele Viewport-Höhen nach dem Ende der Explosion alle da */
  labelsTail: number;
  /** Einblendstrecke je Label, Anteil des Label-Fensters */
  labelSpan: number;
  /** Einblendstrecke je Stücklistenzeile, Anteil des Zeilen-Fensters */
  rowSpan: number;
  /** Gepinnte Strecke je Abschnitt Skills … Kontakt, in Viewport-Höhen */
  section: number;
  /** Sprünge größer als so viele Viewport-Höhen werden ohne Glättung übernommen */
  snap: number;
}

export const DESKTOP: Lengths = {
  lid: 0.8,
  step: 0.5,
  swap: 0.2,
  labelsFrom: 0.5,
  labelsTail: 0.15,
  labelSpan: 0.35,
  rowSpan: 0.3,
  section: 0.6,
  snap: 1.5,
};

/** Handy / Tablet-Hochformat (< 900 px): etwa halbe Strecken, Pin je Projekt 0,35 Viewport-Höhen. */
export const MOBILE: Lengths = {
  lid: 0.4,
  step: 0.35,
  swap: 0.25,
  labelsFrom: 0.5,
  labelsTail: 0.08,
  labelSpan: 0.35,
  rowSpan: 0.3,
  section: 0.3,
  snap: 1.5,
};

/** Teil und Kamera-Keyframe je Abschnitt nach den Projekten (Reihenfolge = Seitenreihenfolge, cam = 3 + Index). */
export const SECTIONS = [
  { id: 'skills', part: 'board' },
  { id: 'ueber', part: 'battery' },
  { id: 'lebenslauf', part: 'ssd' },
  { id: 'kontakt', part: 'ports' },
] as const;

/** Anteil der Outro-Strecke, in dem sich der Laptop zusammensetzt (danach hält das Bild bis zum Seitenende). */
export const OUTRO_DONE = 0.85;

export interface SectionMark {
  /** Der Abschnitt rückt herein (Einfahrt der Kamera beginnt frühestens, wenn der vorige Pin endet) */
  inStart: number;
  /** Pin-Beginn = Abschnitt oben, Kamera angekommen */
  pinStart: number;
  pinEnd: number;
}

/** Scroll-Positionen in px (window.scrollY), gemessen inkl. Pin-Abständen. */
export interface Marks {
  /** Viewport-Höhe in px */
  vh: number;
  /** Ende des Hero-Pins = Deckel offen, Explosion beginnt */
  lidEnd: number;
  /** Explosion fertig (Stückliste ist nachgerückt) */
  explodeEnd: number;
  /** Stücklisten-Zeilen: erste beginnt, letzte fertig */
  rowsStart: number;
  rowsEnd: number;
  /** Projekte rücken herein: Kamera fährt zum Display */
  projStart: number;
  /** = Pin-Beginn von #projekte */
  projEnd: number;
  /** Pin-Ende von #projekte (danach scrollt #projekte-alle normal) */
  stepsEnd: number;
  /** Skills, Über mich, Lebenslauf, Kontakt (SECTIONS) */
  sections: readonly SectionMark[];
  /** Outro rückt herein … Seitenende */
  outroStart: number;
  outroEnd: number;
}

/**
 * Scroll-Ziel für einen Anker `#id` (reine Funktion der Marken). Die Abschnitte sind gepinnt: Das Ziel ist nicht
 * ihr DOM-Abstand, sondern die Position, an der Titel sichtbar und Kamera/Fokus angekommen sind
 * (Hero: Seitenanfang, Stückliste: Explosion fertig, Projekte/Skills …/Kontakt: Pin-Beginn, Outro: Seitenende).
 * `null` für unbekannte Ids (dann gilt die normale Position im Dokument).
 */
export function anchorY(m: Marks, id: string): number | null {
  const y = ((): number | null => {
    switch (id) {
      case 'hero':
        return 0;
      case 'bom':
        return m.explodeEnd;
      case 'projekte':
        return m.projEnd;
      case 'outro':
        return m.outroEnd;
      default: {
        const i = SECTIONS.findIndex((s) => s.id === id);
        return i >= 0 ? (m.sections[i]?.pinStart ?? null) : null;
      }
    }
  })();
  return y === null || !Number.isFinite(y) ? null : Math.max(0, Math.round(y));
}

/** Wo ein fokussiertes Element liegt (timeline.ts ermittelt das aus dem DOM). */
export type FocusRegion =
  | { kind: 'step'; index: number; count: number }
  | { kind: 'projekte' } // gepinnter Teil von #projekte (Überspringen-Link, Titel)
  | { kind: 'row' } // Stücklistenzeile
  | { kind: 'section'; index: number } // SECTIONS[index]
  | { kind: 'outro' };

/**
 * Scroll-Position, die für ein per Tastatur fokussiertes Element nötig ist, oder `null` (nichts zu tun).
 * Der Browser scrollt beim Fokus zum DOM-Abstand des Elements; in gepinnten Abschnitten und bei noch nicht
 * eingeblendeten Elementen (Datenblatt, Stücklistenzeile, Schriftfeld) ist das die falsche Stelle.
 * `shown` = aktuelle Deckkraft (0…1) des Elements bzw. seines Datenblatts/seiner Zeile/des Schriftfelds.
 */
export function focusScrollY(m: Marks, region: FocusRegion, scrollY: number, shown = 1): number | null {
  const EPS = 2;
  switch (region.kind) {
    case 'step': {
      if (shown > 0.99 || region.count <= 0) return null;
      const len = (m.stepsEnd - m.projEnd) / region.count;
      return Math.round(m.projEnd + (region.index + 0.5) * len);
    }
    case 'projekte':
      return scrollY < m.projEnd - EPS ? Math.round(m.projEnd) : null;
    case 'row':
      return shown > 0.99 ? null : Math.round(m.rowsEnd);
    case 'section': {
      const pin = m.sections[region.index]?.pinStart;
      return pin !== undefined && scrollY < pin - EPS ? Math.round(pin) : null;
    }
    case 'outro':
      return shown > 0.99 ? null : Math.round(m.outroEnd);
  }
}

export interface ScoreInput {
  marks: Marks;
  /** Teil-keys in Explosionsreihenfolge (explode.order) → Reihenfolge der Labels */
  labelOrder: readonly string[];
  /** Teil-keys in Stücklisten-Reihenfolge; `focus` ist ein Index hierin */
  partKeys: readonly string[];
  /** Anzahl Stücklisten-Zeilen */
  rows: number;
  /** Anzahl Projekt-Schritte ([data-step]) */
  steps: number;
  /** Anzahl Skill-Labels (Chips) und Kontaktkanäle (Anschlüsse) */
  skills?: number;
  ports?: number;
  lengths?: Lengths;
}

export interface Segment {
  key: string;
  from: number;
  to: number;
  start: number;
  end: number;
}

export interface Score {
  initial: Record<string, number>;
  /** nach start sortiert */
  segments: Segment[];
  /** Abschnitts-Label → Scroll-Position (px); werden auch als Labels in die Master-Timeline gesetzt */
  labels: Record<string, number>;
  /** letzte Scroll-Position mit Bewegung */
  end: number;
}

/** Mindestlänge eines Segments in px (vermeidet Nulldauer-Tweens). */
const MIN = 1;

class Builder {
  readonly initial: Record<string, number> = {};
  readonly segments: Segment[] = [];
  private readonly last: Record<string, { to: number; end: number }> = {};

  init(key: string, value: number): void {
    this.initial[key] = value;
    this.last[key] = { to: value, end: -Infinity };
  }

  to(key: string, value: number, start: number, end: number): void {
    const prev = this.last[key];
    if (!prev) throw new Error(`score: Schlüssel ${key} ohne init`);
    const s = Math.max(start, prev.end);
    const e = Math.max(end, s + MIN);
    this.segments.push({ key, from: prev.to, to: value, start: s, end: e });
    this.last[key] = { to: value, end: e };
  }
}

export const inKey = (part: string): string => `in:${part}`;
export const rowKey = (i: number): string => `row:${i}`;
export const stepKey = (i: number): string => `step:${i}`;

export function buildScore(input: ScoreInput): Score {
  const { marks: m, labelOrder, partKeys, rows, steps } = input;
  const nSkills = input.skills ?? 0;
  const nPorts = input.ports ?? 0;
  const L = input.lengths ?? DESKTOP;
  const b = new Builder();

  for (const k of ['lid', 'explode', 'cam', 'focusMix']) b.init(k, 0);
  b.init('screen', -1); // -1 = kein Projekt auf dem Display
  b.init('focus', -1);
  for (const k of partKeys) b.init(inKey(k), 0);
  for (let i = 0; i < nSkills; i++) b.init(inKey(skillKey(i)), 0);
  for (let i = 0; i < nPorts; i++) b.init(inKey(portKey(i)), 0);
  b.init('outro', 0);
  b.init('layout', -1); // -1 = alle Teile-Labels teilen sich die Spalte, 0…3 = Labels von SECTIONS[i]
  for (let i = 0; i < rows; i++) b.init(rowKey(i), 0);
  for (let i = 0; i < steps; i++) b.init(stepKey(i), i === 0 ? 1 : 0);

  // Hero (gepinnt): Deckel klappt auf
  b.to('lid', 1, 0, m.lidEnd);

  // Explosion, Kamera hero → total
  b.to('explode', 1, m.lidEnd, m.explodeEnd);
  b.to('cam', 1, m.lidEnd, m.explodeEnd);

  // Labels gestaffelt in Explosionsreihenfolge; die Linie zeichnet sich über setIn
  const la = m.lidEnd + L.labelsFrom * (m.explodeEnd - m.lidEnd);
  // Die Labels stehen spätestens, wenn die Stückliste voll ist (rowsEnd): bei hohem Fenster (1920×1080) lag das Ende sonst dahinter
  const lb = Math.max(la + MIN, Math.min(m.explodeEnd + L.labelsTail * m.vh, m.rowsEnd));
  const lspan = L.labelSpan * (lb - la);
  labelOrder.forEach((k, i) => {
    const s = la + (labelOrder.length > 1 ? (i * (lb - la - lspan)) / (labelOrder.length - 1) : 0);
    b.to(inKey(k), 1, s, s + lspan);
  });

  // Stückliste füllt sich Zeile für Zeile
  const rspan = L.rowSpan * (m.rowsEnd - m.rowsStart);
  for (let i = 0; i < rows; i++) {
    const s = m.rowsStart + (rows > 1 ? (i * (m.rowsEnd - m.rowsStart - rspan)) / (rows - 1) : 0);
    b.to(rowKey(i), 1, s, s + rspan);
  }

  // Projekte rücken herein: Kamera zum Display, Fokus auf den Deckel, übrige Labels gehen
  const lidIdx = partKeys.indexOf('lid');
  b.to('cam', 2, m.projStart, m.projEnd);
  b.to('focus', lidIdx, m.projStart, m.projStart + MIN);
  b.to('focusMix', 1, m.projStart, m.projEnd);
  b.to('screen', 0, m.projStart, m.projEnd); // neutrale Fläche blendet zum ersten Projekt
  const half = m.projStart + 0.5 * (m.projEnd - m.projStart);
  for (const k of partKeys) if (k !== 'lid') b.to(inKey(k), 0, m.projStart, half);

  // #projekte gepinnt: je Schritt ein Datenblatt, screen zählt stetig hoch
  const labels: Record<string, number> = {
    hero: 0,
    explode: m.lidEnd,
    bom: m.rowsStart,
    projekte: m.projStart,
  };
  const stepLen = steps > 0 ? (m.stepsEnd - m.projEnd) / steps : 0;
  const w = L.swap * stepLen;
  for (let i = 0; i < steps; i++) {
    labels[`projekte-${i}`] = m.projEnd + i * stepLen;
    if (i === 0) continue;
    const at = m.projEnd + i * stepLen;
    // erst das alte Blatt aus, dann das neue ein (nie zwei Texte übereinander); das Display blendet durchgehend
    b.to(stepKey(i - 1), 0, at - w / 2, at);
    b.to(stepKey(i), 1, at, at + w / 2);
    b.to('screen', i, at - w / 2, at + w / 2);
  }
  labels['projekte-alle'] = m.stepsEnd;

  // Staffel: Labels `keys` gleiten zwischen from und to nacheinander ein
  const stagger = (keys: readonly string[], from: number, to: number): void => {
    const span = L.labelSpan * (to - from);
    keys.forEach((k, i) => {
      const s = from + (keys.length > 1 ? (i * (to - from - span)) / (keys.length - 1) : 0);
      b.to(inKey(k), 1, s, s + span);
    });
  };
  const out = (keys: readonly string[], from: number, to: number): void => {
    for (const k of keys) b.to(inKey(k), 0, from, to);
  };

  // Skills … Kontakt: Kamera fährt zum Teil, Fokus wechselt, Labels des Teils erscheinen
  let prevEnd = m.stepsEnd;
  let prevLabels: string[] = ['lid'];
  SECTIONS.forEach((sec, i) => {
    const S = m.sections[i];
    const idx = partKeys.indexOf(sec.part);
    if (!S || idx < 0) return;
    const start = Math.max(S.inStart, prevEnd);
    const pin = Math.max(S.pinStart, start + 4 * MIN);
    const mid = start + 0.5 * (pin - start);
    const extra =
      sec.part === 'board'
        ? Array.from({ length: nSkills }, (_, n) => skillKey(n))
        : sec.part === 'ports'
          ? Array.from({ length: nPorts }, (_, n) => portKey(n))
          : [];
    b.to('cam', 3 + i, start, pin);
    b.to('focusMix', 0, start, mid);
    b.to('focus', idx, mid, mid + MIN);
    b.to('focusMix', 1, mid + MIN, pin);
    if (i === 0) b.to('screen', -1, mid, mid + MIN); // Display ist weggeblendet: neutrale Fläche für das Outro
    b.to('layout', i, mid, mid + MIN);
    out(prevLabels, start, mid);
    stagger([sec.part, ...extra], mid + MIN, pin);
    prevLabels = [sec.part, ...extra];
    labels[sec.id] = pin;
    prevEnd = Math.max(S.pinEnd, pin);
  });

  // Outro: Explosion und Deckel kehren um, Kamera zurück in die Hero-Ansicht, dann das Schriftfeld
  {
    const o = Math.max(m.outroStart, prevEnd);
    const e = o + OUTRO_DONE * Math.max(m.outroEnd - o, 6 * MIN);
    const r = e - o;
    out(prevLabels, o, o + 0.3 * r);
    b.to('focusMix', 0, o, o + 0.3 * r);
    b.to('focus', -1, o + 0.3 * r, o + 0.3 * r + MIN);
    b.to('layout', -1, o + 0.3 * r, o + 0.3 * r + MIN);
    b.to('explode', 0, o, o + 0.7 * r);
    b.to('lid', 0, o + 0.45 * r, e);
    b.to('cam', 7, o, e);
    b.to('outro', 1, o + 0.55 * r, e);
    labels['outro'] = o;
    prevEnd = e;
  }

  const segments = b.segments.slice().sort((x, y) => x.start - y.start);
  const end = Math.max(m.stepsEnd, prevEnd, ...segments.map((s) => s.end));
  return { initial: b.initial, segments, labels, end };
}

/** Referenz-Auswertung: Wert von `key` bei Scroll-Position y. */
export function valueAt(score: Score, key: string, y: number): number {
  let v = score.initial[key];
  if (v === undefined) return NaN;
  for (const s of score.segments) {
    if (s.key !== key) continue;
    if (y <= s.start) break;
    if (y >= s.end) {
      v = s.to;
      continue;
    }
    return s.from + ((s.to - s.from) * (y - s.start)) / (s.end - s.start);
  }
  return v;
}

/** Alle Werte bei y (für Tests und Debug). */
export function valuesAt(score: Score, y: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(score.initial)) out[k] = valueAt(score, k, y);
  return out;
}
