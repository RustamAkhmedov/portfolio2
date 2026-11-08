<!--
Sync Impact Report
- Version: (Template) → 1.0.0 (Erstfassung)
- Prinzipien neu: I. Inhalt zuerst, 3D ist Bühne · II. Eine Quelle, zwei Sprachen ·
  III. Leicht für die iGPU · IV. Eigene Gestaltung statt Vorlage · V. Prüfbar, nur mit Firefox
- Abschnitte neu: Gestaltung & Technik, Arbeitsablauf, Governance
- Templates: keine Änderung nötig (plan-template liest die Constitution zur Laufzeit)
- Offene TODOs: keine
-->

# portfolio_v2 Constitution

Alternative Portfolio-Seite von Rustam Akhmedov neben v1 (`~/Projects/portfolio`, „rustam.os“).
Kernidee „Explosionszeichnung“: ein stilisierter 3D-Laptop zerlegt sich beim Scrollen, jedes Teil
führt zu einem Abschnitt. Zielgruppe wie v1: Praktikumsbetriebe, Recruiter, Lehrer. Die Seite ist
eine Bewerbung und muss deshalb zuerst funktionieren und erst danach beeindrucken.

## Core Principles

### I. Inhalt zuerst, 3D ist Bühne
Alle Inhalte (Name, Über mich, Skills, Projekte, Lebenslauf, Kontakt) stehen als semantisches HTML
im Dokument und sind ohne WebGL, ohne JavaScript und mit `prefers-reduced-motion` vollständig lesbar
und bedienbar. Das 3D-Canvas ist Dekoration (`aria-hidden`) und darf keinen Inhalt enthalten, der
sonst fehlt. Fällt WebGL aus, zeigt die Seite ein statisches Bild der Explosionszeichnung.
Scroll-Animationen dürfen Inhalte nie länger als einen Bildschirm lang verstecken.
Tastatur, Fokus-Reihenfolge und Kontraste (WCAG AA) gelten auch in gepinnten Abschnitten.

### II. Eine Quelle, zwei Sprachen
Deutsch und Englisch entstehen aus *einem* Markup. Texte liegen mit `{ "de", "en" }` nebeneinander
in Datendateien unter `src/content/`; eine fehlende Übersetzung bricht den Build ab. Die Inhalte
werden einmalig aus v1 (`src/strings.json`, `src/projects.json`) übernommen und danach hier gepflegt.
Es gibt keine Abhängigkeit zur Laufzeit auf den v1-Ordner. Angaben über Rustam müssen stimmen:
nichts erfinden oder aufblähen, neue persönliche Angaben nur nach Rücksprache.

### III. Leicht für die iGPU
Zielgerät ist Rustams Laptop (Intel Arc iGPU, Meteor Lake) in Firefox: Scrollen bleibt flüssig
(Ziel 60 fps, nie spürbar ruckelnd). Dafür gilt:
- Geometrie prozedural im Code oder als eine komprimierte glTF-Datei ≤ 1 MB, keine großen Texturen.
- Pixelratio des Canvas höchstens 1,5 (Handy 2), Schatten nur gebacken oder als einfache Kontaktfläche.
- Rendern nur bei Bewegung/Scroll, Pause wenn Canvas oder Tab unsichtbar.
- JavaScript der Startseite ≤ 350 KB gzip, Seite in ≤ 2,5 s bedienbar (lokaler Produktions-Build).

### IV. Eigene Gestaltung statt Vorlage
Look „Papier-Datenblatt“: warmes Papier, feine Linien, Mono-Beschriftung mit Teilenummern,
eine Signalfarbe Orange. Gestaltet wird mit dem Skill `frontend-design` (erst Designplan, dann Code).
Farben, Schriften, Abstände und Timings nur über Design-Tokens. Typische AI-Slop-Muster sind tabu:
lila Verläufe, Glas-Karten, Emoji als Icons, generische Hero-Phrasen, Effekte ohne Bezug zur Idee.
Der Laptop ist stilisiert nach den echten Proportionen des eigenen Geräts. Logos, Schriftzüge und
Fotos von ASUS kommen nicht auf die Seite.

### V. Prüfbar, nur mit Firefox
`npm run build` und `npm test` müssen vor jedem Commit grün sein. Tests decken ab: Übersetzungen
vollständig, Projektdaten gültig, Links/Assets vorhanden, Seite ohne JS-Fehler. Neue Logik ohne
Grafik (z. B. Scroll-Fortschritt → Explosionsgrad) bekommt Unit-Tests. Optische Kontrolle per Screenshot
in **Firefox** bei ~1440 px und ~390 px Breite. **Nie headless Chrome/Chromium** (i915-Freeze-Gefahr).

## Gestaltung & Technik

- Stack: Vite + TypeScript, three.js, GSAP (ScrollTrigger, SplitText) und Lenis. Kein UI-Framework.
  Remotion nur für vorgerenderte Clips (MP4/WebM). Libraries nur im Projekt installieren, nie global.
- Statische Ausgabe in `dist/`, lauffähig auf GitHub Pages unter einem Unterpfad (relative Pfade).
- Struktur nach Zuständigkeit: Inhalte (`src/content/`), Markup, Stile mit Tokens, 3D-Szene,
  Scroll-Choreografie. Die 3D-Szene kennt keine Texte, die Choreografie kennt keine Geometrie-Details.
- Referenzfotos des Laptops (`docs/referenz/`) sind © ASUS: nur lokale Vorlage, nie veröffentlichen.

## Arbeitsablauf

- Größere Erweiterungen laufen über Spec Kit: `/speckit-specify` → `/speckit-clarify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Kleinkram direkt.
- Das Repo ist **nur lokal**. Kein GitHub-Repo, kein Push, kein Deployment ohne ausdrückliches OK
  von Rustam. Commits: nach jeder abgeschlossenen Phase aus `tasks.md` committen, sobald
  `npm run build` und `npm test` grün sind (Rustams OK vom 2026-11-07). Andere Commits nur auf Nachfrage.
- v1 (`~/Projects/portfolio`) wird nur gelesen, nie verändert.
- Wird es je veröffentlicht: `.specify/`, `.claude/`, `specs/` und `docs/referenz/` vorher in die
  `.gitignore` (wie bei v1).

## Governance

Diese Constitution hat Vorrang vor Vorschlägen aus Specs und Plänen. Änderungen an den Prinzipien
nur auf Rustams Wunsch, mit neuer Versionsnummer (SemVer) und Datum.

**Version**: 1.1.0 | **Ratified**: 2026-11-06 | **Last Amended**: 2026-11-07
