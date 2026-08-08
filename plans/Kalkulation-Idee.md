# Idee: Fachliche Kalkulationen im Arbeits-Dashboard

## Ziel

Das Arbeits-Dashboard soll um fachliche Kalkulationshilfen für die Betriebsprüfung erweitert werden. Beispiele sind eine Bierkalkulation für Gastronomiebetriebe oder eine Taxikalkulation.

Die Kalkulationen werden in das bestehende Dashboard integriert, bleiben im Code aber als eigenständige Fachmodule voneinander getrennt. Dadurch können Navigation, Offlinefähigkeit, IndexedDB, Backup und das gemeinsame Design weiterverwendet werden, ohne alle Kalkulationen in einer großen Komponente zu vermischen.

## Empfohlene App-Struktur

- Neuer Hauptmenüpunkt `Kalkulationen`.
- Übersichtsseite unter `/kalkulationen` mit allen verfügbaren Kalkulationsarten.
- Eigene Route für jede Kalkulation, zum Beispiel:
  - `/kalkulationen/bier`
  - `/kalkulationen/taxi`
- Gemeinsames Hosting als eine Anwendung und eine PWA.
- Keine separate App oder eigene Bereitstellung für jede Kalkulationsart.

Mögliche Ordnerstruktur:

```text
src/modules/calculations/
  CalculationsOverview.tsx
  shared/
  beer/
    BeerCalculationView.tsx
    calculations.ts
    calculations.test.ts
    types.ts
  taxi/
    TaxiCalculationView.tsx
    calculations.ts
    calculations.test.ts
    types.ts
```

Jedes Kalkulationsmodul besitzt damit seine eigene Oberfläche, Typen, Berechnungslogik und Tests. Gemeinsam benötigte Eingabekomponenten oder Formatierungsfunktionen können unter `shared/` liegen.

## Trennung von App und Fachmodulen

Die neuen Kalkulationsoberflächen sollen nicht direkt in `src/app/App.tsx` implementiert werden. Diese Datei ist bereits sehr umfangreich. Sie sollte für diesen Bereich nur Navigation und Routen verbinden.

Für jedes Modul gelten folgende Grenzen:

- `*CalculationView.tsx` enthält die Oberfläche und Formularsteuerung.
- `calculations.ts` enthält ausschließlich nachvollziehbare, möglichst reine Berechnungsfunktionen.
- `types.ts` definiert Eingaben, Ergebnisse und gespeicherte Datensätze.
- `calculations.test.ts` dokumentiert die Fachregeln anhand konkreter Rechenbeispiele.
- IndexedDB-Zugriffe werden nicht direkt in Berechnungsfunktionen ausgeführt.

## IndexedDB und gespeicherte Kalkulationen

Nicht jede Berechnung muss gespeichert werden. Für reine Sofortberechnungen genügt lokaler Formularzustand. Wenn Fälle später weiterbearbeitet, dokumentiert oder gesichert werden sollen, werden sie in IndexedDB gespeichert.

Als Ausgangspunkt bietet sich ein gemeinsamer Store für Kalkulationsfälle an:

```ts
type CalculationKind = "beer" | "taxi";

type CalculationCase = BeerCalculationCase | TaxiCalculationCase;

interface CalculationCaseBase {
  id: string;
  kind: CalculationKind;
  title: string;
  rulesVersion: string;
  createdAt: string;
  updatedAt: string;
}
```

Die konkreten Varianten ergänzen typisierte Eingaben und Ergebnisse. Es sollen keine beliebigen, untypisierten JSON-Daten gespeichert werden.

Für die Nachvollziehbarkeit einer Betriebsprüfung sollten gespeicherte Fälle enthalten:

- die verwendeten Eingabewerte,
- das berechnete Ergebnis als Snapshot,
- eine Version des verwendeten Regelwerks,
- Erstellungs- und Änderungszeitpunkt.

Dadurch bleibt ein alter Kalkulationsfall nachvollziehbar, auch wenn Berechnungsregeln später geändert werden. Der Store muss außerdem in Datenbankmigration, Backup, Import und „Alle lokalen Daten löschen“ aufgenommen werden.

## Wann getrennte Anwendungen sinnvoll wären

Separate Apps oder getrenntes Hosting sind erst sinnvoll, wenn mindestens eine dieser Bedingungen eintritt:

- unterschiedliche Benutzergruppen oder Zugriffsrechte,
- notwendige technische oder datenschutzrechtliche Trennung der Daten,
- voneinander unabhängige Veröffentlichung und Wartung,
- eine Kalkulation entwickelt sich zu einer großen, eigenständigen Anwendung.

Für Bier-, Taxi- und vergleichbare Prüfungskalkulationen ist ein gemeinsamer Bereich im Arbeits-Dashboard zunächst einfacher und besser wartbar.

## Empfohlener erster Umsetzungsschritt

1. Menüpunkt und Übersichtsroute `Kalkulationen` anlegen.
2. Eine erste Kalkulation, beispielsweise Bier, vollständig als eigenes Modul umsetzen.
3. Fachregeln mit konkreten Rechenbeispielen durch Unit-Tests absichern.
4. Erst nach Klärung des tatsächlichen Speicherbedarfs den gemeinsamen IndexedDB-Store ergänzen.
5. Die zweite Kalkulationsart anhand derselben Modulgrenzen hinzufügen und prüfen, welche Teile wirklich gemeinsam genutzt werden.

So entsteht die gemeinsame Architektur aus realen Anforderungen, ohne frühzeitig zu viele abstrakte Gemeinsamkeiten festzulegen.
