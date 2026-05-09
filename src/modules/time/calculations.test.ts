import { describe, expect, it } from "vitest";
import {
  calculateDay,
  calculateFlexBalance,
  calculateNextFlexDayBalance,
  calculateNextVacationUsedMinutes,
  calculateRequiredYearConsumption,
  calculateVacation,
  calculateWeek,
  entriesForFlexBalance
} from "./calculations";

const fixedNow = new Date(2026, 4, 6, 14, 30);

describe("time calculations", () => {
  it("keeps 30 minutes break included in the target day", () => {
    const result = calculateDay({ date: "2026-05-06", startTime: "07:00", endTime: "15:00", breakMinutes: 30, targetMinutes: 480 });
    expect(result.netMinutes).toBe(480);
    expect(result.deltaMinutes).toBe(0);
    expect(result.targetEndTime).toBe("15:00");
  });

  it("extends the target end only for breaks above 30 minutes", () => {
    const result = calculateDay({ date: "2026-05-06", startTime: "07:00", endTime: "15:30", breakMinutes: 60, targetMinutes: 480 });
    expect(result.netMinutes).toBe(480);
    expect(result.deltaMinutes).toBe(0);
    expect(result.targetEndTime).toBe("15:30");
  });

  it("calculates live time without explicit end", () => {
    const result = calculateDay({ date: "2026-05-06", startTime: "07:00", breakMinutes: 30, targetMinutes: 480 }, fixedNow);
    expect(result.status).toBe("running");
    expect(result.netMinutes).toBe(450);
    expect(result.deltaMinutes).toBe(-30);
  });

  it("calculates plus and minus days", () => {
    expect(calculateDay({ date: "2026-05-06", startTime: "07:00", endTime: "16:00", breakMinutes: 30, targetMinutes: 480 }).deltaMinutes).toBe(60);
    expect(calculateDay({ date: "2026-05-06", startTime: "07:00", endTime: "14:00", breakMinutes: 30, targetMinutes: 480 }).deltaMinutes).toBe(-60);
  });

  it("summarizes ISO weeks from Monday", () => {
    const summary = calculateWeek(
      [
        { date: "2026-05-04", startTime: "07:00", endTime: "15:00", breakMinutes: 30, targetMinutes: 480 },
        { date: "2026-05-05", startTime: "07:00", endTime: "16:00", breakMinutes: 30, targetMinutes: 480 },
        { date: "2026-05-09", startTime: "07:00", endTime: "16:00", breakMinutes: 30, targetMinutes: 480 }
      ],
      "2026-05-06"
    );
    expect(summary.weekStart).toBe("2026-05-04");
    expect(summary.days).toHaveLength(5);
    expect(summary.workedMinutes).toBe(1020);
    expect(summary.plusMinutes).toBe(60);
  });

  it("combines flex start, day deltas and corrections", () => {
    const balance = calculateFlexBalance(
      120,
      [{ date: "2026-05-06", startTime: "07:00", endTime: "16:00", breakMinutes: 30, targetMinutes: 480 }],
      [{ diffMinutes: -30 }]
    );
    expect(balance).toBe(150);
  });

  it("excludes only the open current day from flex balance entries", () => {
    const entries = [
      { date: "2026-05-06", startTime: "07:00", breakMinutes: 30, targetMinutes: 480 },
      { date: "2026-05-06", startTime: "07:00", endTime: "16:00", breakMinutes: 30, targetMinutes: 480 },
      { date: "2026-05-05", startTime: "07:00", breakMinutes: 30, targetMinutes: 480 }
    ];

    expect(entriesForFlexBalance(entries, "2026-05-06")).toEqual([entries[1], entries[2]]);
  });

  it("converts vacation and required yearly consumption", () => {
    const vacation = calculateVacation(2000, 560);
    expect(vacation.remainingMinutes).toBe(1440);
    expect(vacation.remainingDays).toBe(3);
    expect(calculateRequiredYearConsumption(vacation.remainingMinutes, 6200, 6000)).toBe(1640);
  });

  it("books vacation without exceeding entitlement", () => {
    expect(calculateNextVacationUsedMinutes(960, 0, 480)).toBe(480);
    expect(calculateNextVacationUsedMinutes(960, 720, 480)).toBe(960);
    expect(calculateNextVacationUsedMinutes(960, 960, 480)).toBe(960);
    expect(calculateNextVacationUsedMinutes(null, 0, 480)).toBe(0);
  });

  it("books flex days only down to ten minus hours", () => {
    expect(calculateNextFlexDayBalance(0, 480)).toBe(-480);
    expect(calculateNextFlexDayBalance(-120, 480)).toBe(-600);
    expect(calculateNextFlexDayBalance(-121, 480)).toBeNull();
    expect(calculateNextFlexDayBalance(-600, 480)).toBeNull();
  });
});
