# portfolio_v2

Portfolio „Explosionszeichnung“: ein stilisierter 3D-Laptop (three.js) zerlegt sich beim Scrollen,
und jedes Teil führt zu einem Abschnitt. Deutsch und Englisch, statisch gebaut mit Vite.
Alternative zu meinem Portfolio `rustam.os` (`~/Projects/portfolio`, nur lesend genutzt).

Ohne WebGL, ohne JavaScript oder mit reduzierter Bewegung gibt es dieselben Inhalte als normale Seite mit Standbild.

Nur lokales git, kein GitHub-Repo, kein Deployment.

## Voraussetzungen

- Node.js ≥ 22 (laut `specs/001-explosionszeichnung/quickstart.md`; lokal getestet mit 24.x), npm
- Firefox als System-Browser für Screenshots und Messungen (`/usr/bin/firefox`). Chrome/Chromium nicht verwenden.

## Befehle

Einmalig `npm install` (Abhängigkeiten nur im Projekt).

| Befehl | Wofür |
|---|---|
| `npm run dev` | Dev-Server, `http://localhost:5173/` (de) und `/en/` (en) |
| `npm run build` | Typprüfung (`tsc --noEmit`), Seiten rendern, Produktions-Build nach `dist/` |
| `npm run preview` | Den Build aus `dist/` lokal ausliefern |
| `npm test` | Vitest: Inhalte und Übersetzungen, Explosionsmathematik, Kamerapfad, Seiten-Render |
| `npm run shots` | Build, Vorschau und Firefox-Screenshots aller Abschnitte (1440 + 390 px) nach `test-results/shots/` |
| `npm run shots:modes` | Screenshots für reduzierte Bewegung, ohne WebGL und ohne JS |
| `npm run still` | Standbild `public/img/explosion-still.webp` neu erzeugen |
| `npm run scroll-shots` | Screenshots der Scroll-Stationen plus Bildrate (nur Richtwert) |
| `npm run perf` | Szene-Messung in Firefox (fps, Draw-Calls, Dreiecke, JS-Zeit), Ergebnisse in `docs/messungen.md` |
| `npm run brand` | Favicon-PNGs und Link-Vorschau `public/img/og-card.png` (1200×630) mit Firefox neu erzeugen (Quelle: `public/favicon.svg` und die Szene) |
| `npm run bundle` | JS-Budget prüfen: Startseite ≤ 350 KB gzip (nach `npm run build`, Exit 1 bei Überschreitung) |

## Ordnerstruktur

```text
src/
  page.html            Gerüst der Seite (Reihenfolge der Abschnitte)
  sections/            ein Abschnitt pro Datei: hero, bom, projekte, skills, ueber, lebenslauf, kontakt, outro, labels
  content/             alle Texte und Daten: strings.json, parts.json, projects.json, contact.json, site.json
  styles/              tokens.css (Farben, Schriften, Abstände, Timings), base, layout, sections, labels, reduced
  scene/               three.js: Zustand (state.ts), Renderer, Laptop-Teile (laptop/), Explosion, Kamerapfad, Labels
  choreo/              Scroll-Choreografie: Lenis, ScrollTrigger-Timeline, Abschnitte, Sprache, Medien
  main.ts              Einstieg: Feature-Erkennung, lädt Szene und Choreografie nur wenn erlaubt
public/                Bilder (img/), Lebensläufe (cv/)
tools/                 Render-Engine, Vite-Plugin, Firefox-Shim (ffbrowser.mjs), Screenshot- und Messwerkzeuge
tests/                 Vitest-Tests (Inhalte, Explosion, Kamera, Choreografie, Seiten-Render)
docs/                  design.md (Designplan), messungen.md (Messwerte), ideen.md, referenz/ (nur lokal, gitignored)
specs/                 Spec Kit: spec, plan, research, data-model, contracts/, quickstart, tasks
.specify/              Spec-Kit-Vorlagen und Constitution (Projektregeln)
```

## Inhalte ändern

Alle Texte stehen in `src/content/*.json`. Jeder Wert hat `{ "de": …, "en": … }` nebeneinander. Eine fehlende
Übersetzung bricht den Build ab. Die Seiten selbst (`src/sections/*.html`) enthalten nur Markup und
Platzhalter wie `{{key}}`.

## Wie Seiten gebaut werden

`index.html` (de) und `en/index.html` (en) entstehen aus `src/page.html`, `src/sections/` und `src/content/`
per `tools/render.mjs`. Das Vite-Plugin `tools/vite-plugin-pages.mjs` ruft das vor dem Build und bei Änderungen
im Dev-Server auf. Beide Dateien sind generiert und in `.gitignore` eingetragen: nie von Hand bearbeiten.
`node tools/render.mjs --check` meldet, ob sie veraltet sind.

## Prüfen

- `npm test` und `npm run build` müssen grün sein, bevor etwas committet wird.
- Optisch nur in Firefox (`npm run shots`, `npm run scroll-shots`, `npm run perf`). Die Werkzeuge
  starten Firefox über `tools/ffbrowser.mjs` mit WebDriver BiDi.
- Messwerte und Grenzen: `docs/messungen.md`. Designentscheidungen: `docs/design.md`.

## Regeln

Verbindlich ist `.specify/memory/constitution.md`. Kurzfassung:

- Inhalt zuerst: Alles Wichtige steht als HTML im Dokument. Das 3D-Bild ist Dekoration.
- Eine Quelle, zwei Sprachen: Texte nur in `src/content/`, de und en gemeinsam pflegen.
- Leicht für die iGPU: JavaScript der Startseite ≤ 350 KB gzip, Pixelratio ≤ 1,5, rendern nur bei Bewegung.
- Gestaltung nur über Design-Tokens in `src/styles/tokens.css`. Keine Verläufe, keine Emoji als Icons.
- Optisch nur mit Firefox testen, nie headless Chrome oder Chromium.
- Keine Fremd-CDNs. Schriften (Archivo, Martian Mono) sind über `@fontsource-variable` selbst gehostet.
- Fotos vom ASUS-Laptop (`docs/referenz/laptop/`, © ASUS) sind nur lokale Vorlage: nie in den Build, kein ASUS-Branding.
- Libraries nur im Projekt installieren, nie global.
- v1 (`~/Projects/portfolio`) nur lesen, dort nichts ändern.
- Kein Push, kein Deployment ohne ausdrückliches OK von Rustam. Commits erst nach Freigabe.

## Spec Kit

Die Umsetzung läuft über `specs/001-explosionszeichnung/`:

1. `spec.md` (was), `plan.md` (Aufbau), `tasks.md` (Aufgaben in Phasen, mit `[H]`/`[S]`/`[O]` für die Modellwahl).
2. Mit Claude Code: „implement phase x“ erledigt genau die Aufgaben von Phase x, prüft den Checkpoint und
   wartet dann auf die Freigabe. Die Modell-Regeln stehen in `CLAUDE.md`, Hinweise für Agenten in `AGENTS.md`.
