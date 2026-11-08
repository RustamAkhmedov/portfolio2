/*
 * Überträgt den SceneState auf das Laptop-Modell: Deckel, Explosionsversatz je Teil, Anker.
 * Ruhelage + pose().offset → group.position (Szeneneinheiten, 1 = 100 mm).
 */
import type { Laptop } from './laptop';
import { pose, type ExplodePart } from './explode';

export interface ApplyPart {
  key: string;
  explode: ExplodePart;
}

export function applyState(
  laptop: Laptop,
  parts: readonly ApplyPart[],
  s: { lid: number; explode: number; compact?: number },
): void {
  const count = Math.max(1, ...parts.map((p) => p.explode.order + 1));
  laptop.setLid(s.lid);
  for (const p of parts) {
    const group = laptop.parts[p.key];
    const rest = laptop.restPositions[p.key];
    if (!group || !rest) continue;
    const { offset } = pose(p.explode, s, count);
    group.position.set(rest.x + offset[0], rest.y + offset[1], rest.z + offset[2]);
  }
  laptop.updateAnchors();
}
