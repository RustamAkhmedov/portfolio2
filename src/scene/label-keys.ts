// Schlüssel der zusätzlichen Labels (Skill-Chips auf dem Mainboard, Kontaktkanäle an den Anschlüssen).
// Geteilt von labels.ts (erzeugt die Elemente) und choreo/score.ts (blendet sie ein). Reine Funktionen.

export const skillKey = (i: number): string => `skill-${i}`;
export const portKey = (i: number): string => `port-${i}`;
