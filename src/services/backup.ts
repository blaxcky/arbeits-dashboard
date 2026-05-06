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
      trips: 0,
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
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("manifest.json");
  const dataFile = zip.file("data.json");
  if (!manifestFile || !dataFile) {
    throw new Error("Backup muss manifest.json und data.json enthalten.");
  }
  const manifest = JSON.parse(await manifestFile.async("string")) as unknown;
  const data = JSON.parse(await dataFile.async("string")) as unknown;
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
  if (typeof value.exportedAt !== "string") throw new Error("Export-Zeitpunkt fehlt.");
}

function validateData(value: unknown): asserts value is BackupData {
  if (!isObject(value)) throw new Error("Daten sind ungültig.");
  if (!Array.isArray(value.timeEntries)) throw new Error("Zeiteinträge fehlen.");
  if (!Array.isArray(value.flexCorrections)) throw new Error("Gleitzeitkorrekturen fehlen.");
  if (!("settings" in value)) throw new Error("Einstellungen fehlen.");
  if (!("vacationSummary" in value)) throw new Error("Urlaubswerte fehlen.");
}
