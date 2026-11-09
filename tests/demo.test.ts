// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initDemo } from '../src/choreo/demo';
import { state, setState, onChange } from '../src/scene/state';

describe('Live-Demo-Knopf (T080)', () => {
  beforeEach(() => {
    document.body.innerHTML = `<button id="demo-close" data-demo-close hidden>x</button>
      <article data-step="a"><button data-demo-open aria-expanded="false">Demo</button></article>`;
    document.documentElement.className = '';
    setState({ demoOpen: false });
  });

  it('Klick öffnet, Escape schließt und gibt den Fokus zurück', () => {
    const demo = initDemo({ setState, onChange });
    const btn = document.querySelector<HTMLElement>('[data-demo-open]')!;
    btn.click();
    expect(state.demoOpen).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.classList.contains('demo-on')).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-demo-close]')!.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(state.demoOpen).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(btn);
    demo.kill();
  });

  it('Schließen-Knopf schließt; kill räumt auf', () => {
    const demo = initDemo({ setState, onChange });
    document.querySelector<HTMLElement>('[data-demo-open]')!.click();
    document.querySelector<HTMLElement>('[data-demo-close]')!.click();
    expect(state.demoOpen).toBe(false);
    document.querySelector<HTMLElement>('[data-demo-open]')!.click();
    demo.kill();
    expect(state.demoOpen).toBe(false);
    document.querySelector<HTMLElement>('[data-demo-open]')!.click();
    expect(state.demoOpen).toBe(false);
  });
});

describe('Live-Demo: iframe, Zoom, Fokus und Scroll (T081)', () => {
  beforeEach(() => {
    document.body.innerHTML = `<a class="skip" href="#main">skip</a><div id="scene"></div>
      <button id="demo-close" data-demo-close hidden>x</button>
      <main id="main"><article data-step="fretlearn"><h3>fretlearn</h3>
        <button data-demo-open data-demo-url="https://example.org/demo/" aria-expanded="false">Live-Demo</button></article></main>`;
    document.documentElement.className = '';
    setState({ demoOpen: false, demoMix: 0 });
  });

  const setup = () => {
    const calls: string[] = [];
    const attached: (HTMLElement | null)[] = [];
    const demo = initDemo({
      setState,
      onChange,
      duration: 0,
      scroll: { stop: () => calls.push('stop'), start: () => calls.push('start') },
      frame: { attach: (el) => attached.push(el) },
    });
    return { demo, calls, attached };
  };

  it('iframe entsteht erst beim Klick, liegt in der Szene, Seite inert, Lenis angehalten', () => {
    const { demo, calls, attached } = setup();
    expect(document.getElementById('demo-frame')).toBeNull();
    const btn = document.querySelector<HTMLElement>('[data-demo-open]')!;
    btn.click();
    const f = document.getElementById('demo-frame') as HTMLIFrameElement;
    expect(f).not.toBeNull();
    expect(f.tagName).toBe('IFRAME');
    expect(f.getAttribute('src')).toBe('https://example.org/demo/');
    expect(f.title).toBe('Live-Demo: fretlearn');
    expect(attached).toEqual([f]);
    expect(state.demoMix).toBe(1);
    expect(calls).toEqual(['stop']);
    expect(document.documentElement.classList.contains('demo-zoom')).toBe(true);
    expect((document.getElementById('main') as HTMLElement).inert).toBe(true);
    expect((document.querySelector('.skip') as HTMLElement).inert).toBe(true);
    expect((document.getElementById('demo-close') as HTMLElement).inert).toBeFalsy();
    expect(f.inert).toBeFalsy();
    expect(document.activeElement).toBe(f);
    demo.kill();
  });

  it('Schließen: Fokus zurück zum Knopf, Kamera zurück, iframe weg, Lenis wieder an', () => {
    const { demo, calls, attached } = setup();
    const btn = document.querySelector<HTMLElement>('[data-demo-open]')!;
    btn.click();
    document.querySelector<HTMLElement>('[data-demo-close]')!.click();
    expect(state.demoOpen).toBe(false);
    expect(state.demoMix).toBe(0);
    expect(document.getElementById('demo-frame')).toBeNull();
    expect(attached.at(-1)).toBeNull();
    expect(calls).toEqual(['stop', 'start']);
    expect(document.documentElement.classList.contains('demo-on')).toBe(false);
    expect(document.documentElement.classList.contains('demo-zoom')).toBe(false);
    expect((document.getElementById('main') as HTMLElement).inert).toBe(false);
    expect(document.activeElement).toBe(btn);
    // erneut öffnen lädt neu
    btn.click();
    expect(document.getElementById('demo-frame')).not.toBeNull();
    demo.kill();
    expect(document.getElementById('demo-frame')).toBeNull();
    expect(state.demoMix).toBe(0);
    expect(calls.at(-1)).toBe('start');
  });

  it('demoMix-Änderungen fokussieren nicht erneut (nur Übergänge von demoOpen zählen)', () => {
    const { demo } = setup();
    document.querySelector<HTMLElement>('[data-demo-open]')!.click();
    const other = document.getElementById('demo-close')!;
    other.focus();
    setState({ demoMix: 0.5 });
    setState({ cam: 2.1 });
    expect(document.activeElement).toBe(other);
    demo.kill();
    setState({ cam: 0 });
  });
});

describe('Live-Demo: Sonderfälle (T082)', () => {
  const html = (url: string) => `<button id="demo-close" data-demo-close hidden>x</button>
    <main id="main"><article data-step="a"><h3>A</h3><button data-demo-open ${url} aria-expanded="false">Demo</button></article>
    <article data-step="b"><h3>B</h3><button data-demo-open data-demo-url="https://example.org/b/" aria-expanded="false">Demo</button></article></main>`;
  beforeEach(() => {
    document.documentElement.className = '';
    setState({ demoOpen: false, demoMix: 0 });
  });

  it('ohne data-demo-url: kein iframe, Fokus auf „Schließen“, Seite inert, Escape schließt', () => {
    document.body.innerHTML = html('');
    const demo = initDemo({ setState, onChange, duration: 0 });
    document.querySelector<HTMLElement>('[data-demo-open]')!.click();
    expect(document.getElementById('demo-frame')).toBeNull();
    expect(document.activeElement).toBe(document.getElementById('demo-close'));
    expect((document.getElementById('main') as HTMLElement).inert).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(state.demoOpen).toBe(false);
    expect((document.getElementById('main') as HTMLElement).inert).toBe(false);
    demo.kill();
  });

  it('Escape ohne offene Demo und andere Tasten tun nichts', () => {
    document.body.innerHTML = html('data-demo-url="https://example.org/a/"');
    const demo = initDemo({ setState, onChange, duration: 0 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(state.demoOpen).toBe(false);
    document.querySelector<HTMLElement>('[data-demo-open]')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(state.demoOpen).toBe(true);
    demo.kill();
  });

  it('zweiter Knopf (anderes Projekt): iframe wird mit der neuen URL geladen, Fokus kehrt zum zweiten Knopf zurück', () => {
    document.body.innerHTML = html('data-demo-url="https://example.org/a/"');
    const demo = initDemo({ setState, onChange, duration: 0 });
    const [a, b] = Array.from(document.querySelectorAll<HTMLElement>('[data-demo-open]')) as [HTMLElement, HTMLElement];
    a.click();
    expect(document.getElementById('demo-frame')!.getAttribute('src')).toBe('https://example.org/a/');
    document.querySelector<HTMLElement>('[data-demo-close]')!.click();
    b.click();
    expect(document.querySelectorAll('#demo-frame')).toHaveLength(1);
    expect(document.getElementById('demo-frame')!.getAttribute('src')).toBe('https://example.org/b/');
    document.querySelector<HTMLElement>('[data-demo-close]')!.click();
    expect(document.activeElement).toBe(b);
    expect(a.getAttribute('aria-expanded')).toBe('false');
    demo.kill();
  });

  it('Klick auf den Knopf bei schon offener Demo öffnet nicht ein zweites Mal', () => {
    document.body.innerHTML = html('data-demo-url="https://example.org/a/"');
    const demo = initDemo({ setState, onChange, duration: 0 });
    const a = document.querySelector<HTMLElement>('[data-demo-open]')!;
    a.click();
    a.click();
    expect(document.querySelectorAll('#demo-frame')).toHaveLength(1);
    expect(state.demoOpen).toBe(true);
    demo.kill();
  });

  it('vorher inerte Elemente bleiben nach dem Schließen inert (nur eigene Änderungen werden zurückgenommen)', () => {
    document.body.innerHTML = html('data-demo-url="https://example.org/a/"') + '<aside id="x"></aside>';
    (document.getElementById('x') as HTMLElement).inert = true;
    const demo = initDemo({ setState, onChange, duration: 0 });
    document.querySelector<HTMLElement>('[data-demo-open]')!.click();
    document.querySelector<HTMLElement>('[data-demo-close]')!.click();
    expect((document.getElementById('x') as HTMLElement).inert).toBe(true);
    expect((document.getElementById('main') as HTMLElement).inert).toBe(false);
    demo.kill();
  });
});
