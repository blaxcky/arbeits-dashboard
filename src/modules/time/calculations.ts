import { isoWeekDays } from "../../lib/dates";

export interface TimeLikeEntry {
  date: string;
  startTime?: string;
  endTime?: string;
  breakMinutes: number;
  targetMinutes: number;
}

export interface DayCalculation {
  hasStart: boolean;
  hasEnd: boolean;
  effectiveEndTime?: string;
  netMinutes: number;
  deltaMinutes: number;
  targetEndTime?: string;
  status: "missing-start" | "running" | "plus" | "minus" | "balanced";
  overtimeMinutes: number;
  undertimeMinutes: number;
}

export interface WeekSummary {
  weekStart: string;
  days: Array<{ date: string; entry?: TimeLikeEntry; calculation: DayCalculation }>;
  workedMinutes: number;
  plusMinutes: number;
  minusMinutes: number;
  deltaMinutes: number;
}

export function timeToMinutes(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function calculateDay(entry: TimeLikeEntry | undefined, now = new Date()): DayCalculation {
  if (!entry || !entry.startTime) {
    return {
      hasStart: false,
      hasEnd: false,
      netMinutes: 0,
      deltaMinutes: 0,
      status: "missing-start",
      overtimeMinutes: 0,
      undertimeMinutes: 0
    };
  }

  const start = timeToMinutes(entry.startTime);
  if (start === undefined) {
    return {
      hasStart: false,
      hasEnd: Boolean(entry.endTime),
      netMinutes: 0,
      deltaMinutes: 0,
      status: "missing-start",
      overtimeMinutes: 0,
      undertimeMinutes: 0
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const explicitEnd = timeToMinutes(entry.endTime);
  const end = explicitEnd ?? nowMinutes;
  const duration = Math.max(0, end - start);
  const extraBreakMinutes = Math.max(entry.breakMinutes - 30, 0);
  const netMinutes = Math.max(0, duration - extraBreakMinutes);
  const deltaMinutes = netMinutes - entry.targetMinutes;
  const targetEndMinutes = start + entry.targetMinutes + extraBreakMinutes;

  return {
    hasStart: true,
    hasEnd: explicitEnd !== undefined,
    effectiveEndTime: minutesToTime(end),
    netMinutes,
    deltaMinutes,
    targetEndTime: minutesToTime(targetEndMinutes),
    status: explicitEnd === undefined ? "running" : deltaMinutes > 0 ? "plus" : deltaMinutes < 0 ? "minus" : "balanced",
    overtimeMinutes: Math.max(deltaMinutes, 0),
    undertimeMinutes: Math.max(-deltaMinutes, 0)
  };
}

export function calculateWeek(entries: TimeLikeEntry[], selectedDate: string, now = new Date()): WeekSummary {
  const weekDays = isoWeekDays(selectedDate).slice(0, 5);
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  const days = weekDays.map((date) => {
    const entry = byDate.get(date);
    return { date, entry, calculation: calculateDay(entry, now) };
  });
  const workedMinutes = days.reduce((sum, day) => sum + day.calculation.netMinutes, 0);
  const plusMinutes = days.reduce((sum, day) => sum + day.calculation.overtimeMinutes, 0);
  const minusMinutes = days.reduce((sum, day) => sum + day.calculation.undertimeMinutes, 0);
  return {
    weekStart: weekDays[0],
    days,
    workedMinutes,
    plusMinutes,
    minusMinutes,
    deltaMinutes: plusMinutes - minusMinutes
  };
}

export function calculateFlexBalance(startMinutes: number, entries: TimeLikeEntry[], corrections: Array<{ diffMinutes: number }>): number {
  const dayDeltas = entries.reduce((sum, entry) => sum + calculateDay(entry).deltaMinutes, 0);
  const correctionDeltas = corrections.reduce((sum, correction) => sum + correction.diffMinutes, 0);
  return startMinutes + dayDeltas + correctionDeltas;
}

export function entriesForFlexBalance(entries: TimeLikeEntry[], currentDate: string): TimeLikeEntry[] {
  return entries.filter((entry) => entry.date !== currentDate || !entry.startTime || Boolean(entry.endTime));
}

export function calculateVacation(entitlementMinutes: number | null, usedMinutes: number, minutesPerDay = 480) {
  const entitlement = entitlementMinutes ?? 0;
  const remainingMinutes = Math.max(entitlement - usedMinutes, 0);
  return {
    entitlementMinutes: entitlement,
    usedMinutes,
    remainingMinutes,
    remainingDays: remainingMinutes / minutesPerDay
  };
}

export function calculateRequiredYearConsumption(vacationRemainingMinutes: number, flexBalanceMinutes: number, flexLimitMinutes: number): number {
  return vacationRemainingMinutes + Math.max(flexBalanceMinutes - flexLimitMinutes, 0);
}
