import Dexie, { type Table } from "dexie";
import { currentYear } from "../lib/dates";
import {
  DB_SCHEMA_VERSION,
  type BackupData,
  type AppMeta,
  type FlexCorrection,
  type SavedDestination,
  type Settings,
  type TimeEntry,
  type Trip,
  type TripFile,
  type VacationSummary,
  defaultSettings
} from "./schema";

class WorkDashboardDb extends Dexie {
  settings!: Table<Settings, string>;
  timeEntries!: Table<TimeEntry, string>;
  flexCorrections!: Table<FlexCorrection, string>;
  vacationSummary!: Table<VacationSummary, string>;
  appMeta!: Table<AppMeta, string>;
  trips!: Table<Trip, string>;
  files!: Table<TripFile, string>;
  savedDestinations!: Table<SavedDestination, string>;

  constructor() {
    super("arbeits-dashboard");
    this.version(1).stores({
      settings: "id",
      timeEntries: "id, &date",
      flexCorrections: "id, date, createdAt",
      vacationSummary: "id, year",
      appMeta: "id"
    });
    this.version(2).stores({
      settings: "id",
      timeEntries: "id, &date",
      flexCorrections: "id, date, createdAt",
      vacationSummary: "id, year",
      appMeta: "id",
      trips: "id, date, done, transportType"
    });
    this.version(3).stores({
      settings: "id",
      timeEntries: "id, &date",
      flexCorrections: "id, date, createdAt",
      vacationSummary: "id, year",
      appMeta: "id",
      trips: "id, date, done, transportType",
      files: "id, tripId, type, createdAt"
    });
    this.version(4).stores({
      settings: "id",
      timeEntries: "id, &date",
      flexCorrections: "id, date, createdAt",
      vacationSummary: "id, year",
      appMeta: "id",
      trips: "id, date, done, transportType",
      files: "id, tripId, type, createdAt",
      savedDestinations: "id, name, updatedAt"
    }).upgrade(async (tx) => {
      const trips = tx.table<Trip, string>("trips");
      await trips.toCollection().modify((trip) => {
        trip.durationMinutes = trip.startTime && trip.endTime ? trip.durationMinutes : 0;
        trip.perDiemCents = trip.startTime && trip.endTime ? trip.perDiemCents : 0;
        trip.transportSubsidyTaxCents = 0;
      });
    });
    this.version(5).stores({
      settings: "id",
      timeEntries: "id, &date",
      flexCorrections: "id, date, createdAt",
      vacationSummary: "id, year",
      appMeta: "id",
      trips: "id, date, done, transportType",
      files: "id, tripId, type, createdAt",
      savedDestinations: "id, name, updatedAt"
    }).upgrade(async (tx) => {
      const trips = tx.table<Trip, string>("trips");
      await trips.toCollection().modify((trip) => {
        trip.employerReimbursedCosts = trip.employerReimbursedCosts ?? true;
      });
    });
  }
}

export const db = new WorkDashboardDb();

export async function ensureDefaults(): Promise<Settings> {
  const now = new Date().toISOString();
  let settings = await db.settings.get("main");
  if (!settings) {
    settings = defaultSettings();
    await db.settings.put(settings);
  }

  const meta = await db.appMeta.get("main");
  if (!meta) {
    await db.appMeta.put({ id: "main", dbSchemaVersion: DB_SCHEMA_VERSION, createdAt: now, updatedAt: now });
  }

  const vacation = await db.vacationSummary.get("current");
  if (!vacation) {
    await db.vacationSummary.put({
      id: "current",
      year: currentYear(),
      entitlementMinutes: settings.vacationEntitlementMinutes,
      usedMinutes: settings.vacationUsedMinutes,
      updatedAt: now
    });
  }

  return settings;
}

export async function getSettings(): Promise<Settings> {
  return ensureDefaults();
}

export async function updateSettings(patch: Partial<Omit<Settings, "id" | "updatedAt">>): Promise<Settings> {
  const current = await ensureDefaults();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await db.settings.put(next);
  await db.vacationSummary.put({
    id: "current",
    year: currentYear(),
    entitlementMinutes: next.vacationEntitlementMinutes,
    usedMinutes: next.vacationUsedMinutes,
    updatedAt: next.updatedAt
  });
  return next;
}

export async function getTimeEntryByDate(date: string): Promise<TimeEntry | undefined> {
  return db.timeEntries.where("date").equals(date).first();
}

export async function upsertTimeEntry(input: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">): Promise<TimeEntry> {
  const existing = await getTimeEntryByDate(input.date);
  const now = new Date().toISOString();
  const entry: TimeEntry = {
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.timeEntries.put(entry);
  return entry;
}

export async function deleteTimeEntry(date: string): Promise<void> {
  const existing = await getTimeEntryByDate(date);
  if (existing) await db.timeEntries.delete(existing.id);
}

export async function listTimeEntries(): Promise<TimeEntry[]> {
  return db.timeEntries.orderBy("date").toArray();
}

export async function listFlexCorrections(): Promise<FlexCorrection[]> {
  return db.flexCorrections.orderBy("date").toArray();
}

export async function addFlexCorrection(input: Omit<FlexCorrection, "id" | "createdAt" | "diffMinutes">): Promise<FlexCorrection> {
  const correction = {
    ...input,
    id: crypto.randomUUID(),
    diffMinutes: input.newValueMinutes - input.oldValueMinutes,
    createdAt: new Date().toISOString()
  };
  await db.flexCorrections.put(correction);
  return correction;
}

export async function deleteFlexCorrection(id: string): Promise<void> {
  await db.flexCorrections.delete(id);
}

export async function listTrips(): Promise<Trip[]> {
  return db.trips.orderBy("date").reverse().toArray();
}

export async function upsertTrip(input: Omit<Trip, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Trip> {
  const existing = input.id ? await db.trips.get(input.id) : undefined;
  const now = new Date().toISOString();
  const trip: Trip = {
    ...input,
    employerReimbursedCosts: input.employerReimbursedCosts ?? true,
    ticketPriceCents: input.ticketPriceCents ?? 0,
    transportSubsidyTaxCents: 0,
    id: input.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.trips.put(trip);
  return trip;
}

export async function listSavedDestinations(): Promise<SavedDestination[]> {
  return db.savedDestinations.orderBy("updatedAt").reverse().toArray();
}

export async function upsertSavedDestination(input: Omit<SavedDestination, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<SavedDestination> {
  const existing = input.id ? await db.savedDestinations.get(input.id) : undefined;
  const now = new Date().toISOString();
  const destination: SavedDestination = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    address: input.address.trim(),
    municipalityCode: input.municipalityCode?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.savedDestinations.put(destination);
  return destination;
}

export async function deleteSavedDestination(id: string): Promise<void> {
  await db.savedDestinations.delete(id);
}

export async function deleteTrip(id: string): Promise<void> {
  await db.transaction("rw", [db.trips, db.files], async () => {
    await db.trips.delete(id);
    await db.files.where("tripId").equals(id).delete();
  });
}

export async function listTripFiles(): Promise<TripFile[]> {
  return db.files.orderBy("createdAt").reverse().toArray();
}

export async function addTripFile(input: Omit<TripFile, "id" | "createdAt">): Promise<TripFile> {
  const file: TripFile = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  await db.files.put(file);
  return file;
}

export async function deleteTripFile(id: string): Promise<void> {
  await db.files.delete(id);
}

export async function readAllData(): Promise<BackupData> {
  await ensureDefaults();
  return {
    settings: (await db.settings.get("main")) ?? null,
    timeEntries: await db.timeEntries.toArray(),
    flexCorrections: await db.flexCorrections.toArray(),
    vacationSummary: (await db.vacationSummary.get("current")) ?? null,
    appMeta: (await db.appMeta.get("main")) ?? null,
    trips: await db.trips.toArray(),
    savedDestinations: await db.savedDestinations.toArray(),
    todos: [],
    files: await db.files.toArray()
  };
}

export async function replaceAllData(data: BackupData): Promise<void> {
  await db.transaction("rw", [db.settings, db.timeEntries, db.flexCorrections, db.vacationSummary, db.appMeta, db.trips, db.files, db.savedDestinations], async () => {
    await Promise.all([db.settings.clear(), db.timeEntries.clear(), db.flexCorrections.clear(), db.vacationSummary.clear(), db.appMeta.clear(), db.trips.clear(), db.files.clear(), db.savedDestinations.clear()]);
    if (data.settings) await db.settings.put(data.settings);
    await db.timeEntries.bulkPut(data.timeEntries);
    await db.flexCorrections.bulkPut(data.flexCorrections);
    if (data.vacationSummary) await db.vacationSummary.put(data.vacationSummary);
    if (data.appMeta) await db.appMeta.put(data.appMeta);
    await db.trips.bulkPut(data.trips.map(normalizeTrip));
    await db.files.bulkPut(data.files);
    await db.savedDestinations.bulkPut(data.savedDestinations ?? []);
  });
  await ensureDefaults();
}

export async function deleteAllLocalData(): Promise<void> {
  await db.transaction("rw", [db.settings, db.timeEntries, db.flexCorrections, db.vacationSummary, db.appMeta, db.trips, db.files, db.savedDestinations], async () => {
    await Promise.all([db.settings.clear(), db.timeEntries.clear(), db.flexCorrections.clear(), db.vacationSummary.clear(), db.appMeta.clear(), db.trips.clear(), db.files.clear(), db.savedDestinations.clear()]);
  });
}

function normalizeTrip(trip: Trip): Trip {
  return {
    ...trip,
    employerReimbursedCosts: trip.employerReimbursedCosts ?? true,
    durationMinutes: trip.startTime && trip.endTime ? trip.durationMinutes : 0,
    perDiemCents: trip.startTime && trip.endTime ? trip.perDiemCents : 0,
    taxableTransportSubsidyCents: trip.taxableTransportSubsidyCents ?? 0,
    transportSubsidyTaxCents: 0,
    ticketPriceCents: trip.ticketPriceCents ?? 0,
    note: trip.note ?? ""
  };
}
