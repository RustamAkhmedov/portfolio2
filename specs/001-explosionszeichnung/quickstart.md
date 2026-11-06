# Quickstart / Abnahme: Portfolio „Explosionszeichnung“

## Voraussetzungen

- Node ≥ 22 (vorhanden: 24.x), npm, System-Firefox (`/usr/bin/firefox`)
- **Kein** Chromium/headless Chrome verwenden.

## Befehle (nach Phase 1 der Tasks vorhanden)

```bash
npm install            # Abhängigkeiten nur im Projekt
npm run dev            # Dev-Server, http://localhost:5173/ (de) und /en/ (en)
npm run build          # Seiten rendern + Produktions-Build nach dist/
npm test               # Vitest: Inhalte, Übersetzungen, Explosionsmathematik, Seiten-Render
npm run shots          # build + preview + Firefox-Screenshots aller Abschnitte (1440 + 390) → test-results/shots/
npm run still          # Fallback-Standbild neu erzeugen → public/img/explosion-still.webp
```

## Abnahme-Szenarien (aus der Spec)

| # | Szenario | Prüfung | Erwartet |
|---|---|---|---|
| 1 | Erster Bildschirm | `npm run shots`, Bild `hero@1440.png`, `hero@390.png` | Name, Zeile, Sprachwahl, Scroll-Hinweis, zugeklappter Laptop |
| 2 | Explosion | `?state={"explode":0.5}` und `1` | Teile entlang ihrer Achsen, Labels mit Linien |
| 3 | Projekte | Anker `#projekte`, 6 Schritte | Screenshot auf dem Display wechselt, Datenblatt daneben (Handy: darunter) |
| 4 | Restliche Abschnitte | Anker `#skills`, `#ueber`, `#lebenslauf`, `#kontakt` | richtiges Teil orange, Rest Linien; Links funktionieren |
| 5 | Ende | Anker `#outro` | Laptop zusammengesetzt und zugeklappt, Schriftfeld mit Link zu v1 |
| 6 | Englisch | `/en/` | gleicher Aufbau, alles übersetzt, englischer Lebenslauf |
| 7 | Reduzierte Bewegung | Firefox `about:config` → `ui.prefersReducedMotion = 1` | kein Pinning/Scrub, Standbild, normale Abschnitte |
| 8 | Ohne WebGL | `about:config` → `webgl.disabled = true` | Standbild statt Canvas, Rest unverändert |
| 9 | Ohne JS | `about:config` → `javascript.enabled = false` | alle Inhalte und Links da |
| 10 | Flüssig | normales Firefox auf dem Laptop, `window.__v2.fps()` im Dev-Modus | ≥ 55 fps im Mittel beim Durchscrollen |
| 11 | Konsole | `npm run shots` | bricht bei JS-Fehlern ab, also grün = keine Fehler |

Fertig ist das Feature, wenn `npm run build && npm test && npm run shots` grün sind und Rustam die
Screenshots plus einen Durchlauf im echten Firefox abgenommen hat.
