# Implementation Plan: Portfolio „Explosionszeichnung“

**Branch**: `001-explosionszeichnung` (Ordner; Arbeit auf `main`, nur lokal) | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-explosionszeichnung/spec.md`

## Summary

Eine statische, zweisprachige Portfolio-Seite. Ein prozedural gebauter three.js-Laptop (Proportionen
des ASUS S5506MA, ohne Logo) klappt beim Scrollen auf und zerlegt sich. GSAP ScrollTrigger (Scrub) und
Lenis treiben ein einziges Zustandsobjekt, Szene und HTML-Overlay lesen es. Fünf Teile führen zu den
Abschnitten Projekte, Skills, Über mich, Lebenslauf und Kontakt. Inhalte und Übersetzungen kommen aus
JSON und werden mit der Template-Engine aus v1 zu `index.html` (de) und `en/index.html` (en) gerendert.
Mit reduzierter Bewegung, ohne WebGL oder ohne JS gibt es die ganze Seite als normales HTML mit Standbild.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), HTML, CSS; Node 24 für Build/Tools

**Primary Dependencies**: `three` (≈0.186, wie teardown), `gsap` (ScrollTrigger, SplitText; komplett gratis),
`lenis`, Dev: `vite`, `typescript`, `vitest`, `jsdom`; Schriften via `@fontsource/*` (Auswahl in T010).
Kein UI-Framework, kein React Bits, Remotion erst in Feature 002.

**Storage**: JSON-Dateien in `src/content/`, Bilder/PDFs in `public/`

**Testing**: Vitest (Unit + Daten + Seiten-Render in jsdom); `tools/shot.mjs` = System-Firefox headless
über WebDriver BiDi für Screenshots/Konsolenfehler. **Nie Chromium.**

**Target Platform**: aktuelle Firefox/Chrome/Safari Desktop + Mobil; Referenzgerät Rustams Laptop
(Intel Arc iGPU, Firefox, 2880×1620 bei Skalierung ~1,55)

**Project Type**: statische Website (Single project, Vite Multi-Page)

**Performance Goals**: 60 fps beim Scrollen auf dem Referenzgerät; LCP < 1,5 s, bedienbar < 2,5 s (lokal, Fast 4G)

**Constraints**: JS ≤ 350 KB gzip; Pixelratio ≤ 1,5 (Handy 2); Render on demand; keine Fremd-CDNs;
relative Pfade (GitHub-Pages-Unterpfad); ASUS-Fotos nie im Build

**Scale/Scope**: 2 Seiten, 7 Abschnitte (Hero, Stückliste, 5 Teil-Abschnitte + Outro), 8 Teile, 6 Projekte

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Prinzip | Prüfung | Status |
|---|---|---|
| I. Inhalt zuerst | Alles Inhaltliche im HTML; Canvas + Labels `aria-hidden`; Fallback-Standbild; reduced motion ohne Scroll-Bindung (R5, contracts/dom.md) | ✅ |
| II. Eine Quelle, zwei Sprachen | v1-Engine portiert (R6), Build-Fehler bei fehlender Übersetzung, Inhalte einmalig aus v1 kopiert | ✅ |
| III. Leicht für die iGPU | prozedural (R1), matte Materialien ohne Echtzeitschatten (R2), render on demand + DPR-Deckel (R9), Budget im Test | ✅ |
| IV. Eigene Gestaltung | Designplan mit `frontend-design` als eigene Task vor dem Styling (T010), Tokens, kein ASUS-Branding | ✅ |
| V. Prüfbar, nur Firefox | Vitest + `tools/shot.mjs` über System-Firefox (R8) | ✅ |
| Arbeitsablauf | nur lokal, kein Push/Deploy; Commits nur nach Rustams OK | ✅ |

Re-Check nach Phase 1: keine Verstöße, Complexity Tracking leer.

## Project Structure

### Documentation (this feature)

```text
specs/001-explosionszeichnung/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (dom.md, content.md)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
index.html, en/index.html     ERZEUGT von tools/render.mjs (gitignored) – nie bearbeiten
vite.config.ts                Multi-Page-Input, base: './', Plugin pages()
src/
├── page.html                 Gerüst (<head>, Inline-Zustandsskript, Reihenfolge der Abschnitte)
├── sections/                 hero, bom, projekte, skills, ueber, lebenslauf, kontakt, outro, labels
├── content/                  strings.json, parts.json, projects.json, contact.json, site.json
├── styles/
│   ├── tokens.css            Farben, Schriften, Abstände, Timings (Designplan T010)
│   ├── base.css · layout.css · sections.css · labels.css · reduced.css
├── main.ts                   Einstieg: Feature-Erkennung, lädt scene + choreo nur wenn erlaubt
├── scene/
│   ├── state.ts              SceneState + Setter (einziger Schreibweg)
│   ├── renderer.ts           Renderer, Kamera, Licht, render-on-demand, Pause, Resize
│   ├── materials.ts          Papier/Ghost/Fokus-Materialien, Kantenlinien
│   ├── laptop/               lid.ts, base.ts (Keil + Bodenplatte), keyboard.ts, board.ts,
│   │                         battery.ts, ssd.ts, fans.ts, ports.ts, index.ts (baut alle Teile, Maße in dims.ts)
│   ├── explode.ts            reine Funktion pose(part, state) → Position/Rotation (getestet)
│   ├── camera-path.ts        Kamera-Keyframes je Abschnitt + Interpolation (getestet)
│   ├── screen.ts             Display-Textur: Projekt-Screenshots laden + überblenden
│   └── labels.ts             Anker projizieren → .label-Positionen + SVG-Linien
├── choreo/
│   ├── smooth.ts             Lenis ↔ ScrollTrigger-Kopplung
│   ├── timeline.ts           Master-Timeline (Labels je Abschnitt) → schreibt SceneState
│   └── media.ts              gsap.matchMedia: desktop / mobile / reduced
└── lib/                      kleine Helfer (clamp, lerp, ease) – nur wenn gebraucht
public/
├── img/projects/*.webp       aus v1 übernommen, auf Displaygröße optimiert
├── img/explosion-still.webp  ERZEUGT von npm run still
├── cv/lebenslauf.pdf, cv/resume.pdf
└── fonts/ (falls nicht @fontsource)
tools/
├── render.mjs                Template-Engine aus v1 (portiert) + Seiten schreiben, --check
├── vite-plugin-pages.mjs     ruft render.mjs vor Build und bei Änderungen im Dev-Server
├── import-v1.mjs             einmalig: Inhalte/Bilder/PDFs aus ~/Projects/portfolio holen
├── ffbrowser.mjs             Firefox-BiDi-Shim (nach teardown/ff/ffbrowser.mjs)
└── shot.mjs                  Screenshots aller Anker @1440/@390, Konsolenfehler = Exit 1, --still
tests/
├── content.test.ts           Vertrag contracts/content.md
├── render.test.ts            beide Seiten rendern, gleiche Struktur, keine {{…}}-Reste, alle Hooks aus contracts/dom.md
├── explode.test.ts           pose(): Grad 0 = Ausgangslage, 1 = dir·dist, monoton, Stagger-Reihenfolge
└── camera-path.test.ts       Keyframe-Grenzen, stetig, Index außerhalb wird geklemmt
```

**Structure Decision**: Single project mit Vite Multi-Page. Die Trennung folgt der Constitution:
`content` + `sections` (Inhalt) · `styles` (Gestaltung) · `scene` (Geometrie, kennt keine Texte) ·
`choreo` (Scroll, kennt nur SceneState und Abschnitts-IDs).

## Ablauf in Phasen (Details in tasks.md)

1. **Setup**: Vite/TS-Gerüst, Abhängigkeiten, Render-Pipeline aus v1, Inhalte importieren, Tests laufen.
2. **Fundament**: Designplan mit `frontend-design` → Tokens; statische Seite ohne 3D (ist zugleich der Fallback).
3. **US1 (P1)**: Laptop-Modell, Explosion, Labels, Hero-Choreografie, Projekte auf dem Display.
4. **US4 (P1)**: reduzierte Bewegung, Handy, ohne WebGL, Standbild.
5. **US2 (P2)**: Skills/Über mich/Lebenslauf/Kontakt-Fokus, Outro.
6. **US3 (P3)**: Englisch, Sprachumschalter mit Anker.
7. **Feinschliff**: Performance-Messung, Screenshots, Abnahme.

## Complexity Tracking

Keine Verstöße.
