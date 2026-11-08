import { describe, expect, it } from 'vitest';
import { partMix } from '../src/scene/focus';

describe('partMix', () => {
  it('kein Fokus oder focusMix 0: alles normal', () => {
    expect(partMix('board', null, 1)).toEqual({ focus: 0, ghost: 0 });
    expect(partMix('board', 'board', 0)).toEqual({ focus: 0, ghost: 0 });
    expect(partMix('fans', 'board', 0)).toEqual({ focus: 0, ghost: 0 });
  });
  it('fokussiertes Teil: focus = mix, andere: ghost = mix', () => {
    expect(partMix('board', 'board', 0.5)).toEqual({ focus: 0.5, ghost: 0 });
    expect(partMix('keyboard', 'board', 0.5)).toEqual({ focus: 0, ghost: 0.5 });
    expect(partMix('ssd', 'board', 1)).toEqual({ focus: 0, ghost: 1 });
  });
  it('Deckel bleibt unberührt, Fokus auf Deckel ändert nichts (Projekte)', () => {
    expect(partMix('lid', 'board', 1)).toEqual({ focus: 0, ghost: 0 });
    expect(partMix('lid', 'lid', 1)).toEqual({ focus: 0, ghost: 0 });
    expect(partMix('board', 'lid', 1)).toEqual({ focus: 0, ghost: 0 });
  });
  it('klemmt focusMix auf 0…1', () => {
    expect(partMix('board', 'board', 3).focus).toBe(1);
    expect(partMix('board', 'ssd', -1)).toEqual({ focus: 0, ghost: 0 });
  });
});
