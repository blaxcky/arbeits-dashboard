import { describe, expect, it } from "vitest";
import type { PlannedAbsence } from "../../db/schema";
import { absenceCalendarEvents, absenceIcsFileName, buildAbsenceIcs } from "./absenceCalendarExport";

function absence(date: string, type: PlannedAbsence["type"], status: PlannedAbsence["status"] = "planned"): PlannedAbsence {
  return { id: `${type}-${date}`, date, type, status, createdAt: "", updatedAt: "" };
}

const plan = [
  absence("2026-11-12", "vacation", "booked"),
  absence("2026-11-20", "flex", "requested"),
  absence("2026-12-21", "vacation", "requested"),
  absence("2026-12-22", "vacation"),
  absence("2026-12-23", "vacation")
];

describe("absence calendar export", () => {
  it("merges consecutive working days of one type into one event regardless of status", () => {
    expect(absenceCalendarEvents(plan, "2026-11-15").map((event) => [event.type, event.start, event.end, event.requested])).toEqual([
      ["flex", "2026-11-20", "2026-11-20", true],
      ["vacation", "2026-12-21", "2026-12-23", false]
    ]);
  });

  it("writes all-day out-of-office events Outlook can import", () => {
    const ics = buildAbsenceIcs(plan, "2026-11-15", new Date("2026-11-15T09:30:00.000Z"));

    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:vacation-2026-12-21@arbeits-dashboard");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261221");
    expect(ics).toContain("DTEND;VALUE=DATE:20261224");
    expect(ics).toContain("SUMMARY:Gleittag");
    expect(ics).toContain("X-MICROSOFT-CDO-BUSYSTATUS:OOF");
    expect(ics).toContain("DTSTAMP:20261115T093000Z");
    expect(ics).not.toContain("20261112");
  });

  it("folds long lines to 75 octets", () => {
    const ics = buildAbsenceIcs(plan, "2026-11-15");
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain("\r\n ");
  });

  it("names the file after the export start date", () => {
    expect(absenceIcsFileName("2026-11-15")).toBe("urlaub-gleittage-ab-2026-11-15.ics");
  });
});
