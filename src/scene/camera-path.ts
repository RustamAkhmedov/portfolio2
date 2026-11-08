// Kamerapfad: ein Keyframe pro Stopp der Choreografie, SceneState.cam ist der stetige Index.
// Reine Daten und Funktion (keine three-Imports). Einheiten: 1 = 100 mm, Laptop ~3,54 × 2,47 um den Ursprung.
// Erste Schätzung ohne Modell – Feinabstimmung in T033 per Screenshots.

export type Vec3 = [number, number, number];
export type CamKey = { name: string; position: Vec3; target: Vec3; fov: number };
export type CamPose = { position: Vec3; target: Vec3; fov: number };

/** Hero: 3/4 von vorne rechts, leicht von oben (entspricht grob HERO_POSE im Renderer, seitlich gedreht). */
const HERO: CamKey = { name: 'outro', position: [4.6, 2.8, 6.6], target: [0, 0.6, 0], fov: 32 };

export const KEYFRAMES: CamKey[] = [
  { ...HERO, name: 'hero' },
  // Totale: alle Teile der vollen Explosion im Bild (y ~ -1 bis 2,5+, x ~ -3,5 bis 2, Deckel hinten bei z ~ -2)
  { name: 'total', position: [3.0, 3.0, 9.0], target: [-0.3, 1.1, -0.6], fov: 40 },
  // Display/Deckel: hinten oben, Blick von vorne auf die Bildfläche
  { name: 'projekte', position: [1.6, 3.6, 5.4], target: [0, 1.6, -2.0], fov: 30 },
  // Mainboard: hinten mittig, von schräg oben
  { name: 'skills', position: [1.8, 3.8, 4.4], target: [0, 0.9, -0.6], fov: 28 },
  // Akku: vorne, etwas höher gehoben
  { name: 'ueber', position: [-1.4, 3.4, 5.2], target: [0, 1.3, 0.6], fov: 28 },
  // SSD: weiter oben
  { name: 'lebenslauf', position: [2.2, 4.4, 4.6], target: [0, 1.8, -0.2], fov: 28 },
  // Anschlüsse: nach links (-x) weggezogen, Blick von vorne links
  { name: 'kontakt', position: [-1.2, 1.8, 6.0], target: [-2.4, 0.3, 0], fov: 30 },
  { ...HERO, name: 'outro' },
];

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function cameraAt(index: number): CamPose {
  const last = KEYFRAMES.length - 1;
  const x = Number.isNaN(index) ? 0 : Math.min(Math.max(index, 0), last);
  const i = Math.min(Math.floor(x), last - 1);
  const t = smooth(x - i);
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const mix = (p: number, q: number): number => (x - i === 0 ? p : x - i === 1 ? q : p + (q - p) * t);
  return {
    position: [mix(a.position[0], b.position[0]), mix(a.position[1], b.position[1]), mix(a.position[2], b.position[2])],
    target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1]), mix(a.target[2], b.target[2])],
    fov: mix(a.fov, b.fov),
  };
}
