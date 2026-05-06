# Work-Dashboard - Umsetzungsplan

## 1. Zielbild

Das Work-Dashboard wird eine lokale, offlinefähige und installierbare PWA für die Arbeit. Die App läuft hauptsächlich im Browser am Laptop oder PC und dient als zentrale Arbeitsübersicht für Zeiterfassung, Gleitzeit, Urlaub, später Reisekosten und Aufgaben.

Der wichtigste Grundsatz ist Datenschutz:

> Arbeitsdaten dürfen das Arbeitsgerät nicht verlassen.

Es gibt keine serverseitige Speicherung, keine Cloud-Synchronisierung, keine externe Datenbank, keine Analytics und keine extern geladenen Kern-Assets. Alle fachlichen Daten werden lokal im Browser gespeichert.

## 2. Verbindliche V1-Entscheidungen

- [ ] Greenfield-App mit Vite, React und TypeScript aufbauen.
- [ ] PWA installierbar und offlinefähig machen.
- [ ] Fachliche Daten in IndexedDB über Dexie.js speichern.
- [ ] Hash-Routing verwenden, damit GitHub Pages und Offline-Nutzung robust funktionieren.
- [ ] Vite-Base-Pfad auf `/arbeits-dashboard/` setzen.
- [ ] GitHub Pages Deployment per GitHub Actions vorbereiten.
- [ ] App beim Erststart direkt im Dashboard öffnen.
- [ ] Dashboard in V1 auf Zeiterfassung, Woche, Gleitzeit, Urlaub und Setup-Hinweise fokussieren.
- [ ] Zeiterfassung in V1 primär manuell bedienen.
- [ ] Urlaub in V1 als Summenwerte in Stunden führen, nicht als Urlaubstags-Kalender.
- [ ] Backup-Import in V1 strikt validieren und nur nach Vorschau vollständig ersetzen.
- [ ] Reisekosten, Nachweise und Todo in V1 nur architektonisch vorbereiten und als Roadmap dokumentieren.

## 3. Technische Basis

### 3.1 Stack

- [ ] Vite als Build-Tool einrichten.
- [ ] React als UI-Framework einrichten.
- [ ] TypeScript strikt genug konfigurieren, damit Fachlogik und Datenmodelle sauber typisiert sind.
- [ ] Dexie.js für IndexedDB einrichten.
- [ ] ZIP-Unterstützung für Backup-Export und Import einplanen.
- [ ] Test-Setup für Unit-Tests einrichten.
- [ ] PWA-Plugin oder eigene Service-Worker-Integration auswählen und konfigurieren.

### 3.2 Routing

- [ ] Hash-Routing einrichten.
- [ ] Route `#/` für Dashboard anlegen.
- [ ] Zeiterfassung als Hauptworkflow direkt im Dashboard bereitstellen, ohne eigene Route.
- [ ] Route `#/reisekosten` als Roadmap-/Platzhalterbereich anlegen.
- [ ] Route `#/aufgaben` als Roadmap-/Platzhalterbereich anlegen.
- [ ] Route `#/einstellungen` für Einstellungen anlegen.
- [ ] Unbekannte Routen auf Dashboard oder eine einfache Fehleransicht führen.

### 3.3 Projektstruktur

Geplante Struktur:

```text
src/
|-- app/
|-- components/
|-- db/
|-- modules/
|   |-- dashboard/
|   |-- time/
|   |-- expenses/
|   |-- todos/
|   |-- settings/
|-- services/
|   |-- backup/
|   |-- pwa/
|-- lib/
|   |-- time/
|   |-- dates/
|   |-- validation/
|-- styles/
```

Aufgaben:

- [ ] App-Shell von Modul-Views trennen.
- [ ] Datenbankzugriff in `db` kapseln.
- [ ] Berechnungslogik in testbare pure Funktionen auslagern.
- [ ] Backup/Import/Export als eigenen Service umsetzen.
- [ ] PWA-spezifische Funktionen als eigenen Service umsetzen.
- [ ] UI-Komponenten wiederverwendbar und fachlich schlank halten.

## 4. Datenschutz, Netzwerk und Offline-Regeln

### 4.1 Kernregeln

- [ ] Keine Arbeitsdaten an externe Dienste senden.
- [ ] Keine fachlichen Daten außerhalb des Browsers speichern.
- [ ] Keine externen Skripte oder Assets für den Kernbetrieb laden.
- [ ] Keine API-Keys im Quellcode ablegen.
- [ ] LocalStorage nur für einfache UI-Zustände oder nicht-kritische Präferenzen verwenden.
- [ ] Arbeitsdaten, Zeitdaten, Reiseeinträge, Backups, Nachweise und spätere Dateien in IndexedDB speichern.

### 4.2 Erlaubte spätere Komfortaktionen

Diese Aktionen sind nur bewusst durch Nutzer ausgelöst erlaubt:

- [ ] Google-Maps-Link öffnen.
- [ ] Google-Maps-API manuell abfragen.
- [ ] ÖBB-Link oder ÖBB-Komfortfunktion öffnen.

Regeln:

- [ ] Google-Maps-API-Key ausschließlich lokal speichern.
- [ ] ÖBB-Komfortfunktion nicht für automatische Berechnungen verwenden.
- [ ] Keine automatische Datenrückgabe aus ÖBB erwarten.

## 5. UI und App-Struktur

### 5.1 Layout

- [ ] Desktop-orientierte App-Shell mit linker Sidebar und rechter Arbeitsfläche bauen.
- [ ] Mobile/kleine Viewports mit kompakter Navigation unterstützen.
- [ ] Hauptbereiche in der Sidebar anzeigen:
  - [ ] Dashboard
  - [ ] Reisekosten
  - [ ] Aufgaben
  - [ ] Einstellungen
- [ ] Aktive Route sichtbar markieren.
- [ ] App-Version im Einstellungsbereich anzeigen.

### 5.2 Visuelle Richtung

- [ ] Ruhige, helle Arbeitsoberfläche umsetzen.
- [ ] Hohe Lesbarkeit und klare Kontraste sicherstellen.
- [ ] Dezente Akzentfarbe verwenden.
- [ ] Keine grellen Verläufe oder dekorativen Effekte einsetzen.
- [ ] Datenorientierte, kompakte Darstellung für wiederholte Arbeit verwenden.
- [ ] Formulare mit klaren Labels, Hilfetexten und Fehlerzuständen bauen.
- [ ] Leere Zustände, Ladezustände und Warnungen explizit gestalten.

## 6. Lokale Datenbank

### 6.1 Kalenderregeln

- [ ] Zeitzone `Europe/Vienna` verwenden.
- [ ] Wochenstart Montag verwenden.
- [ ] ISO-Kalenderwochen verwenden.
- [ ] Jahreswerte auf Kalenderjahr beziehen.
- [ ] Datumswerte konsistent als lokale Kalendertage speichern und anzeigen.

### 6.2 Dexie-Stores V1

- [ ] Store `settings` für allgemeine Einstellungen anlegen.
- [ ] Store `timeEntries` für Zeiteinträge anlegen.
- [ ] Store `flexCorrections` für Gleitzeitkorrekturen anlegen.
- [ ] Store `vacationSummary` für Urlaubs-Summenwerte anlegen.
- [ ] Store `appMeta` für Schema-Version, Setup-Status und interne Metadaten anlegen.

### 6.3 Vorbereitete spätere Stores

Diese Stores müssen nicht voll genutzt werden, dürfen aber im Backup-Format vorbereitet werden:

- [ ] `trips` für Reisekosten.
- [ ] `todos` für Aufgaben.
- [ ] `files` für Nachweise und Dateien.

### 6.4 Migrationsregeln

- [ ] Datenbankschema versionieren.
- [ ] Backup-Schema getrennt versionieren.
- [ ] Migrationen nachvollziehbar und testbar halten.
- [ ] Bei unbekannter Backup-Hauptversion Import ablehnen.

## 7. Dashboard V1

### 7.1 Erststart-Verhalten

- [ ] App beim ersten Start direkt im Dashboard öffnen.
- [ ] Fehlende Sollzeit, Gleitzeitstartwerte oder Urlaubswerte als Setup-Hinweise anzeigen.
- [ ] Setup-Hinweise auf passende Einstellungen verlinken.
- [ ] Dashboard trotzdem nutzbar lassen, auch wenn noch nicht alles eingerichtet ist.

### 7.2 Dashboard-Kennzahlen

- [ ] Heutige Arbeitszeit anzeigen.
- [ ] Restzeit bis Soll anzeigen.
- [ ] Uhrzeit anzeigen, wann Soll erreicht wird.
- [ ] Aktuelles Tages-Plus oder Tages-Minus anzeigen.
- [ ] Wochensumme anzeigen.
- [ ] Gleitzeitstand anzeigen.
- [ ] Warnung bei Überschreiten der Gleitzeitgrenze anzeigen.
- [ ] Offenen Urlaub in Stunden und Tagen anzeigen.
- [ ] Summe anzeigen, die im aktuellen Jahr noch verbraucht werden muss.

### 7.3 Dashboard-Zustände

- [ ] Hinweis bei fehlendem Dienstbeginn anzeigen.
- [ ] Hinweis bei unvollständigem Arbeitstag anzeigen.
- [ ] Hinweis bei fehlender Urlaubseinrichtung anzeigen.
- [ ] Hinweis bei fehlendem Gleitzeitstartwert anzeigen.
- [ ] Roadmap-Module Reisekosten und Aufgaben als nicht aktive Bereiche kennzeichnen.

## 8. Dashboard-Zeiterfassung V1

### 8.1 Zweck

Die Zeiterfassung ersetzt die bisherige Excel-Lösung für Arbeitszeiten, Gleitzeit, Plus-/Minusstunden und Urlaubsausblick. In V1 ist sie kein eigener Navigationsbereich, sondern der dominante Arbeitsbereich im Dashboard.

### 8.2 Tageserfassung

V1 unterstützt einen Zeiteintrag pro Datum.

Ein Zeiteintrag enthält:

- [ ] ID
- [ ] Datum
- [ ] Dienstbeginn
- [ ] Dienstende
- [ ] Pause in Minuten
- [ ] Sollzeit in Minuten
- [ ] Notiz bleibt im Datenmodell für Backup- und Kompatibilität erhalten, wird aber im Tagesformular nicht angezeigt.
- [ ] createdAt
- [ ] updatedAt

Umsetzung:

- [ ] Tagesformular prominent im Dashboard für ein wählbares Datum bauen.
- [ ] Standarddatum auf heute setzen.
- [ ] Beginn und Ende als reine Tastatur-Zeitfelder ohne nativen Uhr-Picker umsetzen.
- [ ] Eingaben wie `7:30`, `07:30`, `730` und `0730` beim Verlassen des Felds zu `HH:MM` normalisieren.
- [ ] Beginn, Ende, Pause und Sollzeit manuell editierbar machen; Notiz nicht mehr im Dashboard anzeigen.
- [ ] Pro Datum vorhandenen Eintrag laden.
- [ ] Änderungen an Beginn, Ende, Pause und Sollzeit beim Verlassen des jeweiligen Felds automatisch speichern.
- [ ] Kein manueller Speichern-Button im Tagesformular.
- [ ] Löschen für den aktuellen Tages-Eintrag anbieten.
- [ ] Validierung für Uhrzeiten und Pausenwerte anzeigen.

### 8.3 Berechnete Tageswerte

- [ ] Wochentag berechnen.
- [ ] Ist-Zeit berechnen.
- [ ] Pluszeit berechnen.
- [ ] Minuszeit berechnen.
- [ ] Soll-Ende berechnen.
- [ ] Tagesstatus berechnen.
- [ ] Alle Berechnungen als pure Funktionen implementieren.

### 8.4 Pausenmodell

Die verbindliche V1-Regel lautet:

> 30 Minuten Pause sind im Solltag enthalten. Nur Pause über 30 Minuten verlängert das Soll-Ende.

Beispiel:

- Dienstbeginn: 07:00
- Pause: 30 Minuten
- Sollzeit: 8 Stunden
- Soll-Ende: 15:00

Berechnung Soll-Ende:

```text
Soll-Ende = Dienstbeginn + Sollzeit + max(Pause - 30 Minuten, 0)
```

Aufgaben:

- [ ] 30-Minuten-Inklusivpause in Tagesberechnung berücksichtigen.
- [ ] Pausen über 30 Minuten als verlängernd behandeln.
- [ ] Ist-Zeit für Plus/Minus so berechnen, dass die inkludierte Pause nicht doppelt negativ wirkt.
- [ ] Edge Cases für Pause 0, 30 und über 30 Minuten testen.

### 8.5 Live-Anzeige

Die Live-Auswertung neben dem Tagesformular zeigt:

- [ ] Netto-Arbeitszeit heute.
- [ ] Restzeit bis Soll.
- [ ] Uhrzeit, wann Soll erreicht wird.
- [ ] aktuelles Plus.
- [ ] aktuelles Minus.
- [ ] Hinweis bei fehlendem Dienstbeginn.
- [ ] Hinweis bei unvollständigem Arbeitstag.

Regeln:

- [ ] Wenn Dienstende eingetragen ist, dieses Dienstende verwenden.
- [ ] Wenn Dienstende fehlt, aktuelle Uhrzeit für Live-Anzeige verwenden.
- [ ] Live-Werte regelmäßig aktualisieren.
- [ ] Live-Anzeige darf gespeicherte Daten nicht automatisch verändern.

### 8.6 Wochenübersicht

Die Wochenübersicht zeigt:

- [ ] Zeiteinträge pro Tag.
- [ ] Plus/Minus pro Tag.
- [ ] Wochensumme.
- [ ] Plusstunden dieser Woche.
- [ ] Minusstunden dieser Woche.
- [ ] Navigation zwischen Wochen.
- [ ] Woche beginnt Montag.

## 9. Gleitzeit

### 9.1 Berechnung

Der Gesamt-Gleitzeitstand wird so berechnet:

```text
Gleitzeitstand = Startwert + Summe Tagesdifferenzen + Summe Korrekturen
```

Aufgaben:

- [ ] Gleitzeitstartwert in Einstellungen pflegen.
- [ ] Tagesdifferenzen aus gespeicherten Zeiteinträgen summieren.
- [ ] Korrekturen einbeziehen.
- [ ] Gesamtstand in Stunden und Minuten anzeigen.
- [ ] Berechnung testbar in eigener Funktion halten.

### 9.2 Korrekturen

Manuelle Korrekturen werden nachvollziehbar gespeichert:

- [ ] ID
- [ ] Datum
- [ ] alter Wert
- [ ] neuer Wert
- [ ] Differenz
- [ ] Grund oder Notiz
- [ ] createdAt

Umsetzung:

- [ ] Korrekturformular im Einstellungsbereich bauen.
- [ ] Liste der Korrekturen anzeigen.
- [ ] Korrekturen löschen oder stornieren können.
- [ ] Auswirkungen auf Gleitzeitstand sofort sichtbar machen.

### 9.3 Gleitzeitgrenze

- [ ] Gleitzeitgrenze einstellbar machen.
- [ ] Standardwert 100 Stunden setzen.
- [ ] Warnung anzeigen, wenn Gleitzeitstand über Grenze liegt.
- [ ] Stunden über Grenze als noch zu verbrauchenden Zeitausgleich anzeigen.

## 10. Urlaub und Zeitausgleich

### 10.1 Urlaub

Urlaub wird intern in Stunden gespeichert und zusätzlich in Tagen angezeigt.

Standardumrechnung:

```text
1 Urlaubstag = 8 Stunden
```

Aufgaben:

- [ ] Urlaubsanspruch in Stunden speichern.
- [ ] Verbrauchte Urlaubsstunden speichern.
- [ ] Resturlaub berechnen.
- [ ] Werte zusätzlich in Tagen anzeigen.
- [ ] Einrichtungshinweis anzeigen, bis der Anspruch gepflegt wurde.
- [ ] Keine konkreten Urlaubstage in V1 verwalten.

### 10.2 Zeitausgleich

Zeitausgleich wird aus dem Gleitzeitstand berechnet:

- [ ] Stunden anzeigen.
- [ ] Tage anzeigen.
- [ ] Wochen anzeigen.

Standardumrechnung:

- 1 Arbeitstag = 8 Stunden.
- 1 Arbeitswoche = 40 Stunden.

### 10.3 Jahresverbrauch

Besonders wichtig ist die Summe, die im aktuellen Jahr noch verbraucht werden muss:

```text
offener Urlaub + Stunden über erlaubter Gleitzeitgrenze
```

Aufgaben:

- [ ] Offenen Urlaub berechnen.
- [ ] Stunden über Gleitzeitgrenze berechnen.
- [ ] Summe im Dashboard anzeigen.
- [ ] Summe in Einstellungen oder Urlaubskachel nachvollziehbar erklären.

## 11. Einstellungen V1

Der Einstellungsbereich enthält mindestens:

- [ ] App-Version.
- [ ] Speicherstatus.
- [ ] Backup exportieren.
- [ ] Backup importieren.
- [ ] Cache und Service Worker zurücksetzen.
- [ ] Lokale Daten löschen mit starker Warnung.
- [ ] Tägliche Soll-Arbeitszeit.
- [ ] Wochenarbeitszeit.
- [ ] Gleitzeitgrenze.
- [ ] Gleitzeitstartwert.
- [ ] Gleitzeitkorrekturen.
- [ ] Urlaubsanspruch.
- [ ] Urlaubswerte.

Standardwerte:

- [ ] Soll-Arbeitszeit: 8 Stunden pro Tag.
- [ ] Wochenarbeitszeit: 40 Stunden.
- [ ] Gleitzeitgrenze: 100 Stunden.
- [ ] Urlaubsanspruch: leer bis eingerichtet.

Umsetzung:

- [ ] Einstellungsbereich in sinnvolle Abschnitte teilen.
- [ ] Speichern pro Abschnitt oder klarer globaler Speichermechanik festlegen.
- [ ] Validierung für Minuten-/Stundenwerte anzeigen.
- [ ] Änderungen sofort im Dashboard widerspiegeln.

## 12. Backup, Export und Import

### 12.1 Backup-Format

Das Backup-Format ist eine ZIP-Datei mit Manifest.

Geplante Struktur:

```text
backup.zip
|-- manifest.json
|-- data.json
|-- files/
    |-- nachweis-1.png
    |-- ticket-1.pdf
```

V1 nutzt dieselbe Struktur bereits für Daten ohne Dateien. Dadurch ist das Format für spätere Nachweise, Screenshots und Belege vorbereitet.

### 12.2 Export

Der Export enthält:

- [ ] Manifest mit App-Name.
- [ ] Manifest mit Backup-Schema-Version.
- [ ] Manifest mit Export-Zeitpunkt.
- [ ] Einstellungen.
- [ ] Zeiteinträge.
- [ ] Gleitzeitstartwert.
- [ ] Gleitzeitkorrekturen.
- [ ] Urlaubswerte.
- [ ] Leere oder vorbereitete Felder für spätere Reisekosten, Todos und Dateien.

Aufgaben:

- [ ] ZIP-Datei lokal im Browser erzeugen.
- [ ] Dateiname mit Datum/Uhrzeit erzeugen.
- [ ] Export ohne Netzwerkverbindung ermöglichen.
- [ ] Exportfehler sichtbar anzeigen.

### 12.3 Import

Import-Verhalten:

- [ ] Backup-Datei auswählen.
- [ ] ZIP-Struktur prüfen.
- [ ] Manifest prüfen.
- [ ] Daten prüfen.
- [ ] Schema-Hauptversion prüfen.
- [ ] Zusammenfassung anzeigen.
- [ ] Erst nach ausdrücklicher Bestätigung lokale Datenbank ersetzen.

V1 implementiert keinen Merge-Import. Das Standardverhalten ist vollständiges Ersetzen nach Vorschau.

Regeln:

- [ ] Unbekannte oder inkompatible Backup-Hauptversion ablehnen.
- [ ] Fehlerhafte Pflichtfelder ablehnen.
- [ ] Bekannte optionale Zukunftsfelder ignorieren, sofern sie die V1-Daten nicht betreffen.
- [ ] Vor dem Ersetzen klare Warnung anzeigen.
- [ ] Nach Import App-Daten neu laden.

### 12.4 Verschlüsselung

- [ ] Backups in V1 unverschlüsselt lassen.
- [ ] Verschlüsselung als spätere Erweiterung dokumentieren.

## 13. PWA, Updates und Reset

### 13.1 PWA

- [ ] Web-App-Manifest erstellen.
- [ ] App-Icons einbinden.
- [ ] App installierbar machen.
- [ ] App-Shell und statische Assets cachen.
- [ ] Offline-Start testen.
- [ ] Fachliche Daten in IndexedDB belassen.

### 13.2 Updates

Update-Verhalten:

- [ ] Neue App-Version erkennen.
- [ ] Update-Hinweis anzeigen.
- [ ] Nutzer bewusst neu laden lassen.
- [ ] Lokale Daten erhalten.

### 13.3 Reset

Reset-Funktionen:

- [ ] Cache und Service Worker zurücksetzen.
- [ ] App neu laden.
- [ ] IndexedDB und Arbeitsdaten dabei nicht löschen.

Datenlöschung:

- [ ] Separate Funktion im Einstellungsbereich anbieten.
- [ ] Deutliche Warnung anzeigen.
- [ ] Vorab Backup empfehlen.
- [ ] Endgültige Bestätigung verlangen.

## 14. Roadmap Reisekosten

Das Reisekostenmodul wird später als eigenständiges Modul innerhalb derselben App umgesetzt.

Geplante Funktionen:

- [ ] Reise erstellen, bearbeiten und löschen.
- [ ] Datum, Zeit von, Zeit bis und Dauer.
- [ ] Grund, Ort und Zieladresse.
- [ ] Fahrtkostenart.
- [ ] Einfache Strecke in Kilometern.
- [ ] Diäten.
- [ ] Sonstige Kosten.
- [ ] Nachweise und Screenshots.
- [ ] Erledigt-Status.
- [ ] Jahresübersichten.
- [ ] Differenzwerbungskosten.

Fahrtkostenarten:

- [ ] Kilometergeld.
- [ ] Beförderungszuschuss normal.
- [ ] Beförderungszuschuss Öffis.
- [ ] Dienstauto.
- [ ] Sonstige Kosten oder freier Betrag.

Architekturregel:

- [ ] Fahrtkostenlogik regelbasiert und modular aufbauen.
- [ ] Sätze und Regeln später wartbar änderbar halten.
- [ ] Reisekostenberechnungen nicht in UI-Komponenten verstreuen.

## 15. Roadmap Nachweise und Dateien

Dateien und Screenshots werden später lokal in IndexedDB gespeichert und Reiseeinträgen zugeordnet.

Nachweise müssen:

- [ ] lokal gespeichert werden.
- [ ] einer Reise zugeordnet sein.
- [ ] angezeigt werden können.
- [ ] heruntergeladen werden können.
- [ ] im Backup enthalten sein.
- [ ] nach Import wiederhergestellt werden.

Mögliche Nachweistypen:

- [ ] Dienstauto-Nachweis.
- [ ] ÖBB-Verbindungskosten.
- [ ] Parkticket.
- [ ] Zugticket.
- [ ] Sonstiger Beleg.

## 16. Roadmap Komfortfunktionen

Spätere Komfortfunktionen:

- [ ] Google-Maps-Link aus Startadresse und Zieladresse erzeugen.
- [ ] Sonderzeichen, Umlaute und Leerzeichen korrekt per URL-Encoding behandeln.
- [ ] Google-Maps-API-Key lokal speichern.
- [ ] Google-Maps-API-Abfrage nur manuell auslösen.
- [ ] ÖBB-Komfortlink oder ÖBB-Widget pro Reise erzeugen.
- [ ] Mehrere ÖBB-Abfahrtsorte unterstützen.
- [ ] Keine automatische Datenübernahme aus ÖBB.

## 17. Roadmap Todo-Modul

Das Todo-Modul wird als einfaches, später erweiterbares Aufgabenmodul geplant.

Grundfunktionen:

- [ ] Aufgabe erstellen.
- [ ] Aufgabe bearbeiten.
- [ ] Aufgabe löschen.
- [ ] Aufgabe abhaken.
- [ ] Offene Aufgaben anzeigen.
- [ ] Erledigte Aufgaben anzeigen.
- [ ] Fälligkeitsdatum.
- [ ] Priorität.
- [ ] Tags oder Kategorien.
- [ ] Notizen.
- [ ] Filter.
- [ ] Suche.

Spätere Erweiterungen:

- [ ] Wiederkehrende Aufgaben.
- [ ] Erinnerungen.
- [ ] Projektzuordnung.
- [ ] Unteraufgaben.
- [ ] Checklisten.
- [ ] Archiv.

## 18. Architekturprinzipien

- [ ] App modular aufbauen.
- [ ] UI-Komponenten von Modul-Views trennen.
- [ ] Datenbankzugriff kapseln.
- [ ] Berechnungslogik isolieren.
- [ ] Einstellungen zentral verwalten.
- [ ] Backup/Import/Export getrennt halten.
- [ ] PWA-Service getrennt halten.
- [ ] Dateiverwaltung getrennt halten.
- [ ] Berechnungslogik nicht direkt in UI-Komponenten verstreuen.
- [ ] Regeln für Zeiterfassung, Gleitzeit, Urlaub, Reisekosten, Diäten und Differenzwerbungskosten in eigene testbare Funktionen legen.

## 19. Testplan V1

### 19.1 Unit-Tests

- [ ] Zeitberechnung mit inkludierter 30-Minuten-Pause testen.
- [ ] Zeitberechnung mit mehr als 30 Minuten Pause testen.
- [ ] Zeitberechnung mit 0 Minuten Pause testen.
- [ ] Live-Berechnung ohne Dienstende testen.
- [ ] Berechnung mit eingetragenem Dienstende testen.
- [ ] Tagesplus testen.
- [ ] Tagesminus testen.
- [ ] Wochenübersicht testen.
- [ ] ISO-Wochenstart Montag testen.
- [ ] Gleitzeitstand aus Startwert, Tagen und Korrekturen testen.
- [ ] Warnung bei Überschreiten der Gleitzeitgrenze testen.
- [ ] Urlaubsumrechnung Stunden/Tage testen.
- [ ] Zu verbrauchende Jahressumme testen.

### 19.2 Daten- und Backup-Tests

- [ ] Dexie-Initialisierung testen.
- [ ] Standardwerte testen.
- [ ] Backup-Export testen.
- [ ] Backup-Manifest testen.
- [ ] Backup-Import mit Vorschau testen.
- [ ] Backup-Import mit Ersetzen testen.
- [ ] Inkompatibles Backup ablehnen.
- [ ] Fehlerhaftes Backup ablehnen.

### 19.3 PWA- und Build-Tests

- [ ] GitHub-Pages-Build mit korrektem Base-Pfad testen.
- [ ] Offline-Start nach installiertem PWA-Cache testen.
- [ ] Cache-/Service-Worker-Reset ohne Datenverlust testen.
- [ ] Update-Hinweis testen.

### 19.4 UI-Szenarien

- [ ] Erststart mit leerer Datenbank testen.
- [ ] Dashboard mit fehlenden Einstellungen testen.
- [ ] Dashboard mit voll eingerichteten Einstellungen testen.
- [ ] Tagesformular erstellen, bearbeiten und löschen testen.
- [ ] Wochenwechsel testen.
- [ ] Einstellungen speichern testen.
- [ ] Datenlösch-Warnung testen.

## 20. Umsetzungsschritte

### Phase 1 - Projektfundament

- [ ] Vite/React/TypeScript-Projekt erstellen.
- [ ] Basiskonfiguration für TypeScript, Vite und Tests erstellen.
- [ ] App-Shell mit Routing aufbauen.
- [ ] Grundlayout mit Sidebar und Arbeitsfläche umsetzen.
- [ ] Basisstyles und UI-Tokens definieren.
- [ ] GitHub-Pages-Base-Pfad konfigurieren.
- [ ] Erste Build- und Test-Kommandos prüfen.

### Phase 2 - Datenbasis

- [ ] Dexie einrichten.
- [ ] Datenmodelle für V1 definieren.
- [ ] Stores für Einstellungen, Zeiteinträge, Gleitzeitkorrekturen, Urlaub und App-Metadaten anlegen.
- [ ] Standardwerte und Setup-Erkennung implementieren.
- [ ] Datenzugriffsfunktionen erstellen.
- [ ] Erste Datenbanktests schreiben.

### Phase 3 - Berechnungslogik

- [ ] Datums- und Kalenderhelfer implementieren.
- [ ] Tageszeitberechnung implementieren.
- [ ] Pausenregel implementieren.
- [ ] Wochenberechnung implementieren.
- [ ] Gleitzeitberechnung implementieren.
- [ ] Urlaubsumrechnung implementieren.
- [ ] Jahresverbrauchsberechnung implementieren.
- [ ] Unit-Tests für alle Rechenregeln schreiben.

### Phase 4 - Dashboard-Zeiterfassung

- [ ] Tagesformular als primären Dashboard-Bereich bauen.
- [ ] Live-Anzeige neben dem Tagesformular bauen.
- [ ] Speichern, Aktualisieren und Löschen implementieren.
- [ ] Wochenübersicht bauen.
- [ ] Wochennavigation einbauen.
- [ ] Fehler- und Leerzustände gestalten.
- [ ] UI-Szenarien testen.

### Phase 5 - Dashboard

- [ ] Dashboard-Grundlayout bauen.
- [ ] Setup-Hinweise anzeigen.
- [ ] Tagesformular und Live-Auswertung als Hauptbereich anbinden.
- [ ] Wochen-Kachel anbinden.
- [ ] Gleitzeit-Kachel anbinden.
- [ ] Urlaub-Kachel anbinden.
- [ ] Warnungen für Gleitzeitgrenze anzeigen.
- [ ] Roadmap-Kacheln für Reisekosten und Aufgaben anzeigen.

### Phase 6 - Einstellungen

- [ ] Einstellungsnavigation oder Abschnittsstruktur bauen.
- [ ] Sollzeit- und Wochenarbeitszeit-Einstellungen implementieren.
- [ ] Gleitzeitgrenze und Startwert implementieren.
- [ ] Gleitzeitkorrekturen implementieren.
- [ ] Urlaubswerte implementieren.
- [ ] Speicherstatus anzeigen.
- [ ] App-Version anzeigen.
- [ ] Lokale Datenlöschung mit Warnung implementieren.

### Phase 7 - Backup und Import

- [ ] Manifest-Format definieren.
- [ ] Data-Format definieren.
- [ ] Export-Service implementieren.
- [ ] ZIP-Erzeugung implementieren.
- [ ] Import-Service implementieren.
- [ ] Strikte Validierung implementieren.
- [ ] Import-Vorschau bauen.
- [ ] Ersetzen der lokalen Datenbank nach Bestätigung implementieren.
- [ ] Backup-Tests schreiben.

### Phase 8 - PWA und Deployment

- [ ] Web-App-Manifest erstellen.
- [ ] Icons einbinden.
- [ ] Service Worker konfigurieren.
- [ ] App-Shell-Caching testen.
- [ ] Offline-Start testen.
- [ ] Update-Hinweis implementieren.
- [ ] Cache-/Service-Worker-Reset implementieren.
- [ ] GitHub Actions Deployment konfigurieren.
- [ ] Produktionsbuild testen.

### Phase 9 - Roadmap-Platzhalter

- [ ] Reisekosten-Platzhalterseite erstellen.
- [ ] Aufgaben-Platzhalterseite erstellen.
- [ ] Roadmap-Inhalte knapp anzeigen.
- [ ] Keine unfertigen Eingabeformulare für Roadmap-Module anbieten.
- [ ] Backup-Format für spätere Daten vorbereitet lassen.

### Phase 10 - Abschluss V1

- [ ] Alle Unit-Tests ausführen.
- [ ] Build ausführen.
- [ ] Offline-Verhalten prüfen.
- [ ] Backup-Export und Import manuell prüfen.
- [ ] Erststart manuell prüfen.
- [ ] Dashboard-Zeiterfassung für Beispielwoche manuell prüfen.
- [ ] UI auf Desktop und kleinem Viewport prüfen.
- [ ] Offene Punkte dokumentieren.

## 21. Akzeptanzkriterien V1

- [ ] App startet lokal im Browser ohne Server-Backend.
- [ ] App ist installierbar und nach erstem Laden offline nutzbar.
- [ ] Dashboard startet beim Erststart und zeigt sinnvolle Setup-Hinweise.
- [ ] Zeiteintrag für heute kann manuell erstellt, gespeichert, geändert und gelöscht werden.
- [ ] Live-Anzeige rechnet ohne Dienstende mit aktueller Uhrzeit.
- [ ] Eingetragenes Dienstende überschreibt Live-Zeit.
- [ ] 30-Minuten-Inklusivpause wird korrekt berücksichtigt.
- [ ] Wochenübersicht berechnet Wochensummen korrekt ab Montag.
- [ ] Gleitzeitstand berücksichtigt Startwert, Tagesdifferenzen und Korrekturen.
- [ ] Gleitzeitwarnung erscheint über der eingestellten Grenze.
- [ ] Urlaubswerte werden in Stunden und Tagen angezeigt.
- [ ] Zu verbrauchende Jahressumme wird angezeigt.
- [ ] Einstellungen bleiben lokal erhalten.
- [ ] Backup-Export erzeugt eine ZIP-Datei mit Manifest und Daten.
- [ ] Backup-Import zeigt eine Vorschau und ersetzt erst nach Bestätigung.
- [ ] Inkompatible oder fehlerhafte Backups werden abgelehnt.
- [ ] Cache-/Service-Worker-Reset löscht keine Arbeitsdaten.
- [ ] Lokale Datenlöschung ist separat, deutlich gewarnt und bestätigungspflichtig.
- [ ] GitHub-Pages-Build verwendet `/arbeits-dashboard/` korrekt.

## 22. Offene Punkte nach V1

- [ ] Reisekosten detailliert spezifizieren.
- [ ] Nachweise und Dateien detailliert spezifizieren.
- [ ] Todo-Modul detailliert spezifizieren.
- [ ] Verschlüsselte Backups prüfen.
- [ ] Optionalen Start/Stop-Modus für Zeiterfassung prüfen.
- [ ] Konkrete Urlaubstage oder Abwesenheitskalender prüfen.
- [ ] Komfortfunktionen für Google Maps und ÖBB prüfen.

## 23. Bearbeitungsstand 2026-05-06

### Erledigt

- [x] Vite/React/TypeScript-Projekt erstellt.
- [x] Basiskonfiguration für TypeScript, Vite, Vitest und PWA erstellt.
- [x] GitHub-Pages-Base-Pfad `/arbeits-dashboard/` konfiguriert.
- [x] Hash-Routing für Dashboard, Reisekosten, Aufgaben und Einstellungen umgesetzt.
- [x] App-Shell mit Sidebar und Arbeitsfläche umgesetzt.
- [x] Helles, ruhiges Dashboard-UI mit responsiven CSS-Regeln umgesetzt.
- [x] Dexie-Datenbank mit Stores für Einstellungen, Zeiteinträge, Gleitzeitkorrekturen, Urlaub und App-Metadaten umgesetzt.
- [x] Standardwerte und Erststart-Setup-Hinweise umgesetzt.
- [x] Pure Berechnungslogik für Tageszeit, Pause, Woche, Gleitzeit, Urlaub und Jahresverbrauch umgesetzt.
- [x] Unit-Tests für zentrale Zeit-, Wochen-, Gleitzeit- und Urlaubsberechnungen geschrieben.
- [x] Dashboard mit Tagesformular, Live-Auswertung, Wochen-, Gleitzeit-, Urlaub- und Jahresverbrauchs-Kennzahlen umgesetzt.
- [x] Manuelle Tages-Zeiterfassung im Dashboard mit Erstellen, Bearbeiten, Löschen und Live-Vorschau umgesetzt.
- [x] Wochenübersicht mit Montag als Wochenstart umgesetzt.
- [x] Einstellungen für Sollzeit, Wochenzeit, Gleitzeitgrenze, Startwert und Urlaub umgesetzt.
- [x] Gleitzeitkorrekturen mit Liste, Speicherung und Entfernen umgesetzt.
- [x] Backup-Export als ZIP mit `manifest.json` und `data.json` umgesetzt.
- [x] Strikter Backup-Import mit Vorschau und vollständigem Ersetzen umgesetzt.
- [x] Cache-/Service-Worker-Reset ohne IndexedDB-Löschung umgesetzt.
- [x] Separate lokale Datenlöschung mit Warnung umgesetzt.
- [x] PWA-Manifest, App-Icons und Service-Worker-Generierung umgesetzt.
- [x] GitHub-Actions-Deployment für GitHub Pages erstellt.
- [x] Roadmap-Platzhalter für Reisekosten und Aufgaben umgesetzt.
- [x] `npm test` erfolgreich ausgeführt.
- [x] `npm run build` erfolgreich ausgeführt.
- [x] Lokaler Vite-Server auf Port 5174 gestartet.

### Noch manuell zu prüfen

- [ ] App im Browser unter `http://127.0.0.1:5174/arbeits-dashboard/` visuell prüfen.
- [ ] Dashboard-Zeiterfassung für eine Beispielwoche im Browser durchklicken.
- [ ] Backup-Export im Browser herunterladen und Import-Vorschau testen.
- [ ] Lokale Datenlöschung mit Testdaten prüfen.
- [ ] PWA-Installation und Offline-Start im Browser prüfen.
- [ ] Update-Hinweis mit späterer Version prüfen.
- [ ] GitHub-Pages-Workflow nach erstem Push in GitHub prüfen.
