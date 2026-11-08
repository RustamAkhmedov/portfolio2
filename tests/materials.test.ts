// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { BoxGeometry, Color, LineSegments, Mesh } from 'three';
import { addEdges, createMaterials } from '../src/scene/materials';

describe('materials', () => {
  beforeEach(() => {
    const s = document.documentElement.style;
    s.setProperty('--paper', '#112233');
    s.setProperty('--ink', '#445566');
    s.setProperty('--orange', '#ff0000');
    s.setProperty('--case', '#00ff00');
    s.setProperty('--case-edge', '#0000ff');
  });

  it('liest Farben aus den CSS-Variablen', () => {
    const m = createMaterials();
    expect(m.paper.color.getHex()).toBe(new Color('#112233').getHex());
    expect(m.focus.color.getHex()).toBe(new Color('#ff0000').getHex());
    expect(m.case.color.getHex()).toBe(new Color('#00ff00').getHex());
    expect(m.edgeOnCase.color.getHex()).toBe(new Color('#0000ff').getHex());
    expect(m.edgeOnCase.opacity).toBeCloseTo(0.6);
    expect(m.edgeInk.color.getHex()).toBe(new Color('#445566').getHex());
  });

  it('addEdges hängt genau ein LineSegments an und teilt das Material', () => {
    const m = createMaterials();
    const a = new Mesh(new BoxGeometry(1, 1, 1), m.case);
    const b = new Mesh(new BoxGeometry(1, 1, 1), m.case);
    const la = addEdges(a, 'case', m);
    const lb = addEdges(b, 'case', m);
    expect(a.children.filter((c) => c instanceof LineSegments)).toHaveLength(1);
    expect(la.material).toBe(m.edgeOnCase);
    expect(lb.material).toBe(la.material);
    expect(addEdges(new Mesh(new BoxGeometry(1, 1, 1)), 'ink', m).material).toBe(m.edgeInk);
  });
});
