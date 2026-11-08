/*
 * Medienfälle (T040, research.md R5): gsap.matchMedia() legt je nach Gerät und Einstellung an,
 * was die Seite braucht, und räumt beim Verlassen des Falls restlos auf.
 *
 *   desktop  (no-preference, ≥ 900 px)  Szene + Intro + Lenis + Master-Timeline + Verzeichnis-Hover
 *   mobile   (no-preference, ≤ 899 px)  Handy und Tablet-Hochformat: Szene als Bühne oben, kürzere Strecken (MOBILE in score.ts),
 *                                       kein Verzeichnis-Hover; `mobile: true` geht an createTimeline
 *   reduced  (reduce)                   keine Szene, kein Intro, keine Timeline, kein Lenis, kein Pinning;
 *                                       `html.reduced` wird mitgeführt (Standbild kommt per CSS)
 *
 * Alle schweren Module kommen über `deps` (main.ts lädt sie dynamisch); media.ts selbst zieht nur gsap-Kern.
 * Die Fälle bauen asynchron auf (dynamische Imports). Räumt matchMedia den Fall währenddessen ab, wird
 * alles, was danach noch fertig wird, sofort wieder abgeräumt.
 */
import { gsap } from 'gsap';

type Awaitable<T> = T | Promise<T>;

export const QUERIES = {
  desktop: '(prefers-reduced-motion: no-preference) and (min-width: 900px)',
  mobile: '(prefers-reduced-motion: no-preference) and (max-width: 899px)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;

export interface MediaDeps {
  root?: HTMLElement;
  /** Szene (einmalig) starten und einblenden; false, wenn sie nicht verfügbar ist (kein WebGL, Fehler). */
  showScene(): Awaitable<boolean>;
  /** Szene anhalten und ausblenden (html.scene-on weg); ohne gestartete Szene ein No-op. */
  hideScene(): void;
  /** State auf Ruhewerte (lid 0, explode 0, cam 0, screen -1, focus null) */
  resetState(): void;
  /** Intro starten; liefert die Aufräumfunktion */
  playIntro(): Awaitable<() => void>;
  createSmooth(): Awaitable<{ destroy(): void; scrollTo(y: number, opts?: { immediate?: boolean }): void }>;
  createTimeline(opts: { mobile: boolean; scrollTo: (y: number, immediate?: boolean) => void }): Awaitable<{ kill(): void }>;
  createDirectory(): Awaitable<{ kill(): void }>;
}

export interface Media {
  /** baut alle Fälle ab (Seite wieder im Ruhezustand) */
  dispose(): void;
}

export function initMedia(deps: MediaDeps): Media {
  const root = deps.root ?? document.documentElement;
  const mm = gsap.matchMedia();

  /** Desktop und Handy: Szene + Choreografie. Gibt die Aufräumfunktion zurück. */
  const interactive = (mobile: boolean): (() => void) => {
    let dead = false;
    const undo: Array<() => void> = [];
    /** merkt Aufräumer; ist der Fall schon vorbei, läuft er sofort */
    const own = (fn: () => void): void => {
      if (dead) fn();
      else undo.push(fn);
    };

    void (async () => {
      try {
        // Intro parallel zum Szenenstart (wie bisher)
        void Promise.resolve(deps.playIntro()).then(own, () => root.classList.remove('intro'));
        const ok = await deps.showScene();
        if (dead) return;
        if (!ok) {
          root.classList.remove('intro');
          return;
        }
        const smooth = await deps.createSmooth();
        own(() => smooth.destroy());
        if (dead) return;
        const timeline = await deps.createTimeline({
          mobile,
          scrollTo: (y, immediate) => smooth.scrollTo(y, immediate ? { immediate: true } : undefined),
        });
        own(() => timeline.kill());
        if (dead) return;
        if (!mobile) {
          const dir = await deps.createDirectory();
          own(() => dir.kill());
        }
      } catch (err) {
        console.warn('Scroll-Choreografie nicht verfügbar:', err);
        root.classList.remove('choreo', 'intro');
      }
    })();

    return () => {
      dead = true;
      while (undo.length) undo.pop()?.();
      root.classList.remove('choreo', 'intro');
      deps.resetState();
    };
  };

  mm.add(QUERIES, (context) => {
    const c = context.conditions as Record<keyof typeof QUERIES, boolean>;
    if (c.reduced) {
      root.classList.add('reduced');
      root.classList.remove('intro', 'choreo');
      deps.hideScene();
      deps.resetState();
      return () => root.classList.remove('reduced');
    }
    root.classList.remove('reduced');
    return interactive(!!c.mobile);
  });

  return { dispose: () => mm.revert() };
}
