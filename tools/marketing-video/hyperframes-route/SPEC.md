# SPEC – „Session-Rückblick mit GPS-Route“ (Funktionsanimation, kein Werbevideo)

GOAL:    Der Zuschauer versteht, wie die Route während einer Session entsteht (welche GPS-Punkte gespeichert und welche verworfen werden, was bei einer Lücke passiert) und was der Rückblick nach dem Beenden zeigt.
OUTPUT:  HyperFrames, 1920 × 1080, 30 fps, ca. 33 s, ohne Sprecher, leise eigene Musik.
QUELLE:  Funktion aus main (PR #69, Commit af50793): domain/track.ts, domain/sessionReview.ts, ARCHITECTURE §5.4, Texte aus i18n/de.ts.
         Regeln im Bild genau wie im Code: höchstens alle 10 s, erst ab 8 m Bewegung (bzw. mehr als die Ungenauigkeit), Genauigkeit > 50 m verworfen,
         > 15 m/s (≈ 54 km/h) als Sprung verworfen, Neustart nach Hintergrund/Pause = neuer Abschnitt, Lücke wird nicht verbunden. Nur bei geöffneter App.
LOOK:    Schema-Karte von oben (kein echter Kartenausschnitt): Land #0E3540, See #17566A mit Uferlinie #5CC4D6, Grund #0B2A33.
         Farben des Rückblicks im Dunkelmodus (ReviewMap.tsx): Route #7FD1C7 auf Umrandung #0B1F22, Start #6FCF97, Ende #EAF3F2, Fang-Ring #F2B65A.
         Schrift: Fraunces 640 für die eine große Zeile je Abschnitt (64 px), Inter 500/600 für Beschriftungen (26–30 px), direkt am Objekt mit Führungslinie.
OBJECTS: Angler als weißer Punkt, läuft in Schlangenlinien am Ufer entlang (Wunsch Nutzer), mit blasser gepunkteter Spur des wirklichen Wegs.
         GPS-Punkte entstehen aus einer Simulation mit denselben Regeln wie domain/track.ts (Rauschen mit festem Startwert, keine Zufallszahlen zur Laufzeit).
MOTION:  Ein Bild, das wächst: Karte → Weg → Punkte → Verwerfen-Beispiele → Lücke → Fänge → Beenden → Rückblick auf derselben Karte.
         Ankommen expo.out, Abgang power2.in (40–50 % kürzer). Gelandete Zeilen stehen still.
SHOTS:   0–2,4 s Karte entsteht · 2,4–15,7 s Session (Zeitraffer ×35, Uhr läuft) mit: ungenauer Fix, Stillstand (zu nah), Fang, Sprung, App im Hintergrund, neuer Abschnitt, Fang
         · 15,7–16,6 s „Session beenden“ · 16,6–29 s Rückblick: Route wächst (1×, dann 4×), Einträge erscheinen zu ihrem Zeitpunkt, „Ganze Route“, Highlights (Beispielwerte aus der Simulation)
         · 29–33 s Schlusszeile.
BANNED:  Werbe-Sprache, Logo-Abschluss, QR, Zahlen ohne Herkunft (alle Werte stammen aus der Simulation und sind als Beispiel gekennzeichnet), Behauptung Hintergrund-Aufzeichnung, Klick-Ringe als Dauerschleife, schwebende Dinge.
