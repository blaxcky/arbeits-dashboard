# Work-Dashboard - Projektplan

## 1. Zielbild

Das Work-Dashboard wird eine lokale, offlinefaehige und installierbare PWA fuer die Arbeit. Die App laeuft hauptsaechlich im Browser am Laptop oder PC und dient als zentrale Arbeitsuebersicht fuer Zeiterfassung, Reisekosten und Aufgaben.

Der wichtigste Grundsatz ist Datenschutz:

> Arbeitsdaten duerfen das Arbeitsgeraet nicht verlassen.

Es gibt keine serverseitige Speicherung, keine Cloud-Synchronisierung und keine externe Datenbank. Alle fachlichen Daten werden lokal im Browser gespeichert.

## 2. Technische Basis

- App-Stack: Vite, React und TypeScript.
- PWA: installierbar, offlinefaehig, mit Service Worker und App-Shell-Caching.
- Lokale Datenbank: IndexedDB mit Dexie.js.
- UI-Basis: shadcn/ui, aber visuell angepasst an eine ruhige, helle Arbeitsoberflaeche.
- Routing: Hash-Routing, zum Beispiel `#/zeit`, damit GitHub Pages und Offline-Nutzung robust funktionieren.
- Hosting: GitHub Pages als Projektseite.
- Deployment: GitHub Actions baut und veroeffentlicht die App.
- Vite-Base-Pfad: `/arbeits-dashboard/`.

Die App wird als Greenfield-Projekt aufgebaut. Im aktuellen Repository existieren noch keine App-Dateien.

## 3. Datenschutz, Netzwerk und Offline-Regeln

Die Kern-App darf im normalen Betrieb keine externen Assets, Skripte oder Arbeitsdaten laden oder senden.

Erlaubt sind nur bewusst ausgeloeste externe Komfortaktionen:

- Google-Maps-Link oeffnen.
- Google-Maps-API manuell abfragen.
- OEBB-Link oder OEBB-Komfortfunktion oeffnen.

API-Keys, insbesondere fuer Google Maps, werden ausschliesslich lokal gespeichert und duerfen nicht im Quellcode stehen.

Das OEBB-Widget oder ein OEBB-Link dient nur als Komfortfunktion. Es wird nicht fuer automatische Berechnungen verwendet und die App erwartet keine Datenrueckgabe daraus.

## 4. V1-Umfang

Die erste implementierbare Version konzentriert sich auf ein stabiles Grundsystem plus Zeiterfassung.

V1 enthaelt:

- PWA-Grundsystem.
- App-Shell mit Sidebar und Arbeitsflaeche.
- Dashboard-Grundlayout.
- Lokale IndexedDB/Dexie-Datenbank.
- Zentralen Einstellungsbereich.
- Vollstaendigen Backup-Export.
- Backup-Import mit Pruefung und Vorschau.
- Cache- und Service-Worker-Reset ohne Datenverlust.
- Zeiterfassungsmodul mit Tageserfassung, Live-Anzeige, Wochenuebersicht, Gleitzeit und Urlaub.

Reisekosten und Todo werden in V1 architektonisch vorbereitet und als Roadmap beschrieben, aber noch nicht vollstaendig umgesetzt.

## 5. App-Struktur und UI

Die App verwendet eine Desktop-orientierte Struktur:

- Linke Sidebar fuer Hauptnavigation.
- Rechte Arbeitsflaeche fuer Dashboard, Module und Einstellungen.
- Helles System-UI mit hoher Lesbarkeit.
- Dezente Akzentfarbe, keine grellen Verlaeufe.
- Datenorientierte, kompakte Darstellung fuer wiederholte Arbeit.
- Formulare mit klaren Labels, Hilfetexten und Fehlerzustaenden.
- Leere Zustaende, Ladezustaende und Warnungen werden explizit gestaltet.

Geplante Hauptbereiche:

- Dashboard
- Zeiterfassung
- Reisekosten
- Aufgaben
- Einstellungen

## 6. Lokale Speicherung

Fachliche Hauptdaten werden in IndexedDB ueber Dexie.js gespeichert.

LocalStorage darf hoechstens fuer einfache UI-Zustaende oder nicht-kritische Praeferenzen verwendet werden. Arbeitsdaten, Reiseeintraege, Zeiteintraege, Backups, Nachweise und spaetere Dateien gehoeren in IndexedDB.

Kalenderlogik:

- Zeitzone: Europe/Vienna.
- Wochenstart: Montag.
- Kalenderwochen: ISO-Kalenderwochen.
- Jahreswerte: Kalenderjahr.

## 7. Backup, Export und Import

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

Der Export enthaelt:

- Einstellungen.
- Zeiteintraege.
- Gleitzeitstartwert.
- Gleitzeitkorrekturen.
- Urlaubswerte.
- spaeter Reisekosten, Todos und Dateien.

Import-Verhalten:

- Backup-Datei auswaehlen.
- Manifest und Daten pruefen.
- Zusammenfassung anzeigen.
- Erst nach ausdruecklicher Bestaetigung lokale Datenbank ersetzen.

V1 implementiert keinen Merge-Import. Das Standardverhalten ist vollstaendiges Ersetzen nach Vorschau.

Backups sind in V1 unverschluesselt. Verschluesselung kann spaeter ergaenzt werden.

## 8. PWA, Updates und Reset

Die App wird als PWA installierbar und offline nutzbar.

Der Service Worker cacht die App-Shell und statische Assets. Fachliche Daten bleiben in IndexedDB und duerfen durch Cache-Aktionen nicht geloescht werden.

Update-Verhalten:

- Neue App-Version wird erkannt.
- Die App zeigt einen Update-Hinweis.
- Nutzer laedt bewusst neu.
- Lokale Daten bleiben erhalten.

Reset-Funktionen:

- Cache und Service Worker zuruecksetzen.
- App neu laden.
- IndexedDB und Arbeitsdaten dabei nicht loeschen.

Eine Datenloeschung ist eine separate Funktion im Einstellungsbereich. Sie ist deutlich zu warnen und soll vorab ein Backup empfehlen.

## 9. Zeiterfassung V1

### 9.1 Zweck

Die Zeiterfassung ersetzt die bisherige Excel-Loesung fuer Arbeitszeiten, Gleitzeit, Plus-/Minusstunden und Urlaubsausblick.

### 9.2 Tageserfassung

V1 unterstuetzt einen Zeiteintrag pro Datum.

Ein Zeiteintrag enthaelt:

- ID
- Datum
- Dienstbeginn
- Dienstende
- Pause in Minuten
- Sollzeit in Minuten
- Notiz
- createdAt
- updatedAt

Berechnete Werte:

- Wochentag
- Ist-Zeit
- Pluszeit
- Minuszeit
- Soll-Ende
- Tagesstatus

### 9.3 Pausenmodell

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

Die Ist-Zeit fuer Plus/Minus wird entsprechend so berechnet, dass die inkludierte Pause nicht doppelt negativ wirkt.

### 9.4 Live-Anzeige

Die Tagesansicht zeigt live:

- Netto-Arbeitszeit heute.
- Restzeit bis Soll.
- Uhrzeit, wann Soll erreicht wird.
- aktuelles Plus.
- aktuelles Minus.
- Hinweis bei fehlendem Dienstbeginn.
- Hinweis bei unvollstaendigem Arbeitstag.

Wenn ein Dienstende eingetragen ist, verwendet die App dieses Dienstende. Ohne Dienstende verwendet sie fuer die Live-Anzeige die aktuelle Uhrzeit.

### 9.5 Wochenuebersicht

Die Wochenuebersicht zeigt:

- Zeiteintraege pro Tag.
- Plus/Minus pro Tag.
- Wochensumme.
- Plusstunden dieser Woche.
- Minusstunden dieser Woche.

Die Woche beginnt am Montag.

## 10. Gleitzeit

Der Gesamt-Gleitzeitstand wird so berechnet:

```text
Gleitzeitstand = Startwert + Summe Tagesdifferenzen + Summe Korrekturen
```

Der Startwert dient zur Uebernahme bestehender Excel-Werte.

Manuelle Korrekturen werden nachvollziehbar gespeichert:

- ID
- Datum
- alter Wert
- neuer Wert
- Differenz
- Grund oder Notiz
- createdAt

Die Gleitzeitgrenze ist einstellbar.

- Standardwert: 100 Stunden.
- Warnung, wenn der Gleitzeitstand ueber der Grenze liegt.
- Stunden ueber der Grenze werden als noch zu verbrauchender Zeitausgleich angezeigt.

## 11. Urlaub und Zeitausgleich

Urlaub wird intern in Stunden gespeichert und zusaetzlich in Tagen angezeigt.

Standardumrechnung:

```text
1 Urlaubstag = 8 Stunden
```

Der Urlaubsanspruch wird nicht automatisch vorbefuellt. Die App zeigt einen Einrichtungshinweis, bis der Anspruch gepflegt wurde.

Die App zeigt:

- offenen Urlaub in Stunden und Tagen.
- verbrauchten Urlaub.
- Resturlaub.
- Urlaub, der im laufenden Jahr noch verbraucht werden muss.

Zeitausgleich wird aus dem Gleitzeitstand berechnet:

- Stunden.
- Tage.
- Wochen.

Standardumrechnung:

- 1 Arbeitstag = 8 Stunden.
- 1 Arbeitswoche = 40 Stunden.

Besonders wichtig ist die Summe, die im aktuellen Jahr noch verbraucht werden muss:

```text
offener Urlaub + Stunden ueber erlaubter Gleitzeitgrenze
```

## 12. Einstellungen V1

Der Einstellungsbereich enthaelt mindestens:

- App-Version.
- Speicherstatus.
- Backup exportieren.
- Backup importieren.
- Cache und Service Worker zuruecksetzen.
- lokale Daten loeschen mit starker Warnung.
- taegliche Soll-Arbeitszeit.
- Wochenarbeitszeit.
- Gleitzeitgrenze.
- Gleitzeitstartwert.
- Gleitzeitkorrekturen.
- Urlaubsanspruch.
- Urlaubswerte.

Standardwerte:

- Soll-Arbeitszeit: 8 Stunden pro Tag.
- Wochenarbeitszeit: 40 Stunden.
- Gleitzeitgrenze: 100 Stunden.
- Urlaubsanspruch: leer bis eingerichtet.

## 13. Roadmap Reisekosten

Das Reisekostenmodul wird spaeter als eigenstaendiges Modul innerhalb derselben App umgesetzt.

Geplante Funktionen:

- Reise erstellen, bearbeiten und loeschen.
- Datum, Zeit von, Zeit bis und Dauer.
- Grund, Ort und Zieladresse.
- Fahrtkostenart.
- einfache Strecke in Kilometern.
- Diäten.
- sonstige Kosten.
- Nachweise und Screenshots.
- Erledigt-Status.
- Jahresuebersichten.
- Differenzwerbungskosten.

Fahrtkostenarten:

- Kilometergeld.
- Beförderungszuschuss normal.
- Beförderungszuschuss Oeffis.
- Dienstauto.
- Sonstige Kosten oder freier Betrag.

Die Fahrtkostenlogik muss regelbasiert und modular aufgebaut werden, damit Saetze und Regeln spaeter wartbar geaendert werden koennen.

## 14. Roadmap Nachweise und Dateien

Dateien und Screenshots werden spaeter lokal in IndexedDB gespeichert und Reiseeintraegen zugeordnet.

Nachweise muessen:

- lokal gespeichert werden.
- einer Reise zugeordnet sein.
- angezeigt werden koennen.
- heruntergeladen werden koennen.
- im Backup enthalten sein.
- nach Import wiederhergestellt werden.

Mögliche Nachweistypen:

- Dienstauto-Nachweis.
- OEBB-Verbindungskosten.
- Parkticket.
- Zugticket.
- sonstiger Beleg.

## 15. Roadmap Komfortfunktionen

Spaetere Komfortfunktionen:

- Google-Maps-Link aus Startadresse und Zieladresse erzeugen.
- Sonderzeichen, Umlaute und Leerzeichen korrekt per URL-Encoding behandeln.
- Google-Maps-API-Key lokal speichern.
- Google-Maps-API-Abfrage nur manuell ausloesen.
- OEBB-Komfortlink oder OEBB-Widget pro Reise erzeugen.
- mehrere OEBB-Abfahrtsorte unterstuetzen.
- keine automatische Datenuebernahme aus OEBB.

## 16. Roadmap Todo-Modul

Das Todo-Modul wird als einfaches, spaeter erweiterbares Aufgabenmodul geplant.

Grundfunktionen:

- Aufgabe erstellen.
- Aufgabe bearbeiten.
- Aufgabe loeschen.
- Aufgabe abhaken.
- offene Aufgaben anzeigen.
- erledigte Aufgaben anzeigen.
- Faelligkeitsdatum.
- Prioritaet.
- Tags oder Kategorien.
- Notizen.
- Filter.
- Suche.

Spaetere Erweiterungen:

- wiederkehrende Aufgaben.
- Erinnerungen.
- Projektzuordnung.
- Unteraufgaben.
- Checklisten.
- Archiv.

## 17. Architekturprinzipien

Die App wird modular aufgebaut.

Wichtige Trennungen:

- UI-Komponenten.
- Modul-Views.
- Datenbankzugriff.
- Berechnungslogik.
- Einstellungen.
- Backup/Import/Export.
- PWA-Service.
- Dateiverwaltung.

Berechnungslogik darf nicht direkt in UI-Komponenten verstreut werden. Besonders Regeln fuer Zeiterfassung, Gleitzeit, Urlaub, Reisekosten, Diäten und Differenzwerbungskosten gehoeren in eigene, testbare Funktionen.

## 18. Testplan

V1 benoetigt Tests fuer:

- Zeitberechnung mit inkludierter 30-Minuten-Pause.
- Zeitberechnung mit mehr als 30 Minuten Pause.
- Live-Berechnung ohne Dienstende.
- Berechnung mit eingetragenem Dienstende.
- Tagesplus.
- Tagesminus.
- Wochenuebersicht.
- Gleitzeitstand aus Startwert, Tagen und Korrekturen.
- Warnung bei Ueberschreiten der Gleitzeitgrenze.
- Urlaubsumrechnung Stunden/Tage.
- Backup-Export.
- Backup-Import mit Vorschau und Ersetzen.
- Cache-/Service-Worker-Reset ohne Datenverlust.
- GitHub-Pages-Build mit korrektem Base-Pfad.
- Offline-Start nach installiertem PWA-Cache.

## 19. Offene Interviewpunkte

Das Interview wird spaeter fortgefuehrt. Noch offen sind:

- Erststart-Verhalten: Setup-Dialog, direktes Dashboard oder Einstieg in Einstellungen.
- Exakte Datenmodelle fuer Dexie.
- Exakte Modulnavigation und Dashboard-Kennzahlen.
- Detaillierte Einstellungsstruktur.
- Detailplanung fuer Reisekosten.
- Detailplanung fuer Nachweise und Dateien.
- Detailplanung fuer Todo.
- Akzeptanzkriterien fuer V1.
- Reihenfolge der ersten Implementierungs-Tasks.

