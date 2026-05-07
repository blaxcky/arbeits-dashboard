import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupData } from "../db/schema";

const dbMocks = vi.hoisted(() => ({
  readAllData: vi.fn(),
  replaceAllData: vi.fn()
}));

vi.mock("../db/database", () => dbMocks);

const { exportBackup, importBackup, inspectBackup } = await import("./backup");

const screenshotBytes = new Uint8Array([137, 80, 78, 71, 13, 10]);
const screenshotDataUrl = `data:image/png;base64,${btoa(String.fromCharCode(...screenshotBytes))}`;

function backupData(): BackupData {
  return {
    settings: null,
    timeEntries: [],
    flexCorrections: [],
    vacationSummary: null,
    appMeta: null,
    trips: [
      {
        id: "trip-1",
        date: "2026-05-07",
        startTime: "08:00",
        endTime: "10:00",
        durationMinutes: 120,
        reason: "Termin",
        origin: "Wien",
        destination: "Graz",
        transportType: "dienstauto",
        oneWayKilometers: 180,
        perDiemCents: 0,
        otherCostsCents: 0,
        otherCostsDescription: "",
        ticketPriceCents: 0,
        taxableTransportSubsidyCents: 0,
        transportSubsidyTaxCents: 0,
        note: "",
        done: false,
        createdAt: "2026-05-07T08:00:00.000Z",
        updatedAt: "2026-05-07T08:00:00.000Z"
      }
    ],
    todos: [],
    files: [
      {
        id: "file-1",
        tripId: "trip-1",
        type: "dienstauto-nachweis",
        fileName: "screenshot.png",
        mimeType: "image/png",
        size: screenshotBytes.length,
        dataUrl: screenshotDataUrl,
        description: "Screenshot",
        createdAt: "2026-05-07T08:01:00.000Z"
      }
    ]
  };
}

async function zipFileFrom(zip: JSZip, name = "backup.zip"): Promise<File> {
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], name, { type: "application/zip" });
}

async function makeZip(data: unknown, schemaVersion = "1.1.0"): Promise<File> {
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify({
      appName: "arbeits-dashboard",
      schemaVersion,
      exportedAt: "2026-05-07T08:02:00.000Z",
      counts: { timeEntries: 0, flexCorrections: 0, trips: 1, todos: 0, files: 1 }
    })
  );
  zip.file("data.json", JSON.stringify(data));
  return zipFileFrom(zip);
}

describe("backup service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports screenshots as real ZIP files and keeps data.json metadata-only", async () => {
    dbMocks.readAllData.mockResolvedValue(backupData());

    const blob = await exportBackup();
    const zip = await JSZip.loadAsync(blob);
    const manifest = JSON.parse((await zip.file("manifest.json")?.async("string")) ?? "{}") as { counts: { files: number } };
    const data = JSON.parse((await zip.file("data.json")?.async("string")) ?? "{}") as { files: Array<{ dataUrl?: string; path?: string }> };

    expect(manifest.counts.files).toBe(1);
    expect(data.files[0].dataUrl).toBeUndefined();
    expect(data.files[0].path).toBe("files/file-1-screenshot.png");
    expect(await zip.file("files/file-1-screenshot.png")?.async("uint8array")).toEqual(screenshotBytes);
  });

  it("imports new backups and restores TripFile dataUrl for IndexedDB", async () => {
    const data = backupData();
    const { dataUrl: _dataUrl, ...fileMetadata } = data.files[0];
    const zip = new JSZip();
    zip.file(
      "manifest.json",
      JSON.stringify({
        appName: "arbeits-dashboard",
        schemaVersion: "1.1.0",
        exportedAt: "2026-05-07T08:02:00.000Z",
        counts: { timeEntries: 0, flexCorrections: 0, trips: 1, todos: 0, files: 1 }
      })
    );
    zip.file("data.json", JSON.stringify({ ...data, files: [{ ...fileMetadata, path: "files/file-1-screenshot.png" }] }));
    zip.file("files/file-1-screenshot.png", screenshotBytes);

    await importBackup(await zipFileFrom(zip));

    expect(dbMocks.replaceAllData).toHaveBeenCalledWith(data);
  });

  it("keeps old inline dataUrl backups importable", async () => {
    const data = backupData();

    await importBackup(await makeZip(data, "1.0.0"));

    expect(dbMocks.replaceAllData).toHaveBeenCalledWith(data);
  });

  it("rejects new backups when the referenced evidence file is missing", async () => {
    const data = backupData();
    const { dataUrl: _dataUrl, ...fileMetadata } = data.files[0];
    const file = await makeZip({ ...data, files: [{ ...fileMetadata, path: "files/file-1-screenshot.png" }] });

    await expect(inspectBackup(file)).rejects.toThrow("Nachweis-Datei fehlt im Backup: files/file-1-screenshot.png");
  });
});
