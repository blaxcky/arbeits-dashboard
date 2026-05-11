export const APP_NAME = "arbeits-dashboard";
export const APP_VERSION = "0.1.0";
export const BACKUP_SCHEMA_VERSION = "1.4.0";
export const DB_SCHEMA_VERSION = 6;

export interface Settings {
  id: "main";
  dailyTargetMinutes: number;
  weeklyTargetMinutes: number;
  flexLimitMinutes: number;
  flexStartMinutes: number | null;
  vacationEntitlementMinutes: number | null;
  vacationUsedMinutes: number;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  breakMinutes: number;
  targetMinutes: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlexCorrection {
  id: string;
  date: string;
  oldValueMinutes: number;
  newValueMinutes: number;
  diffMinutes: number;
  note: string;
  createdAt: string;
}

export interface VacationSummary {
  id: "current";
  year: number;
  entitlementMinutes: number | null;
  usedMinutes: number;
  updatedAt: string;
}

export interface AppMeta {
  id: "main";
  dbSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type TripTransportType = "kilometergeld" | "befoerderungszuschuss" | "oeffi-zuschuss" | "dienstauto" | "sonstige";

export interface Trip {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  reason: string;
  origin: string;
  destination: string;
  municipalityCode?: string;
  transportType: TripTransportType;
  oneWayKilometers: number;
  perDiemCents: number;
  otherCostsCents: number;
  otherCostsDescription: string;
  employerReimbursedCosts: boolean;
  ticketPriceCents?: number;
  taxableTransportSubsidyCents: number;
  transportSubsidyTaxCents?: number;
  note: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedDestination {
  id: string;
  name: string;
  address: string;
  municipalityCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type TripFileType = "dienstauto-nachweis" | "oebb-verbindungskosten" | "sonstiger-beleg";

export interface TripFile {
  id: string;
  tripId: string;
  type: TripFileType;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  description: string;
  createdAt: string;
}

export interface TravelExpensePayment {
  id: string;
  year: number;
  date: string;
  amountCents: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupManifest {
  appName: typeof APP_NAME;
  schemaVersion: string;
  exportedAt: string;
  counts: Record<string, number>;
}

export interface BackupData {
  settings: Settings | null;
  timeEntries: TimeEntry[];
  flexCorrections: FlexCorrection[];
  vacationSummary: VacationSummary | null;
  appMeta: AppMeta | null;
  trips: Trip[];
  tripPayments: TravelExpensePayment[];
  savedDestinations: SavedDestination[];
  todos: unknown[];
  files: TripFile[];
}

export interface BackupPayload {
  manifest: BackupManifest;
  data: BackupData;
}

export function defaultSettings(now = new Date()): Settings {
  return {
    id: "main",
    dailyTargetMinutes: 480,
    weeklyTargetMinutes: 2400,
    flexLimitMinutes: 6000,
    flexStartMinutes: null,
    vacationEntitlementMinutes: null,
    vacationUsedMinutes: 0,
    updatedAt: now.toISOString()
  };
}
