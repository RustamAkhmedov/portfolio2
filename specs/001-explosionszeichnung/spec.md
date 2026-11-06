# Feature Specification: Portfolio „Explosionszeichnung“

**Feature Branch**: `001-explosionszeichnung` (nur Ordnername; gearbeitet wird auf `main`, lokal)

**Created**: 2026-11-06

**Status**: Draft – bereit für `/speckit-plan` (Plan liegt schon vor, siehe `plan.md`)

**Input**: User description: „Alternative Portfolio-Seite mit modernen Trend-Designs, Scroll-Animationen
und 3D-Objekten. Richtung A: Ein 3D-Modell meines Laptops zerlegt sich beim Scrollen wie eine
Explosionszeichnung, jedes Teil ist ein Abschnitt. Look Papier-Datenblatt mit Orange, de + en,
Inhalte als Top-Auswahl aus v1.“

## Überblick

Besucher landen auf einem hellen „Datenblatt“: oben ein Zeichnungskopf (Name, Blattnummer, Revision),
in der Mitte ein zugeklappter Laptop. Beim Scrollen klappt er auf, dann zieht er sich entlang seiner
Achsen auseinander. Jedes Teil bekommt eine Teilenummer und eine Beschriftungslinie. Danach führt der
Scroll von Teil zu Teil, und jedes Teil öffnet einen Abschnitt:

| Teil | Nr. | Abschnitt |
|---|---|---|
| Display / Deckel | P-01 | Projekte – die Screenshots laufen über das Display |
| Mainboard mit CPU | P-02 | Skills & Stack – die Chips sind mit Sprachen/Werkzeugen beschriftet |
| Akku | P-03 | Über mich + Steckbrief (Standort, Schule, Status, Sprachen) |
| SSD | P-04 | Lebenslauf – ansehen oder herunterladen |
| Anschlüsse | P-05 | Kontakt – jeder Anschluss ist ein Kanal (E-Mail, GitHub, …) |
| Tastatur, Lüfter, Bodenplatte | P-06…P-08 | nur Stückliste, keine eigenen Abschnitte |

Am Ende setzt sich der Laptop wieder zusammen und klappt zu. Der Fuß ist ein Zeichnungsschriftfeld mit
Kontakt, Sprachumschalter und einem Link zu v1 („rustam.os – die Retro-Fassung“).

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Erster Eindruck und Projekte (Priority: P1)

Eine Personalerin öffnet den Link aus einer Bewerbung. Sie sieht sofort, wer Rustam ist und was er
macht, scrollt, sieht den Laptop aufklappen und zerfallen und landet bei den Projekten. Dort schaut sie
sich 2–3 Projekte an und öffnet eines auf GitHub.

**Why this priority**: Das ist der Kern der Seite: Wirkung plus Projekte. Allein damit ist sie als
Bewerbungslink brauchbar.

**Independent Test**: Seite öffnen, bis zu den Projekten scrollen und ein Projekt öffnen. Es klappt
ohne Anleitung, in unter 30 Sekunden ab Laden.

**Acceptance Scenarios**:

1. **Given** die Seite ist geladen, **When** noch nicht gescrollt wurde, **Then** stehen Name, eine
   Zeile zur Person und ein Scroll-Hinweis im ersten Bildschirm, neben dem zugeklappten Laptop.
2. **Given** der Besucher scrollt nach unten, **When** er den Hero-Bereich durchscrollt, **Then** klappt
   der Laptop auf und zerlegt sich stufenlos passend zur Scrollposition. Beim Hochscrollen läuft alles
   rückwärts.
3. **Given** die Explosion ist fertig, **When** weitergescrollt wird, **Then** erscheinen die Teile mit
   Teilenummer und Beschriftungslinie, und eine Stückliste (Nr., Teil, Abschnitt) füllt sich.
4. **Given** der Projekt-Abschnitt (P-01) ist erreicht, **When** weitergescrollt wird, **Then** wechselt
   pro Schritt ein Projekt. Screenshot auf dem Display, daneben ein Datenblatt mit Name, Stack, Beschreibung
   und Link. Gezeigt werden 6 Projekte.
5. **Given** ein Projekt-Datenblatt ist sichtbar, **When** der Link aktiviert wird, **Then** öffnet sich
   das Repo bzw. die Live-Demo in einem neuen Tab.

---

### User Story 2 – Restliche Abschnitte und Kontakt (Priority: P2)

Ein Lehrer oder Betrieb will wissen, was Rustam kann, wer er ist, und wie man ihn erreicht. Er scrollt
durch Skills, Über mich und Lebenslauf und schreibt ihm dann eine Mail.

**Why this priority**: Ohne Kontakt und Lebenslauf bleibt die Bewerbung unvollständig, aber die
Wirkung entsteht schon in Story 1.

**Independent Test**: Von oben bis Kontakt scrollen, Lebenslauf öffnen und herunterladen, Mail-Link
aktivieren.

**Acceptance Scenarios**:

1. **Given** P-02 ist erreicht, **When** der Abschnitt im Bild ist, **Then** wird das Mainboard
   hervorgehoben, und die Skills stehen sowohl auf den Chips als auch als lesbare Liste im HTML.
2. **Given** P-03 ist erreicht, **Then** werden Über-mich-Text und Steckbrief angezeigt.
3. **Given** P-04 ist erreicht, **When** „Lebenslauf ansehen“ oder „herunterladen“ gewählt wird,
   **Then** öffnet sich bzw. lädt das PDF in der aktuellen Sprache.
4. **Given** P-05 ist erreicht, **Then** ist jeder Kontaktkanal einem Anschluss zugeordnet und als
   normaler Link bedienbar.
5. **Given** das Seitenende ist erreicht, **Then** setzt sich der Laptop wieder zusammen. Das
   Schriftfeld zeigt Kontakt, den Sprachumschalter und den Link zu v1.

---

### User Story 3 – Zwei Sprachen (Priority: P3)

Ein Besucher ohne Deutschkenntnisse wechselt auf Englisch und bekommt dieselbe Seite übersetzt.

**Why this priority**: v1 ist zweisprachig, v2 soll da nicht zurückfallen. Die Wirkung hängt aber
nicht daran.

**Independent Test**: Auf jeder Scrollposition umschalten. Es erscheint die andere Sprache an
derselben Stelle, und kein Text bleibt unübersetzt.

**Acceptance Scenarios**:

1. **Given** die deutsche Seite, **When** „EN“ gewählt wird, **Then** öffnet sich die englische Seite
   mit gleichem Aufbau, eigener URL und englischem Lebenslauf.
2. **Given** beide Seiten, **Then** sind Texte, Teilenummern, Stückliste und Beschriftungen vollständig
   übersetzt (Teilenummern bleiben gleich).

---

### User Story 4 – Ruhig, ohne 3D, auf dem Handy (Priority: P1)

Jemand öffnet die Seite auf dem Handy, mit „Bewegung reduzieren“, oder auf einem Gerät ohne WebGL.
Die Person bekommt alle Inhalte ohne Wartezeit und ohne Ruckeln.

**Why this priority**: Gehört zu P1, weil Bewerbungslinks oft am Handy aufgemacht werden. Eine
kaputte Seite schadet mehr, als eine schöne nützt (Constitution I).

**Independent Test**: Mit `prefers-reduced-motion`, mit abgeschaltetem WebGL, ohne JavaScript und
bei 390 px Breite öffnen. Alle Inhalte sind lesbar und alle Links bedienbar.

**Acceptance Scenarios**:

1. **Given** `prefers-reduced-motion: reduce`, **Then** gibt es keine Scroll-Bindung, kein Pinning und
   kein Smooth Scroll. Die Explosionszeichnung erscheint als ruhiges Standbild, die Abschnitte stehen
   normal untereinander.
2. **Given** WebGL ist nicht verfügbar, **Then** steht an der Stelle des Canvas ein statisches Bild der
   Explosionszeichnung, und alles andere funktioniert.
3. **Given** JavaScript ist aus, **Then** sind alle Texte, Projekte, Links und der Lebenslauf erreichbar.
4. **Given** ein Handy (~390 px), **Then** ist der Laptop kleiner, die Strecken sind kürzer, Datenblätter
   stehen unter dem Modell statt daneben, und nichts scrollt horizontal.

### Edge Cases

- Sehr schnelles Scrollen oder Sprung per Anker/Tastatur (Pos1/Ende, Tab-Fokus): Die Szene springt
  in den passenden Zustand, ohne Zwischenzustände nachzuholen.
- Fenstergröße ändern oder Handy drehen: Die Scroll-Strecken werden neu berechnet, und die Position
  bleibt im selben Abschnitt.
- Tab im Hintergrund: Es wird nicht gerendert.
- Ein Projekt-Screenshot fehlt: Das Display zeigt eine neutrale Fläche mit dem Projektnamen.
- Langsames Netz: Inhalte sind sofort lesbar, und das 3D-Modell blendet sich ein, sobald es bereit ist.
- Tastatur-Navigation: Ein fokussierter Link in einem gepinnten Abschnitt ist sichtbar und nicht
  von der Szene verdeckt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Die Seite MUSS im ersten Bildschirm Name, eine Zeile zur Person, die Sprachwahl und einen
  Scroll-Hinweis zeigen.
- **FR-002**: Das Laptop-Modell MUSS die Proportionen des eigenen Geräts haben (353,6 × 246,9 mm,
  Keil 13,9–15,9 mm, 16:9-Display, Numpad-Tastatur, Anschlüsse links/rechts wie im Original). Logos und
  Schriftzüge des Herstellers sind ausgeschlossen.
- **FR-003**: Das Aufklappen und die Explosion MÜSSEN direkt an die Scrollposition gekoppelt und
  umkehrbar sein.
- **FR-004**: Jedes Teil MUSS eine Teilenummer (P-01…P-08), einen Namen und eine Beschriftungslinie
  bekommen. Eine Stückliste MUSS alle Teile mit Abschnitt auflisten und zu den Abschnitten verlinken.
- **FR-005**: Die Abschnitte MÜSSEN der Zuordnung in der Tabelle im Überblick folgen (P-01 Projekte,
  P-02 Skills, P-03 Über mich, P-04 Lebenslauf, P-05 Kontakt).
- **FR-006**: Der Projekt-Abschnitt MUSS 6 Projekte zeigen: gen_Ut, fretlearn, Weitland, NSCS-Lernseite,
  OnlineIDE, DrawingTool. Jedes hat Name, Stack, Beschreibung (de/en), Screenshot und Link.
- **FR-007**: Lebenslauf MUSS je Sprache als PDF ansehbar und herunterladbar sein.
- **FR-008**: Alle Inhalte MÜSSEN als HTML im Dokument stehen und ohne WebGL/JavaScript lesbar sein.
  Die 3D-Szene ist für Screenreader ausgeblendet.
- **FR-009**: Bei `prefers-reduced-motion` MUSS die Seite ohne Scroll-Bindung, Pinning und Smooth Scroll
  auskommen und die Explosionszeichnung als Standbild zeigen.
- **FR-010**: Ohne WebGL MUSS ein statisches Bild der Explosionszeichnung erscheinen.
- **FR-011**: Es MUSS eine deutsche und eine englische Seite mit eigener URL geben, aus einer gemeinsamen
  Quelle. Der Umschalter MUSS zur gleichen Stelle der anderen Sprache führen.
- **FR-012**: Am Seitenende MUSS der Laptop sich wieder zusammensetzen. Das Schriftfeld enthält Kontakt,
  Sprachwahl und einen Link zu v1.
- **FR-013**: Die Gestaltung MUSS dem Look „Papier-Datenblatt“ folgen: warmes Papier, feine Linien,
  Mono-Beschriftung, Orange als einzige Signalfarbe.
- **FR-014**: Alle Bedienelemente MÜSSEN per Tastatur erreichbar sein und einen sichtbaren Fokus haben.
  Kontraste MÜSSEN WCAG AA erfüllen.
- **FR-015**: Die Seite MUSS als statische Dateien unter einem Unterpfad auf GitHub Pages lauffähig sein.
  Veröffentlicht wird aber erst nach Rustams OK.

### Key Entities

- **Teil (Part)**: Nr. (P-01…), Name de/en, zugeordneter Abschnitt (optional), Explosionsrichtung und
  -weg, Reihenfolge in der Explosion, kurze technische Angabe für die Beschriftung (z. B. „75 Wh, 4 Zellen“).
- **Abschnitt (Section)**: ID/Anker, Titel de/en, zugehöriges Teil, Inhalte.
- **Projekt (Project)**: Name, Stack, Beschreibung de/en, Screenshot, Link (Repo und/oder Live-Demo).
- **Steckbrief / Kontakt**: Schlüssel-Wert-Paare de/en (Standort, Schule, Status, Sprachen), Kanäle
  (Typ, Ziel-URL, zugeordneter Anschluss).
- **Text (String)**: Schlüssel mit `de`- und `en`-Fassung.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Eine Testperson findet ohne Hilfe innerhalb von 30 s ab Laden ein Projekt und öffnet es.
- **SC-002**: Auf Rustams Laptop in Firefox ruckelt der komplette Durchlauf von oben bis unten nicht
  sichtbar (Ziel 60 fps, kein Einbruch unter 45 fps über mehr als eine halbe Sekunde).
- **SC-003**: Lesbarer Inhalt erscheint in unter 1,5 s, die Seite ist in unter 2,5 s bedienbar
  (lokaler Produktions-Build, gedrosselt auf „Fast 4G“).
- **SC-004**: 100 % der Inhalte sind mit reduzierter Bewegung, ohne WebGL und ohne JavaScript erreichbar.
- **SC-005**: Keine fehlende Übersetzung, kein toter Link, keine Konsolenfehler in beiden Sprachen.
- **SC-006**: Bei 390 px und 1440 px Breite gibt es keinen horizontalen Scroll und keine überlappenden
  Texte. Geprüft per Screenshot an jeder Abschnittsgrenze.
- **SC-007**: Drei Personen (Freund, Lehrer, Familie) beschreiben die Seite ohne Vorgabe als
  „eigen“ oder „besonders“, nicht als „wie eine Vorlage“.

## Assumptions

- Inhalte (Texte, Projektbeschreibungen, Screenshots, Lebensläufe) werden aus v1 übernommen und nur
  gekürzt. Neue persönliche Angaben gibt es nur nach Rücksprache.
- Weitland und NSCS-Lernseite haben in v1 Live-Demos. Ihr Link geht auf die Demo, bei den anderen aufs Repo.
- Das Innenleben (Mainboard-, Akku- und Lüfter-Lage) ist stilisiert nach dem typischen Aufbau dieser
  Geräteklasse, weil es keine Teardown-Fotos vom S5506MA gibt. Eigene Fotos von der Unterseite sind optional.
- Gehäusefarbe: Rustams Gerät ist **Neutral Black**. Das Modell bekommt ein dunkles, mattes Anthrazit als Gehäuseton, das sich vom Papier abhebt.
  Signalfarbe bleibt Orange.
- Sound, Terminal, Katze und Spiele aus v1 sind ausdrücklich **nicht** Teil von v2.
- Veröffentlichung (GitHub-Repo, Pages) ist nicht Teil dieses Features und passiert erst nach Rustams OK.
