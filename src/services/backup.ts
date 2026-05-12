import JSZip from "jszip";
import { readAllData, replaceAllData } from "../db/database";
import { APP_NAME, BACKUP_SCHEMA_VERSION, type AuditPointCase, type AuditPointGoal, type BackupData, type BackupManifest, type BackupPayload, type UsoCase, type UsoGoal, type TravelExpensePayment, type TripFile } from "../db/schema";

type SerializedTripFile = Omit<TripFile, "dataUrl"> & ({ dataUrl: string; path?: never } | { path: string; dataUrl?: never });
type SerializedBackupData = Omit<BackupData, "files" | "tripPayments" | "auditPointCases" | "auditPointGoals" | "usoCases" | "usoGoals"> & { files: SerializedTripFile[]; tripPayments?: TravelExpensePayment[]; auditPointCases?: AuditPointCase[]; auditPointGoals?: AuditPointGoal[]; usoCases?: UsoCase[]; usoGoals?: UsoGoal[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function exportBackup(): Promise<Blob> {
  const data = await readAllData();
  const zip = new JSZip();
  const filesFolder = zip.folder("files");
  const serializedData: SerializedBackupData = {
    ...data,
    files: data.files.map((file, index) => {
      const path = backupFilePath(file, index);
      const bytes = dataUrlToBytes(file.dataUrl, file.mimeType);
      filesFolder?.file(path.slice("files/".length), bytes);
      const { dataUrl: _dataUrl, ...metadata } = file;
      return { ...metadata, path };
    })
  };
  const manifest: BackupManifest = {
    appName: APP_NAME,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      timeEntries: data.timeEntries.length,
      flexCorrections: data.flexCorrections.length,
      trips: data.trips.length,
      tripPayments: data.tripPayments.length,
      auditPointCases: data.auditPointCases.length,
      auditPointGoals: data.auditPointGoals.length,
      usoCases: data.usoCases.length,
      usoGoals: data.usoGoals.length,
      todos: 0,
      files: data.files.length,
      savedDestinations: data.savedDestinations.length
    }
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("data.json", JSON.stringify(serializedData, null, 2));
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
  const hydratedData = await hydrateBackupFiles(data, zip);
  return { manifest, data: hydratedData };
}

export async function importBackup(file: File): Promise<BackupPayload> {
  const payload = await inspectBackup(file);
  await replaceAllData(payload.data);
  return payload;
}

function validateManifest(value: unknown): asserts value is BackupManifest {
  if (!isObject(value)) throw new Error("Manifest ist ungültig.");
  if (value.appName !== APP_NAME) throw new Error("Backup gehört nicht zu dieser App.");
  if (typeof value.schemaVersion !== "string" || !/^1\.\d+\.\d+$/.test(value.schemaVersion)) throw new Error("Backup-Schema wird nicht unterstützt.");
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) throw new Error("Export-Zeitpunkt fehlt oder ist ungültig.");
  if (!isObject(value.counts)) throw new Error("Backup-Zählwerte fehlen.");
}

function validateData(value: unknown): asserts value is SerializedBackupData {
  if (!isObject(value)) throw new Error("Daten sind ungültig.");
  if (!Array.isArray(value.timeEntries)) throw new Error("Zeiteinträge fehlen.");
  if (!Array.isArray(value.flexCorrections)) throw new Error("Gleitzeitkorrekturen fehlen.");
  if (!("settings" in value)) throw new Error("Einstellungen fehlen.");
  if (!("vacationSummary" in value)) throw new Error("Urlaubswerte fehlen.");
  if (!Array.isArray(value.trips)) throw new Error("Reisekosten fehlen.");
  if (value.tripPayments !== undefined && !Array.isArray(value.tripPayments)) throw new Error("Reisekosten-Zahlungen sind ungültig.");
  if (value.auditPointCases !== undefined && !Array.isArray(value.auditPointCases)) throw new Error("Punkte-Fälle sind ungültig.");
  if (value.auditPointGoals !== undefined && !Array.isArray(value.auditPointGoals)) throw new Error("Punkte-Jahresziele sind ungültig.");
  if (value.usoCases !== undefined && !Array.isArray(value.usoCases)) throw new Error("USO-Fälle sind ungültig.");
  if (value.usoGoals !== undefined && !Array.isArray(value.usoGoals)) throw new Error("USO-Jahresziele sind ungültig.");
  if (!Array.isArray(value.files)) throw new Error("Nachweise fehlen.");
  if (value.savedDestinations !== undefined && !Array.isArray(value.savedDestinations)) throw new Error("Gespeicherte Zieladressen sind ungültig.");
  if (value.settings !== null) validateSettings(value.settings);
  value.timeEntries.forEach(validateTimeEntry);
  value.flexCorrections.forEach(validateFlexCorrection);
  if (value.vacationSummary !== null) validateVacationSummary(value.vacationSummary);
  value.trips.forEach(validateTrip);
  (value.tripPayments ?? []).forEach(validateTripPayment);
  (value.auditPointCases ?? []).forEach(validateAuditPointCase);
  (value.auditPointGoals ?? []).forEach(validateAuditPointGoal);
  (value.usoCases ?? []).forEach(validateUsoCase);
  (value.usoGoals ?? []).forEach(validateUsoGoal);
  (value.savedDestinations ?? []).forEach(validateSavedDestination);
  value.files.forEach(validateTripFile);
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
  requireOptionalString(value, "startTime", "Reisebeginn ist ungültig.");
  requireOptionalString(value, "endTime", "Reiseende ist ungültig.");
  requireNumber(value, "durationMinutes", "Reisedauer fehlt.");
  requireString(value, "reason", "Reisegrund fehlt.");
  requireString(value, "origin", "Startort fehlt.");
  requireString(value, "destination", "Zieladresse fehlt.");
  requireOptionalString(value, "municipalityCode", "Gemeindekennzahl ist ungültig.");
  requireString(value, "transportType", "Fahrtkostenart fehlt.");
  requireNumber(value, "oneWayKilometers", "Einfache Strecke fehlt.");
  requireNumber(value, "perDiemCents", "Diäten fehlen.");
  requireNumber(value, "otherCostsCents", "Sonstige Kosten fehlen.");
  requireOptionalString(value, "otherCostsDescription", "Beschreibung sonstige Kosten ist ungültig.");
  requireOptionalBoolean(value, "employerReimbursedCosts", "Arbeitgeber-Erstattung ist ungültig.");
  requireOptionalNumber(value, "ticketPriceCents", "Ticketpreis ist ungültig.");
  requireOptionalNumber(value, "taxableTransportSubsidyCents", "Steuerpflichtiger Beförderungszuschuss ist ungültig.");
  requireOptionalNumber(value, "transportSubsidyTaxCents", "Altes Steuerfeld ist ungültig.");
  requireOptionalString(value, "note", "Reise-Notiz ist ungültig.");
  if (typeof value.done !== "boolean") throw new Error("Reise-Erledigt-Status fehlt.");
  requireString(value, "createdAt", "Reise-Erstellt-Zeit fehlt.");
  requireString(value, "updatedAt", "Reise-Aktualisiert-Zeit fehlt.");
}

function validateTripPayment(value: unknown): void {
  if (!isObject(value)) throw new Error("Reisekosten-Zahlung ist ungültig.");
  requireString(value, "id", "Zahlungs-ID fehlt.");
  requireNumber(value, "year", "Zahlungsjahr fehlt.");
  requireString(value, "date", "Zahlungsdatum fehlt.");
  requireNumber(value, "amountCents", "Zahlungsbetrag fehlt.");
  requireString(value, "note", "Zahlungsnotiz fehlt.");
  requireString(value, "createdAt", "Zahlung-Erstellt-Zeit fehlt.");
  requireString(value, "updatedAt", "Zahlung-Aktualisiert-Zeit fehlt.");
}

function validateSavedDestination(value: unknown): void {
  if (!isObject(value)) throw new Error("Gespeicherte Zieladresse ist ungültig.");
  requireString(value, "id", "Zieladress-ID fehlt.");
  requireString(value, "name", "Zieladress-Name fehlt.");
  requireString(value, "address", "Zieladresse fehlt.");
  requireOptionalString(value, "municipalityCode", "Gemeindekennzahl ist ungültig.");
  requireString(value, "createdAt", "Zieladresse-Erstellt-Zeit fehlt.");
  requireString(value, "updatedAt", "Zieladresse-Aktualisiert-Zeit fehlt.");
}

function validateAuditPointCase(value: unknown): void {
  if (!isObject(value)) throw new Error("Punkte-Fall ist ungültig.");
  requireString(value, "id", "Punkte-Fall-ID fehlt.");
  requireString(value, "name", "Punkte-Fall-Name fehlt.");
  requireString(value, "taxNumber", "Punkte-Fall-Steuernummer fehlt.");
  requireString(value, "firm", "Punkte-Fall-Kanzlei fehlt.");
  requireString(value, "category", "Punkte-Fall-Kategorie fehlt.");
  requireNumber(value, "periodStartYear", "Punkte-Fall-Zeitraum von fehlt.");
  requireNumber(value, "periodEndYear", "Punkte-Fall-Zeitraum bis fehlt.");
  requireNumber(value, "additionalResultCents", "Punkte-Fall-Mehrergebnis fehlt.");
  if (typeof value.section99 !== "boolean") throw new Error("Punkte-Fall-§99-Status fehlt.");
  requireString(value, "submissionMonth", "Punkte-Fall-Abgabemonat fehlt.");
  requireString(value, "status", "Punkte-Fall-Status fehlt.");
  requireNullableNumber(value, "submittedPointsTenths", "Punkte-Fall-Abgabepunkte sind ungültig.");
  requireNullableString(value, "submittedAt", "Punkte-Fall-Abgabezeit ist ungültig.");
  requireString(value, "createdAt", "Punkte-Fall-Erstellt-Zeit fehlt.");
  requireString(value, "updatedAt", "Punkte-Fall-Aktualisiert-Zeit fehlt.");
}

function validateAuditPointGoal(value: unknown): void {
  if (!isObject(value)) throw new Error("Punkte-Jahresziel ist ungültig.");
  requireString(value, "id", "Punkte-Jahresziel-ID fehlt.");
  requireNumber(value, "year", "Punkte-Jahresziel-Jahr fehlt.");
  requireNumber(value, "targetPointsTenths", "Punkte-Jahresziel-Wert fehlt.");
  requireString(value, "updatedAt", "Punkte-Jahresziel-Zeitstempel fehlt.");
}

function validateUsoCase(value: unknown): void {
  if (!isObject(value)) throw new Error("USO-Fall ist ungültig.");
  requireString(value, "id", "USO-Fall-ID fehlt.");
  requireString(value, "title", "USO-Fall-Titel fehlt.");
  requireString(value, "submissionMonth", "USO-Fall-Abgabemonat fehlt.");
  requireString(value, "status", "USO-Fall-Status fehlt.");
  requireString(value, "createdAt", "USO-Fall-Erstellt-Zeit fehlt.");
  requireString(value, "updatedAt", "USO-Fall-Aktualisiert-Zeit fehlt.");
}

function validateUsoGoal(value: unknown): void {
  if (!isObject(value)) throw new Error("USO-Jahresziel ist ungültig.");
  requireString(value, "id", "USO-Jahresziel-ID fehlt.");
  requireNumber(value, "year", "USO-Jahresziel-Jahr fehlt.");
  requireNumber(value, "targetCount", "USO-Jahresziel-Wert fehlt.");
  requireString(value, "updatedAt", "USO-Jahresziel-Zeitstempel fehlt.");
}

function validateTripFile(value: unknown): void {
  if (!isObject(value)) throw new Error("Nachweis ist ungültig.");
  requireString(value, "id", "Nachweis-ID fehlt.");
  requireString(value, "tripId", "Nachweis-Reise-ID fehlt.");
  requireString(value, "type", "Nachweistyp fehlt.");
  requireString(value, "fileName", "Nachweis-Dateiname fehlt.");
  requireString(value, "mimeType", "Nachweis-Dateityp fehlt.");
  requireNumber(value, "size", "Nachweis-Dateigröße fehlt.");
  const hasDataUrl = typeof value.dataUrl === "string";
  const hasPath = typeof value.path === "string";
  if (hasDataUrl === hasPath) throw new Error("Nachweis-Dateiinhalt fehlt.");
  if (typeof value.path === "string" && !isValidBackupFilePath(value.path)) throw new Error("Nachweis-Dateipfad ist ungültig.");
  requireString(value, "description", "Nachweis-Beschreibung fehlt.");
  requireString(value, "createdAt", "Nachweis-Erstellt-Zeit fehlt.");
}

async function hydrateBackupFiles(data: SerializedBackupData, zip: JSZip): Promise<BackupData> {
  const files: TripFile[] = await Promise.all(
    data.files.map(async (file) => {
      if (typeof file.path !== "string") return file;
      const path = file.path;
      const zipFile = zip.file(path);
      if (!zipFile) throw new Error(`Nachweis-Datei fehlt im Backup: ${path}`);
      const bytes = await zipFile.async("uint8array");
      const { path: _path, ...metadata } = file;
      return {
        ...metadata,
        dataUrl: bytesToDataUrl(bytes, file.mimeType)
      };
    })
  );
  return { ...data, files, savedDestinations: data.savedDestinations ?? [], tripPayments: data.tripPayments ?? [], auditPointCases: data.auditPointCases ?? [], auditPointGoals: data.auditPointGoals ?? [], usoCases: data.usoCases ?? [], usoGoals: data.usoGoals ?? [] };
}

function backupFilePath(file: TripFile, index: number): string {
  const id = sanitizePathPart(file.id) || `file-${index + 1}`;
  const fileName = sanitizePathPart(file.fileName) || "nachweis";
  return `files/${id}-${fileName}`;
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").replace(/^\.+/, "");
}

function isValidBackupFilePath(path: string): boolean {
  return path.startsWith("files/") && !path.includes("..") && !path.includes("\\") && !path.startsWith("/") && path.length > "files/".length;
}

function dataUrlToBytes(dataUrl: string, expectedMimeType: string): Uint8Array {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Nachweis-Dateiinhalt ist kein gültiger Data-URL.");
  const mimeType = match[1] ?? "";
  if (mimeType && mimeType !== expectedMimeType) throw new Error("Nachweis-Dateityp passt nicht zum Dateiinhalt.");
  if (match[2] !== ";base64") {
    return new TextEncoder().encode(decodeURIComponent(match[3]));
  }
  return base64ToBytes(match[3]);
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function requireString(value: Record<string, unknown>, key: string, message: string): void {
  if (typeof value[key] !== "string") throw new Error(message);
}

function requireOptionalString(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== undefined && typeof value[key] !== "string") throw new Error(message);
}

function requireNullableString(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== null && typeof value[key] !== "string") throw new Error(message);
}

function requireNumber(value: Record<string, unknown>, key: string, message: string): void {
  if (typeof value[key] !== "number" || !Number.isFinite(value[key])) throw new Error(message);
}

function requireOptionalNumber(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== undefined && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) throw new Error(message);
}

function requireOptionalBoolean(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== undefined && typeof value[key] !== "boolean") throw new Error(message);
}

function requireNullableNumber(value: Record<string, unknown>, key: string, message: string): void {
  if (value[key] !== null && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) throw new Error(message);
}
