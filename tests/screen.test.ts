import { describe, it, expect } from 'vitest';
import projects from '../src/content/projects.json';
import {
  SCREEN_COUNT,
  SCREEN_PROJECTS,
  fitScale,
  neededIndices,
  screenBlend,
  screenIndexOf,
} from '../src/scene/screen';

describe('Display: Reihenfolge und Index', () => {
  it('featured zuerst, dann der Rest in Dateireihenfolge', () => {
    expect(SCREEN_COUNT).toBe(projects.length);
    expect(SCREEN_PROJECTS.slice(0, 6).map((p) => p.name)).toEqual([
      'gen_Ut', 'fretlearn', 'Weitland', 'NSCS', 'OnlineIDE', 'DrawingTool',
    ]);
    const rest = projects.filter((p) => !p.featured).map((p) => p.name);
    expect(SCREEN_PROJECTS.slice(6).map((p) => p.name)).toEqual(rest);
  });
  it('screenIndexOf', () => {
    expect(screenIndexOf('gen_Ut')).toBe(0);
    expect(screenIndexOf('DrawingTool')).toBe(5);
    expect(screenIndexOf('JDBC-TicketSystem')).toBe(6);
    expect(screenIndexOf('gibts nicht')).toBe(-1);
  });
});

describe('Display: Überblendung', () => {
  it('zerlegt den Index in Folien und Anteil', () => {
    expect(screenBlend(1.5)).toEqual({ a: 1, b: 2, t: 0.5 });
    expect(screenBlend(2)).toEqual({ a: 2, b: 2, t: 0 });
    expect(screenBlend(0)).toEqual({ a: 0, b: 0, t: 0 });
  });
  it('-1 und kleiner = neutral, dazwischen Blende neutral → erstes Projekt', () => {
    expect(screenBlend(-1)).toEqual({ a: -1, b: -1, t: 0 });
    expect(screenBlend(-3)).toEqual({ a: -1, b: -1, t: 0 });
    const m = screenBlend(-0.25);
    expect(m.a).toBe(-1);
    expect(m.b).toBe(0);
    expect(m.t).toBeCloseTo(0.75);
  });
  it('klemmt am Ende', () => {
    expect(screenBlend(99)).toEqual({ a: SCREEN_COUNT - 1, b: SCREEN_COUNT - 1, t: 0 });
    expect(screenBlend(NaN).a).toBe(-1);
  });
  it('Vorladen: gezeigte plus Nachbarn', () => {
    expect(neededIndices(0)).toEqual([0, 1]);
    expect(neededIndices(1.5)).toEqual([0, 1, 2, 3]);
    expect(neededIndices(-1).sort()).toEqual([0, 1]);
    expect(neededIndices(SCREEN_COUNT - 1)).toEqual([SCREEN_COUNT - 2, SCREEN_COUNT - 1]);
  });
});

describe('Display: Einpassung', () => {
  it('contain auf 16:9', () => {
    const d = 16 / 9;
    expect(fitScale(d, d)).toEqual([1, 1]);
    const wide = fitScale(2.4, d);
    expect(wide[0]).toBe(1);
    expect(wide[1]).toBeCloseTo(d / 2.4);
    const tall = fitScale(1, d);
    expect(tall[1]).toBe(1);
    expect(tall[0]).toBeCloseTo(1 / d);
    expect(fitScale(0, d)).toEqual([1, 1]);
  });
});
