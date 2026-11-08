// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Steuerbares matchMedia: reduced / Breite lassen sich zur Laufzeit umschalten.
const env = vi.hoisted(() => {
  const e = {
    reduced: false,
    width: 1200,
    subs: new Set<() => void>(),
    matches(q: string): boolean {
      const noPref = q.includes('no-preference');
      if (!q.includes('prefers-reduced-motion')) return false;
      if (!noPref) return e.reduced;
      if (e.reduced) return false;
      if (q.includes('min-width: 900px')) return e.width >= 900;
      if (q.includes('max-width: 899px')) return e.width <= 899;
      return true;
    },
    set(next: { reduced?: boolean; width?: number }) {
      Object.assign(e, next);
      e.subs.forEach((f) => f());
    },
  };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((q: string) => {
    let last = e.matches(q);
    const listeners = new Set<(ev: MediaQueryListEvent) => void>();
    const mql = {
      media: q,
      get matches() {
        return e.matches(q);
      },
      onchange: null,
      addListener: (fn: (ev: MediaQueryListEvent) => void) => {
        listeners.add(fn);
        e.subs.add(() => {
          const m = e.matches(q);
          if (m !== last) {
            last = m;
            listeners.forEach((l) => l({ matches: m, media: q } as MediaQueryListEvent));
          }
        });
      },
      removeListener: (fn: (ev: MediaQueryListEvent) => void) => listeners.delete(fn),
      dispatchEvent: () => false,
    };
    return mql;
  }) as unknown as typeof window.matchMedia;
  return e;
});

import { initMedia, type Media } from '../src/choreo/media';

// gsap entprellt Medienwechsel auf > 2 ms
const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 5));
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

function makeDeps() {
  const c = { smooth: 0, smoothKilled: 0, tl: 0, tlKilled: 0, dir: 0, dirKilled: 0, intro: 0, introKilled: 0, show: 0, hide: 0, reset: 0, mobile: [] as boolean[] };
  const deps = {
    showScene: vi.fn(() => {
      c.show++;
      return true;
    }),
    hideScene: vi.fn(() => void c.hide++),
    resetState: vi.fn(() => void c.reset++),
    playIntro: vi.fn(() => {
      c.intro++;
      return () => void c.introKilled++;
    }),
    createSmooth: vi.fn(() => {
      c.smooth++;
      return { destroy: () => void c.smoothKilled++, scrollTo() {} };
    }),
    createTimeline: vi.fn(({ mobile }: { mobile: boolean }) => {
      c.tl++;
      c.mobile.push(mobile);
      return { kill: () => void c.tlKilled++ };
    }),
    createDirectory: vi.fn(() => {
      c.dir++;
      return { kill: () => void c.dirKilled++ };
    }),
  };
  return { c, deps };
}

describe('initMedia', () => {
  let media: Media | null = null;
  beforeEach(() => {
    media?.dispose();
    env.subs.clear();
    document.documentElement.className = 'js';
    env.reduced = false;
    env.width = 1200;
  });

  it('desktop: baut Szene, Lenis, Timeline und Verzeichnis auf; dispose räumt alles ab', async () => {
    const { c, deps } = makeDeps();
    media = initMedia(deps);
    await flush();
    expect([c.show, c.smooth, c.tl, c.dir, c.intro]).toEqual([1, 1, 1, 1, 1]);
    expect(c.mobile).toEqual([false]);
    media.dispose();
    expect([c.smoothKilled, c.tlKilled, c.dirKilled, c.introKilled]).toEqual([1, 1, 1, 1]);
    expect(c.reset).toBe(1);
  });

  it('mobile: Timeline mit mobile=true, ohne Verzeichnis', async () => {
    env.width = 400;
    const { c, deps } = makeDeps();
    media = initMedia(deps);
    await flush();
    expect(c.mobile).toEqual([true]);
    expect(c.dir).toBe(0);
    expect(c.tl).toBe(1);
  });

  it('reduced: nichts wird aufgebaut, html.reduced steht, Szene wird versteckt', async () => {
    env.reduced = true;
    const { c, deps } = makeDeps();
    media = initMedia(deps);
    await flush();
    expect([c.show, c.smooth, c.tl, c.dir, c.intro]).toEqual([0, 0, 0, 0, 0]);
    expect(c.hide).toBe(1);
    expect(document.documentElement.classList.contains('reduced')).toBe(true);
  });

  it('Laufzeit: desktop -> mobile -> reduced -> mobile ohne Leaks', async () => {
    const { c, deps } = makeDeps();
    media = initMedia(deps);
    await flush();
    env.set({ width: 500 });
    await flush();
    expect([c.tl, c.tlKilled, c.dirKilled, c.smooth, c.smoothKilled]).toEqual([2, 1, 1, 2, 1]);
    env.set({ reduced: true });
    await flush();
    expect([c.tl, c.tlKilled, c.smoothKilled, c.introKilled]).toEqual([2, 2, 2, 2]);
    expect(document.documentElement.classList.contains('reduced')).toBe(true);
    env.set({ reduced: false });
    await flush();
    expect(document.documentElement.classList.contains('reduced')).toBe(false);
    expect([c.tl, c.tlKilled, c.smooth, c.smoothKilled, c.dir, c.dirKilled]).toEqual([3, 2, 3, 2, 1, 1]);
  });

  it('Wechsel mitten im Aufbau: nachträglich fertige Handles werden sofort abgeräumt', async () => {
    const { c, deps } = makeDeps() as { c: ReturnType<typeof makeDeps>['c']; deps: ReturnType<typeof makeDeps>['deps'] };
    let release!: () => void;
    deps.createSmooth.mockImplementation(
      () =>
        new Promise((res) => {
          release = () => {
            c.smooth++;
            res({ destroy: () => void c.smoothKilled++, scrollTo() {} });
          };
        }) as never,
    );
    media = initMedia(deps);
    await flush();
    env.set({ reduced: true });
    release();
    await flush();
    expect(c.smooth).toBe(1);
    expect(c.smoothKilled).toBe(1);
    expect(c.tl).toBe(0);
  });

  it('ohne Szene (showScene false): keine Choreografie', async () => {
    const { c, deps } = makeDeps();
    deps.showScene.mockReturnValue(false);
    media = initMedia(deps);
    await flush();
    expect([c.smooth, c.tl]).toEqual([0, 0]);
  });
});
