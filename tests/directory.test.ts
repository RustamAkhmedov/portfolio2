// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createDirectory, hoverIndex } from '../src/choreo/directory';
import { state, setState, onChange } from '../src/scene/state';

const NAMES = ['A', 'B', 'C'];
const indexOf = (n: string): number => {
  const i = NAMES.indexOf(n);
  return i < 0 ? -1 : 6 + i;
};

describe('hoverIndex', () => {
  it('bildet Namen auf Display-Indizes ab', () => {
    expect(hoverIndex('B', indexOf)).toBe(7);
    expect(hoverIndex('X', indexOf)).toBeNull();
    expect(hoverIndex('', indexOf)).toBeNull();
    expect(hoverIndex(undefined, indexOf)).toBeNull();
  });
});

describe('createDirectory', () => {
  let rows: HTMLElement[];
  let active: boolean;
  let view: boolean;
  let dir: { kill(): void };
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="projekte-alle"><table><tbody>' +
      NAMES.map((n) => `<tr data-project="${n}"><th><a href="#">${n}</a></th></tr>`).join('') +
      '</tbody></table></div>';
    rows = [...document.querySelectorAll<HTMLElement>('[data-project]')];
    setState({ cam: 2, screen: 5, focus: null });
    active = true;
    view = true;
    dir = createDirectory({
      indexOf, setState, state, onChange,
      isActive: () => active,
      inView: () => view,
    });
  });

  const over = (el: Element): boolean => el.dispatchEvent(new Event('pointerover', { bubbles: true }));
  const out = (el: Element): boolean => el.dispatchEvent(new Event('pointerout', { bubbles: true }));

  it('Hover setzt screen und focus, Verlassen stellt den alten Wert wieder her', () => {
    over(rows[1]!);
    expect(state.screen).toBe(7);
    expect(state.focus).toBe('lid');
    out(rows[1]!);
    expect(state.screen).toBe(5);
    dir.kill();
  });

  it('hält den Hover-Wert gegen die Timeline', () => {
    over(rows[0]!);
    setState({ screen: 5 }); // Timeline schreibt beim Scrollen
    expect(state.screen).toBe(6);
    out(rows[0]!);
    expect(state.screen).toBe(5);
    dir.kill();
  });

  it('Tastaturfokus wirkt wie Hover', () => {
    rows[2]!.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(state.screen).toBe(8);
    rows[2]!.dispatchEvent(new Event('focusout', { bubbles: true }));
    expect(state.screen).toBe(5);
    dir.kill();
  });

  it('ignoriert Hover ohne 3D oder außerhalb des Viewports; kill gibt frei', () => {
    active = false;
    over(rows[0]!);
    expect(state.screen).toBe(5);
    active = true;
    view = false;
    over(rows[0]!);
    expect(state.screen).toBe(5);
    view = true;
    over(rows[0]!);
    expect(state.screen).toBe(6);
    dir.kill();
    expect(state.screen).toBe(5);
    setState({ screen: 3 });
    expect(state.screen).toBe(3);
  });
});
