export const VIENNA_TIME_ZONE = "Europe/Vienna";

export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: VIENNA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parseDateKey(dateKey));
}

export function weekdayName(dateKey: string): string {
  return new Intl.DateTimeFormat("de-AT", { weekday: "long" }).format(parseDateKey(dateKey));
}

export function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfIsoWeek(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return toDateKey(date);
}

export function isoWeekDays(dateKey: string): string[] {
  const monday = startOfIsoWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function currentYear(now = new Date()): number {
  return Number(todayKey(now).slice(0, 4));
}
