# App.tsx modularisieren

## Zusammenfassung

Die derzeit rund 4.000 Zeilen große `src/app/App.tsx` wird schrittweise in bestehende beziehungsweise neue Fachmodule aufgeteilt. Das Verhalten, die Routen, IndexedDB, Backups, UI-Texte und Gestaltung bleiben dabei unverändert.

Dieser Plan wird während der Umsetzung nach jeder abgeschlossenen Etappe mit Status, Testergebnissen und Commit ergänzt.

Aktuell bestätigte Ausgangslage:

- `npm test`: 12 Testdateien und 178 Tests erfolgreich.
- `npm run build`: erfolgreich.
- `TodosView` ist bereits modularisiert.
- `App.test.tsx` enthält derzeit 63 vermischte Tests für Zeit, Einstellungen, Punkte und Reisekosten.
- `styles.css` bleibt in diesem Umbau bewusst unverändert.
- IndexedDB-, Backup- und Datenmodelle werden nicht verändert.
- Der unversionierte Ordner `todo-beispiele/` bleibt unangetastet.

## Zielarchitektur und Abhängigkeitsregeln

```text
src/
  app/
    App.tsx
    types.ts
    useWorkData.ts
    components/
      Feedback.tsx
      FormControls.tsx
      ModalOverlay.tsx
      PageHeader.tsx
      ToastStack.tsx

  lib/
    dates.ts
    format.ts
    input.ts

  modules/
    time/
      TimeDashboardView.tsx
      timeForm.ts
      calculations.ts

    expenses/
      TripsView.tsx
      TripsYearView.tsx
      TripCostPanel.tsx
      TripPickers.tsx
      OpenTripsWorklist.tsx
      tripForm.ts
      tripWorklist.ts
      calculations.ts
      municipalities.ts
      advertisingCostsExport.ts

    points/
      PointsView.tsx
      PointsYearView.tsx
      pointForms.ts
      calculations.ts
      formStatus.ts

    todos/
      TodosView.tsx
      calculations.ts

    settings/
      SettingsView.tsx
      settingsForm.ts
```

Verbindliche Architekturregeln:

- `App.tsx` enthält am Ende nur App-Shell, Navigation, Toast-Zustand und Routing.
- `App.tsx` importiert keine fachlichen Berechnungs-, Formular- oder Formatierungsfunktionen.
- Fachmodule dürfen gemeinsame App-Komponenten und `src/lib/` verwenden, aber nicht `App.tsx` importieren.
- Fachmodule importieren einander nicht direkt.
- Gemeinsame Komponenten enthalten keine Fachlogik.
- Berechnungsfunktionen bleiben reine Funktionen außerhalb der React-Komponenten.
- Verschobene Komponenten behalten DOM-Struktur, CSS-Klassen, ARIA-Attribute und deutsche UI-Texte.
- Keine vorschnellen Barrel-Dateien über allgemeine `index.ts`-Exporte; Imports bleiben explizit.
- Keine neuen globalen State-Lösungen, Contexts oder Bibliotheken.
- `useWorkData` bleibt während dieses Refactorings zentral und funktional unverändert.
- Die globale `styles.css` wird erst in einem späteren, separaten Vorhaben aufgeteilt.

## Öffentliche Typen und Schnittstellen

- `src/app/types.ts` exportiert:

```ts
export type WorkData = ReturnType<typeof useWorkData>;
export type ShowToast = (message: string) => void;

export interface WorkViewProps {
  data: WorkData;
  showToast: ShowToast;
}
```

- Der Import von `useWorkData` in `types.ts` erfolgt als Type-only-Import, damit kein neuer Runtime-Zyklus entsteht.
- Route-Views werden als benannte Komponenten exportiert:
  - `TimeDashboardView`
  - `TripsView`
  - `TripsYearView`
  - `PointsView`
  - `PointsYearView`
  - `TodosView`
  - `SettingsView`
- Nach Abschluss exportiert `App.tsx` nur noch `App`.
- Alle bestehenden URLs bleiben unverändert:
  - `/`
  - `/reisekosten`
  - `/reisekosten/jahr`
  - `/reisekosten/jahr/:year`
  - `/punkte`
  - `/punkte/jahr`
  - `/punkte/jahr/:year`
  - alle `/aufgaben/...`-Routen
  - `/einstellungen`
- Es gibt keine Änderung an Dexie-Stores, Schema-Versionen, Backups oder gespeicherten Daten.

## Schrittweise Umsetzung

### 1. Plan dokumentieren und Sicherheitsbaseline schaffen

- [ ] Vor jeder Änderung `git status --short` prüfen und `todo-beispiele/` nicht vormerken oder verändern.
- [ ] Die erfolgreiche Ausgangsbaseline von 178 Tests und erfolgreichem Build im Dokument festhalten.
- [ ] Eine vollständige, wiederverwendbare `WorkData`-Testfixture anlegen, die alle Arrays, Einstellungen, Uhrzeit und Mutationsfunktionen enthält.
- [ ] Vor dem Verschieben zusätzliche Charakterisierungstests ergänzen:
  - Zeiterfassung zeigt Überschrift, Datum, Zeitfelder und Wochenübersicht.
  - Reisekosten zeigt Erfassungsformular und Reisebereiche.
  - Reisekosten-Jahresübersicht zeigt das gewählte Jahr.
  - Einstellungen zeigt Arbeitszeit-, Backup- und Gefahrenbereiche.
  - Bestehende Punkte-Tests bleiben unverändert grün.
- [ ] Tests auf sichtbares Verhalten, Rollen, Beschriftungen und ARIA-Zustände ausrichten; keine Tests auf interne Dateipfade schreiben.

Prüfung:

```bash
npm test
npm run build
```

Commit nach erfolgreicher Prüfung:

```text
test: characterize views before app modularization
```

### 2. Gemeinsame Typen, Eingabehelfer und UI-Grundbausteine extrahieren

- [ ] `WorkData`, `ShowToast` und `WorkViewProps` aus `App.tsx` nach `src/app/types.ts` verschieben.
- [ ] Allgemeine Eingabeparser nach `src/lib/input.ts` verschieben:
  - `normalizeTimeInput`
  - `parseEuroCentsInput`
- [ ] Allgemeine Datumsformatierung in `src/lib/dates.ts` zusammenführen:
  - `formatDateOnly`
  - gemeinsames Parsen eines optionalen vierstelligen Routenjahres
- [ ] Allgemeine Geldformatierung in `src/lib/format.ts` ergänzen, soweit sie tatsächlich von mehreren Modulen verwendet wird.
- [ ] Gemeinsame UI-Bausteine ohne Fachlogik auslagern:
  - `Header` als `PageHeader`
  - `Notice` und `SkeletonRows`
  - `Field` und `FormSection`
  - `ModalOverlay`
  - `ToastStack`
- [ ] `Metric`, `LiveDayClock`, `WeekTable`, `WorkTimeField` und `AutoFitInput` noch nicht als allgemein einstufen; sie bleiben bei ihren jeweiligen Fachmodulen.
- [ ] Den nachweislich ungenutzten `RoadmapView` entfernen.
- [ ] Parser- und Formatierungstests aus `App.test.tsx` nach passenden `src/lib/*.test.ts` verschieben.
- [ ] Keine Komponente visuell oder semantisch verändern.

Zwischenprüfungen:

```bash
npm test -- --run src/lib
npm test
npm run build
```

Zusätzlich mit `rg` sicherstellen:

- Keine doppelte Definition der verschobenen Helfer.
- Kein Fachmodul importiert `App.tsx`.
- Gemeinsame Komponenten importieren keine Fachmodule.

Commit:

```text
refactor: extract shared app foundations
```

### 3. Punkte und Jahresstatistik modularisieren

- [ ] `AuditPointsView` als `PointsView` nach `src/modules/points/PointsView.tsx` verschieben.
- [ ] Dazu gehörende Unterkomponenten dort oder in einer eng zugehörigen Komponentendatei halten:
  - einklappbare Punktelisten
  - Statusgruppen
  - Formular-Tabs
  - Punkte-Vorschau
- [ ] `PointsYearView` und die Jahrestabellen nach `src/modules/points/PointsYearView.tsx` verschieben.
- [ ] Formularmodelle und Validierungen nach `pointForms.ts` verschieben:
  - Formular-Drafts für BP, USO und sonstige Maßnahmen
  - Steuernummernformatierung
  - Punkte- und Zielwertparser
  - Formularvalidierungen
  - Monats- und Jahresauswahl
- [ ] Bestehende `calculations.ts` und `formStatus.ts` als fachliche Logikquellen beibehalten.
- [ ] Punkte-Tests aus `App.test.tsx` aufteilen:
  - `PointsView.test.tsx` für Tabs, Listen, Statuswechsel und ARIA-Verhalten
  - `pointForms.test.ts` für Formatierung, Validierung und Optionen
  - `PointsYearView.test.tsx` für Jahresauswahl und Tabellen-Smoke-Test
- [ ] `App.tsx` nur noch die beiden Punkte-Views importieren lassen.

Zwischenprüfungen:

```bash
npm test -- --run src/modules/points
npm test
npm run build
```

Manuelle Kontrolle:

- BP-, USO- und Sonstige-Formular öffnen.
- Zwischen Tabs wechseln und Entwürfe prüfen.
- Offene und erledigte Gruppen ein-/ausklappen.
- Punkte-Jahresübersicht und Jahresnavigation öffnen.

Commit:

```text
refactor: modularize points views
```

### 4. Reisekosten-Helfer aus App.tsx lösen

Diese Etappe trennt zuerst reine Logik, bevor die großen React-Views verschoben werden.

- [ ] `tripForm.ts` anlegen und dorthin verschieben:
  - Default-Startort
  - Formularmodell und `tripToForm`
  - Metadaten entfernen
  - Reise duplizieren
  - Zeit- und Betragsvalidierung für das Reiseformular
  - unvollständige Reise erkennen
- [ ] `tripWorklist.ts` anlegen und dorthin verschieben:
  - offene Reisen sortieren
  - Copy-Felder erzeugen
  - Datum/Uhrzeit für Copy-Ausgaben formatieren
  - ÖPNV-Zielort bestimmen
  - Zieladress-Drafts erzeugen
  - Google-Maps-URLs erzeugen
  - Nachweistypen und Nachweisbeschreibungen bestimmen
- [ ] Jahresnavigation und ÖPNV-Jahresgrenzen fachlich dem Reisekostenmodul zuordnen.
- [ ] Reine Reisekosten-Helfertests aus `App.test.tsx` nach `tripForm.test.ts` und `tripWorklist.test.ts` verschieben.
- [ ] Bestehende Berechnungs-, Gemeinde- und Exportmodule unverändert weiterverwenden.
- [ ] `App.tsx` darf die neuen Helfer vorübergehend noch für die dort verbliebenen Views importieren.

Zwischenprüfungen:

```bash
npm test -- --run src/modules/expenses
npm test
npm run build
```

Commit:

```text
refactor: extract travel form and worklist helpers
```

### 5. Reisekosten-Views und Unterkomponenten verschieben

- [ ] `TripsView` nach `src/modules/expenses/TripsView.tsx` verschieben.
- [ ] `TripsYearView` nach `src/modules/expenses/TripsYearView.tsx` verschieben.
- [ ] Große, eigenständig verständliche Unterkomponenten aufteilen:
  - Kostenübersicht als `TripCostPanel`
  - Gemeinde- und Zieladressauswahl als `TripPickers`
  - Dialog und Arbeitsliste offener Reisen als `OpenTripsWorklist`
- [ ] Datei-Upload, Vorschau, Download, Copy-Aktionen, automatische Zieladressanlage und Kartenanzeige unverändert erhalten.
- [ ] Die Jahresübersicht behält Zahlungen, Jahreslimit, Export, Druck und offene Reiserechnungen.
- [ ] Mindestens folgende View-Tests ergänzen beziehungsweise beibehalten:
  - neue, bestehende und duplizierte Reise werden korrekt ins Formular geladen
  - unvollständige Zeiten bleiben speicherbar
  - offene und erledigte Reisen bleiben getrennt
  - Picker öffnen und schließen mit korrekten ARIA-Beziehungen
  - Jahresauswahl berücksichtigt vorhandene und aktuell ausgewählte Jahre
  - ÖPNV-Jahresgrenze akzeptiert leere und gültige Werte, weist ungültige Werte zurück
- [ ] `App.tsx` verwendet danach nur noch `TripsView` und `TripsYearView`.

Zwischenprüfungen:

```bash
npm test -- --run src/modules/expenses
npm test
npm run build
```

Browserprüfung auf Desktopbreite:

- `/reisekosten`
- `/reisekosten/jahr`
- `/reisekosten/jahr/2026`
- Formularsektionen, Modale, Kartenbereich und Jahresübersicht visuell vergleichen.
- Browserkonsole auf React-, Router- und Laufzeitfehler prüfen.

Commit:

```text
refactor: modularize travel views
```

### 6. Zeiterfassung modularisieren

- [ ] `Dashboard` als `TimeDashboardView` nach `src/modules/time/TimeDashboardView.tsx` verschieben.
- [ ] Zeitbezogene Unterkomponenten mitverschieben:
  - `WorkTimeField`
  - `WeekTable`
  - `Metric`
  - `LiveDayClock`
- [ ] `timeForm.ts` für Formularabbildung und UI-nahe reine Helfer anlegen:
  - `entryToForm`
  - bevorzugtes Eingabedatum
  - überfälligen Arbeitstag ohne Dienstende erkennen
  - Vorschau- und Speicherzeit normalisieren
  - Fortschritts- und Statuswerte für die Live-Anzeige
- [ ] Bestehende fachliche Berechnungen in `time/calculations.ts` unverändert lassen.
- [ ] Zeitbezogene Tests aus `App.test.tsx` verschieben:
  - `timeForm.test.ts` für Datumswahl und Form-Helfer
  - `TimeDashboardView.test.tsx` für Schnellwahl, Tagesformular und Wochenanzeige
- [ ] Folgende Fälle explizit testen:
  - konfigurierte Schnellwahl setzt nur das gewählte Feld
  - ältester beziehungsweise neuester relevanter offener Werktag wird korrekt gewählt
  - Wochenende, Zukunft und abgeschlossene Tage werden ignoriert
  - fehlendes Dienstende erzeugt weiterhin Warnstatus
  - Wochenwechsel ruft dieselbe Datumsauswahl wie zuvor auf

Zwischenprüfungen:

```bash
npm test -- --run src/modules/time
npm test
npm run build
```

Browserprüfung:

- `/` öffnen.
- Datum wechseln, Schnellwahl verwenden und Wochenwechsel prüfen.
- Live-Uhr, Metriken, Urlaubseditor und Warnhinweise visuell prüfen.

Commit:

```text
refactor: modularize time dashboard
```

### 7. Einstellungen und Systemfunktionen modularisieren

- [ ] `SettingsView` nach `src/modules/settings/SettingsView.tsx` verschieben.
- [ ] Systemstatus, Backup, Gleitzeitkorrekturen und Gefahrenbereich als interne Unterkomponenten dort behalten oder bei deutlich besserer Lesbarkeit in eng zugehörige Dateien trennen.
- [ ] `settingsForm.ts` anlegen für:
  - Settings-zu-Formular-Abbildung
  - Stunden- und optionale Uhrzeitvalidierung
  - Formularfehlertypen
- [ ] Backup-Logik selbst bleibt in `src/services/backup.ts`.
- [ ] Datenbankoperationen bleiben in `useWorkData` beziehungsweise `database.ts`.
- [ ] Settings-Tests aus `App.test.tsx` nach `settingsForm.test.ts` und `SettingsView.test.tsx` verschieben.
- [ ] Testfälle:
  - Standard- und Legacy-Einstellungen werden korrekt abgebildet
  - optionale Schnellwahlzeiten bleiben optional
  - ungültige Stunden und Uhrzeiten verhindern Speichern
  - gültiges Formular ruft `saveSettings` mit normalisierten Werten auf
  - Backup- und Löschen-Aktionen bleiben über ihre Beschriftungen erreichbar
  - Bestätigungsmechanismus zum Löschen lokaler Daten bleibt erhalten

Zwischenprüfungen:

```bash
npm test -- --run src/modules/settings
npm test -- --run src/services/backup.test.ts
npm test
npm run build
```

Browserprüfung:

- `/einstellungen`
- Arbeitszeitwerte, Korrekturformular, Backup-Bereich und Gefahrenbereich prüfen.
- Keine echte Datenlöschung im manuellen Smoke-Test auslösen.

Commit:

```text
refactor: modularize settings view
```

### 8. App-Shell bereinigen und Routentests abschließen

- [ ] Nicht mehr benötigte Imports, Typen, Helfer und Komponenten aus `App.tsx` entfernen.
- [ ] `App.tsx` auf App-Shell, Navigation, Toast-Verwaltung und Routen reduzieren.
- [ ] `TodosView` funktional unverändert lassen und nur auf die gemeinsamen Prop-Typen umstellen, wenn dies ohne zusätzliche Kopplung möglich ist.
- [ ] Einen schlanken `App.test.tsx` beibehalten, der nur App-Verantwortung testet:
  - Navigation ist vorhanden
  - jede Route rendert die richtige View
  - Unterrouten bleiben aktiv erreichbar
  - unbekannte Route leitet zum Dashboard
  - globaler Datenfehler wird angezeigt
  - Toasts können angezeigt und entfernt werden
- [ ] Alle fachlichen Tests müssen nun neben ihrem jeweiligen Modul liegen.
- [ ] Sicherstellen, dass `App.tsx` keine fachlichen Helper mehr exportiert.
- [ ] Zielwert: `App.tsx` bleibt unter ungefähr 250 Zeilen; wichtiger als die exakte Zahl sind klare Zuständigkeiten.
- [ ] Keine rein kosmetischen Umformatierungen außerhalb der verschobenen Bereiche durchführen.

Statische Abschlusskontrollen:

```bash
rg -n "from .*app/App" src/modules src/lib
rg -n "calculate|validate|parseEuro|normalizeTime" src/app/App.tsx
rg -n "^export " src/app/App.tsx
git diff --check
```

Erwartung:

- Kein Modul importiert `App.tsx`.
- `App.tsx` exportiert nur `App`.
- Keine fachliche Berechnung oder Formularvalidierung befindet sich mehr in `App.tsx`.
- `git diff --check` meldet keine Whitespace-Probleme.

Commit:

```text
refactor: reduce app to shell and routes
```

### 9. Vollständige Abschlussprüfung

Automatisiert:

```bash
npm test
npm run build
git status --short
```

Akzeptanz:

- Mindestens die bestehenden 178 Tests bleiben erhalten; zusätzliche Charakterisierungs- und Routentests erhöhen die Gesamtzahl.
- Alle Tests bestehen.
- TypeScript- und Vite-Build bestehen.
- Keine Datenbank- oder Backup-Schemaänderung.
- Keine geänderten Routen.
- Keine unbeabsichtigte Änderung an `dist/` oder `todo-beispiele/`.

Browser-Smoke-Test auf Desktop und schmalem Viewport:

- Dashboard/Zeiterfassung
- Reisekosten
- Reisekosten-Jahresübersicht
- Punkte
- Punkte-Jahresübersicht
- Aufgaben
- Einstellungen
- Navigation, Modale, Formulare, Tabellen und responsive Darstellung
- Browserkonsole ohne neue Fehler oder Warnungen

Abschlussdokumentation in `plans/App-Modularisierung.md`:

- alle erledigten Schritte abhaken
- ausgeführte Testbefehle und Ergebnis festhalten
- neue Modulstruktur dokumentieren
- verbleibende bewusst nicht bearbeitete Punkte notieren
- finalen Commit-Hash eintragen

Abschlusscommit, falls ausschließlich die aktualisierte Plandokumentation offen ist:

```text
docs: complete app modularization plan
```

## Commit- und Synchronisationsstrategie

Nach jeder vollständig grünen Etappe:

1. Nur die zur Etappe gehörenden Dateien vormerken.
2. `git diff --cached` und `git status --short` kontrollieren.
3. Den angegebenen fokussierten Conventional Commit erstellen.
4. Mit dem Remote-Stand per Rebase abgleichen.
5. Den Branch zu `origin/main` synchronisieren.
6. Commit-Hash und Testergebnis im Plan vermerken.

Bei einem fehlschlagenden Test wird nicht mit der nächsten Etappe begonnen. Der Fehler wird innerhalb der aktuellen Etappe behoben oder die Etappe wird ohne Zurücksetzen fremder Änderungen sauber eingegrenzt.

## Annahmen und bewusste Grenzen

- Der Umbau ist rein strukturell; sichtbare Funktionen und Fachregeln werden nicht geändert.
- Neue Kalkulationsmodule für Bier oder Taxi werden erst nach diesem Umbau begonnen.
- `styles.css` wird nicht aufgeteilt, weil eine gleichzeitige Änderung der CSS-Kaskade das Risiko unnötig erhöht.
- `useWorkData` wird noch nicht in Modul-Hooks zerlegt; das kann später separat erfolgen, falls Lade- oder Kopplungsprobleme auftreten.
- IndexedDB, Backupformat, PWA-Konfiguration und Deployment bleiben unverändert.
- Es wird kein Lazy Loading eingeführt; das wäre eine eigenständige Performance-Änderung.
- Bestehende Testaussagen werden nicht abgeschwächt, nur fachlich passend verschoben.
- Unabhängige lokale Dateien und Änderungen des Benutzers werden nicht aufgenommen, verändert oder zurückgesetzt.
