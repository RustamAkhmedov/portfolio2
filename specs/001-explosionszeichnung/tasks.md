---
description: "Aufgabenliste für Feature 001 – Portfolio „Explosionszeichnung“"
---

# Tasks: Portfolio „Explosionszeichnung“

**Input**: `specs/001-explosionszeichnung/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: Constitution v1.0.0 (`.specify/memory/constitution.md`)

**Tests**: verpflichtend laut Constitution V (Vitest + Firefox-Screenshots, nie Chromium).

**Referenzen**: Laptop-Maße und Fotos in `docs/referenz/laptop/` (© ASUS, nur Vorlage).
v1-Quelle: `~/Projects/portfolio/` (nur lesen, nichts dort ändern).

## Format: `[ID] [P?] [Story] Beschreibung`

- **[P]**: parallel möglich (andere Dateien, keine offenen Abhängigkeiten)
- **[Story]**: US1 … US4 aus spec.md

---

## Phase 1: Setup

**Zweck**: Gerüst, Abhängigkeiten, Render-Pipeline, Inhalte aus v1. Danach laufen `npm run dev` und `npm test`.

- [ ] T001 Vite + TypeScript-Gerüst von Hand anlegen (kein `create-vite`-Template, um Beispielcode zu vermeiden): `package.json` (`"type": "module"`, Skripte `dev`, `build`, `preview`, `test`, `shots`, `still`), `tsconfig.json` (strict, `moduleResolution: bundler`), `vite.config.ts` (`base: './'`, Multi-Page-Input `index.html` + `en/index.html`), `.gitignore` um `index.html`, `en/`, `test-results/` ergänzen
- [ ] T002 Abhängigkeiten nur im Projekt installieren: `npm i three gsap lenis` und `npm i -D vite typescript vitest jsdom @types/three`; Versionen in `package.json` festhalten
- [ ] T003 v1-Template-Engine nach `tools/render.mjs` portieren (Quelle `~/Projects/portfolio/tools/build.mjs`): liest `src/page.html`, `src/sections/*.html`, `src/content/*.json`, schreibt `index.html` (de) und `en/index.html` (en), `--check`-Modus; `@`-Variablen aus `src/content/site.json` (`@lang`, `@altUrl`, `@base`, …); Pfade für `en/` mit `../`-Präfix
- [ ] T004 `tools/vite-plugin-pages.mjs`: ruft `render.mjs` in `buildStart` und bei Änderungen an `src/page.html|sections|content` im Dev-Server (danach Full Reload); in `vite.config.ts` einbinden
- [ ] T005 `tools/import-v1.mjs` schreiben und einmal ausführen: übernimmt aus v1 die Texte (`about.*`, `contact.*`, `info.*`, `skills`, `meta.*`, `cv.*`) nach `src/content/strings.json`, die 6 Projekte gen_Ut, fretlearn, Weitland, NSCS, OnlineIDE, DrawingTool (aus `projects.json` + `demos.json`) nach `src/content/projects.json`, Screenshots als WebP (≤ 1280 px breit) nach `public/img/projects/`, Lebensläufe nach `public/cv/`, Porträt nach `public/img/`; danach von Hand prüfen und kürzen
- [ ] T006 [P] `tools/ffbrowser.mjs` nach dem Muster von `~/.claude/skills/teardown/ff/ffbrowser.mjs` anlegen (System-Firefox headless, WebDriver BiDi: launch, goto, setViewport, evaluate, screenshot, Konsolen-/Seitenfehler sammeln)
- [ ] T007 [P] Vitest-Konfiguration (`vitest.config.ts`, Umgebung `node`, jsdom pro Datei wo nötig) und ein Smoke-Test, damit `npm test` läuft

**Checkpoint**: `npm run dev` zeigt eine (noch leere) de- und en-Seite, `npm test` ist grün.

---

## Phase 2: Fundament (blockiert alle User Stories)

**Zweck**: Designplan, Tokens, Inhaltsdaten mit Tests und die komplette statische Seite ohne 3D.
Sie ist zugleich der Fallback (Constitution I).

- [ ] T010 **Designplan mit Skill `frontend-design`** (vorher `/frontend-design` aufrufen) nach `docs/design.md`: Papier-Datenblatt-Look konkretisieren (Papierton, Linienstärken, Raster, Zeichnungskopf/Schriftfeld, Teilenummern-Stil, Orange-Ton), Schriftpaar wählen (Grotesk + technische Mono, selbst gehostet), Typo-Skala, Abstände, Bewegungs-Timings, Gehäuseton des Laptops (Rustams Gerät ist Neutral Black → dunkles mattes Anthrazit; Kantenlinien müssen darauf lesbar bleiben), AI-Slop-Liste abhaken; **Rustam abnehmen lassen, bevor T011 startet**
- [ ] T011 Tokens aus dem Designplan in `src/styles/tokens.css`; Schriften via `@fontsource/<name>` installieren oder WOFF2 nach `public/fonts/`
- [ ] T012 [P] `src/content/parts.json` mit P-01…P-08 nach `data-model.md` (Namen/Specs de+en aus `docs/referenz/laptop/README.md`, Explosionsrichtungen grob: Deckel nach hinten-oben, Tastatur nach oben, Board/Akku/SSD gestaffelt nach oben, Lüfter seitlich, Bodenplatte nach unten, Anschlüsse seitlich)
- [ ] T013 [P] `src/content/contact.json` (E-Mail, GitHub, Lebenslauf … je ein Anschluss) und `src/content/site.json` (Sprachen, Basis-URL, Link zu v1 `https://rustamakhmedov.github.io/portfolio/`)
- [ ] T014 [P] `tests/content.test.ts` nach `contracts/content.md` (Regeln 1–6)
- [ ] T015 `src/page.html` (Gerüst, Meta/og, hreflang, Inline-Skript im `<head>` setzt `html.js`, `html.reduced`, `html.no-webgl` vor dem ersten Paint) und Abschnitte `src/sections/{hero,bom,projekte,skills,ueber,lebenslauf,kontakt,outro,labels}.html` mit allen Hooks aus `contracts/dom.md`
- [ ] T016 Statische Gestaltung: `src/styles/{base,layout,sections}.css` – die Seite muss ohne JS komplett und schön sein (Zeichnungskopf, Stückliste als Tabelle, Projekt-Datenblätter, Schriftfeld); `#scene-fallback` zeigt vorerst einen Platzhalter
- [ ] T017 [P] `tests/render.test.ts`: beide Seiten rendern, gleiche Struktur, keine `{{`-Reste, alle Hooks aus `contracts/dom.md` vorhanden, alle internen Links/Assets existieren
- [ ] T018 `tools/shot.mjs`: `vite build` + `vite preview` starten, mit `ffbrowser.mjs` jede Abschnitts-ID bei 1440×900 und 390×844 anspringen, PNGs nach `test-results/shots/<lang>/<id>@<w>.png`, Exit 1 bei Konsolenfehlern; `npm run shots`

**Checkpoint**: Statische Seite de/en vollständig, `npm test` und `npm run shots` grün. Screenshots mit Rustam anschauen.

---

## Phase 3: User Story 1 – Erster Eindruck und Projekte (P1) 🎯 MVP

**Ziel**: Laptop klappt auf, zerlegt sich, Labels + Stückliste, Projekte laufen über das Display.
**Unabhängiger Test**: quickstart.md Szenarien 1–3 und 10.

### Tests zuerst

- [ ] T020 [P] [US1] `tests/explode.test.ts`: `pose(part, state)` – bei `explode=0` Ausgangslage, bei 1 Ausgangslage + `dir·dist`, monoton, Teile mit kleinerem `order` starten früher, Werte außerhalb 0…1 werden geklemmt
- [ ] T021 [P] [US1] `tests/camera-path.test.ts`: Keyframes je Abschnitt, Interpolation stetig, Index wird an den Rändern geklemmt

### Umsetzung

- [ ] T022 [US1] `src/scene/state.ts`: `SceneState` + `setState()` (einziger Schreibweg, markiert `needsRender`)
- [ ] T023 [US1] `src/scene/renderer.ts`: WebGLRenderer (DPR-Deckel 1,5 / Handy 2), Kamera, 2 Lichter, render on demand, Pause per `IntersectionObserver` + `visibilitychange`, Resize; `window.__v2`-Hook laut `contracts/dom.md`
- [ ] T024 [P] [US1] `src/scene/materials.ts`: Papier-, Gehäuse-, Ghost- und Fokus-Material (Orange aus Tokens per CSS-Variable gelesen), `addEdges(mesh)` für Kantenlinien
- [ ] T025 [US1] `src/scene/laptop/dims.ts` + Teile `base.ts` (Keil 13,9→15,9 mm, 353,6×246,9 mm, abgerundete Ecken), `lid.ts` (Deckel + Display-Fläche 16:9, Kamera-Bucht, Scharnierachse hinten), `keyboard.ts` (InstancedMesh mit Numpad, Touchpad), `board.ts` (Platine, CPU, RAM-Chips), `battery.ts` (4 Zellen), `ssd.ts` (M.2 2280), `fans.ts` (2 Lüfter + Heatpipes), `ports.ts` (links HDMI, 2× TB4, microSD, Klinke; rechts 2× USB-A), `index.ts` (Teile nach `parts.json`-`key` zusammenbauen); Abgleich mit Fotos `docs/referenz/laptop/04-schraeg-rechts.png`, `06`/`07` (Seiten)
- [ ] T026 [US1] `src/scene/explode.ts` (reine Funktion, macht T020 grün) und Anbindung an die Teile
- [ ] T027 [US1] `src/scene/camera-path.ts` (macht T021 grün): Hero-Ansicht 3/4 von vorne rechts, Totale für Explosion, je ein Keyframe pro Teil-Abschnitt
- [ ] T028 [US1] `src/scene/labels.ts` + `src/styles/labels.css`: Anker projizieren, `.label[data-part]` positionieren, SVG-Linien, Labels außerhalb des Bildes ausblenden, nur `transform`/`opacity` animieren
- [ ] T029 [US1] `src/choreo/smooth.ts`: Lenis ↔ ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker`-Kopplung, `lagSmoothing(0)`)
- [ ] T030 [US1] `src/choreo/timeline.ts`: Master-Timeline mit Scrub; Hero pinnen → `lid` 0→1 → `explode` 0→1 → Stückliste blendet ein → `#projekte` gepinnt, je `[data-step]` ein Label, `screen` zählt hoch; Name/Zeile im Hero mit SplitText einblenden
- [ ] T031 [US1] `src/scene/screen.ts`: Projekt-Screenshots als Texturen laden (lazy, erst ab Explosion), Überblendung über `screen`, neutrale Fläche + Name, falls Bild fehlt
- [ ] T032 [US1] `src/main.ts`: Feature-Erkennung, dynamischer Import von `scene` + `choreo` nur bei WebGL + keine reduzierte Bewegung, Canvas einblenden, sobald das erste Bild gerendert ist
- [ ] T033 [US1] `?state=` und `?still` laut `contracts/dom.md` umsetzen; Screenshots von Explosion 0 / 0,5 / 1 mit `npm run shots` prüfen und mit Fotos vergleichen, nachbessern
- [ ] T034 [US1] Performance-Check auf dem Laptop in normalem Firefox: `window.__v2.fps()` beim Durchscrollen ≥ 55; sonst Kantenlinien zusammenführen, DPR senken, Geometrie vereinfachen

**Checkpoint**: MVP – Hero, Explosion, Stückliste, Projekte funktionieren auf Desktop.

---

## Phase 4: User Story 4 – Ruhig, ohne 3D, auf dem Handy (P1)

**Ziel**: Seite bleibt mit reduzierter Bewegung, ohne WebGL, ohne JS und auf 390 px voll nutzbar.
**Unabhängiger Test**: quickstart.md Szenarien 7–9 und 390-px-Screenshots.

- [ ] T040 [US4] `src/choreo/media.ts`: `gsap.matchMedia()` mit desktop / mobile / reduced; `timeline.ts` und `smooth.ts` darin anlegen, damit beim Umschalten aufgeräumt wird
- [ ] T041 [US4] Mobil-Choreografie: kürzere Pin-Strecken, kleinere Explosion (`dist`-Faktor), Datenblätter unter dem Modell, Labels nur für das aktive Teil
- [ ] T042 [US4] `npm run still` (`tools/shot.mjs --still`): Seite mit `?still` bei 1600×1000 rendern, Hintergrund transparent → `public/img/explosion-still.webp`; `#scene-fallback` nutzt es (`<picture>`, `width`/`height` gesetzt)
- [ ] T043 [P] [US4] `src/styles/reduced.css`: `html.reduced` und `html.no-webgl` → Standbild sichtbar, Abschnitte normal untereinander, keine `position: sticky`-Tricks
- [ ] T044 [US4] Prüfen mit Firefox-Prefs (`ui.prefersReducedMotion=1`, `webgl.disabled=true`, `javascript.enabled=false`): `tools/shot.mjs` um `--pref key=value` erweitern und je einen Durchlauf speichern

**Checkpoint**: Alle drei Ersatzmodi und 390 px sind sauber.

---

## Phase 5: User Story 2 – Restliche Abschnitte und Kontakt (P2)

**Ziel**: Fokusfahrten zu P-02…P-05, Inhalte, Outro.
**Unabhängiger Test**: quickstart.md Szenarien 4–5.

- [ ] T050 [US2] Timeline-Abschnitte für `#skills` (Board orange, Chips beschriftet mit `skills` aus den Strings, als Labels im Overlay), `#ueber` (Akku), `#lebenslauf` (SSD), `#kontakt` (Anschlüsse; je Kanal ein Label am passenden Port laut `contact.json`)
- [ ] T051 [US2] Ghost/Fokus-Überblendung über `focus` + `focusMix` in `materials.ts`/`index.ts`
- [ ] T052 [US2] Outro: `explode` 1→0, `lid` 1→0, Kamera zurück in die Hero-Ansicht; Schriftfeld mit Kontakt, Sprachwahl, Link zu v1
- [ ] T053 [US2] Stückliste: Zeilen verlinken auf die Abschnitte; Anker-Sprung per Lenis `scrollTo` (bei reduced: nativ)
- [ ] T054 [US2] Fokus-Sichtbarkeit: Fokus in gepinnten Abschnitten scrollt das Element sichtbar, `:focus-visible`-Stil aus Tokens; Kontraste prüfen (WCAG AA)

**Checkpoint**: Ganze Seite von oben bis unten auf Deutsch fertig.

---

## Phase 6: User Story 3 – Zwei Sprachen (P3)

**Ziel**: Englische Seite gleichwertig, Umschalter landet an derselben Stelle.
**Unabhängiger Test**: quickstart.md Szenario 6.

- [ ] T060 [US3] Alle englischen Texte prüfen und glätten (`strings.json`, `parts.json`, `projects.json`, `contact.json`); englischer Lebenslauf `public/cv/resume.pdf`
- [ ] T061 [US3] Sprachumschalter `a[data-lang-switch]` hängt den aktuellen Abschnitts-Anker an; nach dem Laden setzt die Timeline den Zustand passend zum Anker
- [ ] T062 [P] [US3] `tests/render.test.ts` erweitern: en-Seite hat `lang="en"`, alle `href`/`src` funktionieren aus `en/` heraus

**Checkpoint**: de und en gleichwertig.

---

## Phase 7: Feinschliff & Abnahme

- [ ] T070 Bundle-Budget prüfen (`vite build` → JS gzip ≤ 350 KB); three nur über benannte Importe
- [ ] T071 [P] Lighthouse-ähnliche Messung ohne Chromium: in normalem Firefox Netzwerk „Fast 4G“, LCP/bedienbar laut SC-003 messen und in `docs/messungen.md` notieren
- [ ] T072 [P] `README.md` aktualisieren (Befehle, Aufbau, Regeln) und `AGENTS.md` + `CLAUDE.md` (`@AGENTS.md`) wie in v1 anlegen
- [ ] T073 Alle quickstart.md-Szenarien durchgehen, Screenshots mit Rustam anschauen, Korrekturen
- [ ] T074 Rustam fragen: Commit? GitHub-Repo/Pages? (Constitution: nur nach OK)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → (Phase 3 ∥ Phase 4 teilweise) → Phase 5 → Phase 6 → Phase 7
- **T010 (Designplan) blockiert alles Gestalterische** (T011, T016, T024, T028)
- US4 hängt an US1 (T032, T033) für Standbild und `matchMedia`, kann aber T043 schon ab Phase 2 machen
- US2 braucht die Timeline aus US1 (T030); US3 braucht nur Phase 2 und kann jederzeit danach

### Parallel-Beispiele

- Phase 1: T006 und T007 neben T003–T005
- Phase 2: T012, T013, T014, T017 gleichzeitig nach T011
- US1: T020, T021, T024 gleichzeitig; danach T025 (größter Brocken) vor T026–T028

## Implementation Strategy

1. **MVP** = Phase 1 + 2 + 3: Hero, Explosion, Projekte. Schon als Link verschickbar, sobald Phase 4
   (Ersatzmodi) auch fertig ist. Das ist die Mindestgrenze laut Constitution I.
2. Danach US2 (Rest + Kontakt), US3 (Englisch), Feinschliff.
3. Nach jeder Phase: `npm run build && npm test && npm run shots`, Screenshots anschauen, Rustam zeigen.
4. Ausführen mit `/speckit-implement` (arbeitet die Liste ab) oder phasenweise per Hand. Nach jeder
   Phase Haken setzen.
