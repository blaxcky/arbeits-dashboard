import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addFlexCorrection,
  addTripFile,
  deleteAuditPointCase,
  deleteUsoCase,
  deleteSavedDestination,
  deleteAllLocalData,
  deleteFlexCorrection,
  deleteTimeEntry,
  deleteTripFile,
  deleteTripPayment,
  deleteTrip,
  ensureDefaults,
  getTimeEntryByDate,
  listFlexCorrections,
  listAuditPointCases,
  listAuditPointGoals,
  listUsoCases,
  listUsoGoals,
  listTripFiles,
  listSavedDestinations,
  listTimeEntries,
  listTripPayments,
  listTrips,
  updateSettings,
  upsertAuditPointCase,
  upsertAuditPointGoal,
  upsertUsoCase,
  upsertUsoGoal,
  upsertTimeEntry,
  upsertTrip,
  upsertTripPayment,
  upsertSavedDestination
} from "../db/database";
import type { AuditPointCase, AuditPointGoal, FlexCorrection, SavedDestination, Settings, TimeEntry, Trip, TripFile, UsoCase, UsoGoal, TravelExpensePayment } from "../db/schema";
import { todayKey } from "../lib/dates";

export interface WorkDataState {
  loading: boolean;
  error: string | null;
  settings: Settings | null;
  timeEntries: TimeEntry[];
  flexCorrections: FlexCorrection[];
  trips: Trip[];
  tripPayments: TravelExpensePayment[];
  auditPointCases: AuditPointCase[];
  auditPointGoals: AuditPointGoal[];
  usoCases: UsoCase[];
  usoGoals: UsoGoal[];
  files: TripFile[];
  savedDestinations: SavedDestination[];
}

export function useWorkData() {
  const [state, setState] = useState<WorkDataState>({
    loading: true,
    error: null,
    settings: null,
    timeEntries: [],
    flexCorrections: [],
    trips: [],
    tripPayments: [],
    auditPointCases: [],
    auditPointGoals: [],
    usoCases: [],
    usoGoals: [],
    files: [],
    savedDestinations: []
  });
  const [clock, setClock] = useState(new Date());

  const refresh = useCallback(async () => {
    try {
      const settings = await ensureDefaults();
      const [timeEntries, flexCorrections, trips, tripPayments, auditPointCases, auditPointGoals, usoCases, usoGoals, files, savedDestinations] = await Promise.all([listTimeEntries(), listFlexCorrections(), listTrips(), listTripPayments(), listAuditPointCases(), listAuditPointGoals(), listUsoCases(), listUsoGoals(), listTripFiles(), listSavedDestinations()]);
      setState({ loading: false, error: null, settings, timeEntries, flexCorrections, trips, tripPayments, auditPointCases, auditPointGoals, usoCases, usoGoals, files, savedDestinations });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Daten konnten nicht geladen werden." }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const entriesByDate = useMemo(() => new Map(state.timeEntries.map((entry) => [entry.date, entry])), [state.timeEntries]);

  return {
    ...state,
    clock,
    entriesByDate,
    refresh,
    getTodayEntry: () => entriesByDate.get(todayKey()),
    getEntryByDate: getTimeEntryByDate,
    saveTimeEntry: async (input: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">) => {
      await upsertTimeEntry(input);
      await refresh();
    },
    removeTimeEntry: async (date: string) => {
      await deleteTimeEntry(date);
      await refresh();
    },
    saveSettings: async (patch: Partial<Omit<Settings, "id" | "updatedAt">>) => {
      await updateSettings(patch);
      await refresh();
    },
    addCorrection: async (input: Omit<FlexCorrection, "id" | "createdAt" | "diffMinutes">) => {
      await addFlexCorrection(input);
      await refresh();
    },
    removeCorrection: async (id: string) => {
      await deleteFlexCorrection(id);
      await refresh();
    },
    saveTrip: async (input: Omit<Trip, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
      const trip = await upsertTrip(input);
      await refresh();
      return trip;
    },
    removeTrip: async (id: string) => {
      await deleteTrip(id);
      await refresh();
    },
    saveTripPayment: async (input: Omit<TravelExpensePayment, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
      await upsertTripPayment(input);
      await refresh();
    },
    removeTripPayment: async (id: string) => {
      await deleteTripPayment(id);
      await refresh();
    },
    saveAuditPointCase: async (input: Omit<AuditPointCase, "id" | "createdAt" | "updatedAt" | "submittedPointsTenths" | "submittedAt"> & { id?: string; submittedPointsTenths?: number | null; submittedAt?: string | null }) => {
      await upsertAuditPointCase(input);
      await refresh();
    },
    removeAuditPointCase: async (id: string) => {
      await deleteAuditPointCase(id);
      await refresh();
    },
    saveAuditPointGoal: async (input: Omit<AuditPointGoal, "id" | "updatedAt"> & { id?: string }) => {
      await upsertAuditPointGoal(input);
      await refresh();
    },
    saveUsoCase: async (input: Omit<UsoCase, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
      await upsertUsoCase(input);
      await refresh();
    },
    removeUsoCase: async (id: string) => {
      await deleteUsoCase(id);
      await refresh();
    },
    saveUsoGoal: async (input: Omit<UsoGoal, "id" | "updatedAt"> & { id?: string }) => {
      await upsertUsoGoal(input);
      await refresh();
    },
    saveTripFile: async (input: Omit<TripFile, "id" | "createdAt">) => {
      await addTripFile(input);
      await refresh();
    },
    removeTripFile: async (id: string) => {
      await deleteTripFile(id);
      await refresh();
    },
    saveDestination: async (input: Omit<SavedDestination, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
      await upsertSavedDestination(input);
      await refresh();
    },
    removeDestination: async (id: string) => {
      await deleteSavedDestination(id);
      await refresh();
    },
    wipeData: async () => {
      await deleteAllLocalData();
      await refresh();
    }
  };
}
