import { describe, expect, it } from "vitest";
import type { AuditPointCase, OtherMeasure, UsoCase } from "../../db/schema";
import { buildPointYearCases, monthlyTargetValue, niceAxisScale, summarizePointYear, type PointYearCase } from "./yearOverview";

const timestamp = "2026-05-01T08:00:00.000Z";

function pointCase(id: string, submissionMonth: string, value: number, completed: boolean): PointYearCase {
  return { id, kind: "audit", title: id, detail: "Betriebsprüfung", value, completed, submissionMonth };
}

describe("point year overview", () => {
  const cases = [
    pointCase("Jänner", "2026-01", 210, true),
    pointCase("März", "2026-03", 450, true),
    pointCase("Oktober", "2026-10", 150, true),
    pointCase("Überfällig", "2026-09", 30, false),
    pointCase("Huber", "2026-11", 210, false),
    pointCase("November erledigt", "2026-11", 20, true),
    pointCase("Moser", "2026-12", 70, false),
    pointCase("Lindner", "", 450, false),
    pointCase("Vorjahr", "2025-12", 100, true)
  ];

  it("summarizes the current year with past months collapsed and the rest of the year listed", () => {
    const summary = summarizePointYear(cases, 2026, 1900, "2026-11");

    expect(summary.completedValue).toBe(830);
    expect(summary.openValue).toBe(310);
    expect(summary.currentTarget).toEqual({ month: "2026-11", value: 1742 });
    expect(summary.remainder.past).toMatchObject({ label: "Jänner – Oktober", completedValue: 810 });
    expect(summary.remainder.past?.months.map((month) => month.month)).toEqual(["2026-01", "2026-03", "2026-10"]);
    expect(summary.remainder.months.map((month) => [month.month, month.completedValue, month.openValue, month.current])).toEqual([
      ["2026-09", 0, 30, false],
      ["2026-11", 20, 210, true],
      ["2026-12", 0, 70, false]
    ]);
    expect(summary.remainder.withoutMonth?.cases.map((entry) => entry.id)).toEqual(["Lindner"]);
    expect(summary.calc).toEqual({ completedValue: 830, openValue: 310, withoutMonthValue: 450, possibleValue: 1590, goal: 1900, difference: -310 });
  });

  it("draws the stand until last month and continues it with open cases", () => {
    const { series } = summarizePointYear(cases, 2026, 1900, "2026-11");

    expect(series.stand).toEqual([210, 210, 660, 660, 660, 660, 660, 660, 660, 810, null, null]);
    expect(series.projection).toEqual([null, null, null, null, null, null, null, null, null, 810, 1070, 1140]);
    expect(series.target[0]).toBe(159);
    expect(series.target[11]).toBe(1900);
  });

  it("keeps past years complete and leaves cases without month out", () => {
    const summary = summarizePointYear(cases, 2025, null, "2026-11");

    expect(summary.remainder.past).toMatchObject({ label: "Jänner – Dezember", completedValue: 100 });
    expect(summary.remainder.months).toEqual([]);
    expect(summary.remainder.withoutMonth).toBeNull();
    expect(summary.series.projection.every((value) => value === null)).toBe(true);
    expect(summary.calc.difference).toBeNull();
  });

  it("lists only months with cases for future years", () => {
    const summary = summarizePointYear([pointCase("Plan", "2027-03", 50, false)], 2027, 1200, "2026-11");

    expect(summary.remainder.past).toBeNull();
    expect(summary.remainder.months.map((month) => month.month)).toEqual(["2027-03"]);
    expect(summary.currentTarget).toBeNull();
    expect(summary.series.stand.every((value) => value === null)).toBe(true);
    expect(summary.series.projection[2]).toBe(50);
  });

  it("builds tab specific cases with points or counts", () => {
    const audit = { id: "a", name: "Huber Bau GmbH", taxNumber: "", firm: "", category: "M1", periodStartYear: 2021, periodEndYear: 2023, additionalResultCents: 0, section99: false, submissionMonth: "2026-11", status: "in_progress", submittedPointsTenths: null, submittedAt: null, createdAt: timestamp, updatedAt: timestamp } as AuditPointCase;
    const uso = { id: "u", title: "USO Gastro Mayr", submissionMonth: "2026-11", status: "in_progress", createdAt: timestamp, updatedAt: timestamp } as UsoCase;
    const other = { id: "o", title: "Kassennachschau", measureType: "Registrierkassennachschau", manualPointsTenths: 5, submissionMonth: "2026-11", status: "completed", createdAt: timestamp, updatedAt: timestamp } as OtherMeasure;

    expect(buildPointYearCases("points", [audit], [uso], [other]).map(({ id, detail, value }) => [id, detail, value])).toEqual([
      ["a", "Betriebsprüfung", 100],
      ["u", "USO", 0],
      ["o", "Sonstige Maßnahme", 5]
    ]);
    expect(buildPointYearCases("uso", [audit], [uso], [other]).map(({ id, value }) => [id, value])).toEqual([["u", 1]]);
    expect(buildPointYearCases("other", [audit], [uso], [other]).map(({ id, detail, value, completed }) => [id, detail, value, completed])).toEqual([["o", "Registrierkassennachschau", 1, true]]);
  });

  it("spreads goals over the months and picks readable axis steps", () => {
    expect(monthlyTargetValue(8, 6)).toBe(5);
    expect(niceAxisScale(2000)).toEqual({ max: 2000, step: 500 });
    expect(niceAxisScale(1710)).toEqual({ max: 2000, step: 500 });
    expect(niceAxisScale(8)).toEqual({ max: 8, step: 2 });
    expect(niceAxisScale(0)).toEqual({ max: 1, step: 1 });
  });
});
