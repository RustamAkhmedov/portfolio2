/*
 * Beschriftungs-Overlay (research.md R3, contracts/dom.md): projiziert die Anker der Teile auf Pixel,
 * setzt je `.label[data-part]` ein `transform: translate3d()` und zeichnet je Teil eine Linie
 * (`<path>`) plus Endpunkt (`<circle>`, 3px) in das `<svg>` von `#labels`. Die Szene kennt keine Texte,
 * sie kommen aus dem Markup (`data-part` = Teil-`id`, z. B. "P-01"). Container = Viewport (fixed).
 *
 * Schnittstelle für die Choreografie (T030):
 *   - `show('all' | keys[])`: genau diese Labels ganz sichtbar (1), alle anderen weg (0). Sofort.
 *   - `setIn(key, 0..1)`: Einblend-Grad je Label, z. B. per GSAP scrub. 0 = unsichtbar, die Linie
 *     zeichnet sich per stroke-dashoffset (1 → 0, pathLength = 1), Kreis/Text blenden per opacity ein.
 *     Der Wert steht auch als CSS-Variable `--label-in` am `.label`, am Pfad und am Punkt.
 *   - `setActive(key | null)`: aktives Teil (Klasse `is-active`, Kreis orange gefüllt).
 *   - `setLayout(keys | null)`: nur diese Labels teilen sich die Spalte (null = alle, Standard). Für die Abschnitte
 *     nach den Projekten: unsichtbare Labels anderer Teile würden sonst Platz belegen und die sichtbaren verschieben.
 *   - `update()`: Positionen neu rechnen; wird nach jedem gezeichneten Frame (rig.onFrame) aufgerufen.
 * Zusätzliche Labels (T050) entstehen beim Anlegen aus dem DOM der Abschnitte: je Eintrag in `#skills .skill-list`
 * ein Label an einem Chip des Mainboards, je Kanal in `#kontakt .ports` eines am passenden Anschluss
 * (`.label[data-anchor]`, Schlüssel `data-label-key`, siehe label-keys.ts). Die Texte bleiben im Markup.
 * Animiert werden nur transform, opacity und stroke-dashoffset. Die endgültige Deckkraft ist
 * in × Bildrand-Faktor (Anker außerhalb des Bildes → 0).
 */
import { Vector3, type Camera } from 'three';
import { skillKey, portKey } from './label-keys';
import { CHIP_ANCHORS } from './laptop/dims';

// ---------- reine Funktionen (ohne WebGL testbar) ----------

export interface LayoutOptions {
  /** Abstand der Label-Spalte vom äußersten Anker der jeweiligen Seite */
  offset: number;
  /** Mindestabstand zweier Label-Mitten in derselben Spalte */
  gap: number;
  /** Rand zum Bildrand */
  pad: number;
  /** Breite des Textes neben dem Kreis (0, wenn ausgeblendet) */
  textWidth: number;
  /** Kreisradius */
  radius: number;
  /** Alle Labels auf eine Seite zwingen (-1 links, 1 rechts); sonst nach Bildschirmhälfte */
  side?: -1 | 1;
  /** Spalten ganz außen am Bildrand statt neben dem äußersten Anker (Abschnitte mit Fokus: Linien laufen nach außen) */
  edge?: boolean;
  /** Ohne `side`: Seite nach Median der Anker-x (je Hälfte eine Spalte) statt nach Bildschirmhälfte */
  split?: boolean;
}

/** Abstand der Spalten von den Gruppen bei getrennten Anker-Gruppen (Anschlüsse links/rechts) */
const CLUSTER_OFFSET = 70;
export const LAYOUT: LayoutOptions = { offset: 200, gap: 78, pad: 20, textWidth: 190, radius: 14 };
/** Schmale Bühne (Overlay < COMPACT_WIDTH px breit, Handy): nur Nummernkreise, enger gestaffelt, näher am Bauteil */
export const COMPACT_WIDTH = 768;
export const LAYOUT_COMPACT: LayoutOptions = { ...LAYOUT, offset: 70, gap: 40, pad: 14, textWidth: 0 };

export interface Pt {
  x: number;
  y: number;
}
export interface PlacedLabel {
  /** Kreismitte in Pixeln */
  x: number;
  y: number;
  /** -1 = Text links vom Kreis, 1 = rechts */
  side: -1 | 1;
}

/** NDC (−1…1, y nach oben) → Pixel (y nach unten). */
export function ndcToPixel(ndcX: number, ndcY: number, w: number, h: number): Pt {
  return { x: ((ndcX + 1) / 2) * w, y: ((1 - ndcY) / 2) * h };
}

/** 1 im Bild, 0 außerhalb (weicher Übergang über `fade` Pixel); hinter der Kamera/Clip-Ebene 0. */
export function edgeFactor(p: Pt, ndcZ: number, w: number, h: number, fade = 32): number {
  if (!(ndcZ > -1 && ndcZ < 1)) return 0;
  const d = Math.min(p.x, w - p.x, p.y, h - p.y);
  return Math.min(1, Math.max(0, d / fade));
}

/** Verteilt Werte (Mitten) so, dass Nachbarn ≥ gap auseinander liegen, innerhalb [min, max]; Reihenfolge bleibt. */
export function spreadY(ys: readonly number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a]! - ys[b]!);
  const out = order.map((i) => Math.min(max, Math.max(min, ys[i]!)));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i]!, out[i - 1]! + gap);
  const over = (out[out.length - 1] ?? 0) - max;
  if (over > 0) {
    out[out.length - 1] = max;
    for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i]!, out[i + 1]! - gap);
  }
  const result = new Array<number>(ys.length);
  order.forEach((idx, i) => (result[idx] = Math.max(min, out[i]!)));
  return result;
}

/** Platziert die Label-Kreise: Seite nach Bildschirmhälfte, je Seite eine Spalte, vertikal entzerrt. */
export function placeLabels(
  anchors: readonly Pt[],
  w: number,
  h: number,
  opts: LayoutOptions = LAYOUT,
): PlacedLabel[] {
  const { offset, gap, pad, textWidth, radius } = opts;
  const text = textWidth > 0 ? textWidth + 8 : 0;
  let mid = w / 2;
  // Ohne side/split-Vorgabe: Bildschirmhälfte. Mit split: zwei deutlich getrennte Gruppen (größte Lücke ≥ 25 % der
  // Breite, z. B. linke/rechte Anschlüsse) trennen dort, sonst nach Median (je Hälfte eine Spalte).
  let clustered = false;
  if (opts.split && anchors.length > 1) {
    const xs = anchors.map((a) => a.x).sort((a, b) => a - b);
    let best = 0;
    for (let i = 1; i < xs.length - 1; i++) if (xs[i + 1]! - xs[i]! > xs[best + 1]! - xs[best]!) best = i;
    const gap = xs[best + 1]! - xs[best]!;
    if (gap >= 0.25 * w) {
      mid = (xs[best]! + xs[best + 1]!) / 2;
      clustered = true;
    } else mid = (xs[Math.floor((xs.length - 1) / 2)]! + xs[Math.floor(xs.length / 2)]!) / 2;
  }
  // edge ohne split: Spalte auf der Seite mit mehr Platz (das Teil bleibt frei vom Label)
  const far = !!opts.edge && !opts.split;
  const sides = anchors.map((a): -1 | 1 => opts.side ?? (far ? (a.x < mid ? 1 : -1) : a.x < mid ? -1 : 1));
  const result: PlacedLabel[] = anchors.map((a, i) => ({ x: a.x, y: a.y, side: sides[i]! }));

  for (const side of [-1, 1] as const) {
    const idx = anchors.map((_, i) => i).filter((i) => sides[i] === side);
    if (!idx.length) continue;
    const extreme = side === -1 ? Math.min(...idx.map((i) => anchors[i]!.x)) : Math.max(...idx.map((i) => anchors[i]!.x));
    // links liegt der Text links vom Kreis, rechts rechts davon
    const lo = side === -1 ? pad + radius + text : pad + radius;
    const hi = side === -1 ? w - pad - radius : w - pad - radius - text;
    const want = opts.edge && !clustered ? (side === -1 ? lo : hi) : extreme + side * (clustered ? CLUSTER_OFFSET : offset);
    const col = Math.min(Math.max(want, lo), Math.max(lo, hi));
    const ys = spreadY(idx.map((i) => anchors[i]!.y), gap, pad + radius, h - pad - radius);
    idx.forEach((i, k) => {
      result[i] = { x: col, y: ys[k]!, side };
    });
  }
  return result;
}

/** Linienende am Kreisrand (Richtung Anker); bei Deckung der Mittelpunkt. */
export function lineEnd(anchor: Pt, center: Pt, radius: number): Pt {
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;
  const len = Math.hypot(dx, dy);
  if (len <= radius) return { x: center.x, y: center.y };
  return { x: center.x + (dx / len) * radius, y: center.y + (dy / len) * radius };
}

// ---------- DOM ----------

export interface LabelRig {
  camera: Camera;
  laptop: { anchors: Record<string, Vector3> };
  /** id (data-part) → key (Anker) */
  parts: readonly { id: string; key: string }[];
}

export interface Labels {
  update(): void;
  show(keys: readonly string[] | 'all'): void;
  setIn(key: string, value: number): void;
  setActive(key: string | null): void;
  setLayout(keys: readonly string[] | null): void;
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Item {
  key: string;
  /** Name in `laptop.anchors` */
  anchor: string;
  el: HTMLElement;
  path: SVGPathElement;
  dot: SVGCircleElement;
  in: number;
  edge: number;
  side: -1 | 1 | 0;
  lastD: string;
  lastT: string;
}

/** Beschreibung eines zusätzlichen Labels aus dem DOM. */
export interface ExtraLabel {
  key: string;
  anchor: string;
  no: string;
  name: string;
  spec?: string;
}

/** Skill-Chips und Kontaktkanäle aus dem Dokument lesen (Texte kommen aus dem Markup). */
export function extraLabels(doc: ParentNode): ExtraLabel[] {
  const out: ExtraLabel[] = [];
  doc.querySelectorAll('#skills .skill-list li').forEach((li, i) => {
    const chip = CHIP_ANCHORS[i];
    const name = li.textContent?.trim();
    if (chip && name) out.push({ key: skillKey(i), anchor: `chip:${chip.name}`, no: `S${i + 1}`, name });
  });
  doc.querySelectorAll('#kontakt .ports li').forEach((li, i) => {
    const port = li.querySelector('.port')?.textContent?.trim();
    const name = li.querySelector('a')?.textContent?.trim();
    if (port && name) out.push({ key: portKey(i), anchor: port, no: `K${i + 1}`, name, spec: port });
  });
  return out;
}

function appendExtraLabels(overlay: HTMLElement): void {
  for (const x of extraLabels(document)) {
    if (overlay.querySelector(`[data-label-key="${x.key}"]`)) continue;
    const el = document.createElement('div');
    el.className = 'label label--extra';
    el.dataset.anchor = x.anchor;
    el.dataset.labelKey = x.key;
    const no = document.createElement('span');
    no.className = 'label__no';
    no.textContent = x.no;
    const name = document.createElement('span');
    name.className = 'label__name';
    name.textContent = x.name;
    el.append(no, ' ', name);
    if (x.spec) {
      const spec = document.createElement('span');
      spec.className = 'label__spec';
      spec.textContent = x.spec;
      el.append(' ', spec);
    }
    overlay.appendChild(el);
  }
}

export function createLabels(overlay: HTMLElement, rig: LabelRig): Labels {
  const svg = overlay.querySelector('svg');
  if (!svg) throw new Error('#labels: <svg> fehlt');
  const byId = new Map(rig.parts.map((p) => [p.id, p.key]));
  const items: Item[] = [];
  appendExtraLabels(overlay);

  overlay.querySelectorAll<HTMLElement>('.label[data-part], .label[data-anchor]').forEach((el) => {
    const anchor = el.dataset.anchor ?? byId.get(el.dataset.part ?? '');
    const key = el.dataset.labelKey ?? anchor;
    if (!key || !anchor || !rig.laptop.anchors[anchor]) return;
    const no = el.querySelector('.label__no');
    if (no) no.textContent = (no.textContent ?? '').replace(/^P-/, ''); // Kreis zeigt „01“
    // Name und Spec in einen Textblock (Kreis bleibt für sich)
    const text = document.createElement('span');
    text.className = 'label__text';
    el.querySelectorAll('.label__name, .label__spec').forEach((n) => text.appendChild(n));
    el.appendChild(text);

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'label-line');
    path.setAttribute('pathLength', '1');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'label-dot');
    dot.setAttribute('r', '1.5');
    svg.append(path, dot);
    items.push({ key, anchor, el, path, dot, in: 0, edge: 1, side: 0, lastD: '', lastT: '' });
  });

  function applyIn(it: Item): void {
    const v = String(it.in);
    const op = String(it.in * it.edge);
    it.el.style.setProperty('--label-in', v);
    it.path.style.setProperty('--label-in', v);
    it.dot.style.setProperty('--label-in', v);
    it.el.style.opacity = op;
    it.path.style.opacity = String(it.edge);
    it.path.style.strokeDashoffset = String(1 - it.in);
    it.dot.style.opacity = String(Math.min(1, it.in * 4) * it.edge);
  }
  items.forEach(applyIn);

  const v = new Vector3();
  let layout: Set<string> | null = null;
  // Layout kann die Seite vorgeben: CSS-Variable --labels-side (-1/1) am Overlay, gelesen bei Größenänderung.
  let lastW = 0;
  let lastH = 0;
  let forcedSide: -1 | 1 | undefined;
  let lastNarrow: boolean | undefined;
  function update(): void {
    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    if (!w || !h || !items.length) return;
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      const raw = Number.parseInt(getComputedStyle(overlay).getPropertyValue('--labels-side'), 10);
      forcedSide = raw === -1 || raw === 1 ? raw : undefined;
    }
    rig.camera.updateMatrixWorld();
    const narrow = w < COMPACT_WIDTH;
    if (narrow !== lastNarrow) {
      lastNarrow = narrow;
      overlay.classList.toggle('labels--compact', narrow); // CSS blendet die Texte aus (labels.css)
    }
    // Abschnitte mit Fokus (layout gesetzt): Spalten am Rand; mit Chips/Kanälen beide Seiten nach Median der Anker
    const multi = !!layout && [...layout].some((k) => k.startsWith('skill-') || k.startsWith('port-'));
    const opts: LayoutOptions = {
      ...(narrow ? LAYOUT_COMPACT : LAYOUT),
      side: multi ? undefined : forcedSide,
      split: multi,
      edge: !!layout,
    };
    svg!.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const list = layout ? items.filter((it) => layout!.has(it.key)) : items;
    const px: Pt[] = [];
    const z: number[] = [];
    for (const it of list) {
      v.copy(rig.laptop.anchors[it.anchor]!).project(rig.camera);
      px.push(ndcToPixel(v.x, v.y, w, h));
      z.push(v.z);
    }
    const placed = placeLabels(px, w, h, opts);
    list.forEach((it, i) => {
      const a = px[i]!;
      const p = placed[i]!;
      const edge = edgeFactor(a, z[i]!, w, h);
      const t = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (t !== it.lastT) {
        it.el.style.transform = t;
        it.lastT = t;
      }
      if (p.side !== it.side) {
        it.side = p.side;
        it.el.classList.toggle('label--left', p.side === -1);
        it.el.classList.toggle('label--right', p.side === 1);
      }
      const e = lineEnd(a, p, opts.radius);
      const d = `M${e.x.toFixed(1)} ${e.y.toFixed(1)}L${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
      if (d !== it.lastD) {
        it.path.setAttribute('d', d);
        it.dot.setAttribute('cx', a.x.toFixed(1));
        it.dot.setAttribute('cy', a.y.toFixed(1));
        it.lastD = d;
      }
      if (edge !== it.edge) {
        it.edge = edge;
        applyIn(it);
      }
    });
  }

  const find = (key: string): Item | undefined => items.find((i) => i.key === key);
  return {
    update,
    show(keys) {
      for (const it of items) {
        it.in = keys === 'all' || keys.includes(it.key) ? 1 : 0;
        applyIn(it);
      }
    },
    setIn(key, value) {
      const it = find(key);
      if (!it) return;
      it.in = Math.min(1, Math.max(0, value));
      applyIn(it);
    },
    setLayout(keys) {
      layout = keys ? new Set(keys) : null;
    },
    setActive(key) {
      for (const it of items) {
        const on = it.key === key;
        it.el.classList.toggle('is-active', on);
        it.path.classList.toggle('is-active', on);
        it.dot.classList.toggle('is-active', on);
      }
    },
    dispose() {
      for (const it of items) {
        it.path.remove();
        it.dot.remove();
      }
      items.length = 0;
    },
  };
}
