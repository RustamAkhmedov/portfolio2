/*
 * Projektverzeichnis (T035): Hover/Fokus auf eine Zeile `[data-project]` in `#projekte-alle` zeigt deren
 * Screenshot auf dem Display. Der Laptop bleibt sichtbar (Kamera steht nach dem Pin auf `projekte`, cam 2),
 * es gibt keine eigene Scroll-Strecke.
 *
 * Die Timeline schreibt `screen` bei jedem Scroll-Schritt (nach dem Pin: letzter Schritt). Damit sie nicht
 * gegen den Hover kämpft, hält dieses Modul den Hover-Wert per onChange-Abo, solange die Zeile Hover/Fokus
 * hat, und stellt beim Verlassen den vorherigen Wert wieder her. Aktiv nur mit 3D, nach dem Pin
 * (cam ≈ projekte) und solange das Verzeichnis im Viewport steht. kill() räumt alles ab (T040: matchMedia).
 */
import type { SceneState } from '../scene/state';

export interface DirectoryDeps {
  /** Wurzel mit den `[data-project]`-Zeilen (Standard: #projekte-alle) */
  root?: HTMLElement | null;
  /** Projektname → Display-Index (screen.ts: screenIndexOf); < 0 = unbekannt */
  indexOf: (name: string) => number;
  setState: (patch: Partial<SceneState>) => void;
  /** lesender Zugriff auf den Szenenzustand */
  state: Readonly<SceneState>;
  onChange: (fn: (s: Readonly<SceneState>) => void) => () => void;
  /** 3D aktiv und Kamera auf Projekte-Rahmung (Standard: cam >= MIN_CAM) */
  isActive?: () => boolean;
  /** Test-Hook: Sichtbarkeit des Verzeichnisses (Standard: IntersectionObserver) */
  inView?: () => boolean;
}

/** ab dieser Kamerastellung (Keyframe `projekte` = 2, mit Toleranz) darf der Hover das Display setzen */
export const MIN_CAM = 1.9;

export interface Directory {
  kill(): void;
}

/** Display-Index für einen Zeilennamen, oder null (unbekannt/ohne Namen). */
export function hoverIndex(name: string | undefined | null, indexOf: (n: string) => number): number | null {
  if (!name) return null;
  const i = indexOf(name);
  return Number.isInteger(i) && i >= 0 ? i : null;
}

export function createDirectory(deps: DirectoryDeps): Directory {
  const root = deps.root ?? document.getElementById('projekte-alle');
  if (!root) return { kill() {} };
  const { setState, state } = deps;
  const isActive = deps.isActive ?? (() => state.cam >= MIN_CAM);

  let visible = false;
  let io: IntersectionObserver | null = null;
  if (deps.inView === undefined && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (!visible) release();
    });
    io.observe(root);
  }
  const inView = deps.inView ?? (() => (io ? visible : true));

  let hold: number | null = null;
  let before = 0;

  function engage(row: HTMLElement): void {
    if (!isActive() || !inView()) return;
    const i = hoverIndex(row.dataset.project, deps.indexOf);
    if (i === null) return;
    if (hold === null) before = state.screen;
    hold = i;
    setState({ screen: i, focus: 'lid' });
  }
  function release(): void {
    if (hold === null) return;
    hold = null;
    setState({ screen: before });
  }

  const rowOf = (t: EventTarget | null): HTMLElement | null =>
    (t as Element | null)?.closest?.<HTMLElement>('[data-project]') ?? null;
  const onEnter = (e: Event): void => {
    const row = rowOf(e.target);
    if (row) engage(row);
  };
  const onLeave = (e: Event): void => {
    const row = rowOf(e.target);
    const to = (e as FocusEvent | PointerEvent).relatedTarget as Node | null;
    if (row && to && row.contains(to)) return; // innerhalb derselben Zeile
    if (!row || hold !== null) release();
  };
  root.addEventListener('pointerover', onEnter);
  root.addEventListener('pointerout', onLeave);
  root.addEventListener('focusin', onEnter);
  root.addEventListener('focusout', onLeave);

  // Die Timeline schreibt screen bei jedem Scroll-Schritt: Hover-Wert halten
  const off = deps.onChange((s) => {
    if (hold !== null && s.screen !== hold) setState({ screen: hold });
  });

  return {
    kill() {
      root.removeEventListener('pointerover', onEnter);
      root.removeEventListener('pointerout', onLeave);
      root.removeEventListener('focusin', onEnter);
      root.removeEventListener('focusout', onLeave);
      off();
      io?.disconnect();
      release();
    },
  };
}
