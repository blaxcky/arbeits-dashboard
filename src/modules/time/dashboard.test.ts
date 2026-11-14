import { describe, expect, it } from "vitest";
import { calculateDay, calculateWeek } from "./calculations";
import { completedWeekDelta, formatShortDayLabel, formatWeekRange, isoWeekNumber, timelinePercent, weekLine } from "./dashboard";

describe("isoWeekNumber", () => {
  it("returns ISO calendar weeks including year boundaries", () => {
    expect(isoWeekNumber("2026-11-13")).toBe(46);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(isoWeekNumber("2024-12-30")).toBe(1);
  });
});

describe("week labels", () => {
  it("formats a working week range compactly", () => {
    expect(formatWeekRange("2026-11-09")).toBe("09.–13.11.2026");
    expect(formatWeekRange("2026-11-30")).toBe("30.11.–04.12.2026");
    expect(formatWeekRange("2026-12-28")).toBe("28.12.2026–01.01.2027");
  });

  it("formats short weekday labels", () => {
    expect(formatShortDayLabel("2026-11-09")).toBe("Mo 09.11.");
  });
});

describe("timelinePercent", () => {
  it("maps 06:00 to 20:00 onto the timeline and clamps outside values", () => {
    expect(timelinePercent(6 * 60)).toBe(0);
    expect(timelinePercent(13 * 60)).toBe(50);
    expect(timelinePercent(20 * 60)).toBe(100);
    expect(timelinePercent(5 * 60)).toBe(0);
    expect(timelinePercent(22 * 60)).toBe(100);
  });
});

describe("weekLine", () => {
  const now = new Date(2026, 10, 13, 13, 45);
  const base = { breakMinutes: 30, targetMinutes: 480 };

  it("describes complete, running, missing-end and empty days", () => {
    const complete = { ...base, date: "2026-11-09", startTime: "07:30", endTime: "16:15" };
    expect(weekLine(complete, calculateDay(complete, now), complete.date, "2026-11-13", 825)).toEqual({ kind: "complete", startMinutes: 450, endMinutes: 975 });

    const running = { ...base, date: "2026-11-13", startTime: "07:30" };
    expect(weekLine(running, calculateDay(running, now), running.date, "2026-11-13", 825)).toEqual({ kind: "running", startMinutes: 450, endMinutes: 825, plannedEndMinutes: 930 });

    const missingEnd = { ...base, date: "2026-11-12", startTime: "08:00" };
    expect(weekLine(missingEnd, calculateDay(missingEnd, now), missingEnd.date, "2026-11-13", 825)).toEqual({ kind: "missing-end", startMinutes: 480, plannedEndMinutes: 960 });

    expect(weekLine(undefined, calculateDay(undefined, now), "2026-11-10", "2026-11-13", 825)).toEqual({ kind: "empty" });
  });
});

describe("completedWeekDelta", () => {
  it("sums only days with start and end", () => {
    const now = new Date(2026, 10, 13, 13, 45);
    const entries = [
      { date: "2026-11-09", startTime: "07:30", endTime: "15:45", breakMinutes: 30, targetMinutes: 480 },
      { date: "2026-11-10", startTime: "07:30", endTime: "15:00", breakMinutes: 30, targetMinutes: 480 },
      { date: "2026-11-13", startTime: "07:30", breakMinutes: 30, targetMinutes: 480 }
    ];
    expect(completedWeekDelta(calculateWeek(entries, "2026-11-13", now))).toBe(-15);
  });
});
