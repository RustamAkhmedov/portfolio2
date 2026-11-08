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
