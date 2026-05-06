import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addFlexCorrection,
  deleteAllLocalData,
  deleteFlexCorrection,
  deleteTimeEntry,
  ensureDefaults,
  getTimeEntryByDate,
  listFlexCorrections,
  listTimeEntries,
  updateSettings,
  upsertTimeEntry
} from "../db/database";
import type { FlexCorrection, Settings, TimeEntry } from "../db/schema";
import { todayKey } from "../lib/dates";

export interface WorkDataState {
  loading: boolean;
  error: string | null;
  settings: Settings | null;
  timeEntries: TimeEntry[];
  flexCorrections: FlexCorrection[];
}

export function useWorkData() {
  const [state, setState] = useState<WorkDataState>({
    loading: true,
    error: null,
    settings: null,
    timeEntries: [],
    flexCorrections: []
  });
  const [clock, setClock] = useState(new Date());

  const refresh = useCallback(async () => {
    try {
      const settings = await ensureDefaults();
      const [timeEntries, flexCorrections] = await Promise.all([listTimeEntries(), listFlexCorrections()]);
      setState({ loading: false, error: null, settings, timeEntries, flexCorrections });
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
    wipeData: async () => {
      await deleteAllLocalData();
      await refresh();
    }
  };
}
