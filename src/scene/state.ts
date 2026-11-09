// Laufzeitzustand der Szene (data-model.md). Nur die Choreografie schreibt (über setState),
// Szene und Overlay lesen. Kein three.js-Import.

export interface SceneState {
  /** 0 (zu) … 1 (offen) */
  lid: number;
  /** 0 … 1 */
  explode: number;
  /** key des fokussierten Teils */
  focus: string | null;
  /** 0 … 1 Überblendung ghost/focus */
  focusMix: number;
  /** stetiger Index in die Kamera-Keyframes (>= 0) */
  cam: number;
  /** stetiger Index des Projekts auf dem Display; -1 = kein Projekt (neutrale Fläche), Werte dazwischen blenden */
  screen: number;
  /** 0 (Desktop) … 1 (Handy/Tablet-Hochformat, < 900 px): kleinere Explosion, eigene Kamera-Rahmung */
  compact: number;
  /** Live-Demo geöffnet (T080: Knopf/Escape/Schließen) */
  demoOpen: boolean;
  /** 0 (Kamera am Scroll-Keyframe) … 1 (Kamera-Keyframe `demo`, Display füllt den Schirm); Kamerafahrt der Live-Demo (T081) */
  demoMix: number;
}

const mutable: SceneState = {
  lid: 0,
  explode: 0,
  focus: null,
  focusMix: 0,
  cam: 0,
  screen: -1,
  compact: 0,
  demoOpen: false,
  demoMix: 0,
};

/** Nur lesen. Die Objektidentität bleibt stabil. */
export const state: Readonly<SceneState> = mutable;

const RANGES: Record<'lid' | 'explode' | 'focusMix' | 'cam' | 'screen' | 'compact' | 'demoMix', [number, number]> = {
  lid: [0, 1],
  explode: [0, 1],
  focusMix: [0, 1],
  cam: [0, Infinity],
  screen: [-1, Infinity],
  compact: [0, 1],
  demoMix: [0, 1],
};

let needsRender = true;
const listeners = new Set<(s: Readonly<SceneState>) => void>();

export function setState(patch: Partial<SceneState>): void {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof SceneState)[]) {
    const value = patch[key];
    if (key === 'focus') {
      if (value === undefined) continue;
      const next = (value as string | null) ?? null;
      if (mutable.focus !== next) {
        mutable.focus = next;
        changed = true;
      }
      continue;
    }
    if (key === 'demoOpen') {
      if (typeof value !== 'boolean') continue;
      if (mutable.demoOpen !== value) {
        mutable.demoOpen = value;
        changed = true;
      }
      continue;
    }
    const range = RANGES[key as keyof typeof RANGES];
    if (!range || typeof value !== 'number' || Number.isNaN(value)) continue;
    const next = Math.min(range[1], Math.max(range[0], value));
    if (mutable[key as keyof typeof RANGES] !== next) {
      mutable[key as keyof typeof RANGES] = next;
      changed = true;
    }
  }
  if (changed) {
    needsRender = true;
    listeners.forEach((fn) => fn(state));
  }
}

/** Ab dieser Breite steht die Szene neben der Textspalte (layout.css, --scene-left); darunter oben als Bühne. */
export const COMPACT_QUERY = '(max-width: 899px)';

/** Hält `compact` im State passend zur Fensterbreite (COMPACT_QUERY); liefert die Abmelde-Funktion. */
export function trackCompact(): () => void {
  const mq = window.matchMedia(COMPACT_QUERY);
  const set = (): void => setState({ compact: mq.matches ? 1 : 0 });
  set();
  mq.addEventListener('change', set);
  return () => mq.removeEventListener('change', set);
}

/** Liefert das Flag und löscht es. */
export function consumeNeedsRender(): boolean {
  const was = needsRender;
  needsRender = false;
  return was;
}

/** Erzwingt ein Neuzeichnen (z. B. bei Resize). */
export function requestRender(): void {
  needsRender = true;
}

/** Meldet Änderungen an; liefert die Abmelde-Funktion. */
export function onChange(fn: (s: Readonly<SceneState>) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
