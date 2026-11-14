import type { PlannedAbsence, PlannedAbsenceType } from "../../db/schema";
import { addDays } from "../../lib/dates";
import { ABSENCE_TYPE_LABELS, nextWorkday } from "./absencePlanning";

export interface AbsenceCalendarEvent {
  type: PlannedAbsenceType;
  start: string;
  end: string;
  dates: string[];
  requested: boolean;
}

export function absenceCalendarEvents(absences: PlannedAbsence[], fromDate: string): AbsenceCalendarEvent[] {
  const sorted = absences
    .filter((absence) => absence.date >= fromDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  const events: AbsenceCalendarEvent[] = [];
  for (const absence of sorted) {
    const last = events[events.length - 1];
    const requested = absence.status !== "planned";
    if (last && last.type === absence.type && nextWorkday(last.end) === absence.date) {
      last.end = absence.date;
      last.dates.push(absence.date);
      last.requested = last.requested && requested;
    } else {
      events.push({ type: absence.type, start: absence.date, end: absence.date, dates: [absence.date], requested });
    }
  }
  return events;
}

function icsDate(date: string): string {
  return date.replace(/-/g, "");
}

function icsTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildAbsenceIcs(absences: PlannedAbsence[], fromDate: string, now = new Date()): string {
  const stamp = icsTimestamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Arbeits-Dashboard//Urlaubsplanung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Urlaub und Gleittage"
  ];
  for (const event of absenceCalendarEvents(absences, fromDate)) {
    const label = ABSENCE_TYPE_LABELS[event.type];
    const dayCount = event.dates.length;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.type}-${event.start}@arbeits-dashboard`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(event.start)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(event.end, 1))}`,
      `SUMMARY:${escapeText(label)}`,
      `DESCRIPTION:${escapeText(`${label}, ${dayCount === 1 ? "1 Arbeitstag" : `${dayCount} Arbeitstage`} – ${event.requested ? "beantragt" : "geplant, noch nicht beantragt"}. Aus dem Arbeits-Dashboard exportiert.`)}`,
      "TRANSP:OPAQUE",
      "X-MICROSOFT-CDO-BUSYSTATUS:OOF",
      "X-MICROSOFT-CDO-INTENDEDSTATUS:OOF",
      "X-MICROSOFT-CDO-ALLDAYEVENT:TRUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function absenceIcsFileName(fromDate: string): string {
  return `urlaub-gleittage-ab-${fromDate}.ics`;
}

export function downloadAbsenceIcs(absences: PlannedAbsence[], fromDate: string): void {
  const blob = new Blob([buildAbsenceIcs(absences, fromDate)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = absenceIcsFileName(fromDate);
  anchor.click();
  URL.revokeObjectURL(url);
}
