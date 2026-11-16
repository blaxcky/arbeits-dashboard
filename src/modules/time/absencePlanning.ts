import type { PlannedAbsence, PlannedAbsenceType } from "../../db/schema";
import { addDays, isValidDateKey, parseDateKey, toDateKey } from "../../lib/dates";

export const DEFAULT_REQUEST_LEAD_DAYS = 14;
export const DEFAULT_REQUEST_URGENT_DAYS = 7;
export const MINIMUM_FLEX_BALANCE_MINUTES = -600;

export const ABSENCE_TYPE_LABELS: Record<PlannedAbsenceType, string> = {
  vacation: "Urlaub",
  flex: "Gleittag"
};

export const ABSENCE_TYPE_LETTERS: Record<PlannedAbsenceType, string> = {
  vacation: "U",
  flex: "G"
};

const holidayCache = new Map<number, Map<string, string>>();

export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDateKey(new Date(year, month - 1, day));
}

export function austrianPublicHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const entries: Array<[string, string]> = [
    [`${year}-01-01`, "Neujahr"],
    [`${year}-01-06`, "Heilige Drei Könige"],
    [addDays(easter, 1), "Ostermontag"],
    [`${year}-05-01`, "Staatsfeiertag"],
    [addDays(easter, 39), "Christi Himmelfahrt"],
    [addDays(easter, 50), "Pfingstmontag"],
    [addDays(easter, 60), "Fronleichnam"],
    [`${year}-08-15`, "Mariä Himmelfahrt"],
    [`${year}-10-26`, "Nationalfeiertag"],
    [`${year}-11-01`, "Allerheiligen"],
    [`${year}-12-08`, "Mariä Empfängnis"],
    [`${year}-12-25`, "Christtag"],
    [`${year}-12-26`, "Stefanitag"]
  ];
  const holidays = new Map(entries);
  holidayCache.set(year, holidays);
  return holidays;
}

export function holidayName(date: string): string | undefined {
  if (!isValidDateKey(date)) return undefined;
  return austrianPublicHolidays(Number(date.slice(0, 4))).get(date);
}

export function isWeekend(date: string): boolean {
  const day = parseDateKey(date).getDay();
  return day === 0 || day === 6;
}

export function isWorkday(date: string): boolean {
  return isValidDateKey(date) && !isWeekend(date) && !holidayName(date);
}

export function nextWorkday(date: string): string {
  let next = addDays(date, 1);
  while (!isWorkday(next)) next = addDays(next, 1);
  return next;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86400000);
}

export interface PlanningMonth {
  key: string;
  label: string;
  leadingBlanks: number;
  days: string[];
}

export const VISIBLE_PLANNING_MONTHS = 2;

export function defaultPlanningMonthStart(year: number, today: string): number {
  const todayYear = Number(today.slice(0, 4));
  if (year !== todayYear) return 0;
  return Math.min(Number(today.slice(5, 7)) - 1, 12 - VISIBLE_PLANNING_MONTHS);
}

export function planningMonths(year: number): PlanningMonth[] {
  const formatter = new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" });
  const months: PlanningMonth[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const first = new Date(year, month - 1, 1);
    const count = new Date(year, month, 0).getDate();
    months.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: formatter.format(first),
      leadingBlanks: (first.getDay() + 6) % 7,
      days: Array.from({ length: count }, (_, index) => toDateKey(new Date(year, month - 1, index + 1)))
    });
  }
  return months;
}

export type AbsencePlanAction = "create" | "remove" | "change-type" | "locked";

export function absencePlanAction(existing: PlannedAbsence | undefined, type: PlannedAbsenceType): AbsencePlanAction {
  if (!existing) return "create";
  if (existing.status === "booked") return "locked";
  return existing.type === type ? "remove" : "change-type";
}

export interface AbsenceRequestGroup {
  type: PlannedAbsenceType;
  status: "planned" | "requested";
  start: string;
  end: string;
  dates: string[];
  ids: string[];
}

export function groupOpenAbsences(absences: PlannedAbsence[], fromDate?: string): AbsenceRequestGroup[] {
  const open = absences
    .filter((absence) => absence.status !== "booked" && (!fromDate || absence.date >= fromDate))
    .sort((left, right) => left.date.localeCompare(right.date));
  const groups: AbsenceRequestGroup[] = [];
  for (const absence of open) {
    const status = absence.status === "requested" ? "requested" : "planned";
    const last = groups[groups.length - 1];
    if (last && last.type === absence.type && last.status === status && nextWorkday(last.end) === absence.date) {
      last.end = absence.date;
      last.dates.push(absence.date);
      last.ids.push(absence.id);
    } else {
      groups.push({ type: absence.type, status, start: absence.date, end: absence.date, dates: [absence.date], ids: [absence.id] });
    }
  }
  return groups;
}

export type AbsenceRequestState = "later" | "open" | "urgent" | "requested" | "missed";

export interface AbsenceRequestInfo {
  state: AbsenceRequestState;
  opensOn: string;
  daysUntil: number;
}

export function absenceRequestInfo(group: Pick<AbsenceRequestGroup, "start" | "status">, today: string, leadDays = DEFAULT_REQUEST_LEAD_DAYS, urgentDays = DEFAULT_REQUEST_URGENT_DAYS): AbsenceRequestInfo {
  const daysUntil = daysBetween(today, group.start);
  const opensOn = addDays(group.start, -Math.max(leadDays, 0));
  if (group.status === "requested") return { state: "requested", opensOn, daysUntil };
  if (daysUntil < 0) return { state: "missed", opensOn, daysUntil };
  if (daysUntil <= urgentDays) return { state: "urgent", opensOn, daysUntil };
  if (today >= opensOn) return { state: "open", opensOn, daysUntil };
  return { state: "later", opensOn, daysUntil };
}

export interface DueAbsenceRequest {
  group: AbsenceRequestGroup;
  info: AbsenceRequestInfo;
}

export function dueAbsenceRequests(absences: PlannedAbsence[], today: string, leadDays = DEFAULT_REQUEST_LEAD_DAYS, urgentDays = DEFAULT_REQUEST_URGENT_DAYS): DueAbsenceRequest[] {
  return groupOpenAbsences(absences, today)
    .map((group) => ({ group, info: absenceRequestInfo(group, today, leadDays, urgentDays) }))
    .filter(({ info }) => info.state === "open" || info.state === "urgent");
}

export function missedAbsences(absences: PlannedAbsence[], today: string): PlannedAbsence[] {
  return absences
    .filter((absence) => absence.status === "planned" && absence.date < today)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function absencesDueForBooking(absences: PlannedAbsence[], today: string): PlannedAbsence[] {
  return absences
    .filter((absence) => absence.status === "requested" && absence.date <= today)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export type AbsencePlanStatus = "done" | "almost" | "open" | "overplanned" | "flex-too-low";

export interface AbsencePlanSummary {
  vacationRequestedDays: number;
  vacationPlannedDays: number;
  flexRequestedDays: number;
  flexPlannedDays: number;
  vacationRemainingMinutes: number;
  vacationAfterMinutes: number;
  flexBalanceMinutes: number;
  flexAfterMinutes: number;
  flexOverLimitMinutes: number;
  flexOverLimitAfterMinutes: number;
  neededMinutes: number;
  scheduledMinutes: number;
  coveredRequestedMinutes: number;
  coveredPlannedMinutes: number;
  openMinutes: number;
  status: AbsencePlanStatus;
}

export function summarizeAbsencePlan(input: {
  absences: PlannedAbsence[];
  today: string;
  vacationRemainingMinutes: number;
  flexBalanceMinutes: number;
  flexLimitMinutes: number;
  dailyTargetMinutes: number;
}): AbsencePlanSummary {
  const yearEnd = `${input.today.slice(0, 4)}-12-31`;
  const counted = input.absences.filter((absence) => absence.status !== "booked" && absence.date >= input.today && absence.date <= yearEnd);
  const count = (type: PlannedAbsenceType, status: "planned" | "requested") => counted.filter((absence) => absence.type === type && absence.status === status).length;
  const vacationRequestedDays = count("vacation", "requested");
  const vacationPlannedDays = count("vacation", "planned");
  const flexRequestedDays = count("flex", "requested");
  const flexPlannedDays = count("flex", "planned");
  const day = Math.max(input.dailyTargetMinutes, 0);
  const vacationRemainingMinutes = Math.max(input.vacationRemainingMinutes, 0);
  const vacationAfterMinutes = vacationRemainingMinutes - (vacationRequestedDays + vacationPlannedDays) * day;
  const flexAfterMinutes = input.flexBalanceMinutes - (flexRequestedDays + flexPlannedDays) * day;
  const flexOverLimitMinutes = Math.max(input.flexBalanceMinutes - input.flexLimitMinutes, 0);
  const flexOverLimitAfterMinutes = Math.max(flexAfterMinutes - input.flexLimitMinutes, 0);
  const neededMinutes = vacationRemainingMinutes + flexOverLimitMinutes;

  const vacationRequestedCovered = Math.min(vacationRequestedDays * day, vacationRemainingMinutes);
  const vacationPlannedCovered = Math.min(vacationPlannedDays * day, vacationRemainingMinutes - vacationRequestedCovered);
  const flexRequestedCovered = Math.min(flexRequestedDays * day, flexOverLimitMinutes);
  const flexPlannedCovered = Math.min(flexPlannedDays * day, flexOverLimitMinutes - flexRequestedCovered);
  const openMinutes = Math.max(vacationAfterMinutes, 0) + flexOverLimitAfterMinutes;

  let status: AbsencePlanStatus;
  if (vacationAfterMinutes < 0) status = "overplanned";
  else if (flexAfterMinutes < MINIMUM_FLEX_BALANCE_MINUTES) status = "flex-too-low";
  else if (openMinutes === 0) status = "done";
  else if (vacationAfterMinutes === 0 && flexOverLimitAfterMinutes < day) status = "almost";
  else status = "open";

  return {
    vacationRequestedDays,
    vacationPlannedDays,
    flexRequestedDays,
    flexPlannedDays,
    vacationRemainingMinutes,
    vacationAfterMinutes,
    flexBalanceMinutes: input.flexBalanceMinutes,
    flexAfterMinutes,
    flexOverLimitMinutes,
    flexOverLimitAfterMinutes,
    neededMinutes,
    scheduledMinutes: counted.length * day,
    coveredRequestedMinutes: vacationRequestedCovered + flexRequestedCovered,
    coveredPlannedMinutes: vacationPlannedCovered + flexPlannedCovered,
    openMinutes,
    status
  };
}

export interface AbsenceOpenDays {
  vacationDays: number;
  vacationRestMinutes: number;
  flexDays: number;
}

// Calendar clicks plan whole days: vacation rounds down (one more day would overplan),
// flex rounds up (only whole flex days bring the balance back under the limit).
export function absenceOpenDays(summary: AbsencePlanSummary, dailyTargetMinutes: number): AbsenceOpenDays {
  if (dailyTargetMinutes <= 0) return { vacationDays: 0, vacationRestMinutes: 0, flexDays: 0 };
  const vacationOpenMinutes = Math.max(summary.vacationAfterMinutes, 0);
  const vacationDays = Math.floor(vacationOpenMinutes / dailyTargetMinutes);
  return {
    vacationDays,
    vacationRestMinutes: vacationOpenMinutes - vacationDays * dailyTargetMinutes,
    flexDays: Math.ceil(summary.flexOverLimitAfterMinutes / dailyTargetMinutes)
  };
}
