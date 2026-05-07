import JSZip from "jszip";
import { readAllData, replaceAllData } from "../db/database";
import { APP_NAME, BACKUP_SCHEMA_VERSION, type BackupData, type BackupManifest, type BackupPayload } from "../db/schema";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function exportBackup(): Promise<Blob> {
  const data = await readAllData();
  const manifest: BackupManifest = {
    appName: APP_NAME,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      timeEntries: data.timeEntries.length,
      flexCorrections: data.flexCorrections.length,
      trips: data.trips.length,
      todos: 0,
      files: 0
    }
  };
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("data.json", JSON.stringify(data, null, 2));
  zip.folder("files");
  return zip.generateAsync({ type: "blob" });
}

export function backupFileName(now = new Date()): string {
  return `arbeits-dashboard-backup-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;
}

export async function downloadBackup(): Promise<void> {
  const blob = await exportBackup();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFileName();
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function inspectBackup(file: File): Promise<BackupPayload> {
  const zip = await JSZip.loadAsync(file).catch(() => {
    throw new Error("Backup-Datei ist keine gültige ZIP-Datei.");
  });
  const manifestFile = zip.file("manifest.json");
  const dataFile = zip.file("data.json");
  if (!manifestFile || !dataFile) {
    throw new Error("Backup muss manifest.json und data.json enthalten.");
  }
  const manifest = parseJson(await manifestFile.async("string"), "Manifest ist kein gültiges JSON.");
  const data = parseJson(await dataFile.async("string"), "Daten sind kein gültiges JSON.");
  validateManifest(manifest);
  validateData(data);
  return { manifest, data };
}

export async function importBackup(file: File): Promise<BackupPayload> {
  const payload = await inspectBackup(file);
  await replaceAllData(payload.data);
  return payload;
}

function validateManifest(value: unknown): asserts value is BackupManifest {
  if (!isObject(value)) throw new Error("Manifest ist ungültig.");
  if (value.appName !== APP_NAME) throw new Error("Backup gehört nicht zu dieser App.");
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error("Backup-Schema wird nicht unterstützt.");
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) throw new Error("Export-Zeitpunkt fehlt oder ist ungültig.");
  if (!isObject(value.counts)) throw new Error("Backup-Zählwerte fehlen.");
}

function validateData(value: unknown): asserts value is BackupData {
  if (!isObject(value)) throw new Error("Daten sind ungültig.");
  if (!Array.isArray(value.timeEntries)) throw new Error("Zeiteinträge fehlen.");
  if (!Array.isArray(value.flexCorrections)) throw new Error("Gleitzeitkorrekturen fehlen.");
  if (!("settings" in value)) throw new Error("Einstellungen fehlen.");
  if (!("vacationSummary" in value)) throw new Error("Urlaubswerte fehlen.");
  if (!Array.isArray(value.trips)) throw new Error("Reisekosten fehlen.");
  if (value.settings !== null) validateSettings(value.settings);
  value.timeEntries.forEach(validateTimeEntry);
  value.flexCorrections.forEach(validateFlexCorrection);
  if (value.vacationSummary !== null) validateVacationSummary(value.vacationSummary);
  value.trips.forEach(validateTrip);
}

function parseJson(text: string, message: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(message);
  }
}

function validateSettings(value: unknown): void {
  if (!isObject(value)) throw new Error("Einstellungen sind ungültig.");
  requireString(value, "id", "Einstellungen-ID fehlt.");
  requireNumber(value, "dailyTargetMinutes", "Tägliche Sollzeit fehlt.");
  requireNumber(value, "weeklyTargetMinutes", "Wochenarbeitszeit fehlt.");
  requireNumber(value, "flexLimitMinutes", "Gleitzeitgrenze fehlt.");
  requireNullableNumber(value, "flexStartMinutes", "Gleitzeitstartwert ist ungültig.");
  requireNullableNumber(value, "vacationEntitlementMinutes", "Urlaubsanspruch ist ungültig.");
  requireNumber(value, "vacationUsedMinutes", "Verbrauchter Urlaub fehlt.");
  requireString(value, "updatedAt", "Einstellungs-Zeitstempel fehlt.");
}

function validateTimeEntry(value: unknown): void {
  if (!isObject(value)) throw new Error("Zeiteintrag ist ungültig.");
  requireString(value, "id", "Zeiteintrag-ID fehlt.");
  requireString(value, "date", "Zeiteintrag-Datum fehlt.");
  requireOptionalString(value, "startTime", "Dienstbeginn ist ungültig.");
  requireOptionalString(value, "endTime", "Dienstende ist ungültig.");
  requireNumber(value, "breakMinutes", "Pause fehlt.");
  requireNumber(value, "targetMinutes", "Sollzeit fehlt.");
  requireString(value, "note", "Notiz fehlt.");
  requireString(value, "createdAt", "Zeiteintrag-Erstellt-Zeit fehlt.");
  requireString(value, "updatedAt", "Zeiteintrag-Aktualisiert-Zeit fehlt.");
}

function validateFlexCorrection(value: unknown): void {
  if (!isObject(value)) throw new Error("Gleitzeitkorrektur ist ungültig.");
  requireString(value, "id", "Korrektur-ID fehlt.");
  requireString(value, "date", "Korrektur-Datum fehlt.");
  requireNumber(value, "oldValueMinutes", "Alter Korrekturwert fehlt.");
  requireNumber(value, "newValueMinutes", "Neuer Korrekturwert fehlt.");
  requireNumber(value, "diffMinutes", "Korrekturdifferenz fehlt.");
  requireString(value, "note", "Korrektur-Notiz fehlt.");
  requireString(value, "createdAt", "Korrektur-Erstellt-Zeit fehlt.");
}

function validateVacationSummary(value: unknown): void {
  if (!isObject(value)) throw new Error("Urlaubswerte sind ungültig.");
  requireString(value, "id", "Urlaubs-ID fehlt.");
  requireNumber(value, "year", "Urlaubsjahr fehlt.");
  requireNullableNumber(value, "entitlementMinutes", "Urlaubsanspruch ist ungültig.");
  requireNumber(value, "usedMinutes", "Verbrauchter Urlaub fehlt.");
  requireString(value, "updatedAt", "Urlaubs-Zeitstempel fehlt.");
}

function validateTrip(value: unknown): void {
  if (!isObject(value)) throw new Error("Reise ist ungültig.");
  requireString(value, "id", "Reise-ID fehlt.");
  requireString(value, "date", "Reisedatum fehlt.");
  requireString(value, "startTime", "Reisebeginn fehlt.");
  requireString(value, "endTime", "Reiseende fehlt.");
  requireNumber(value, "durationMinutes", "Reisedauer fehlt.");
  requireString(value, "reason", "Reisegrund fehlt.");
  requireString(value, "origin", "Startort fehlt.");
  requireString(value, "destination", "Zieladresse fehlt.");
  requireString(value, "transportType", "Fahrtkostenart fehlt.");
  requireNumber(value, "oneWayKilometers", "Einfache Strecke fehlt.");
  requireNumber(value, "perDiemCents", "Diäten fehlen.");
  requireNumber(value, "otherCostsCents", "Sonstige Kosten fehlen.");
  requireOptionalString(value, "otherCostsDescription", "Beschreibung sonstige Kosten ist ungültig.");
  requireOptionalNumber(value, "ticketPriceCents", "Ticketpreis ist ungültig.");
  requireOptionalNumber(value, "taxableTransportSubsidyCents", "Steuerpflichtiger Beförderungszuschuss ist ungültig.");
  requireOptionalNumber(value, "transportSubsidyTaxCents", "Bezahlte Steuer ist ungültig.");
  requireOptionalString(value, "note", "Reise-Notiz ist ungültig.");
  if (typeof value.done !== "boolean") throw new Error("Reise-Erledigt-Status fehlt.");
  requireString(value, "createdAt", "Reise-Erstellt-Zeit fehlt.");
  requireString(value, "updatedAt", "Reise-Aktualisiert-Zeit fehlt.");
}

function requireString(value: Record<string, unknown>, key: string, message: string): void {
  if (typeof value[key] !== "string") throw new Error(message);
}

function requireOptionalString(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== undefined && typeof value[key] !== "string") throw new Error(message);
}

function requireNumber(value: Record<string, unknown>, key: string, message: string): void {
  if (typeof value[key] !== "number" || !Number.isFinite(value[key])) throw new Error(message);
}

function requireOptionalNumber(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== undefined && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) throw new Error(message);
}

function requireNullableNumber(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== null && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) throw new Error(message);
}
