import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

type ScrollToOptions = NonNullable<Parameters<Lenis['scrollTo']>[1]>;

export interface Smooth {
  lenis: Lenis;
  scrollTo(target: string | number | HTMLElement, opts?: ScrollToOptions): void;
  destroy(): void;
}

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth Scroll (Lenis, lerp 0.1) gekoppelt an ScrollTrigger über gsap.ticker.
 * Nicht bei reduzierter Bewegung erzeugen. destroy() macht alles rückgängig.
 */
export function createSmooth(): Smooth {
  const lenis = new Lenis({ lerp: 0.1, autoRaf: false });

  const onScroll = (): void => ScrollTrigger.update();
  lenis.on('scroll', onScroll);

  const tick = (time: number): void => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const scrollTo: Smooth['scrollTo'] = (target, opts) => lenis.scrollTo(target, opts);

  // Anker-Sprünge (#id) über Lenis statt nativem Sprung.
  const onClick = (e: MouseEvent): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
    const hash = a?.getAttribute('href');
    if (!a || !hash || hash === '#') return;
    let el: Element | null = null;
    try {
      el = document.querySelector(hash);
    } catch {
      return;
    }
    if (!el) return;
    e.preventDefault();
    lenis.scrollTo(el as HTMLElement);
    history.pushState(null, '', hash);
  };
  document.addEventListener('click', onClick);

  let destroyed = false;
  return {
    lenis,
    scrollTo,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('click', onClick);
      lenis.off('scroll', onScroll);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33); // GSAP-Standard wiederherstellen
      lenis.destroy();
    },
  };
}
