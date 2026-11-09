import { describe, it, expect, beforeEach } from 'vitest';
import { state, setState, consumeNeedsRender, requestRender, onChange } from '../src/scene/state';

describe('SceneState', () => {
  beforeEach(() => {
    setState({ lid: 0, explode: 0, focus: null, focusMix: 0, cam: 0, screen: 0 });
    consumeNeedsRender();
  });

  it('klemmt Bereiche', () => {
    setState({ lid: 2, explode: -1, focusMix: 5, cam: -3, screen: -1 });
    expect(state.lid).toBe(1);
    expect(state.explode).toBe(0);
    expect(state.focusMix).toBe(1);
    expect(state.cam).toBe(0);
    expect(state.screen).toBe(-1);
    setState({ screen: -5 });
    expect(state.screen).toBe(-1);
    setState({ cam: 2.4 });
    expect(state.cam).toBe(2.4);
  });

  it('ignoriert NaN', () => {
    setState({ explode: 0.5 });
    consumeNeedsRender();
    setState({ explode: NaN });
    expect(state.explode).toBe(0.5);
    expect(consumeNeedsRender()).toBe(false);
  });

  it('setzt needsRender nur bei Änderung, consume löscht', () => {
    setState({ lid: 0 });
    expect(consumeNeedsRender()).toBe(false);
    setState({ lid: 0.3, focus: 'screen' });
    expect(state.focus).toBe('screen');
    expect(consumeNeedsRender()).toBe(true);
    expect(consumeNeedsRender()).toBe(false);
    setState({ lid: 0.3 });
    expect(consumeNeedsRender()).toBe(false);
    requestRender();
    expect(consumeNeedsRender()).toBe(true);
  });

  it('onChange meldet Änderungen und kann abgemeldet werden', () => {
    let n = 0;
    const off = onChange(() => n++);
    setState({ explode: 0.2 });
    setState({ explode: 0.2 });
    expect(n).toBe(1);
    off();
    setState({ explode: 0.4 });
    expect(n).toBe(1);
  });
});

describe('SceneState demoOpen', () => {
  it('ist boolean, nur über setState, meldet Änderungen', () => {
    setState({ demoOpen: false });
    consumeNeedsRender();
    expect(state.demoOpen).toBe(false);
    let calls = 0;
    const off = onChange(() => calls++);
    setState({ demoOpen: true });
    expect(state.demoOpen).toBe(true);
    expect(calls).toBe(1);
    expect(consumeNeedsRender()).toBe(true);
    setState({ demoOpen: true });
    expect(calls).toBe(1);
    // ungültige Werte werden ignoriert
    setState({ demoOpen: 1 as unknown as boolean });
    expect(state.demoOpen).toBe(true);
    setState({ demoOpen: false });
    expect(state.demoOpen).toBe(false);
    off();
  });
});

describe('SceneState demoMix', () => {
  it('klemmt auf 0 … 1', () => {
    setState({ demoMix: 2 });
    expect(state.demoMix).toBe(1);
    setState({ demoMix: -1 });
    expect(state.demoMix).toBe(0);
    setState({ demoMix: 0.25 });
    expect(state.demoMix).toBe(0.25);
    setState({ demoMix: 0 });
  });
});

describe('SceneState demoMix', () => {
  it('klemmt auf 0…1 und ignoriert NaN/Strings', () => {
    setState({ demoMix: 0.4 });
    expect(state.demoMix).toBe(0.4);
    setState({ demoMix: 5 });
    expect(state.demoMix).toBe(1);
    setState({ demoMix: -2 });
    expect(state.demoMix).toBe(0);
    setState({ demoMix: 0.6 });
    setState({ demoMix: NaN });
    setState({ demoMix: '1' as unknown as number });
    expect(state.demoMix).toBe(0.6);
    setState({ demoMix: 0 });
  });
});
