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
  /** stetiger Index des Projekts auf dem Display (>= 0) */
  screen: number;
}

const mutable: SceneState = {
  lid: 0,
  explode: 0,
  focus: null,
  focusMix: 0,
  cam: 0,
  screen: 0,
};

/** Nur lesen. Die Objektidentität bleibt stabil. */
export const state: Readonly<SceneState> = mutable;

const RANGES: Record<'lid' | 'explode' | 'focusMix' | 'cam' | 'screen', [number, number]> = {
  lid: [0, 1],
  explode: [0, 1],
  focusMix: [0, 1],
  cam: [0, Infinity],
  screen: [0, Infinity],
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
