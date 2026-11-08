---
description: "Aufgabenliste für Feature 001 – Portfolio „Explosionszeichnung“"
---

# Tasks: Portfolio „Explosionszeichnung“

**Input**: `specs/001-explosionszeichnung/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: Constitution v1.0.0 (`.specify/memory/constitution.md`)

**Tests**: verpflichtend laut Constitution V (Vitest + Firefox-Screenshots, nie Chromium).

**Referenzen**: Laptop-Maße und Fotos in `docs/referenz/laptop/` (© ASUS, nur Vorlage).
v1-Quelle: `~/Projects/portfolio/` (nur lesen, nichts dort ändern).

## Format: `[ID] [P?] [H|S|O] [Story] Beschreibung`

- **[P]**: parallel möglich (andere Dateien, keine offenen Abhängigkeiten)
- **[H] / [S] / [O]**: Modell-Routing laut `~/.claude/CLAUDE.md` → `umsetzer-haiku` / `umsetzer-sonnet` /
  `spezialist-opus`. Aufgaben ohne Marke (T010, T073, T074) macht die Haupt-Session selbst, weil sie Rustam fragen.
- **[Story]**: US1 … US4 aus spec.md

---

## Phase 1: Setup

**Zweck**: Gerüst, Abhängigkeiten, Render-Pipeline, Inhalte aus v1.

- [X] T001 [H] Vite + TypeScript-Gerüst von Hand anlegen (kein `create-vite`-Template, um Beispielcode zu vermeiden): `package.json` (`"type": "module"`, Skripte `dev`, `build`, `preview`, `test`, `shots`, `still`), `tsconfig.json` (strict, `moduleResolution: bundler`), `vite.config.ts` (`base: './'`, Multi-Page-Input `index.html` + `en/index.html`), `.gitignore` um `index.html`, `en/`, `test-results/` ergänzen
- [X] T002 [H] Abhängigkeiten nur im Projekt installieren: `npm i three gsap lenis` und `npm i -D vite typescript vitest jsdom @types/three`; Versionen in `package.json` festhalten
- [X] T003 [S] v1-Template-Engine nach `tools/render.mjs` portieren (Quelle `~/Projects/portfolio/tools/build.mjs`): liest `src/page.html`, `src/sections/*.html`, `src/content/*.json`, schreibt `index.html` (de) und `en/index.html` (en), `--check`-Modus; `@`-Variablen aus `src/content/site.json` (`@lang`, `@altUrl`, `@base`, …); Pfade für `en/` mit `../`-Präfix
- [X] T004 [S] `tools/vite-plugin-pages.mjs`: ruft `render.mjs` in `buildStart` und bei Änderungen an `src/page.html|sections|content` im Dev-Server (danach Full Reload); in `vite.config.ts` einbinden
- [X] T005 [S] `tools/import-v1.mjs` schreiben und einmal ausführen: übernimmt aus v1 die Texte (`about.*`, `contact.*`, `info.*`, `skills`, `meta.*`, `cv.*`) nach `src/content/strings.json`, alle 13 Projekte (aus `projects.json` + `demos.json`; `featured: true` für gen_Ut, fretlearn, Weitland, NSCS, OnlineIDE, DrawingTool; Demo-Links aus `demos.json` übernehmen; Emojis weglassen) nach `src/content/projects.json`, Screenshots als WebP (≤ 1280 px breit) nach `public/img/projects/`, Lebensläufe nach `public/cv/`, Porträt nach `public/img/`; danach von Hand prüfen und kürzen (nichts dazuerfinden). **v1 nur lesen, dort nichts ändern**
- [X] T006 [P] [S] `tools/ffbrowser.mjs` nach dem Muster von `~/.claude/skills/teardown/ff/ffbrowser.mjs` anlegen (System-Firefox headless, WebDriver BiDi: launch, goto, setViewport, evaluate, screenshot, Konsolen-/Seitenfehler sammeln)
- [X] T007 [P] [H] Vitest-Konfiguration (`vitest.config.ts`, Umgebung `node`, jsdom pro Datei wo nötig) und ein Smoke-Test, damit `npm test` läuft

**Checkpoint**: `npm run dev` zeigt eine (noch leere) de- und en-Seite, `npm test` ist grün. Danach committen und auf Rustams OK warten.

---

## Phase 2: Designplan und Inhaltsdaten

**Zweck**: Look festlegen (mit Rustam) und die Inhaltsdaten mit Tests. T012–T014 hängen nicht am Design und können parallel zu T010 laufen.

- [X] T010 **(Haupt-Session, nicht delegieren – braucht Rustam)** **Designplan mit Skill `frontend-design`** (vorher `/frontend-design` aufrufen) nach `docs/design.md`: Papier-Datenblatt-Look konkretisieren (Papierton, Linienstärken, Raster, Zeichnungskopf/Schriftfeld, Teilenummern-Stil, Orange-Ton), Schriftpaar wählen (Grotesk + technische Mono, selbst gehostet), Typo-Skala, Abstände, Bewegungs-Timings, Gehäuseton des Laptops (Rustams Gerät ist Neutral Black → dunkles mattes Anthrazit; Kantenlinien müssen darauf lesbar bleiben), AI-Slop-Liste abhaken; **Rustam abnehmen lassen, bevor T011 startet**
- [X] T012 [P] [H] `src/content/parts.json` mit P-01…P-08 nach `data-model.md` (Namen/Specs de+en aus `docs/referenz/laptop/README.md`, Explosionsrichtungen grob: Deckel nach hinten-oben, Tastatur nach oben, Board/Akku/SSD gestaffelt nach oben, Lüfter seitlich, Bodenplatte nach unten, Anschlüsse seitlich)
- [X] T013 [P] [H] `src/content/contact.json` (E-Mail, GitHub, Lebenslauf … je ein Anschluss) und `src/content/site.json` (Sprachen, Basis-URL, Link zu v1 `https://rustamakhmedov.github.io/portfolio/`)
- [X] T014 [P] [S] `tests/content.test.ts` nach `contracts/content.md` (Regeln 1–6)

**Checkpoint**: `docs/design.md` von Rustam abgenommen, `npm test` grün (Inhaltsregeln). Danach committen und auf Rustams OK warten.

---

## Phase 3: Statische Seite (Fallback)

**Zweck**: Die komplette Seite ohne 3D. Sie ist zugleich der Fallback (Constitution I). Erst nach Rustams OK zu T010.

- [X] T011 [H] Tokens aus dem Designplan in `src/styles/tokens.css`; Schriften via `@fontsource/<name>` installieren oder WOFF2 nach `public/fonts/`
- [X] T015 [S] `src/page.html` (Gerüst, Meta/og, hreflang, Inline-Skript im `<head>` setzt `html.js`, `html.reduced`, `html.no-webgl` vor dem ersten Paint) und Abschnitte `src/sections/{hero,bom,projekte,skills,ueber,lebenslauf,kontakt,outro,labels}.html` mit allen Hooks aus `contracts/dom.md`; danach in `tests/content.test.ts` die zwei `it.skip` (Regel 2, Abschnitts-Anker) wieder auf `it` stellen
- [X] T016 [S] Statische Gestaltung: `src/styles/{base,layout,sections}.css` – die Seite muss ohne JS komplett und schön sein (Zeichnungskopf, Stückliste als Tabelle, Projekt-Datenblätter, Schriftfeld); `#scene-fallback` zeigt vorerst einen Platzhalter
- [X] T017 [P] [S] `tests/render.test.ts`: beide Seiten rendern, gleiche Struktur, keine `{{`-Reste, alle Hooks aus `contracts/dom.md` vorhanden, alle internen Links/Assets existieren
- [X] T018 [S] `tools/shot.mjs`: `vite build` + `vite preview` starten, mit `ffbrowser.mjs` jede Abschnitts-ID bei 1440×900 und 390×844 anspringen, PNGs nach `test-results/shots/<lang>/<id>@<w>.png`, Exit 1 bei Konsolenfehlern; `npm run shots`

**Checkpoint**: Statische Seite de/en vollständig, `npm test` und `npm run shots` grün. Screenshots mit Rustam anschauen. Danach committen und auf Rustams OK warten.

---

## Phase 4: US1 – Szene-Grundlage (P1) 🎯 MVP

**Ziel**: Zustand, Renderer und Materialien stehen, Tests für Explosion und Kamerapfad sind geschrieben (dürfen noch rot sein).

- [X] T020 [P] [S] [US1] `tests/explode.test.ts`: `pose(part, state)` – bei `explode=0` Ausgangslage, bei 1 Ausgangslage + `dir·dist`, monoton, Teile mit kleinerem `order` starten früher, Werte außerhalb 0…1 werden geklemmt
- [X] T021 [P] [S] [US1] `tests/camera-path.test.ts`: Keyframes je Abschnitt, Interpolation stetig, Index wird an den Rändern geklemmt
- [X] T022 [S] [US1] `src/scene/state.ts`: `SceneState` + `setState()` (einziger Schreibweg, markiert `needsRender`)
- [X] T023 [S] [US1] `src/scene/renderer.ts`: WebGLRenderer (DPR-Deckel 1,5 / Handy 2), Kamera, 2 Lichter, render on demand, Pause per `IntersectionObserver` + `visibilitychange`, Resize; `window.__v2`-Hook laut `contracts/dom.md`
- [X] T024 [P] [S] [US1] `src/scene/materials.ts`: Papier-, Gehäuse-, Ghost- und Fokus-Material (Orange aus Tokens per CSS-Variable gelesen), `addEdges(mesh)` für Kantenlinien

**Checkpoint**: `npm run build` ohne Fehler, übrige Tests grün; T020/T021 dürfen nur rot sein, weil `explode.ts`/`camera-path.ts` noch fehlen. Danach committen und auf Rustams OK warten.

---

## Phase 5: US1 – Laptop-Modell (P1) 🎯 MVP

**Ziel**: Der prozedurale Laptop steht, zerlegt sich per `?state=` und sieht aus wie das Foto.

- [X] T025 [O] [US1] `src/scene/laptop/dims.ts` + Teile `base.ts` (Keil 13,9→15,9 mm, 353,6×246,9 mm, abgerundete Ecken), `lid.ts` (Deckel + Display-Fläche 16:9, Kamera-Bucht, Scharnierachse hinten), `keyboard.ts` (InstancedMesh mit Numpad, Touchpad), `board.ts` (Platine, CPU, RAM-Chips), `battery.ts` (4 Zellen), `ssd.ts` (M.2 2280), `fans.ts` (2 Lüfter + Heatpipes), `ports.ts` (links HDMI, 2× TB4, microSD, Klinke; rechts 2× USB-A), `index.ts` (Teile nach `parts.json`-`key` zusammenbauen); Abgleich mit Fotos `docs/referenz/laptop/04-schraeg-rechts.png`, `06`/`07` (Seiten)
- [X] T026 [S] [US1] `src/scene/explode.ts` (reine Funktion, macht T020 grün) und Anbindung an die Teile; Signatur laut Kopf von `tests/explode.test.ts` (Stagger-Schritt ≥ 0,01 je `order`-Stufe); danach `tests/explode.test.ts` aus `exclude` in `tsconfig.json` nehmen
- [X] T027 [S] [US1] `src/scene/camera-path.ts` (macht T021 grün) (API laut Kopf von `tests/camera-path.test.ts`; danach aus `exclude` in `tsconfig.json` nehmen): Hero-Ansicht 3/4 von vorne rechts, Totale für Explosion, je ein Keyframe pro Teil-Abschnitt
- [X] T032 [S] [US1] `src/main.ts`: Feature-Erkennung, dynamischer Import von `scene` (+ `choreo`, sobald es in Phase 6 existiert) nur bei WebGL + keine reduzierte Bewegung, Canvas einblenden, sobald das erste Bild gerendert ist
- [X] T033 [S] [US1] `?state=` und `?still` laut `contracts/dom.md` umsetzen; Screenshots (Explosion per `?state=` gesetzt, Scroll-Steuerung kommt erst in Phase 6) von Explosion 0 / 0,5 / 1 mit `npm run shots` prüfen und mit Fotos vergleichen, nachbessern

**Checkpoint**: T020/T021 grün; Screenshots bei Explosion 0 / 0,5 / 1 mit den Fotos verglichen und mit Rustam angeschaut. Danach committen und auf Rustams OK warten.

---

## Phase 6: US1 – Scroll-Choreografie (P1) 🎯 MVP

**Ziel**: Beim Scrollen klappt der Laptop auf, zerlegt sich, Labels + Stückliste erscheinen.

- [X] T028 [S] [US1] `src/scene/labels.ts` + `src/styles/labels.css`: Anker projizieren, `.label[data-part]` positionieren, SVG-Linien, Labels außerhalb des Bildes ausblenden, nur `transform`/`opacity` animieren
- [X] T029 [S] [US1] `src/choreo/smooth.ts`: Lenis ↔ ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker`-Kopplung, `lagSmoothing(0)`)
- [X] T030 [O] [US1] `src/choreo/timeline.ts`: Master-Timeline mit Scrub; Hero pinnen → `lid` 0→1 → `explode` 0→1 → Stückliste blendet ein → `#projekte` gepinnt, je `[data-step]` (nur die 6 Hauptprojekte, kurze Strecke je Schritt) ein Label, `screen` zählt hoch; danach endet der Pin, `#projekte-alle` scrollt normal; Name/Zeile im Hero mit SplitText einblenden

**Checkpoint**: Hero → Aufklappen → Explosion → Stückliste läuft flüssig per Scroll (quickstart.md Szenarien 1–2). Danach committen und auf Rustams OK warten.

---

## Phase 7: US1 – Projekte und Performance (P1) 🎯 MVP

**Ziel**: Projekte laufen über das Display, Verzeichnis der übrigen Projekte, 60 fps.
**Unabhängiger Test**: quickstart.md Szenarien 1–3 und 10.

- [X] T031 [S] [US1] `src/scene/screen.ts`: Projekt-Screenshots als Texturen laden (lazy, erst ab Explosion), Überblendung über `screen`, neutrale Fläche + Name, falls Bild fehlt
- [X] T035 [S] [US1] Projektverzeichnis `#projekte-alle` (in `src/sections/projekte.html` + `sections.css`): kompakte Tabelle/Liste der 7 übrigen Projekte (Name, Stack, eine Zeile, Demo/Repo-Links), Fokus/Hover auf `[data-project]` zeigt den Screenshot auf dem Display (Laptop bleibt sichtbar, keine eigene Scroll-Strecke); auf dem Handy und ohne 3D kleines Vorschaubild in der Zeile; Link „Projekte überspringen“ am Anfang von `#projekte`
- [X] T034 [O] [US1] Performance-Check auf dem Laptop in normalem Firefox: `window.__v2.fps()` beim Durchscrollen ≥ 55; sonst Kantenlinien zusammenführen, DPR senken, Geometrie vereinfachen

**Checkpoint**: MVP – Hero, Explosion, Stückliste, Projekte funktionieren auf Desktop. Danach committen und auf Rustams OK warten.

---

## Phase 8: US4 – Ruhig, ohne 3D, auf dem Handy (P1)

**Ziel**: Seite bleibt mit reduzierter Bewegung, ohne WebGL, ohne JS und auf 390 px voll nutzbar.
**Unabhängiger Test**: quickstart.md Szenarien 7–9 und 390-px-Screenshots.

- [X] T040 [S] [US4] `src/choreo/media.ts`: `gsap.matchMedia()` mit desktop / mobile / reduced; `timeline.ts` und `smooth.ts` darin anlegen, damit beim Umschalten aufgeräumt wird
- [X] T041 [S] [US4] Mobil-Choreografie: kürzere Pin-Strecken, kleinere Explosion (`dist`-Faktor), Datenblätter unter dem Modell, Labels nur für das aktive Teil
- [X] T042 [S] [US4] `npm run still` (`tools/shot.mjs --still`): Seite mit `?still` bei 1600×1000 rendern, Hintergrund transparent → `public/img/explosion-still.webp`; `#scene-fallback` nutzt es (`<picture>`, `width`/`height` gesetzt)
- [X] T043 [P] [S] [US4] `src/styles/reduced.css`: `html.reduced` und `html.no-webgl` → Standbild sichtbar, Abschnitte normal untereinander, keine `position: sticky`-Tricks
- [X] T044 [S] [US4] Prüfen mit Firefox-Prefs (`ui.prefersReducedMotion=1`, `webgl.disabled=true`, `javascript.enabled=false`): `tools/shot.mjs` um `--pref key=value` erweitern und je einen Durchlauf speichern

**Checkpoint**: Alle drei Ersatzmodi und 390 px sind sauber. Danach committen und auf Rustams OK warten.

---

## Phase 9: US2 – Restliche Abschnitte und Kontakt (P2)

**Ziel**: Fokusfahrten zu P-02…P-05, Inhalte, Outro.
**Unabhängiger Test**: quickstart.md Szenarien 4–5.

- [X] T050 [S] [US2] Timeline-Abschnitte für `#skills` (Board orange, Chips beschriftet mit `skills` aus den Strings, als Labels im Overlay), `#ueber` (Akku), `#lebenslauf` (SSD), `#kontakt` (Anschlüsse; je Kanal ein Label am passenden Port laut `contact.json`)
- [X] T051 [S] [US2] Ghost/Fokus-Überblendung über `focus` + `focusMix` in `materials.ts`/`index.ts`
- [X] T052 [S] [US2] Outro: `explode` 1→0, `lid` 1→0, Kamera zurück in die Hero-Ansicht; Schriftfeld mit Kontakt, Sprachwahl, Link zu v1
- [X] T053 [S] [US2] Stückliste: Zeilen verlinken auf die Abschnitte; Anker-Sprung per Lenis `scrollTo` (bei reduced: nativ)
- [X] T054 [S] [US2] Fokus-Sichtbarkeit: Fokus in gepinnten Abschnitten scrollt das Element sichtbar, `:focus-visible`-Stil aus Tokens; Kontraste prüfen (WCAG AA)

**Checkpoint**: Ganze Seite von oben bis unten auf Deutsch fertig. Danach committen und auf Rustams OK warten.

---

## Phase 10: US3 – Zwei Sprachen (P3)

**Ziel**: Englische Seite gleichwertig, Umschalter landet an derselben Stelle.
**Unabhängiger Test**: quickstart.md Szenario 6.

- [X] T060 [S] [US3] Alle englischen Texte prüfen und glätten (`strings.json`, `parts.json`, `projects.json`, `contact.json`); englischer Lebenslauf `public/cv/resume.pdf`
- [X] T061 [S] [US3] Sprachumschalter `a[data-lang-switch]` hängt den aktuellen Abschnitts-Anker an; nach dem Laden setzt die Timeline den Zustand passend zum Anker
- [X] T062 [P] [S] [US3] `tests/render.test.ts` erweitern: en-Seite hat `lang="en"`, alle `href`/`src` funktionieren aus `en/` heraus

**Checkpoint**: de und en gleichwertig. Danach committen und auf Rustams OK warten.

---

## Phase 11: Feinschliff & Abnahme

**Ziel**: Budgets messen, Doku, Abnahme mit Rustam.

- [X] T070 [S] Bundle-Budget prüfen (`vite build` → JS gzip ≤ 350 KB); three nur über benannte Importe
- [X] T071 [P] [S] Lighthouse-ähnliche Messung ohne Chromium: in normalem Firefox Netzwerk „Fast 4G“, LCP/bedienbar laut SC-003 messen und in `docs/messungen.md` notieren
- [X] T072 [P] [H] `README.md` aktualisieren (Befehle, Aufbau, Regeln) und `AGENTS.md` wie in v1 anlegen; bestehende `CLAUDE.md` (Modell-Routing) behalten und um `@AGENTS.md` ergänzen
- [ ] T073 **(Haupt-Session, nicht delegieren – braucht Rustam)** Alle quickstart.md-Szenarien durchgehen, Screenshots mit Rustam anschauen, Korrekturen
- [ ] T074 **(Haupt-Session, nicht delegieren – braucht Rustam)** Rustam fragen: GitHub-Repo/Pages? (Constitution: nur nach OK)

**Checkpoint**: Alles abgenommen. Danach committen und auf Rustams OK warten.

---

## Phase 12: Erweiterungen – Live-Demo im Laptop und mehr Farbe (Ideen 2026-11-08, nach Phase 11)

**Ziel**: Bei Projekten mit Live-Demo (fretlearn, Weitland, NSCS, OnlineIDE, Sudoku) gibt es einen Knopf „Live-Demo“. Die Kamera zoomt in den Laptop, die Demo läuft bedienbar auf dem Display; Schließen fährt zurück.
**Vorab zu klären (Rustams Entscheidung)**: Die Demos liegen auf `rustamakhmedov.github.io` (andere Domain als v2). Ein `<iframe>` darauf ist eine bewusste Ausnahme zu „keine Fremdquellen“; GitHub-Pages-URL von v2 und Frame-Header prüfen.

- [ ] T080 [S] [US1] Knopf „Live-Demo“ im Datenblatt (`[data-step]`, nur bei Projekten mit `demo`), Zustand `demoOpen` (state/choreo), Escape/„Schließen“, Tastaturbedienung; ohne 3D/Handy/reduced: normaler Link in neuem Tab
- [ ] T081 [O] [US1] Kamera zoomt auf das Display (neuer Keyframe `demo`), `<iframe>` deckungsgleich über der projizierten Displayfläche (Eckpunkte pro Frame, `transform` per CSS), Scroll- und Tastaturfokus sauber getrennt (Lenis pausieren, `inert` für Seite), iframe erst bei Klick laden und beim Schließen entfernen
- [ ] T082 [S] [US1] Tests und Screenshots (Zoom-Zustand, Schließen, Fokus-Rückgabe), Messung fps mit offenem iframe in `docs/messungen.md`, `contracts/dom.md` um Hooks (`[data-demo]`, `#demo-frame`) ergänzen

**Checkpoint**: Demo öffnet und schließt flüssig, Fokus kehrt zurück, Seite ohne JS/3D unverändert nutzbar. Danach committen und auf Rustams OK warten.

### Mehr Farbe (Rustams Wunsch 2026-11-08)

Die Seite wirkt mit Papier, Tinte und Orange als einziger Farbe sehr zurückhaltend. Sie soll etwas mehr Farbe bekommen. Das widerspricht der heutigen Regel „Orange als einzige Signalfarbe“ (Constitution IV, FR-013, `docs/design.md`) und braucht deshalb zuerst Rustams Entscheidung und eine Anpassung dieser Dokumente.

- [X] T086 [S] [US1] Projekt-Vorschau besser sichtbar (Rustams Eindruck 2026-11-08: vor allem auf dem Handy schlecht erkennbar): Display/Screenshot größer und lesbarer (Bühne auf dem Handy, Zoom/Kamera näher am Display, größere Bildfläche pro Projekt, eventuell Screenshot zusätzlich neben/unter dem Datenblatt), Prüfung auf 390 px und 1440 px
- [ ] T087 [S] [US1] Seite wirkt „leer“ (Rustams Eindruck 2026-11-08): mehr Inhalt und Leben ohne Überladung (zusammen mit dem Farbkonzept T083: Flächen, Hintergründe pro Abschnitt, Details im Laptop, Zwischenräume zwischen den Abschnitten), Entscheidung mit Rustam
- [ ] T083 **(Haupt-Session, nicht delegieren – braucht Rustam)** Farbkonzept mit `/frontend-design` und Rustam klären: wie viel Farbe (z. B. zweite Akzentfarbe, getönte Abschnittsflächen, Farbe je Teil/Abschnitt, farbige Teile im Laptop), Kontrast WCAG AA prüfen, Constitution IV, FR-013 und `docs/design.md` anpassen; erst nach Rustams OK weiter
- [ ] T084 [H] Neue Farben als Tokens in `src/styles/tokens.css` (und ins Modell über die CSS-Variablen in `src/scene/materials.ts`), Werte aus `docs/design.md`
- [ ] T085 [S] Farbe in Seite und Szene anwenden (Abschnitte, Labels, Teile im Laptop, Standbild `npm run still` neu erzeugen), Screenshots aller Modi neu prüfen, Kontraste in `docs/messungen.md` aktualisieren

**Checkpoint (Farbe)**: Neues Farbkonzept von Rustam abgenommen, alle Modi und Kontraste geprüft.


---

## Dependencies & Execution Order

- Phasen der Reihe nach: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. **Eine Phase pro „implement phase x“.**
- **T010 (Designplan) blockiert alles Gestalterische** (T011, T016, T024, T028) → Phase 3 erst nach Rustams OK
- Phase 8 (US4) braucht T032/T033 (Phase 5) und die Timeline (Phase 6); T043 ginge schon ab Phase 3
- Phase 9 (US2) braucht die Timeline (T030, Phase 6); Phase 10 (US3) braucht nur Phase 3

### Parallel-Beispiele

- Phase 1: T006 und T007 neben T003–T005
- Phase 2: T012, T013, T014 neben T010
- Phase 3: T017 neben T016
- Phase 4: T020, T021, T024 gleichzeitig

## Implementation Strategy

1. **MVP** = Phase 1–7: Hero, Explosion, Projekte. Schon als Link verschickbar, sobald Phase 8
   (Ersatzmodi) auch fertig ist. Das ist die Mindestgrenze laut Constitution I.
2. Danach Phase 9 (Rest + Kontakt), 10 (Englisch), 11 (Feinschliff).
3. Nach jeder Phase: `npm run build && npm test && npm run shots`, Screenshots anschauen, Rustam zeigen,
   Haken setzen, nach OK committen.
4. Ausführen mit „implement phase x“ (nur diese Phase, danach stoppen).
