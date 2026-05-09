# Features-Plan Arbeits-Dashboard

## 0. Ziel und Fachregeln

- [ ] Reisemaske zustandssicher machen: Speichern darf Bearbeitung nicht verlieren.
- [ ] Reisekosten-Erfassung so umbauen, dass unvollstaendige Reisen frueh gespeichert und spaeter fertiggestellt werden koennen.
- [ ] Reisekosten-Jahresuebersicht aus der Eingabemaske herausloesen und als eigenen Unterpunkt fuehren.
- [ ] Offene Reisekosten als abarbeitbare Liste mit Copy-Buttons bereitstellen.
- [ ] Dashboard um Wochen-Delta, Resturlaub-Direktbearbeitung und Gleittag-Buchung erweitern.
- [ ] Allgemeine UI-Texte reduzieren und PWA-Icon ersetzen.

### Verbindliche Oeffi-BEZU-Regel

- [ ] Kilometergeld als gesetzliche Vergleichsbasis verwenden.
- [ ] Ticketpreis als steuerfreien Betrag behandeln.
- [ ] Steuerpflichtigen Oeffi-BEZU nur als Informations-/Kontrollwert anzeigen.
- [ ] Steuerpflichtigen Oeffi-BEZU nicht zusaetzlich zu den Werbungskosten addieren.
- [ ] Doppelte Zaehlung ausdruecklich durch Tests verhindern.

```text
Werbungskosten Fahrtkosten = max(fiktives Kilometergeld - steuerfreier Ticketpreis, 0)
```

```text
berechneter Oeffi-BEZU = BEZU nach Kilometerstaffel
Auszahlung Oeffi = max(berechneter Oeffi-BEZU, Ticketpreis)
steuerfreier Betrag = Ticketpreis
steuerpflichtiger Oeffi-BEZU = max(Auszahlung Oeffi - Ticketpreis, 0)
Werbungskosten Fahrtkosten = max(fiktives Kilometergeld - Ticketpreis, 0)
```

### Oeffi-BEZU Beispiele

- [ ] Normalfall in Tests abbilden.

```text
Fiktives Kilometergeld:       60 EUR
Berechneter Oeffi-BEZU:       50 EUR
Ticketpreis:                   5 EUR
Auszahlung Oeffi:             50 EUR
Steuerpflichtiger Oeffi-BEZU: 45 EUR
Werbungskosten Fahrtkosten:   55 EUR
```

- [ ] Sonderfall `Ticketpreis > Oeffi-BEZU` in Tests abbilden.

```text
Fiktives Kilometergeld:       60 EUR
Berechneter Oeffi-BEZU:       50 EUR
Ticketpreis:                  55 EUR
Auszahlung Oeffi:             55 EUR
Steuerpflichtiger Oeffi-BEZU:  0 EUR
Werbungskosten Fahrtkosten:    5 EUR
```

- [ ] Bei `Ticketpreis > Oeffi-BEZU` diesen Hinweis anzeigen:

```text
Ticketpreis liegt ueber dem Oeffi-BEZU. Es wird der Ticketpreis ersetzt; dadurch entsteht kein steuerpflichtiger Oeffi-BEZU.
```

## 1. Datenmodell und Migrationen

- [ ] `Trip.startTime` optional speicherbar machen.
- [ ] `Trip.endTime` optional speicherbar machen.
- [ ] `durationMinutes` bei fehlenden oder unvollstaendigen Zeiten auf `0` setzen.
- [ ] `Trip.transportSubsidyTaxCents` aus aktiver Logik entfernen.
- [ ] Formularfeld `Bezahlte Steuer` entfernen.
- [ ] Alte Backups mit `transportSubsidyTaxCents` weiterhin importierbar lassen.
- [ ] Bei alten Backups `transportSubsidyTaxCents` ignorieren oder auf `0` migrieren.
- [ ] `Trip.taxableTransportSubsidyCents` als berechneten Informationswert fuer steuerpflichtigen Oeffi-BEZU erhalten.
- [ ] Aus fehlenden Zeiten automatisch UI-Status `Unvollstaendig` ableiten.
- [ ] `done` weiterhin nur fuer fertig abgearbeitete Reiserechnungen verwenden.
- [ ] Datenbankschema-Version erhoehen.
- [ ] Backup-Schema-Version erhoehen, falls Backup-Shape angepasst wird.
- [ ] Migration fuer neue Stores und geaenderte Trip-Felder testen.

### Neuer Store `savedDestinations`

- [ ] Store `savedDestinations` in Dexie anlegen.
- [ ] Indexe fuer `id`, optional `name` und `updatedAt` definieren.
- [ ] Typ `SavedDestination` im Schema ergaenzen.
- [ ] Backup-Export um `savedDestinations` erweitern.
- [ ] Backup-Import um `savedDestinations` erweitern.
- [ ] `replaceAllData` um `savedDestinations` erweitern.
- [ ] `deleteAllLocalData` um `savedDestinations` erweitern.

Felder:

- [ ] `id`
- [ ] `name`
- [ ] `address`
- [ ] optional `municipalityCode`
- [ ] `createdAt`
- [ ] `updatedAt`

### Gemeindekennzahl-XML

- [ ] Statische Ressource `public/gemeinden.xml` als Zielpfad vorsehen.
- [ ] Parser fuer Gemeindekennzahl-XML implementieren.
- [ ] Parser mit Test-Fixture absichern, falls echte XML-Datei noch fehlt.
- [ ] UI-Hinweis `Gemeindedatei fehlt` anzeigen, wenn XML nicht geladen werden kann.
- [ ] Zieladresse mit Gemeindekennzahl verbinden, wenn ein gespeicherter Treffer vorhanden ist.
- [ ] Manuelle Auswahl/Korrektur der Gemeindekennzahl in der Abarbeitungsansicht erlauben.

## 2. Reisekosten-Erfassung

### Speichern und Bearbeitungszustand

- [ ] `Reise speichern` so aendern, dass der aktuelle Datensatz offen bleibt.
- [ ] Nach `Reise speichern` `editingId` beibehalten.
- [ ] Nach `Reise speichern` Formular nicht leeren.
- [ ] Toast fuer Speichern beibehalten.
- [ ] Button `Speichern und Schliessen` ergaenzen.
- [ ] `Speichern und Schliessen` speichert den aktuellen Datensatz.
- [ ] `Speichern und Schliessen` beendet danach den Bearbeitungsmodus.
- [ ] `Speichern und Schliessen` setzt Formular auf neue Reise zurueck.
- [ ] Button `Neu` beibehalten, aber Verhalten gegen ungespeicherte Aenderungen absichern.
- [ ] Beim Wechsel der Maske pruefen, ob ein speicherbarer Reiseentwurf vorhanden ist.
- [ ] Entwurf automatisch speichern, wenn `reason.trim()` vorhanden ist.
- [ ] Komplett leeren Entwurf beim Maskenwechsel nicht speichern.
- [ ] Beim Bearbeiten einer bestehenden Reise ungespeicherte Aenderungen beim Maskenwechsel automatisch sichern.
- [ ] Fehlerhafte Zeitfelder duerfen Auto-Save nicht blockieren, solange Grund vorhanden ist.

### Unvollstaendige Reisen

- [ ] Speichern mit Datum und Grund ohne `Zeit von` erlauben.
- [ ] Speichern mit Datum und Grund ohne `Zeit bis` erlauben.
- [ ] Pflichtvalidierung fuer Start-/Endzeit aus `saveTrip` entfernen.
- [ ] Ungueltige nicht-leere Uhrzeiten weiterhin als Feldfehler anzeigen.
- [ ] Bei fehlenden Zeiten `durationMinutes = 0` speichern.
- [ ] Bei fehlenden Zeiten `perDiemCents = 0` speichern.
- [ ] Bei fehlenden Zeiten `taxPerDiemCents = 0` anzeigen.
- [ ] Unvollstaendige Reisen in der Liste farblich dezent markieren.
- [ ] Badge `Unvollstaendig` fuer unvollstaendige Reisen anzeigen.
- [ ] Unvollstaendige Reisen weiterhin bearbeiten, loeschen und erledigen koennen.
- [ ] Screenshots/Nachweise nach erstem Speichern auch fuer unvollstaendige Reisen erlauben.

### Route und Adressen

- [ ] `Startort`-AutoFit so erweitern, dass bei sehr langer Eingabe zweizeilige Darstellung verwendet wird.
- [ ] Visuelle Hoehe des Eingabefelds stabil halten.
- [ ] Inhalt darf umbrechen, aber Layout darf nicht springen.
- [ ] Standard-Startort weiterhin als Default verwenden:

```text
Finanzamt Oesterreich - Dienststelle Bruck Eisenstadt Oberwart, Neusiedler Str. 46, 7001 Eisenstadt
```

- [ ] In `Erfasste Reisen` Standard-Startort ausblenden.
- [ ] Abweichende Startorte weiterhin anzeigen.
- [ ] Zieladresse-Feld mit Icon-Button erweitern.
- [ ] Icon-Button im Feld rechts platzieren, ohne Texteingabe zu verdecken.
- [ ] Klick auf Icon-Button oeffnet Zieladress-Maske.
- [ ] Zieladress-Maske als Modal oder seitliches Panel umsetzen.
- [ ] Zieladress-Maske per Escape schliessbar machen.
- [ ] Zieladress-Maske mit Suche/Filter ausstatten.
- [ ] Zieladresse neu anlegen koennen.
- [ ] Zieladresse bearbeiten koennen.
- [ ] Zieladresse loeschen koennen.
- [ ] Zieladresse mit einem Klick uebernehmen koennen.
- [ ] Nach Uebernahme `form.destination` setzen.
- [ ] Nach Uebernahme Maske schliessen.
- [ ] Optional gespeicherte `municipalityCode` mit in den Reise-/Abarbeitungskontext uebernehmen.

## 3. Reisekosten-Berechnung und Anzeige

### Berechnungsfunktionen

- [ ] Funktion fuer fiktives Kilometergeld weiter als Basis verwenden.
- [ ] Funktion fuer berechneten Oeffi-BEZU separat halten.
- [ ] Funktion fuer Oeffi-Auszahlung ergaenzen: `max(berechneter Oeffi-BEZU, Ticketpreis)`.
- [ ] Funktion fuer steuerpflichtigen Oeffi-BEZU ergaenzen.
- [ ] Funktion fuer `Werbungskosten Fahrtkosten` ergaenzen.
- [ ] `calculateTransportDifferentialCents` auf neue Bedeutung umstellen oder eindeutig umbenennen.
- [ ] `calculateTripDifferentialCents` so anpassen, dass keine doppelte Addition passiert.
- [ ] Jahreszusammenfassung auf neue Fahrtkosten-Werbungskosten umstellen.
- [ ] Vorschau und gespeicherte Trips mit derselben Logik berechnen.

### Eingabefelder

- [ ] Feld `Bezahlte Steuer (EUR)` entfernen.
- [ ] `transportSubsidyTaxEuros` aus Formularzustand entfernen.
- [ ] `transportSubsidyTaxCents` nicht mehr aus UI speichern.
- [ ] Feld `Ticketpreis (EUR)` nur bei `Befoerderungszuschuss Oeffis` aktiv lassen.
- [ ] Feld `Ticketpreis (EUR)` bei allen anderen Fahrtkostenarten ausgegraut lassen.
- [ ] Bei Wechsel weg von `Befoerderungszuschuss Oeffis` Ticketpreis fuer Berechnung auf `0` behandeln.

### Reisevorschau

- [ ] Kostenreihenfolge aendern:
  - [ ] `Diaeten Arbeitgeber`
  - [ ] `Fahrtkosten`
  - [ ] `Sonstige Kosten`
- [ ] Bereich `Steuer & Differenz` neu sortieren:
  - [ ] `Diaeten steuerlich`
  - [ ] `Steuerpfl. Oeffi-BEZU`
  - [ ] Trennlinie
  - [ ] `Differenz Diaeten`
  - [ ] `Werbungskosten Fahrtkosten`
  - [ ] `Differenz gesamt`
- [ ] Trennlinie zwischen `Steuerpfl. Oeffi-BEZU` und `Differenz Diaeten` darstellen.
- [ ] `Differenz gesamt` semibold darstellen.
- [ ] Bezeichnung `Differenz Fahrtkosten` in `Werbungskosten Fahrtkosten` aendern.
- [ ] Bei `Ticketpreis > Oeffi-BEZU` Hinweisbox anzeigen.
- [ ] Hinweisbox nur fuer Fahrtkostenart `Befoerderungszuschuss Oeffis` anzeigen.

### Jahreswerte

- [ ] Jahreswerte mit denselben Berechnungsfunktionen wie Reisevorschau berechnen.
- [ ] Jahresuebersicht um Block `Offene Reiserechnungen` ergaenzen.
- [ ] Offene Anzahl anzeigen.
- [ ] Offenen Gesamtbetrag anzeigen.
- [ ] Offene Werbungskosten Fahrtkosten anzeigen.
- [ ] Optional aelteste offene Reise anzeigen.
- [ ] Erledigte Reisen in Gesamtjahreswerten behalten.
- [ ] Erledigte Reisen aus offenen Werten ausschliessen.
- [ ] Alten Jahresuebersicht-Hinweistext entfernen:

```text
Kilometergeld, Befoerderungszuschuesse, Arbeitgeber-Diaeten und steuerliche Vergleichswerte werden automatisch berechnet. Sonstige Kosten und bezahlte Steuer bleiben manuelle Eingaben.
```

## 4. Reisekosten-Layout und Navigation

- [ ] Route `#/reisekosten/jahr` anlegen.
- [ ] Komponente fuer Jahresuebersicht aus Reiseeingabe herausloesen.
- [ ] Sidebar-Unterpunkt `Jahresuebersicht` unter `Reisekosten` anzeigen.
- [ ] Sidebar-Unterpunkt leicht einruecken.
- [ ] Sidebar-Unterpunkt visuell als Untermenuepunkt kenntlich machen.
- [ ] Aktiven Zustand fuer `#/reisekosten/jahr` korrekt anzeigen.
- [ ] Rechte Seite der Reiseeingabe durch aktuelle Kostenauswertung ersetzen.
- [ ] Rechte Kostenauswertung mit Gruppen `Reise`, `Kosten`, `Steuer & Differenz` aufbauen.
- [ ] Kostenauswertung rechts synchron zum aktuellen Formular aktualisieren.
- [ ] Bestehende grosse Karten-/Maps-Vorschau weiterhin sinnvoll platzieren.
- [ ] Titelzeile in `Erfasste Reisen` eine Schriftgroesse groesser machen.
- [ ] Offene Reisen mit Badge `Offen` kennzeichnen.
- [ ] Unvollstaendige Reisen mit Badge `Unvollstaendig` kennzeichnen.
- [ ] Abgeschlossene Reisen weiterhin dezenter anzeigen.

## 5. Reisekosten-Abarbeitung

- [ ] Ansicht oder Abschnitt `Offene Reisekosten abarbeiten` erstellen.
- [ ] Nur Reisen mit `done === false` anzeigen.
- [ ] Unvollstaendige Reisen sichtbar markieren.
- [ ] Pro Reise Gesamtsumme aus App-Berechnung anzeigen.
- [ ] Pro Reise Feld `Zeit von` anzeigen.
- [ ] Pro Reise Feld `Zeit bis` anzeigen.
- [ ] Pro Reise Feld `Grund` anzeigen.
- [ ] Pro Reise Feld `Gemeindekennzahl` anzeigen.
- [ ] Pro Oeffi-Reise Feld `Beschreibung` anzeigen.
- [ ] Pro Oeffi-Reise Feld `Bemerkungen` anzeigen.
- [ ] Pro Oeffi-Reise Feld `Anzahl` anzeigen.
- [ ] `Zeit von` als `DD.MM.YYYY, HH:MM` formatieren.
- [ ] `Zeit bis` als `DD.MM.YYYY, HH:MM` formatieren.
- [ ] Fehlende Zeiten als nicht kopierfertig markieren.
- [ ] `Beschreibung` fuer BEZU fix auf `Fahrt Oeffis` setzen.
- [ ] `Bemerkungen` nach Vorlage generieren:

```text
Fahrt wurde mit oeffentlichen Verkehrsmitteln angetreten. Eisenstadt Finanzamt -> {Zieladresse} Kilometer lt. Google Maps
```

- [ ] `Anzahl` als einfache Strecke in Kilometern ausgeben.
- [ ] Neben jedem Feld kleinen Copy-Icon-Button anzeigen.
- [ ] Copy-Button kopiert nur den jeweiligen Einzelwert.
- [ ] Copy-Erfolg per Toast bestaetigen.
- [ ] Copy-Fehler per Toast oder Inline-Fehler anzeigen.
- [ ] Reise aus Abarbeitungsansicht auf `Erledigt` setzen koennen.
- [ ] Erledigte Reise verschwindet aus der offenen Abarbeitungsliste.
- [ ] Leeren Zustand anzeigen, wenn keine offenen Reisekosten vorhanden sind.

## 6. Dashboard-Zeiterfassung

### Wochenuebersicht

- [ ] Summenzeile im Kopf der Wochenuebersicht entfernen:

```text
-4:57 h
Plus 2:55 h
Minus 7:52 h
```

- [ ] Nach Enduhrzeit eine neue Delta-Spalte einfuegen.
- [ ] Delta-Spalte pro Tag mit Plus-/Minusstatus anzeigen.
- [ ] Plusstatus mit modernem SVG-Icon darstellen.
- [ ] Minusstatus mit modernem SVG-Icon darstellen.
- [ ] Neutralen Zustand bei `0` darstellen.
- [ ] Betrag im kompakten Stundenformat anzeigen.
- [ ] Vorhandene `@phosphor-icons/react` Icons bevorzugen.
- [ ] Tabellenlayout auf Desktop stabil halten.
- [ ] Tabellenlayout auf Mobil lesbar halten.

### Resturlaub inline bearbeiten

- [ ] Resturlaub-Detail per Doppelklick editierbar machen.
- [ ] Beispielwert `168:00 h von 200:00 h` in Inline-Eingabe verwandeln.
- [ ] Bearbeitet wird der Restwert.
- [ ] Nach Bestaetigung `vacationUsedMinutes` berechnen:

```text
vacationUsedMinutes = vacationEntitlementMinutes - newRemainingMinutes
```

- [ ] Bestehende Urlaubs-Berechnungslogik weiterverwenden.
- [ ] Keine zweite Urlaubslogik einfuehren.
- [ ] Negative Restwerte ablehnen.
- [ ] Restwert groesser als Urlaubsanspruch ablehnen.
- [ ] Ungueltiges Stundenformat ablehnen.
- [ ] Escape bricht Inline-Bearbeitung ab.
- [ ] Enter speichert Inline-Bearbeitung.
- [ ] Blur speichert oder verwirft konsistent nach bestehendem UI-Muster.

### Gleittag buchen

- [ ] Gleitzeit-Metric im Dashboard um Button fuer Gleittag erweitern.
- [ ] Button bucht eine Gleitzeitkorrektur.
- [ ] Korrektur mit `diffMinutes = -dailyTargetMinutes` erzeugen.
- [ ] Notiz `Gleittag vorgemerkt` setzen.
- [ ] Datum auf aktuelles oder ausgewaehltes Datum setzen.
- [ ] Gleitzeitstand nach Buchung sofort aktualisieren.
- [ ] Buchung per Toast bestaetigen.
- [ ] Storno ueber bestehende Korrekturliste erlauben.
- [ ] Gleittag-Korrekturen in Einstellungen erkennbar markieren.
- [ ] Technisch normale Gleitzeitkorrekturen beibehalten.

## 7. Allgemeines UI

- [ ] Seitenueberschrift `Zeiterfassung` zwei Schriftgroessenstufen kleiner machen.
- [ ] Seitenueberschrift `Reisen erfassen` zwei Schriftgroessenstufen kleiner machen.
- [ ] Seitenueberschrift `Aufgaben` zwei Schriftgroessenstufen kleiner machen.
- [ ] Seitenueberschrift `Lokale Steuerzentrale` zwei Schriftgroessenstufen kleiner machen.
- [ ] Header-Beschreibung unter `Zeiterfassung` entfernen.
- [ ] Header-Beschreibung unter `Reisen erfassen` entfernen.
- [ ] Header-Beschreibung unter `Aufgaben` entfernen.
- [ ] Header-Beschreibung unter `Lokale Steuerzentrale` entfernen.
- [ ] `Header`-Komponente so anpassen, dass Beschreibung optional ist.
- [ ] Text `Arbeitsdaten bleiben in IndexedDB auf diesem Geraet.` deutlich kleiner darstellen.
- [ ] Diesen Text deutlich heller/grauer darstellen.
- [ ] Pruefen, ob der Text aus der Sidebar entfernt und nur in Einstellungen gezeigt werden soll.
- [ ] Ruhige helle Arbeitsoberflaeche beibehalten.
- [ ] Kompakte datenorientierte Darstellung beibehalten.
- [ ] Keine extern geladenen Kern-Assets einfuehren.
- [ ] Keine Emoji-Icons verwenden.

## 8. PWA-Icon

- [ ] Passenderes Arbeitszeit/Reisekosten-Icon auswaehlen.
- [ ] Frei nutzbare Lizenz pruefen.
- [ ] Bevorzugt lokales SVG-Konzept aus Arbeitskoffer und Uhr verwenden.
- [ ] Optional Material Design Icons `briefcase-clock-outline` als Apache-2.0-Referenz verwenden.
- [ ] `public/favicon.svg` aktualisieren.
- [ ] `public/apple-touch-icon.svg` aktualisieren.
- [ ] `public/pwa-192.svg` aktualisieren.
- [ ] `public/pwa-512.svg` aktualisieren.
- [ ] `vite.config.ts` auf lokale SVG-Assets belassen.
- [ ] PWA Manifest nach Icon-Aenderung pruefen.
- [ ] Build pruefen, dass Icons in den Service-Worker-Assets landen.

## 9. Tests

### Reisekosten-Zeiten

- [ ] Reise mit nur Grund ist speicherbar.
- [ ] Reise ohne Startzeit speichert `durationMinutes = 0`.
- [ ] Reise ohne Endzeit speichert `durationMinutes = 0`.
- [ ] Reise ohne Zeiten speichert `perDiemCents = 0`.
- [ ] Reise ohne Zeiten wird als `Unvollstaendig` erkannt.
- [ ] Nachtragen von Zeiten macht Reise vollstaendig.

### Oeffi-BEZU

- [ ] Normalfall testen: `Kilometergeld 60`, `BEZU 50`, `Ticket 5`.
- [ ] Normalfall erwartet `steuerpflichtig 45`.
- [ ] Normalfall erwartet `Werbungskosten Fahrtkosten 55`.
- [ ] Sonderfall testen: `Kilometergeld 60`, `BEZU 50`, `Ticket 55`.
- [ ] Sonderfall erwartet `Auszahlung 55`.
- [ ] Sonderfall erwartet `steuerpflichtig 0`.
- [ ] Sonderfall erwartet `Werbungskosten Fahrtkosten 5`.
- [ ] Test sicherstellen, dass steuerpflichtiger Oeffi-BEZU nicht doppelt addiert wird.
- [ ] Test sicherstellen, dass Werbungskosten Fahrtkosten nie negativ werden.
- [ ] Test fuer `Ticketpreis = 0`.
- [ ] Test fuer `Ticketpreis > Kilometergeld`.

### Jahresuebersicht

- [ ] Offene Summe zaehlt nur `done === false`.
- [ ] Erledigte Reisen bleiben in Gesamtjahreswerten enthalten.
- [ ] Erledigte Reisen sind nicht in offenen Werten enthalten.
- [ ] Offene Werbungskosten Fahrtkosten werden korrekt summiert.

### Zieladressen

- [ ] Zieladresse speichern.
- [ ] Zieladresse bearbeiten.
- [ ] Zieladresse uebernehmen.
- [ ] Zieladresse loeschen.
- [ ] Zieladresse mit Gemeindekennzahl speichern.
- [ ] Zieladresssuche filtert nach Name und Adresse.

### Dashboard

- [ ] Resturlaub-Doppelklick startet Inline-Bearbeitung.
- [ ] Restwert-Aenderung aktualisiert `vacationUsedMinutes`.
- [ ] Ungueltiger Restwert wird abgelehnt.
- [ ] Gleittag erzeugt Korrektur `-dailyTargetMinutes`.
- [ ] Loeschen der Gleittag-Korrektur stellt Gleitzeit ueber bestehende Logik wieder her.
- [ ] Wochenuebersicht zeigt Tagesdelta nach Enduhrzeit.
- [ ] Wochenuebersicht zeigt keine Summenzeile im Kopf mehr.

### Backup und Migration

- [ ] Backup-Export enthaelt `savedDestinations`.
- [ ] Backup-Import liest `savedDestinations`.
- [ ] Alte Backups ohne `savedDestinations` bleiben importierbar.
- [ ] Alte Trips mit `transportSubsidyTaxCents` bleiben importierbar.
- [ ] Neue Trips ohne `transportSubsidyTaxCents` werden korrekt exportiert.

## 10. UI-Abnahme

- [ ] Desktop pruefen: keine ueberlaufenden Texte in `Startort`.
- [ ] Desktop pruefen: keine ueberlaufenden Texte in `Zieladresse`.
- [ ] Mobil pruefen: keine horizontale Ueberbreite.
- [ ] Mobil pruefen: Zieladress-Maske ist bedienbar.
- [ ] Mobil pruefen: Wochenuebersicht bleibt lesbar.
- [ ] Reisekosten-Untermenue ist eingerueckt sichtbar.
- [ ] Header-Beschreibungen sind entfernt.
- [ ] Jahresuebersicht-Hinweistext ist entfernt.
- [ ] `Arbeitsdaten bleiben in IndexedDB auf diesem Geraet.` ist kleiner und heller.
- [ ] Oeffi-BEZU-Sonderhinweis wird nur im passenden Fall angezeigt.
- [ ] Copy-Buttons sind als Icons erkennbar und haben zugängliche Labels.
- [ ] PWA-Icon im Browser/Manifest sichtbar pruefen.

## 11. Build und Abschluss

- [ ] Unit-Tests ausfuehren.

```bash
npm test
```

- [ ] Produktionsbuild ausfuehren.

```bash
npm run build
```

- [ ] Falls UI geaendert wurde, lokalen Dev-Server starten und Sichtpruefung machen.
- [ ] Relevante Screenshots oder Browser-Pruefung dokumentieren.
- [ ] Geaenderte Dateien reviewen.
- [ ] Keine ungewollten unrelated Changes einchecken.
- [ ] Umsetzung erst abschliessen, wenn Tests und Build erfolgreich sind oder Blocker dokumentiert sind.

## 12. Annahmen

- [ ] App bleibt offline-first.
- [ ] Internet wird nur durch bewusst ausgeloeste Aktionen genutzt, z.B. Google Maps oeffnen.
- [ ] Gemeindekennzahl-XML ist aktuell noch nicht im sichtbaren Projektstand vorhanden.
- [ ] Gemeindekennzahl-XML wird als `public/gemeinden.xml` eingebunden, sobald verfuegbar.
- [ ] Kilometergeld ist fuer Fahrtkosten-Werbungskosten immer die gesetzliche Basis.
- [ ] Beim Oeffi-BEZU wird als steuerfreier Betrag der Ticketpreis angesetzt.
- [ ] Wenn Ticketpreis hoeher als berechneter Oeffi-BEZU ist, wird Ticketpreis ersetzt und die App weist explizit darauf hin.
- [ ] Bestehende Backups mit `transportSubsidyTaxCents` bleiben importierbar.


Commite nach jedem Feature.
Kontrolliere zum Schluss jedes einzelne Feature, ob alles enthalten ist.