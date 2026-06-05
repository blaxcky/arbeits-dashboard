# Punkte-Jahresübersicht und Listen-UI verbessern

## Summary

Die Punkte-Jahresübersicht wird kompakter, verständlicher und besser visuell geführt. Monatszahlen werden ausgeschrieben, die "Offen"-Spalte entfällt, "OK" wird rückwirkend nach aktuellem Jahresstand bewertet, und der aktuelle Monat wird hervorgehoben. Zusätzlich werden die Punkte-Falllisten auf Icon-Aktionen umgestellt, BP erhält einen Status-Toggle, Steuernummern werden automatisch formatiert, Metriken werden vertikal sauber zentriert, und die Reisekostenliste wird in offene und erledigte Reisen getrennt.

## Key Changes

- Jahresübersicht Punkte:
  - Monatsanzeige in BP, USO und Sonstige von `01`/`02` auf ausgeschriebene österreichische Monatsnamen umstellen, z.B. `Jänner`, `Februar`.
  - Gemeinsamen Helper nutzen, z.B. `formatMonthName("2026-01")`.
  - Tabellen kompakter machen: kleinere horizontale Padding-Werte, keine unnötig hohe `min-width`, numerische Spalten eng, Monats-Spalte links lesbar.
  - Die letzte Spalte `Offen` bei BP und USO entfernen.
  - USO-Tabelle soll auf Desktop nicht horizontal scrollen; horizontaler Scroll bleibt nur als Mobile-Fallback, falls die Viewportbreite wirklich nicht reicht.
  - Aktuellen Monat nur im aktuell ausgewählten Jahr hervorheben:
    - Zeile fett.
    - Dezenter farblicher Hintergrund.
    - Gilt für BP, USO und Sonstige.
  - "noch offen / OK" rückwirkend nach aktuellem Jahres-Gesamtstand berechnen:
    - Für jede Monatszeile wird das Monatssoll wie bisher berechnet.
    - Verglichen wird gegen den aktuellen Jahresstand aus allen erfassten erledigten Werten im ausgewählten Jahr, nicht gegen den Stand bis zu diesem Monat.
    - Eine Monatszeile ist `OK`, sobald der aktuelle Jahresstand das Soll dieser Monatszeile deckt.
    - `noch offen` zeigt `max(monatssoll - aktueller Jahresstand, 0)`.

- Punkte-Eingabemaske und Fallübersichten:
  - In den Falllisten Buttons mit Text durch Icon-Buttons ersetzen:
    - Bearbeiten: `PencilSimple`
    - Löschen: `Trash`
    - Erledigt/Auf offen setzen: `CheckCircle` bzw. `ArrowClockwise`
  - USO-Status-Button ebenfalls als Icon-Button darstellen.
  - BP-Fallliste bekommt zusätzlich denselben Status-Toggle wie USO.
  - Steuernummer im BP-Formular automatisch nach `99-999/9999` formatieren:
    - Eingabe darf als reine Ziffernfolge erfolgen.
    - Beim Tippen oder spätestens beim Speichern wird auf maximal 9 Ziffern normalisiert.
    - Beispiel: `123456789` wird `12-345/6789`.
    - Bereits korrekt formatierte Eingabe bleibt korrekt.
  - BP-Metrikblock in der Fallübersicht vertikal zentrieren, damit Punkte, Mehrergebnis und §99-Text optisch mittig stehen.
  - Dieselbe Zentrierung auch für Reisekosten-Zeilen anwenden, weil sie dasselbe Row-Layout nutzen.

- Reisekostenliste:
  - Bereich "Erfasste Reisen" in zwei Cards trennen:
    - Oben: `Offene Reisen`
    - Darunter: `Erledigte Reisen`
  - Offene Reisen nicht mehr über den Badge-Text `Offen` markieren.
  - Zeilen sollen durch die Statusänderung nicht mehr springen.
  - Bestehende Aktionen pro Reise bleiben erhalten: erledigen/offen setzen, bearbeiten, duplizieren, löschen.
  - Leere Zustände je Bereich anzeigen, z.B. `Keine offenen Reisen.` und `Keine erledigten Reisen.`.

## Implementation Notes

- Keine Datenbank- oder Backup-Schemaänderung nötig.
- Berechnungslogik in `src/modules/points/calculations.ts` anpassen:
  - `YearlyMonthlyRow` um die neue rückwirkende Zielbewertung unterstützen.
  - `openValue` für BP/USO nicht mehr für die Tabelle benötigen; falls noch für Summary gebraucht, dort separat berechnen oder bestehende Summary-Werte beibehalten.
- UI in `src/app/App.tsx` anpassen:
  - `PointsYearTable` ohne `Offen`-Spalte rendern.
  - Aktuelle Monatszeile über Klasse markieren.
  - Trip-Liste in offene und erledigte Listen aufteilen.
  - Icon-Buttons mit vorhandenen Phosphor-Icons verwenden.
- CSS in `src/styles.css` anpassen:
  - kompakte Tabellenbreiten und aktuelle-Monat-Highlight.
  - `.trip-row-metrics` mit `align-content: center`/`justify-items` sauber zentrieren.
  - keine Status-Badges mehr, die beim Erledigen Layoutsprünge erzeugen.

## Test Plan

- Unit-Tests für Punkte-Jahreszeilen:
  - Monatsnamen werden für `de-AT` korrekt angezeigt.
  - `OK` wird rückwirkend nach aktuellem Jahresstand gesetzt.
  - `noch offen` sinkt rückwirkend für frühere Monate, wenn spätere Erledigungen den Jahresstand erhöhen.
  - BP und USO haben keine `Offen`-Tabellenspalte mehr.
- App-/Helper-Tests:
  - Steuernummernformatierung: `123456789` -> `12-345/6789`, Teil-Eingaben bleiben sinnvoll, Sonderzeichen werden bereinigt.
  - `pointYearOptions` bleibt unverändert funktionsfähig.
- UI-nahe Tests, soweit bestehend sinnvoll:
  - BP-Fall hat Status-Toggle.
  - Bearbeiten/Löschen/Status-Aktionen sind über `aria-label` auffindbar.
  - Offene und erledigte Reisen werden in getrennten Bereichen gerendert.
- Abschlusschecks:
  - `npm test`
  - `npm run build`

## Assumptions

- Die "Offen"-Spalte in BP/USO wird vollständig entfernt, nicht umbenannt.
- "OK rückwirkend" bedeutet: Bewertung gegen den aktuellen Jahres-Gesamtstand im ausgewählten Jahr.
- Die Reise-Liste wird in getrennte Cards für offene und erledigte Reisen umgebaut.
- Der Plan wird bei Umsetzung in `USER-PLAN.md` geschrieben.
- Nach Umsetzung wird ein fokussierter Commit erstellt und der Branch mit Remote synchronisiert.
