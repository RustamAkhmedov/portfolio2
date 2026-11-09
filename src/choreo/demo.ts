/*
 * Live-Demo (T080 Knopf, T081 Zoom + iframe). Auf dem Desktop mit Choreografie ersetzt `button[data-demo-open]` den
 * Link `a[data-demo-link]` (CSS). Ohne Choreografie (Handy, reduziert, kein WebGL, kein JS) bleibt der Link in neuem
 * Tab; dieses Modul läuft dort nicht.
 *
 * Öffnen (Klick): `demoOpen` an, `html.demo-on` („Schließen“ sichtbar), `html.demo-dim` (Seite ausgeblendet; bei der
 * Rückfahrt erst ab demoMix < UNDIM_AT wieder da) und `html.demo-zoom` (Canvas über das ganze Fenster, Labels aus,
 * Seite nicht scrollbar), restliche Seite `inert`, Lenis angehalten. Erst jetzt
 * entsteht `<iframe id="demo-frame">` mit der Demo-URL; die Szene legt es je Frame auf das Display (attach).
 * `demoMix` fährt per GSAP 0 → 1: die Kamera zoomt auf das Display, das iframe wächst deckungsgleich mit.
 * Der Fokus geht ins iframe.
 *
 * Schließen (Escape, „Schließen“): `demoOpen` aus, `inert` weg, Fokus zurück zum Knopf, `demoMix` fährt 1 → 0
 * (Kamera zurück zur unveränderten Scroll-Pose); danach iframe entfernen, Canvas zurück, Lenis wieder an.
 * Die Choreografie schreibt nur SceneState; Geometrie (Ecken, Pose) kennt nur die Szene.
 */
import { gsap } from 'gsap';
import type { SceneState } from '../scene/state';

export interface DemoDeps {
  setState: (patch: Partial<SceneState>) => void;
  onChange: (fn: (s: Readonly<SceneState>) => void) => () => void;
  root?: Document;
  /** Smooth Scroll anhalten/fortsetzen (Lenis) */
  scroll?: { stop(): void; start(): void };
  /** Szene: legt das iframe über das Display (null = keins) */
  frame?: { attach(el: HTMLElement | null): void };
  /** Dauer der Kamerafahrt in s (Standard DURATION; 0 = sofort, z. B. in Tests) */
  duration?: number;
}

export interface Demo {
  kill(): void;
}

/** Kamerafahrt zum Display und zurück */
const DURATION = 1.1;
const EASE = 'power3.inOut';
/** Rückfahrt: unter diesem demoMix blendet die Seite wieder ein (vorher läge Text über dem großen Laptop) */
const UNDIM_AT = 0.35;

export function initDemo(deps: DemoDeps): Demo {
  const doc = deps.root ?? document;
  const html = doc.documentElement;
  const body = doc.body;
  const close = doc.querySelector<HTMLElement>('[data-demo-close]');
  const duration = deps.duration ?? DURATION;
  let opener: HTMLElement | null = null;
  let frame: HTMLIFrameElement | null = null;
  let wasOpen = false;
  let scrollStopped = false;
  const stopScroll = (on: boolean): void => {
    if (on === scrollStopped) return;
    scrollStopped = on;
    if (on) deps.scroll?.stop();
    else deps.scroll?.start();
  };
  let tween: gsap.core.Tween | null = null;
  const mix = { v: 0 };
  /** von uns inert gesetzte Elemente */
  let inerted: HTMLElement[] = [];

  const setInert = (on: boolean): void => {
    if (on) {
      for (const el of Array.from(body.children) as HTMLElement[]) {
        if (el === close || el === frame || el.id === 'scene' || el.inert) continue;
        el.inert = true;
        inerted.push(el);
      }
    } else {
      inerted.forEach((el) => (el.inert = false));
      inerted = [];
    }
  };

  /** Escape im iframe (gleiche Herkunft, z. B. rustamakhmedov.github.io): fremde Seiten werfen beim Zugriff */
  const hookFrameKeys = (f: HTMLIFrameElement): void => {
    try {
      f.contentWindow?.addEventListener('keydown', onKey);
    } catch {
      /* andere Herkunft: Escape nur außerhalb des iframes, „Schließen“ per Umschalt+Tab */
    }
  };

  const createFrame = (btn: HTMLElement): HTMLIFrameElement | null => {
    const url = btn.dataset['demoUrl'];
    if (!url) return null;
    const f = doc.createElement('iframe');
    f.id = 'demo-frame';
    f.className = 'demo-frame';
    const name = btn.closest('[data-step]')?.querySelector('h3')?.textContent?.trim();
    const label = btn.textContent?.trim() ?? '';
    f.title = name ? `${label}: ${name}` : label;
    f.setAttribute('allow', 'fullscreen');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.addEventListener('load', () => hookFrameKeys(f));
    f.src = url;
    body.appendChild(f);
    return f;
  };

  const removeFrame = (): void => {
    if (!frame) return;
    deps.frame?.attach(null);
    try {
      frame.contentWindow?.removeEventListener('keydown', onKey);
    } catch {
      /* andere Herkunft */
    }
    frame.remove();
    frame = null;
  };

  /** Kamerafahrt; onDone nur, wenn sie nicht vorher abgelöst wurde */
  const animate = (to: number, onDone?: () => void): void => {
    tween?.kill();
    const done = (): void => {
      tween = null;
      onDone?.();
    };
    if (duration <= 0) {
      mix.v = to;
      deps.setState({ demoMix: to });
      done();
      return;
    }
    tween = gsap.to(mix, {
      v: to,
      duration: duration * Math.abs(to - mix.v),
      ease: EASE,
      onUpdate: () => {
        deps.setState({ demoMix: mix.v });
        if (to === 0 && mix.v < UNDIM_AT) html.classList.remove('demo-dim');
      },
      onComplete: done,
    });
  };

  const open = (): void => {
    const btn = opener;
    if (!btn) return;
    if (frame && frame.dataset['url'] !== btn.dataset['demoUrl']) removeFrame();
    html.classList.add('demo-on', 'demo-dim', 'demo-zoom');
    if (close) close.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    stopScroll(true);
    if (!frame) {
      frame = createFrame(btn);
      if (frame) frame.dataset['url'] = btn.dataset['demoUrl'];
      if (frame) deps.frame?.attach(frame);
    }
    frame?.classList.remove('is-closing');
    if (frame) frame.inert = false;
    setInert(true);
    // Fokus ins iframe (Tastatur bedient die Demo); ohne iframe auf „Schließen“
    if (frame) frame.focus({ preventScroll: true });
    else close?.focus({ preventScroll: true });
    requestAnimationFrame(() => frame?.classList.add('is-open'));
    animate(1);
  };

  const finish = (): void => {
    removeFrame();
    html.classList.remove('demo-dim', 'demo-zoom');
    stopScroll(false);
  };

  const shut = (): void => {
    html.classList.remove('demo-on');
    if (close) close.hidden = true;
    setInert(false);
    if (frame) {
      frame.inert = true;
      frame.classList.remove('is-open');
      frame.classList.add('is-closing');
    }
    const btn = opener;
    btn?.setAttribute('aria-expanded', 'false');
    btn?.focus({ preventScroll: true });
    animate(0, finish);
  };

  const onClick = (e: Event): void => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-demo-open]');
    if (!btn) return;
    if (wasOpen) return;
    opener = btn;
    deps.setState({ demoOpen: true });
  };
  const onClose = (): void => deps.setState({ demoOpen: false });
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && wasOpen) deps.setState({ demoOpen: false });
  }

  // Nur auf Übergänge von demoOpen reagieren (onChange meldet jede State-Änderung, auch demoMix je Frame)
  const off = deps.onChange((s) => {
    if (s.demoOpen === wasOpen) return;
    wasOpen = s.demoOpen;
    if (wasOpen) open();
    else shut();
  });

  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);
  close?.addEventListener('click', onClose);

  return {
    kill() {
      off();
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('keydown', onKey);
      close?.removeEventListener('click', onClose);
      tween?.kill();
      tween = null;
      mix.v = 0;
      removeFrame();
      setInert(false);
      html.classList.remove('demo-on', 'demo-dim', 'demo-zoom');
      if (close) close.hidden = true;
      opener?.setAttribute('aria-expanded', 'false');
      stopScroll(false);
      wasOpen = false;
      deps.setState({ demoOpen: false, demoMix: 0 });
    },
  };
}
