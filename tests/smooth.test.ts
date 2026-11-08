// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { gsap } from 'gsap';

// jsdom hat kein matchMedia (ScrollTrigger und Lenis brauchen es), daher vor dem Import stubben.
vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
});

import { createSmooth } from '../src/choreo/smooth';

describe('createSmooth', () => {
  it('koppelt Lenis an den gsap.ticker und räumt in destroy() auf', () => {
    const add = vi.spyOn(gsap.ticker, 'add');
    const remove = vi.spyOn(gsap.ticker, 'remove');
    const lag = vi.spyOn(gsap.ticker, 'lagSmoothing');
    const smooth = createSmooth();
    expect(add).toHaveBeenCalledTimes(1);
    expect(lag).toHaveBeenCalledWith(0);
    const tick = add.mock.calls[0][0];
    expect(typeof smooth.scrollTo).toBe('function');

    smooth.destroy();
    expect(remove).toHaveBeenCalledWith(tick);
    expect(lag).toHaveBeenLastCalledWith(500, 33);
    expect(() => smooth.destroy()).not.toThrow();
    vi.restoreAllMocks();
  });
});
