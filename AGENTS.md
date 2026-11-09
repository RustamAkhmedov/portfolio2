# portfolio_v2 – Anleitung für KI-Agenten

Portfolio „Explosionszeichnung“: stilisierter three.js-Laptop, der sich beim Scrollen zerlegt, jedes Teil führt
zu einem Abschnitt. Deutsch + Englisch aus einem Markup, statisch mit Vite, TypeScript, GSAP + ScrollTrigger, Lenis.
Projektregeln: `.specify/memory/constitution.md` – **vor größeren Änderungen lesen.**
Feature-Doku: `specs/001-explosionszeichnung/` (spec, plan, data-model, contracts/, quickstart, tasks).

## Befehle

```bash
npm install            # einmalig, nur im Projekt
npm run dev            # Dev-Server, http://localhost:5173/ (de) und /en/ (en); setzt window.__v2
npm run build          # tsc --noEmit + Seiten rendern + vite build nach dist/
npm test               # Vitest (Inhalte, Explosion, Kamera, Choreografie, Seiten-Render)
npm run shots          # build + preview + Firefox-Screenshots → test-results/shots/
npm run shots:modes    # reduziert / ohne WebGL / ohne JS
npm run still          # Standbild public/img/explosion-still.webp neu erzeugen
npm run scroll-shots   # Stationen der Choreografie, Bildrate (nur Richtwert)
npm run perf           # Messung in Firefox → docs/messungen.md
npm run shots:demo     # Live-Demo: Zoom, Schließen, Fokus, Tastatur, Ruhe=0 Draw-Calls (Firefox, Dev-Server) → test-results/shots/demo/
npm run brand          # Favicon-PNGs + Link-Vorschau public/img/og-card.png neu erzeugen (Firefox)
npm run bundle         # JS-Budget der Startseite ≤ 350 KB gzip (nach npm run build)
```

**Fertig ist eine Änderung erst, wenn `npm run build && npm test` grün ist.** Optische Änderungen zusätzlich mit `npm run shots`.

## Die wichtigste Regel

`index.html` und `en/index.html` sind **erzeugt** (`tools/render.mjs`, gitignored). Nie direkt bearbeiten.
Bearbeitet wird `src/` (`page.html`, `sections/`, `content/`), danach Build oder Dev-Server. `node tools/render.mjs --check` prüft, ob sie veraltet sind.

## Architektur (Kurzfassung)

```text
src/page.html          Gerüst, Reihenfolge der Abschnitte ({{> name}})
src/sections/*.html    Markup je Abschnitt (hero, bom, projekte, skills, ueber, lebenslauf, kontakt, outro, labels)
src/content/*.json     alle Texte und Daten, je Wert { "de", "en" }
src/styles/tokens.css  einzige Quelle für Farben, Schriften, Abstände, Timings
src/scene/             three.js: state.ts (SceneState + setState), renderer, laptop/, explode, camera-path, labels, screen
src/choreo/            Lenis, ScrollTrigger, Master-Timeline (timeline.ts, master.ts), score.ts, lang, directory, media
src/main.ts            Einstieg: Feature-Erkennung, lädt scene/choreo nur wenn erlaubt
```

- **Die Szene kennt keine Texte.** Texte kommen nur aus dem DOM (Markup und Labels), nicht aus `src/scene/`.
- **Die Choreografie schreibt nur SceneState.** Sie kennt keine Geometrie-Details, die Szene keine Scroll-Logik.
- **Zustandsobjekt nur über `setState`** (`src/scene/state.ts`). Direktes Schreiben an `state` ist verboten.
- Render on demand: Ruhe = 0 Render-Aufrufe (siehe `docs/messungen.md`).

## Hooks und Verträge

- `specs/001-explosionszeichnung/contracts/dom.md`: DOM-Hooks (`[data-step]`, `.proj-pin`, `#projekte-alle`, `[data-project]`,
  `#scene`, `#labels`, `html.*`-Klassen, Seiten-Parameter, `window.__v2`). Umbenennen nur zusammen mit Code und Tests.
- `specs/001-explosionszeichnung/contracts/content.md`: Regeln für `src/content/` (vollständige Übersetzungen, 13 Projekte mit 6 gepinnten,
  Teile P-01…P-08, PDFs je Sprache). `tests/content.test.ts` prüft das.
- `specs/001-explosionszeichnung/data-model.md`: Felder der Inhaltsdateien und SceneState.

## Regeln aus der Constitution

- **Inhalt zuerst:** Alle Inhalte sind ohne WebGL, ohne JS und mit `prefers-reduced-motion` lesbar. Scroll-Animationen
  verstecken Inhalte nie länger als einen Bildschirm. Fokus-Reihenfolge und WCAG AA gelten auch in gepinnten Abschnitten.
- **Eine Quelle, zwei Sprachen:** Eine fehlende Übersetzung bricht den Build ab. Nichts in der Seite erfinden oder aufblähen;
  neue persönliche Angaben nur nach Rücksprache mit Rustam.
- **Leicht für die iGPU:** Geometrie prozedural, keine großen Texturen, Pixelratio ≤ 1,5, Rendern nur bei Bewegung,
  JS der Startseite ≤ 350 KB gzip (aktuell gemessen: 219 KB, siehe `docs/messungen.md`).
- **Eigene Gestaltung:** Look „Papier-Datenblatt“ laut `docs/design.md`. Werte nur über Tokens. Kein Lila-Verlauf,
  keine Glas-Karten, keine Emoji als Icons. Logos, Schriftzüge und Fotos von ASUS nie auf die Seite.
- **Prüfbar, nur Firefox:** Optische Kontrolle nur mit Firefox (`tools/ffbrowser.mjs`), nie headless Chrome/Chromium.
- **Keine Fremd-CDNs;** Schriften über `@fontsource-variable` selbst gehostet.
- **Nur lokal:** kein Push, kein Deployment, kein GitHub-Repo ohne ausdrückliches OK von Rustam. Commits nur auf Nachfrage.
- **v1** (`~/Projects/portfolio`) nur lesen, nie verändern.
- **ASUS-Fotos** aus `docs/referenz/` nie in den Build (gitignored).

## Bekannte Fallen

- **Pin-Spacer + Lenis:** Gepinnte Abschnitte haben Pin-Spacer. Ihr DOM-Abstand ist nicht die Scroll-Position.
  Für Anker und Sprachwechsel die Marken nutzen (`anchorY`/`marks` in `src/choreo/score.ts`, `src/choreo/lang.ts`), nie `offsetTop`.
- **`ScrollTrigger.refresh`:** Nach Schriften-Laden (`document.fonts.ready`) und `load` neu berechnen, sonst stimmen die Marken.
  Der Aufruf sitzt in `src/choreo/timeline.ts`.
- **Headless Firefox hat keinen Fokus:** `document.hasFocus()` ist falsch, Firefox schickt dann kein `focusin`. Fokus-Tests
  laufen deshalb über `tools/focus-shot.mjs` mit `focusmanager.testmode`. Den Fokusring nie nur über Screenshots prüfen.
- **`?state` und `?still` schalten die Choreografie ab:** kein Lenis, keine Timeline, Szene auf festem Zustand (`src/main.ts`).
  Für Screenshots einzelner Zustände nutzen, nicht zum Testen des Scrollens.
- **`window.__v2`** existiert nur im Dev-Modus oder mit `?still`/`?state` (`src/scene/renderer.ts`). Im Produktions-Build fehlt es.
  Die Messung im Build hängt deshalb ihre Hooks per Preload-Skript an (`tools/perf.mjs`).
- **Headless ist nur Richtwert** für die Bildrate. Verbindliche fps-Werte stammen aus dem normalen Firefox-Fenster (`--headed`).

## Wo steht was?

- Designplan und Tokens-Werte: `docs/design.md` (von Rustam abgenommen)
- Messwerte (fps, Draw-Calls, Bundle-Größe, Ruhe-Frames): `docs/messungen.md`
- Ideen und Entscheidungen: `docs/ideen.md`
- Technische Entscheidungen mit Begründung: `specs/001-explosionszeichnung/research.md`

## Aufgaben abarbeiten

- Aufgaben stehen in `specs/001-explosionszeichnung/tasks.md`, Markierungen `[H]` / `[S]` / `[O]` (Delegation laut `CLAUDE.md`).
- „implement phase x“ heißt: nur Phase x, Checkpoint prüfen, Haken setzen, berichten, auf Rustams OK warten. Erst danach committen.
- Abhaken in `tasks.md` macht die Haupt-Session, nicht der ausführende Agent.
- Aufgaben ohne Marke (T010, T073, T074) brauchen Rückfragen an Rustam und bleiben bei der Haupt-Session.
