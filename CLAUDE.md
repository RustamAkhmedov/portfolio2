# portfolio_v2

Portfolio „Explosionszeichnung“ (three.js-Laptop, der sich beim Scrollen zerlegt), de + en, statisch mit Vite.
Spec-driven mit Spec Kit. Verbindliche Regeln stehen in `.specify/memory/constitution.md`, alles zum aktuellen
Feature in `specs/001-explosionszeichnung/` (spec, plan, research, data-model, contracts, quickstart, tasks).

## Umsetzen

- Aufgaben aus `specs/001-explosionszeichnung/tasks.md` **phasenweise** abarbeiten (11 Phasen).
  **„implement phase x“** heißt: genau die Aufgaben von Phase x erledigen (vorher prüfen, dass die vorigen Phasen
  abgehakt sind), Checkpoint prüfen, Haken setzen, dann stoppen, Rustam berichten (Screenshots in
  `test-results/shots/`) und auf sein OK warten. Commit erst nach diesem OK.
- **Modell-Routing ist aktiv**: Jede Aufgabe hat `[H]`, `[S]` oder `[O]`. Delegieren nach den Regeln in
  `~/.claude/CLAUDE.md` (Modell-Routing): `[H]` → `umsetzer-haiku`, `[S]` → `umsetzer-sonnet`, `[O]` → `spezialist-opus`.
  Die Haupt-Session (am besten auf Sonnet, `/model sonnet`) koordiniert, prüft mit `npm test` / `npm run build` /
  `npm run shots` und hakt in `tasks.md` ab.
- Aufgaben **ohne** Marke (T010 Designplan, T073 Abnahme, T074 GitHub-Frage) macht die Haupt-Session selbst,
  weil sie Rückfragen an Rustam brauchen. T011 und alles Gestalterische erst nach Rustams OK zu T010.
- Beim Übergeben einer Aufgabe immer mitgeben: Aufgabentext, Pfad `specs/001-explosionszeichnung/`, die Dokumente,
  auf die die Aufgabe verweist (v. a. `contracts/dom.md`, `data-model.md`, `docs/design.md` sobald vorhanden),
  und was die vorigen Aufgaben schon gebaut haben.

## Regeln, die oft vergessen werden

- Nur lokales git, kein GitHub-Repo, kein Push/Deploy ohne Rustams OK. Commit nach jeder abgeschlossenen Phase.
- Optisch testen nur mit **Firefox** (`tools/ffbrowser.mjs`), **nie headless Chrome/Chromium**.
- Libraries nur im Projekt installieren, nie global. Keine Fremd-CDNs, Schriften selbst hosten.
- v1 (`~/Projects/portfolio/`) nur lesen, dort nichts ändern.
- ASUS-Fotos aus `docs/referenz/laptop/` nie in den Build, kein ASUS-Branding.

@AGENTS.md
