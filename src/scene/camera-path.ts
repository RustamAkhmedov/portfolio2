// Kamerapfad: ein Keyframe pro Stopp der Choreografie, SceneState.cam ist der stetige Index.
// Reine Daten und Funktion (keine three-Imports). Einheiten: 1 = 100 mm, Laptop ~3,54 × 2,47 um den Ursprung.
// Erste Schätzung ohne Modell – Feinabstimmung in T033 per Screenshots.
import { DISPLAY } from './laptop/dims';

export type Vec3 = [number, number, number];
/** shift: Bildverschiebung als Anteil von Breite/Höhe (+x rechts, +y unten), Standard [0, 0] */
export type CamKey = {
  name: string;
  position: Vec3;
  target: Vec3;
  fov: number;
  shift?: [number, number];
  /** Abweichungen für die kompakte Bühne (Handy/Tablet < 900 px: Szene oben, ohne Label-Spalte, Seitenverhältnis ~1–1,6) */
  compact?: Partial<Omit<CamKey, 'name' | 'compact'>>;
};
export type CamPose = { position: Vec3; target: Vec3; fov: number; shift: [number, number] };

/** Hero: 3/4 von vorne rechts, leicht von oben (entspricht grob HERO_POSE im Renderer, seitlich gedreht). */
// Mit 3D-Szene steht #scene rechts neben der Textspalte (layout.css, --scene-left); fov/shift sind darauf abgestimmt.
const HERO: CamKey = { name: 'outro', position: [4.6, 2.8, 6.6], target: [0, 0.6, 0], fov: 37, shift: [0, 0.075] };

export const KEYFRAMES: CamKey[] = [
  { ...HERO, name: 'hero' },
  // Totale: alle Teile der vollen Explosion im Bild (y ~ -1 bis 2,5+, x ~ -3,5 bis 2, Deckel hinten bei z ~ -2)
  // shift nach links: rechts daneben steht die Label-Spalte
  { name: 'total', position: [3.0, 6.2, 8.2], target: [-0.3, 1.3, -0.8], fov: 46, shift: [-0.17, 0.02], compact: { fov: 44 } },
  // Display/Deckel (explodiert: Mitte ~ (0, 2.75, -3.5), Normale 20° nach oben): fast frontal und so hoch,
  // dass die angehobene Tastatur die Unterkante des Displays nicht verdeckt
  { name: 'projekte', position: [1.0, 5.8, 2.4], target: [0.1, 2.6, -3.5], fov: 44, shift: [0.06, 0.0], compact: { position: [0, 4.6, 1.6], target: [0, 2.75, -3.5], fov: 40, shift: [0, 0] } },
  // Mainboard: hinten mittig, steiler Blick von vorne rechts oben, damit die Chips frei liegen; Platz für die Label-Spalte rechts
  { name: 'skills', position: [3.0, 9.66, 8.04], target: [0, 0.9, -0.6], fov: 40, shift: [0, 0.0], compact: { fov: 44, shift: [0, 0] } },
  // Akku: vorne, etwas höher gehoben
  { name: 'ueber', position: [-1.8, 4.6, 6.6], target: [0, 1.6, 0.4], fov: 47, shift: [-0.04, 0.0], compact: { fov: 42, shift: [0, 0] } },
  // SSD (Lasche vorne rechts, 2 Einheiten angehoben): groß im Bild
  { name: 'lebenslauf', position: [2.8, 4.4, 4.2], target: [1.1, 2.0, 0.2], fov: 33, shift: [-0.1, 0.0], compact: { shift: [0, 0] } },
  // Anschlüsse: links (-x) weggezogen, beide Seiten (USB-A rechts) im Bild
  { name: 'kontakt', position: [-3.97, 3.44, 9.18], target: [-1.0, 0.2, 0], fov: 44, shift: [0, 0.1], compact: { fov: 48, shift: [0, 0] } },
  { ...HERO, name: 'outro' },
];

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Schlüssel für die kompakte Bühne: Überschreibungen anwenden, Bildverschiebung nach rechts entfällt (keine Label-Spalte). */
function resolve(k: CamKey, compact: boolean): CamKey {
  if (!compact) return k;
  return { ...k, ...k.compact, shift: k.compact?.shift ?? [0, k.shift?.[1] ?? 0] };
}

/** `compact` (state.compact, 0…1) ab 0,5 = kompakte Bühne. */
export function cameraAt(index: number, compact = 0): CamPose {
  const last = KEYFRAMES.length - 1;
  const x = Number.isNaN(index) ? 0 : Math.min(Math.max(index, 0), last);
  const i = Math.min(Math.floor(x), last - 1);
  const t = smooth(x - i);
  const c = compact >= 0.5;
  const a = resolve(KEYFRAMES[i], c);
  const b = resolve(KEYFRAMES[i + 1], c);
  const mix = (p: number, q: number): number => (x - i === 0 ? p : x - i === 1 ? q : p + (q - p) * t);
  return {
    position: [mix(a.position[0], b.position[0]), mix(a.position[1], b.position[1]), mix(a.position[2], b.position[2])],
    target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1]), mix(a.target[2], b.target[2])],
    fov: mix(a.fov, b.fov),
    shift: [mix(a.shift?.[0] ?? 0, b.shift?.[0] ?? 0), mix(a.shift?.[1] ?? 0, b.shift?.[1] ?? 0)],
  };
}

// ---------- Live-Demo (T081): Keyframe `demo` ----------
//
// Kein Scroll-Stopp, deshalb nicht in KEYFRAMES (cam bleibt der Scroll-Index). Die Kamera blickt senkrecht auf das
// Display und rückt so nah heran, dass die aktive Fläche das Rechteck `demoRect` des Fensters genau füllt. Die Pose
// hängt von der Lage des Displays (Explosion, Deckel) und der Fenstergröße ab und wird daher in der Szene berechnet
// (demoPose); state.demoMix blendet zwischen der Scroll-Pose und dieser Pose (blendPose).

/** Rechteck in Pixeln (Fenster-Koordinaten, y nach unten) */
export type Rect = { x: number; y: number; w: number; h: number };
/** Lage der aktiven Display-Fläche in Szeneneinheiten: Mitte, Normale (zum Betrachter), Höhe */
export type DisplayFrame = { center: Vec3; normal: Vec3; height: number };

export const DEMO: { name: 'demo'; fov: number; aspect: number } = {
  name: 'demo',
  fov: 30,
  aspect: DISPLAY.width / DISPLAY.height,
};

/**
 * Bildschirmrechteck, das das Display am Ende der Kamerafahrt füllt: so groß wie möglich im Seitenverhältnis des
 * Displays, mittig zwischen den Rändern (`margin` in px: oben Platz für „Schließen“). Ganze Pixel, damit das iframe
 * in Ruhe ohne Skalierung (scharf) dasteht.
 */
export function demoRect(vw: number, vh: number, margin: { top: number; side: number; bottom: number }): Rect {
  const maxW = Math.max(1, vw - 2 * margin.side);
  const maxH = Math.max(1, vh - margin.top - margin.bottom);
  const w = Math.max(16, Math.floor(Math.min(maxW, maxH * DEMO.aspect)));
  const h = Math.round(w / DEMO.aspect);
  return { x: Math.round((vw - w) / 2), y: Math.round(margin.top + (maxH - h) / 2), w, h };
}

/**
 * Kamera-Pose `demo`: Blick entlang der Display-Normalen, Abstand so, dass die Display-Höhe `rect.h` Pixel im
 * Fenster der Höhe `vh` füllt; die Bildverschiebung (shift, Anteil von Breite/Höhe) setzt die Mitte auf die Mitte
 * von `rect`. Gilt für ein Bild über das ganze Fenster (vw × vh), siehe renderer `frame`.
 */
export function demoPose(d: DisplayFrame, rect: Rect, vw: number, vh: number): CamPose {
  const tanHalf = Math.tan(((DEMO.fov * Math.PI) / 180) / 2);
  const dist = (d.height * vh) / (2 * Math.max(1, rect.h) * tanHalf);
  const [cx, cy, cz] = d.center;
  const [nx, ny, nz] = d.normal;
  return {
    position: [cx + nx * dist, cy + ny * dist, cz + nz * dist],
    target: [cx, cy, cz],
    fov: DEMO.fov,
    shift: [(rect.x + rect.w / 2 - vw / 2) / vw, (rect.y + rect.h / 2 - vh / 2) / vh],
  };
}

/** Lineare Mischung zweier Posen (t = 0 → a, t = 1 → b, geklemmt); das Easing kommt von der Choreografie. */
export function blendPose(a: CamPose, b: CamPose, t: number): CamPose {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  if (k === 0) return a;
  if (k === 1) return b;
  const m = (p: number, q: number): number => p + (q - p) * k;
  return {
    position: [m(a.position[0], b.position[0]), m(a.position[1], b.position[1]), m(a.position[2], b.position[2])],
    target: [m(a.target[0], b.target[0]), m(a.target[1], b.target[1]), m(a.target[2], b.target[2])],
    fov: m(a.fov, b.fov),
    shift: [m(a.shift[0], b.shift[0]), m(a.shift[1], b.shift[1])],
  };
}
