import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

type ScrollToOptions = NonNullable<Parameters<Lenis['scrollTo']>[1]>;

/** `#id` → Scroll-Position in px (Timeline: `anchorY`), `null` = unbekannt (dann gilt das Element im Dokument) */
export type AnchorResolver = (id: string) => number | null;

export interface Smooth {
  lenis: Lenis;
  scrollTo(target: string | number | HTMLElement, opts?: ScrollToOptions): void;
  /**
   * Auflösung für Anker-Sprünge. Die Abschnitte sind gepinnt, ihr DOM-Abstand ist nicht die Position, an der der
   * Zustand (Kamera, Fokus) passt. Ohne Auflösung bleiben Anker nativ (kein preventDefault).
   */
  setResolver(fn: AnchorResolver | null): void;
  destroy(): void;
}

/** `#projekte` → `projekte` (URL-dekodiert); `#`, leer oder kaputt → null */
export function hashId(hash: string | null | undefined): string | null {
  if (!hash || hash.length < 2 || hash[0] !== '#') return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

/** Ziel eines Anker-Sprungs fokussierbar machen (wie der native Anker): der nächste Tab startet dort. */
export function focusAnchor(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex') && !el.matches('a[href], button, input, select, textarea, summary, [contenteditable]')) {
    el.setAttribute('tabindex', '-1');
  }
  el.focus({ preventScroll: true });
}

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth Scroll (Lenis, lerp 0.1) gekoppelt an ScrollTrigger über gsap.ticker.
 * Nicht bei reduzierter Bewegung erzeugen. destroy() macht alles rückgängig.
 */
export function createSmooth(): Smooth {
  // syncTouch aus: auf Touch-Geräten bleibt die native Scroll-Physik (Trägheit, Adressleiste); Lenis folgt nur
  // der Position und stellt ScrollTrigger. normalizeScroll ist nicht nötig, die Pins bleiben stabil.
  const lenis = new Lenis({ lerp: 0.1, autoRaf: false, syncTouch: false });

  const onScroll = (): void => ScrollTrigger.update();
  lenis.on('scroll', onScroll);

  const tick = (time: number): void => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const scrollTo: Smooth['scrollTo'] = (target, opts) => lenis.scrollTo(target, opts);

  let resolve: AnchorResolver | null = null;
  const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  // Anker-Sprünge (#id) über Lenis statt nativem Sprung, zur Position der Timeline (nicht zum DOM-Abstand)
  const onClick = (e: MouseEvent): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!resolve || reducedMotion()) return; // nativ
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
    const hash = a?.getAttribute('href');
    const id = hashId(hash);
    if (!a || !hash || !id || a.hasAttribute('download')) return;
    const el = document.getElementById(id);
    const y = resolve(id);
    if (y === null && !el) return;
    e.preventDefault();
    if (y !== null) lenis.scrollTo(y);
    else lenis.scrollTo(el as HTMLElement);
    if (el) focusAnchor(el);
    if (location.hash !== hash) {
      // Zurück-Taste: Position vor dem Sprung merken (popstate unten)
      history.replaceState({ y: window.scrollY }, '');
      history.pushState({}, '', hash);
    }
  };
  document.addEventListener('click', onClick);

  // Zurück/Vor: gemerkte Position, sonst Anker der URL, sonst Seitenanfang. Sofort statt animiert
  // (der Browser springt selbst zum DOM-Abstand des Fragments; das überschreiben wir, auch im nächsten Frame).
  const onPop = (e: PopStateEvent): void => {
    if (!resolve) return;
    const saved = (e.state as { y?: unknown } | null)?.y;
    const id = hashId(location.hash);
    const y = typeof saved === 'number' ? saved : id ? resolve(id) : location.hash ? null : 0;
    if (y === null) return;
    const go = (): void => lenis.scrollTo(y, { immediate: true, force: true });
    go();
    requestAnimationFrame(go);
  };
  window.addEventListener('popstate', onPop);
  const prevRestoration = 'scrollRestoration' in history ? history.scrollRestoration : null;
  if (prevRestoration) history.scrollRestoration = 'manual';

  let destroyed = false;
  return {
    lenis,
    scrollTo,
    setResolver(fn) {
      resolve = fn;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPop);
      if (prevRestoration) history.scrollRestoration = prevRestoration;
      lenis.off('scroll', onScroll);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33); // GSAP-Standard wiederherstellen
      lenis.destroy();
    },
  };
}
