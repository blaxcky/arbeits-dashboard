import { addDays, isValidDateKey, parseDateKey } from "../../lib/dates";
import { timeToMinutes, type DayCalculation, type TimeLikeEntry, type WeekSummary } from "./calculations";

export const TIMELINE_START_MINUTES = 6 * 60;
export const TIMELINE_END_MINUTES = 20 * 60;
export const TIMELINE_HOUR_LABELS = ["06", "08", "10", "12", "14", "16", "18", "20"];

export type WeekLineKind = "empty" | "complete" | "running" | "missing-end";

export interface WeekLine {
  kind: WeekLineKind;
  startMinutes?: number;
  endMinutes?: number;
  plannedEndMinutes?: number;
}

export function isoWeekNumber(dateKey: string): number {
  if (!isValidDateKey(dateKey)) return 0;
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  const weekdayIndex = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - weekdayIndex + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayIndex = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayIndex + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export function formatWeekRange(weekStart: string, dayCount = 5): string {
  if (!isValidDateKey(weekStart)) return "-";
  const weekEnd = addDays(weekStart, dayCount - 1);
  const [startYear, startMonth, startDay] = weekStart.split("-");
  const [endYear, endMonth, endDay] = weekEnd.split("-");
  if (startYear !== endYear) return `${startDay}.${startMonth}.${startYear}–${endDay}.${endMonth}.${endYear}`;
  if (startMonth !== endMonth) return `${startDay}.${startMonth}.–${endDay}.${endMonth}.${endYear}`;
  return `${startDay}.–${endDay}.${endMonth}.${endYear}`;
}

export function formatShortDayLabel(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return "-";
  const weekday = new Intl.DateTimeFormat("de-AT", { weekday: "short" }).format(parseDateKey(dateKey)).replace(".", "");
  const [, month, day] = dateKey.split("-");
  return `${weekday} ${day}.${month}.`;
}

export function timelinePercent(minutes: number): number {
  const span = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;
  const value = ((minutes - TIMELINE_START_MINUTES) / span) * 100;
  return Math.min(Math.max(value, 0), 100);
}

export function weekLine(entry: TimeLikeEntry | undefined, calculation: DayCalculation, date: string, currentDate: string, nowMinutes: number): WeekLine {
  const startMinutes = timeToMinutes(entry?.startTime);
  if (!calculation.hasStart || startMinutes === undefined) return { kind: "empty" };
  const endMinutes = timeToMinutes(entry?.endTime);
  if (endMinutes !== undefined) return { kind: "complete", startMinutes, endMinutes };
  const plannedEndMinutes = timeToMinutes(calculation.targetEndTime);
  if (date === currentDate) return { kind: "running", startMinutes, endMinutes: Math.max(nowMinutes, startMinutes), plannedEndMinutes };
  return { kind: "missing-end", startMinutes, plannedEndMinutes };
}

export function completedWeekDelta(week: WeekSummary): number {
  return week.days.reduce((sum, day) => (day.calculation.hasStart && day.calculation.hasEnd ? sum + day.calculation.deltaMinutes : sum), 0);
}
