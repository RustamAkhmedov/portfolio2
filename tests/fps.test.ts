import { describe, expect, it } from 'vitest';
import { drawnFps } from '../src/scene/renderer';

/** n Zeitpunkte ab t0 im Abstand dt */
const run = (t0: number, n: number, dt: number): number[] => Array.from({ length: n }, (_, i) => t0 + i * dt);

describe('drawnFps (T034)', () => {
  it('liefert die Bildrate bei gleichmäßigem Zeichnen', () => {
    const t = run(0, 30, 1000 / 60);
    expect(drawnFps(t, t[29]! + 5)).toBeCloseTo(60, 5);
    const t120 = run(0, 30, 1000 / 120);
    expect(drawnFps(t120, t120[29]!)).toBeCloseTo(120, 5);
  });

  it('zählt Ruhepausen zwischen zwei Bewegungen nicht mit', () => {
    // 10 Frames, 2 s Pause (Szene ruht), 20 Frames, jeweils mit 60 fps
    const t = [...run(0, 10, 1000 / 60), ...run(2150, 20, 1000 / 60)];
    expect(drawnFps(t, t[t.length - 1]!)).toBeCloseTo(60, 5);
  });

  it('zeigt echte Einbrüche (lange Frames unter der Pausengrenze)', () => {
    const t = run(0, 30, 40); // 25 fps
    expect(drawnFps(t, t[29]!)).toBeCloseTo(25, 5);
  });

  it('ist 0 ohne Daten oder wenn zuletzt nichts gezeichnet wurde', () => {
    expect(drawnFps([], 0)).toBe(0);
    expect(drawnFps([5], 10)).toBe(0);
    const t = run(0, 30, 1000 / 60);
    expect(drawnFps(t, t[29]! + 600)).toBe(0);
  });

  it('ist 0, wenn nur Pausen im Fenster liegen', () => {
    expect(drawnFps([0, 300, 600], 650)).toBe(0);
  });
});
