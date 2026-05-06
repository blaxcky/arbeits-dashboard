# Work-Dashboard - Umsetzungsplan

## 1. Zielbild

Das Work-Dashboard wird eine lokale, offlinefaehige und installierbare PWA fuer die Arbeit. Die App laeuft hauptsaechlich im Browser am Laptop oder PC und dient als zentrale Arbeitsuebersicht fuer Zeiterfassung, Gleitzeit, Urlaub, spaeter Reisekosten und Aufgaben.

Der wichtigste Grundsatz ist Datenschutz:

> Arbeitsdaten duerfen das Arbeitsgeraet nicht verlassen.

Es gibt keine serverseitige Speicherung, keine Cloud-Synchronisierung, keine externe Datenbank, keine Analytics und keine extern geladenen Kern-Assets. Alle fachlichen Daten werden lokal im Browser gespeichert.

## 2. Verbindliche V1-Entscheidungen

- [ ] Greenfield-App mit Vite, React und TypeScript aufbauen.
- [ ] PWA installierbar und offlinefaehig machen.
- [ ] Fachliche Daten in IndexedDB ueber Dexie.js speichern.
- [ ] Hash-Routing verwenden, damit GitHub Pages und Offline-Nutzung robust funktionieren.
- [ ] Vite-Base-Pfad auf `/arbeits-dashboard/` setzen.
- [ ] GitHub Pages Deployment per GitHub Actions vorbereiten.
- [ ] App beim Erststart direkt im Dashboard oeffnen.
- [ ] Dashboard in V1 auf Zeiterfassung, Woche, Gleitzeit, Urlaub und Setup-Hinweise fokussieren.
- [ ] Zeiterfassung in V1 primaer manuell bedienen.
- [ ] Urlaub in V1 als Summenwerte in Stunden fuehren, nicht als Urlaubstags-Kalender.
- [ ] Backup-Import in V1 strikt validieren und nur nach Vorschau vollstaendig ersetzen.
- [ ] Reisekosten, Nachweise und Todo in V1 nur architektonisch vorbereiten und als Roadmap dokumentieren.

## 3. Technische Basis

### 3.1 Stack

- [ ] Vite als Build-Tool einrichten.
- [ ] React als UI-Framework einrichten.
- [ ] TypeScript strikt genug konfigurieren, damit Fachlogik und Datenmodelle sauber typisiert sind.
- [ ] Dexie.js fuer IndexedDB einrichten.
- [ ] ZIP-Unterstuetzung fuer Backup-Export und Import einplanen.
- [ ] Test-Setup fuer Unit-Tests einrichten.
- [ ] PWA-Plugin oder eigene Service-Worker-Integration auswaehlen und konfigurieren.

### 3.2 Routing

- [ ] Hash-Routing einrichten.
- [ ] Route `#/` fuer Dashboard anlegen.
- [ ] Zeiterfassung als Hauptworkflow direkt im Dashboard bereitstellen, ohne eigene Route.
- [ ] Route `#/reisekosten` als Roadmap-/Platzhalterbereich anlegen.
- [ ] Route `#/aufgaben` als Roadmap-/Platzhalterbereich anlegen.
- [ ] Route `#/einstellungen` fuer Einstellungen anlegen.
- [ ] Unbekannte Routen auf Dashboard oder eine einfache Fehleransicht fuehren.

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
- [ ] Keine fachlichen Daten ausserhalb des Browsers speichern.
- [ ] Keine externen Skripte oder Assets fuer den Kernbetrieb laden.
- [ ] Keine API-Keys im Quellcode ablegen.
- [ ] LocalStorage nur fuer einfache UI-Zustaende oder nicht-kritische Praeferenzen verwenden.
- [ ] Arbeitsdaten, Zeitdaten, Reiseeintraege, Backups, Nachweise und spaetere Dateien in IndexedDB speichern.

### 4.2 Erlaubte spaetere Komfortaktionen

Diese Aktionen sind nur bewusst durch Nutzer ausgeloest erlaubt:

- [ ] Google-Maps-Link oeffnen.
- [ ] Google-Maps-API manuell abfragen.
- [ ] OEBB-Link oder OEBB-Komfortfunktion oeffnen.

Regeln:

- [ ] Google-Maps-API-Key ausschliesslich lokal speichern.
- [ ] OEBB-Komfortfunktion nicht fuer automatische Berechnungen verwenden.
- [ ] Keine automatische Datenrueckgabe aus OEBB erwarten.

## 5. UI und App-Struktur

### 5.1 Layout

- [ ] Desktop-orientierte App-Shell mit linker Sidebar und rechter Arbeitsflaeche bauen.
- [ ] Mobile/kleine Viewports mit kompakter Navigation unterstuetzen.
- [ ] Hauptbereiche in der Sidebar anzeigen:
  - [ ] Dashboard
  - [ ] Reisekosten
  - [ ] Aufgaben
  - [ ] Einstellungen
- [ ] Aktive Route sichtbar markieren.
- [ ] App-Version im Einstellungsbereich anzeigen.

### 5.2 Visuelle Richtung

- [ ] Ruhige, helle Arbeitsoberflaeche umsetzen.
- [ ] Hohe Lesbarkeit und klare Kontraste sicherstellen.
- [ ] Dezente Akzentfarbe verwenden.
- [ ] Keine grellen Verlaeufe oder dekorativen Effekte einsetzen.
- [ ] Datenorientierte, kompakte Darstellung fuer wiederholte Arbeit verwenden.
- [ ] Formulare mit klaren Labels, Hilfetexten und Fehlerzustaenden bauen.
- [ ] Leere Zustaende, Ladezustaende und Warnungen explizit gestalten.

## 6. Lokale Datenbank

### 6.1 Kalenderregeln

- [ ] Zeitzone `Europe/Vienna` verwenden.
- [ ] Wochenstart Montag verwenden.
- [ ] ISO-Kalenderwochen verwenden.
- [ ] Jahreswerte auf Kalenderjahr beziehen.
- [ ] Datumswerte konsistent als lokale Kalendertage speichern und anzeigen.

### 6.2 Dexie-Stores V1

- [ ] Store `settings` fuer allgemeine Einstellungen anlegen.
- [ ] Store `timeEntries` fuer Zeiteintraege anlegen.
- [ ] Store `flexCorrections` fuer Gleitzeitkorrekturen anlegen.
- [ ] Store `vacationSummary` fuer Urlaubs-Summenwerte anlegen.
- [ ] Store `appMeta` fuer Schema-Version, Setup-Status und interne Metadaten anlegen.

### 6.3 Vorbereitete spaetere Stores

Diese Stores muessen nicht voll genutzt werden, duerfen aber im Backup-Format vorbereitet werden:

- [ ] `trips` fuer Reisekosten.
- [ ] `todos` fuer Aufgaben.
- [ ] `files` fuer Nachweise und Dateien.

### 6.4 Migrationsregeln

- [ ] Datenbankschema versionieren.
- [ ] Backup-Schema getrennt versionieren.
- [ ] Migrationen nachvollziehbar und testbar halten.
- [ ] Bei unbekannter Backup-Hauptversion Import ablehnen.

## 7. Dashboard V1

### 7.1 Erststart-Verhalten

- [ ] App beim ersten Start direkt im Dashboard oeffnen.
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
- [ ] Warnung bei Ueberschreiten der Gleitzeitgrenze anzeigen.
- [ ] Offenen Urlaub in Stunden und Tagen anzeigen.
- [ ] Summe anzeigen, die im aktuellen Jahr noch verbraucht werden muss.

### 7.3 Dashboard-Zustaende

- [ ] Hinweis bei fehlendem Dienstbeginn anzeigen.
- [ ] Hinweis bei unvollstaendigem Arbeitstag anzeigen.
- [ ] Hinweis bei fehlender Urlaubseinrichtung anzeigen.
- [ ] Hinweis bei fehlendem Gleitzeitstartwert anzeigen.
- [ ] Roadmap-Module Reisekosten und Aufgaben als nicht aktive Bereiche kennzeichnen.

## 8. Dashboard-Zeiterfassung V1

### 8.1 Zweck

Die Zeiterfassung ersetzt die bisherige Excel-Loesung fuer Arbeitszeiten, Gleitzeit, Plus-/Minusstunden und Urlaubsausblick. In V1 ist sie kein eigener Navigationsbereich, sondern der dominante Arbeitsbereich im Dashboard.

### 8.2 Tageserfassung

V1 unterstuetzt einen Zeiteintrag pro Datum.

Ein Zeiteintrag enthaelt:

- [ ] ID
- [ ] Datum
- [ ] Dienstbeginn
- [ ] Dienstende
- [ ] Pause in Minuten
- [ ] Sollzeit in Minuten
- [ ] Notiz
- [ ] createdAt
- [ ] updatedAt

Umsetzung:

- [ ] Tagesformular prominent im Dashboard fuer ein waehlbares Datum bauen.
- [ ] Standarddatum auf heute setzen.
- [ ] Beginn, Ende, Pause, Sollzeit und Notiz manuell editierbar machen.
- [ ] Pro Datum vorhandenen Eintrag laden.
- [ ] Speichern erstellt oder aktualisiert den Eintrag.
- [ ] Loeschen fuer den aktuellen Tages-Eintrag anbieten.
- [ ] Validierung fuer Uhrzeiten und Pausenwerte anzeigen.

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

> 30 Minuten Pause sind im Solltag enthalten. Nur Pause ueber 30 Minuten verlaengert das Soll-Ende.

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

- [ ] 30-Minuten-Inklusivpause in Tagesberechnung beruecksichtigen.
- [ ] Pausen ueber 30 Minuten als verlaengernd behandeln.
- [ ] Ist-Zeit fuer Plus/Minus so berechnen, dass die inkludierte Pause nicht doppelt negativ wirkt.
- [ ] Edge Cases fuer Pause 0, 30 und ueber 30 Minuten testen.

### 8.5 Live-Anzeige

Die Live-Auswertung neben dem Tagesformular zeigt:

- [ ] Netto-Arbeitszeit heute.
- [ ] Restzeit bis Soll.
- [ ] Uhrzeit, wann Soll erreicht wird.
- [ ] aktuelles Plus.
- [ ] aktuelles Minus.
- [ ] Hinweis bei fehlendem Dienstbeginn.
- [ ] Hinweis bei unvollstaendigem Arbeitstag.

Regeln:

- [ ] Wenn Dienstende eingetragen ist, dieses Dienstende verwenden.
- [ ] Wenn Dienstende fehlt, aktuelle Uhrzeit fuer Live-Anzeige verwenden.
- [ ] Live-Werte regelmaessig aktualisieren.
- [ ] Live-Anzeige darf gespeicherte Daten nicht automatisch veraendern.

### 8.6 Wochenuebersicht

Die Wochenuebersicht zeigt:

- [ ] Zeiteintraege pro Tag.
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
- [ ] Tagesdifferenzen aus gespeicherten Zeiteintraegen summieren.
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
- [ ] Korrekturen loeschen oder stornieren koennen.
- [ ] Auswirkungen auf Gleitzeitstand sofort sichtbar machen.

### 9.3 Gleitzeitgrenze

- [ ] Gleitzeitgrenze einstellbar machen.
- [ ] Standardwert 100 Stunden setzen.
- [ ] Warnung anzeigen, wenn Gleitzeitstand ueber Grenze liegt.
- [ ] Stunden ueber Grenze als noch zu verbrauchenden Zeitausgleich anzeigen.

## 10. Urlaub und Zeitausgleich

### 10.1 Urlaub

Urlaub wird intern in Stunden gespeichert und zusaetzlich in Tagen angezeigt.

Standardumrechnung:

```text
1 Urlaubstag = 8 Stunden
```

Aufgaben:

- [ ] Urlaubsanspruch in Stunden speichern.
- [ ] Verbrauchte Urlaubsstunden speichern.
- [ ] Resturlaub berechnen.
- [ ] Werte zusaetzlich in Tagen anzeigen.
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
offener Urlaub + Stunden ueber erlaubter Gleitzeitgrenze
```

Aufgaben:

- [ ] Offenen Urlaub berechnen.
- [ ] Stunden ueber Gleitzeitgrenze berechnen.
- [ ] Summe im Dashboard anzeigen.
- [ ] Summe in Einstellungen oder Urlaubskachel nachvollziehbar erklaeren.

## 11. Einstellungen V1

Der Einstellungsbereich enthaelt mindestens:

- [ ] App-Version.
- [ ] Speicherstatus.
- [ ] Backup exportieren.
- [ ] Backup importieren.
- [ ] Cache und Service Worker zuruecksetzen.
- [ ] Lokale Daten loeschen mit starker Warnung.
- [ ] Taegliche Soll-Arbeitszeit.
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
- [ ] Validierung fuer Minuten-/Stundenwerte anzeigen.
- [ ] Aenderungen sofort im Dashboard widerspiegeln.

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

V1 nutzt dieselbe Struktur bereits fuer Daten ohne Dateien. Dadurch ist das Format fuer spaetere Nachweise, Screenshots und Belege vorbereitet.

### 12.2 Export

Der Export enthaelt:

- [ ] Manifest mit App-Name.
- [ ] Manifest mit Backup-Schema-Version.
- [ ] Manifest mit Export-Zeitpunkt.
- [ ] Einstellungen.
- [ ] Zeiteintraege.
- [ ] Gleitzeitstartwert.
- [ ] Gleitzeitkorrekturen.
- [ ] Urlaubswerte.
- [ ] Leere oder vorbereitete Felder fuer spaetere Reisekosten, Todos und Dateien.

Aufgaben:

- [ ] ZIP-Datei lokal im Browser erzeugen.
- [ ] Dateiname mit Datum/Uhrzeit erzeugen.
- [ ] Export ohne Netzwerkverbindung ermoeglichen.
- [ ] Exportfehler sichtbar anzeigen.

### 12.3 Import

Import-Verhalten:

- [ ] Backup-Datei auswaehlen.
- [ ] ZIP-Struktur pruefen.
- [ ] Manifest pruefen.
- [ ] Daten pruefen.
- [ ] Schema-Hauptversion pruefen.
- [ ] Zusammenfassung anzeigen.
- [ ] Erst nach ausdruecklicher Bestaetigung lokale Datenbank ersetzen.

V1 implementiert keinen Merge-Import. Das Standardverhalten ist vollstaendiges Ersetzen nach Vorschau.

Regeln:

- [ ] Unbekannte oder inkompatible Backup-Hauptversion ablehnen.
- [ ] Fehlerhafte Pflichtfelder ablehnen.
- [ ] Bekannte optionale Zukunftsfelder ignorieren, sofern sie die V1-Daten nicht betreffen.
- [ ] Vor dem Ersetzen klare Warnung anzeigen.
- [ ] Nach Import App-Daten neu laden.

### 12.4 Verschluesselung

- [ ] Backups in V1 unverschluesselt lassen.
- [ ] Verschluesselung als spaetere Erweiterung dokumentieren.

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

- [ ] Cache und Service Worker zuruecksetzen.
- [ ] App neu laden.
- [ ] IndexedDB und Arbeitsdaten dabei nicht loeschen.

Datenloeschung:

- [ ] Separate Funktion im Einstellungsbereich anbieten.
- [ ] Deutliche Warnung anzeigen.
- [ ] Vorab Backup empfehlen.
- [ ] Endgueltige Bestaetigung verlangen.

## 14. Roadmap Reisekosten

Das Reisekostenmodul wird spaeter als eigenstaendiges Modul innerhalb derselben App umgesetzt.

Geplante Funktionen:

- [ ] Reise erstellen, bearbeiten und loeschen.
- [ ] Datum, Zeit von, Zeit bis und Dauer.
- [ ] Grund, Ort und Zieladresse.
- [ ] Fahrtkostenart.
- [ ] Einfache Strecke in Kilometern.
- [ ] Diaeten.
- [ ] Sonstige Kosten.
- [ ] Nachweise und Screenshots.
- [ ] Erledigt-Status.
- [ ] Jahresuebersichten.
- [ ] Differenzwerbungskosten.

Fahrtkostenarten:

- [ ] Kilometergeld.
- [ ] Befoerderungszuschuss normal.
- [ ] Befoerderungszuschuss Oeffis.
- [ ] Dienstauto.
- [ ] Sonstige Kosten oder freier Betrag.

Architekturregel:

- [ ] Fahrtkostenlogik regelbasiert und modular aufbauen.
- [ ] Saetze und Regeln spaeter wartbar aenderbar halten.
- [ ] Reisekostenberechnungen nicht in UI-Komponenten verstreuen.

## 15. Roadmap Nachweise und Dateien

Dateien und Screenshots werden spaeter lokal in IndexedDB gespeichert und Reiseeintraegen zugeordnet.

Nachweise muessen:

- [ ] lokal gespeichert werden.
- [ ] einer Reise zugeordnet sein.
- [ ] angezeigt werden koennen.
- [ ] heruntergeladen werden koennen.
- [ ] im Backup enthalten sein.
- [ ] nach Import wiederhergestellt werden.

Moegliche Nachweistypen:

- [ ] Dienstauto-Nachweis.
- [ ] OEBB-Verbindungskosten.
- [ ] Parkticket.
- [ ] Zugticket.
- [ ] Sonstiger Beleg.

## 16. Roadmap Komfortfunktionen

Spaetere Komfortfunktionen:

- [ ] Google-Maps-Link aus Startadresse und Zieladresse erzeugen.
- [ ] Sonderzeichen, Umlaute und Leerzeichen korrekt per URL-Encoding behandeln.
- [ ] Google-Maps-API-Key lokal speichern.
- [ ] Google-Maps-API-Abfrage nur manuell ausloesen.
- [ ] OEBB-Komfortlink oder OEBB-Widget pro Reise erzeugen.
- [ ] Mehrere OEBB-Abfahrtsorte unterstuetzen.
- [ ] Keine automatische Datenuebernahme aus OEBB.

## 17. Roadmap Todo-Modul

Das Todo-Modul wird als einfaches, spaeter erweiterbares Aufgabenmodul geplant.

Grundfunktionen:

- [ ] Aufgabe erstellen.
- [ ] Aufgabe bearbeiten.
- [ ] Aufgabe loeschen.
- [ ] Aufgabe abhaken.
- [ ] Offene Aufgaben anzeigen.
- [ ] Erledigte Aufgaben anzeigen.
- [ ] Faelligkeitsdatum.
- [ ] Prioritaet.
- [ ] Tags oder Kategorien.
- [ ] Notizen.
- [ ] Filter.
- [ ] Suche.

Spaetere Erweiterungen:

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
- [ ] Regeln fuer Zeiterfassung, Gleitzeit, Urlaub, Reisekosten, Diaeten und Differenzwerbungskosten in eigene testbare Funktionen legen.

## 19. Testplan V1

### 19.1 Unit-Tests

- [ ] Zeitberechnung mit inkludierter 30-Minuten-Pause testen.
- [ ] Zeitberechnung mit mehr als 30 Minuten Pause testen.
- [ ] Zeitberechnung mit 0 Minuten Pause testen.
- [ ] Live-Berechnung ohne Dienstende testen.
- [ ] Berechnung mit eingetragenem Dienstende testen.
- [ ] Tagesplus testen.
- [ ] Tagesminus testen.
- [ ] Wochenuebersicht testen.
- [ ] ISO-Wochenstart Montag testen.
- [ ] Gleitzeitstand aus Startwert, Tagen und Korrekturen testen.
- [ ] Warnung bei Ueberschreiten der Gleitzeitgrenze testen.
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
- [ ] Tagesformular erstellen, bearbeiten und loeschen testen.
- [ ] Wochenwechsel testen.
- [ ] Einstellungen speichern testen.
- [ ] Datenloesch-Warnung testen.

## 20. Umsetzungsschritte

### Phase 1 - Projektfundament

- [ ] Vite/React/TypeScript-Projekt erstellen.
- [ ] Basiskonfiguration fuer TypeScript, Vite und Tests erstellen.
- [ ] App-Shell mit Routing aufbauen.
- [ ] Grundlayout mit Sidebar und Arbeitsflaeche umsetzen.
- [ ] Basisstyles und UI-Tokens definieren.
- [ ] GitHub-Pages-Base-Pfad konfigurieren.
- [ ] Erste Build- und Test-Kommandos pruefen.

### Phase 2 - Datenbasis

- [ ] Dexie einrichten.
- [ ] Datenmodelle fuer V1 definieren.
- [ ] Stores fuer Einstellungen, Zeiteintraege, Gleitzeitkorrekturen, Urlaub und App-Metadaten anlegen.
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
- [ ] Unit-Tests fuer alle Rechenregeln schreiben.

### Phase 4 - Dashboard-Zeiterfassung

- [ ] Tagesformular als primaeren Dashboard-Bereich bauen.
- [ ] Live-Anzeige neben dem Tagesformular bauen.
- [ ] Speichern, Aktualisieren und Loeschen implementieren.
- [ ] Wochenuebersicht bauen.
- [ ] Wochennavigation einbauen.
- [ ] Fehler- und Leerzustaende gestalten.
- [ ] UI-Szenarien testen.

### Phase 5 - Dashboard

- [ ] Dashboard-Grundlayout bauen.
- [ ] Setup-Hinweise anzeigen.
- [ ] Tagesformular und Live-Auswertung als Hauptbereich anbinden.
- [ ] Wochen-Kachel anbinden.
- [ ] Gleitzeit-Kachel anbinden.
- [ ] Urlaub-Kachel anbinden.
- [ ] Warnungen fuer Gleitzeitgrenze anzeigen.
- [ ] Roadmap-Kacheln fuer Reisekosten und Aufgaben anzeigen.

### Phase 6 - Einstellungen

- [ ] Einstellungsnavigation oder Abschnittsstruktur bauen.
- [ ] Sollzeit- und Wochenarbeitszeit-Einstellungen implementieren.
- [ ] Gleitzeitgrenze und Startwert implementieren.
- [ ] Gleitzeitkorrekturen implementieren.
- [ ] Urlaubswerte implementieren.
- [ ] Speicherstatus anzeigen.
- [ ] App-Version anzeigen.
- [ ] Lokale Datenloeschung mit Warnung implementieren.

### Phase 7 - Backup und Import

- [ ] Manifest-Format definieren.
- [ ] Data-Format definieren.
- [ ] Export-Service implementieren.
- [ ] ZIP-Erzeugung implementieren.
- [ ] Import-Service implementieren.
- [ ] Strikte Validierung implementieren.
- [ ] Import-Vorschau bauen.
- [ ] Ersetzen der lokalen Datenbank nach Bestaetigung implementieren.
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
- [ ] Keine unfertigen Eingabeformulare fuer Roadmap-Module anbieten.
- [ ] Backup-Format fuer spaetere Daten vorbereitet lassen.

### Phase 10 - Abschluss V1

- [ ] Alle Unit-Tests ausfuehren.
- [ ] Build ausfuehren.
- [ ] Offline-Verhalten pruefen.
- [ ] Backup-Export und Import manuell pruefen.
- [ ] Erststart manuell pruefen.
- [ ] Dashboard-Zeiterfassung fuer Beispielwoche manuell pruefen.
- [ ] UI auf Desktop und kleinem Viewport pruefen.
- [ ] Offene Punkte dokumentieren.

## 21. Akzeptanzkriterien V1

- [ ] App startet lokal im Browser ohne Server-Backend.
- [ ] App ist installierbar und nach erstem Laden offline nutzbar.
- [ ] Dashboard startet beim Erststart und zeigt sinnvolle Setup-Hinweise.
- [ ] Zeiteintrag fuer heute kann manuell erstellt, gespeichert, geaendert und geloescht werden.
- [ ] Live-Anzeige rechnet ohne Dienstende mit aktueller Uhrzeit.
- [ ] Eingetragenes Dienstende ueberschreibt Live-Zeit.
- [ ] 30-Minuten-Inklusivpause wird korrekt beruecksichtigt.
- [ ] Wochenuebersicht berechnet Wochensummen korrekt ab Montag.
- [ ] Gleitzeitstand beruecksichtigt Startwert, Tagesdifferenzen und Korrekturen.
- [ ] Gleitzeitwarnung erscheint ueber der eingestellten Grenze.
- [ ] Urlaubswerte werden in Stunden und Tagen angezeigt.
- [ ] Zu verbrauchende Jahressumme wird angezeigt.
- [ ] Einstellungen bleiben lokal erhalten.
- [ ] Backup-Export erzeugt eine ZIP-Datei mit Manifest und Daten.
- [ ] Backup-Import zeigt eine Vorschau und ersetzt erst nach Bestaetigung.
- [ ] Inkompatible oder fehlerhafte Backups werden abgelehnt.
- [ ] Cache-/Service-Worker-Reset loescht keine Arbeitsdaten.
- [ ] Lokale Datenloeschung ist separat, deutlich gewarnt und bestaetigungspflichtig.
- [ ] GitHub-Pages-Build verwendet `/arbeits-dashboard/` korrekt.

## 22. Offene Punkte nach V1

- [ ] Reisekosten detailliert spezifizieren.
- [ ] Nachweise und Dateien detailliert spezifizieren.
- [ ] Todo-Modul detailliert spezifizieren.
- [ ] Verschluesselte Backups pruefen.
- [ ] Optionalen Start/Stop-Modus fuer Zeiterfassung pruefen.
- [ ] Konkrete Urlaubstage oder Abwesenheitskalender pruefen.
- [ ] Komfortfunktionen fuer Google Maps und OEBB pruefen.

## 23. Bearbeitungsstand 2026-05-06

### Erledigt

- [x] Vite/React/TypeScript-Projekt erstellt.
- [x] Basiskonfiguration fuer TypeScript, Vite, Vitest und PWA erstellt.
- [x] GitHub-Pages-Base-Pfad `/arbeits-dashboard/` konfiguriert.
- [x] Hash-Routing fuer Dashboard, Reisekosten, Aufgaben und Einstellungen umgesetzt.
- [x] App-Shell mit Sidebar und Arbeitsflaeche umgesetzt.
- [x] Helles, ruhiges Dashboard-UI mit responsiven CSS-Regeln umgesetzt.
- [x] Dexie-Datenbank mit Stores fuer Einstellungen, Zeiteintraege, Gleitzeitkorrekturen, Urlaub und App-Metadaten umgesetzt.
- [x] Standardwerte und Erststart-Setup-Hinweise umgesetzt.
- [x] Pure Berechnungslogik fuer Tageszeit, Pause, Woche, Gleitzeit, Urlaub und Jahresverbrauch umgesetzt.
- [x] Unit-Tests fuer zentrale Zeit-, Wochen-, Gleitzeit- und Urlaubsberechnungen geschrieben.
- [x] Dashboard mit Tagesformular, Live-Auswertung, Wochen-, Gleitzeit-, Urlaub- und Jahresverbrauchs-Kennzahlen umgesetzt.
- [x] Manuelle Tages-Zeiterfassung im Dashboard mit Erstellen, Bearbeiten, Loeschen und Live-Vorschau umgesetzt.
- [x] Wochenuebersicht mit Montag als Wochenstart umgesetzt.
- [x] Einstellungen fuer Sollzeit, Wochenzeit, Gleitzeitgrenze, Startwert und Urlaub umgesetzt.
- [x] Gleitzeitkorrekturen mit Liste, Speicherung und Entfernen umgesetzt.
- [x] Backup-Export als ZIP mit `manifest.json` und `data.json` umgesetzt.
- [x] Strikter Backup-Import mit Vorschau und vollstaendigem Ersetzen umgesetzt.
- [x] Cache-/Service-Worker-Reset ohne IndexedDB-Loeschung umgesetzt.
- [x] Separate lokale Datenloeschung mit Warnung umgesetzt.
- [x] PWA-Manifest, App-Icons und Service-Worker-Generierung umgesetzt.
- [x] GitHub-Actions-Deployment fuer GitHub Pages erstellt.
- [x] Roadmap-Platzhalter fuer Reisekosten und Aufgaben umgesetzt.
- [x] `npm test` erfolgreich ausgefuehrt.
- [x] `npm run build` erfolgreich ausgefuehrt.
- [x] Lokaler Vite-Server auf Port 5174 gestartet.

### Noch manuell zu pruefen

- [ ] App im Browser unter `http://127.0.0.1:5174/arbeits-dashboard/` visuell pruefen.
- [ ] Dashboard-Zeiterfassung fuer eine Beispielwoche im Browser durchklicken.
- [ ] Backup-Export im Browser herunterladen und Import-Vorschau testen.
- [ ] Lokale Datenloeschung mit Testdaten pruefen.
- [ ] PWA-Installation und Offline-Start im Browser pruefen.
- [ ] Update-Hinweis mit spaeterer Version pruefen.
- [ ] GitHub-Pages-Workflow nach erstem Push in GitHub pruefen.
