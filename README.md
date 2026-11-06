# portfolio_v2

Alternative Portfolio-Seite zu `~/Projects/portfolio` (rustam.os, Retro-OS-Look):
**„Explosionszeichnung“**. Ein 3D-Modell meines Laptops (ASUS Vivobook S 15, stilisiert) zerlegt sich
beim Scrollen, und jedes Teil führt zu einem Abschnitt. Look „Papier-Datenblatt“ mit Orange, de + en.

**Status:** Planung fertig, Code folgt. Nur lokales git, kein GitHub-Repo.

## Nächste Woche: so geht's los

1. Claude Code in diesem Ordner starten: `cd ~/Projects/portfolio_v2 && claude`
2. Kurz drüberlesen: `specs/001-explosionszeichnung/spec.md` (was) und `tasks.md` (Schritte).
3. `/speckit-analyze` (optional), um Spec, Plan und Tasks gegeneinander zu prüfen.
4. `/speckit-implement`. Claude arbeitet `tasks.md` Phase für Phase ab.
   - **Phase 1** (Setup) läuft ohne Rückfragen.
   - **T010 Designplan**: Hier fragt Claude dich (Schriften, Look; Gehäusefarbe steht fest: schwarz). Erst danach wird gestylt.
   - Nach jeder Phase: Screenshots in `test-results/shots/` anschauen und Feedback geben.
5. Alternativ kleinschrittig: „Mach Phase 1 aus tasks.md“, dann „Mach Phase 2“, …

## Wo steht was?

| Datei | Inhalt |
|---|---|
| `.specify/memory/constitution.md` | Projektregeln (Inhalt zuerst, de/en aus einer Quelle, iGPU-Budget, eigene Optik, nur Firefox) |
| `specs/001-explosionszeichnung/spec.md` | Was die Seite können muss (User Stories, Anforderungen, Erfolgskriterien) |
| `specs/001-explosionszeichnung/plan.md` | Stack, Ordnerstruktur, Architektur |
| `specs/001-explosionszeichnung/research.md` | technische Entscheidungen mit Begründung |
| `specs/001-explosionszeichnung/data-model.md` | Teile, Projekte, Texte, Szenenzustand |
| `specs/001-explosionszeichnung/contracts/` | DOM-Hooks und Inhaltsregeln |
| `specs/001-explosionszeichnung/quickstart.md` | Befehle + Abnahme-Szenarien |
| `specs/001-explosionszeichnung/tasks.md` | 49 Aufgaben in 7 Phasen |
| `docs/referenz/laptop/` | ASUS-Fotos + Maße + deine echten Hardwaredaten (© ASUS, gitignored) |
| `docs/ideen.md` | die 4 ursprünglichen Richtungen + Entscheidungen |

## Werkzeuge (aus /reminder)

| Werkzeug | Wofür hier |
|---|---|
| `frontend-design`-Skill | Designplan (T010) vor dem Styling, kein AI-Slop |
| GSAP + `gsap-skills` | ScrollTrigger (Pin, Scrub), SplitText, Timelines, matchMedia |
| Lenis | Smooth Scroll, gekoppelt an ScrollTrigger |
| three.js | prozeduraler Laptop (Bauweise wie im `teardown`-Skill) |
| Spec Kit | `/speckit-…`-Befehle, eingerichtet |
| Remotion | später (Feature 002): Projekt-Clips aufs Display |

Libraries nur in diesem Projekt installieren, nie global. Optisch testen nur mit Firefox (nie headless Chrome).
