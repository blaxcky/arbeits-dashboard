import { describe, expect, it } from "vitest";
import type { AuditPointCase, OtherMeasure, UsoCase } from "../../db/schema";
import { formatPointMonthLabel, groupPointCasesByMonth, summarizePointCaseOverview } from "./overview";

const timestamp = "2026-05-01T08:00:00.000Z";
const auditCase: AuditPointCase = {
  id: "audit-1",
  name: "Huber Bau GmbH",
  taxNumber: "12 345/6789",
  firm: "Kanzlei Gruber",
  category: "M1",
  periodStartYear: 2021,
  periodEndYear: 2023,
  additionalResultCents: 1_250_000,
  section99: true,
  submissionMonth: "2026-11",
  status: "in_progress",
  submittedPointsTenths: null,
  submittedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp
};
const usoCase: UsoCase = {
  id: "uso-1",
  title: "USO Gastro Mayr",
  submissionMonth: "2026-11",
  status: "in_progress",
  createdAt: timestamp,
  updatedAt: timestamp
};
const otherMeasure: OtherMeasure = {
  id: "other-1",
  title: "Kassennachschau Café Zentral",
  measureType: "Registrierkassennachschau",
  manualPointsTenths: 5,
  submissionMonth: "2026-11",
  status: "in_progress",
  createdAt: timestamp,
  updatedAt: timestamp
};

describe("point case overview", () => {
  it("summarizes open cases, the current submission month, cases without month and the year", () => {
    const overview = summarizePointCaseOverview(
      [
        auditCase,
        { ...auditCase, id: "audit-2", name: "Moser KG", category: "K1", periodStartYear: 2022, periodEndYear: 2024, additionalResultCents: 320_000, section99: false, submissionMonth: "2026-12" },
        { ...auditCase, id: "audit-3", name: "Lindner OG", submissionMonth: "" },
        { ...auditCase, id: "audit-4", name: "Steiner", status: "completed", submittedPointsTenths: 65, submissionMonth: "2026-10" },
        { ...auditCase, id: "audit-5", name: "Vorjahr", status: "completed", submittedPointsTenths: 100, submissionMonth: "2025-10" }
      ],
      [usoCase, { ...usoCase, id: "uso-2", status: "completed", submissionMonth: "2026-08" }],
      [otherMeasure],
      "2026-11"
    );

    expect(overview.openCounts).toEqual({ audit: 3, uso: 1, other: 1 });
    expect(overview.openCount).toBe(5);
    expect(overview.currentMonth).toEqual({ month: "2026-11", openCount: 3, openPointsTenths: 215 });
    expect(overview.withoutMonth).toEqual({ count: 1, pointsTenths: 210, title: "Lindner OG" });
    expect(overview.year).toEqual({ year: 2026, completedPointsTenths: 65, openPointsTenths: 285, totalPointsTenths: 350 });
  });

  it("names no single case when several cases have no submission month", () => {
    const overview = summarizePointCaseOverview([{ ...auditCase, submissionMonth: "" }], [{ ...usoCase, submissionMonth: "" }], [], "2026-11");

    expect(overview.withoutMonth).toEqual({ count: 2, pointsTenths: 210, title: null });
  });

  it("groups cases by submission month in both directions with cases without month last", () => {
    const cases = [
      { id: "a", submissionMonth: "2026-12", points: 7 },
      { id: "b", submissionMonth: "", points: 45 },
      { id: "c", submissionMonth: "2026-11", points: 21 },
      { id: "d", submissionMonth: "2026-11", points: 5 }
    ];

    const ascending = groupPointCasesByMonth(cases, "asc", (pointCase) => pointCase.points);
    expect(ascending.map((group) => [group.month, group.cases.map(({ id }) => id), group.pointsTenths])).toEqual([
      ["2026-11", ["c", "d"], 26],
      ["2026-12", ["a"], 7],
      ["", ["b"], 45]
    ]);
    expect(groupPointCasesByMonth(cases, "desc", (pointCase) => pointCase.points).map((group) => group.month)).toEqual(["2026-12", "2026-11", ""]);
  });

  it("formats submission months with Austrian month names", () => {
    expect(formatPointMonthLabel("2026-01")).toBe("Jänner 2026");
    expect(formatPointMonthLabel("2026-11")).toBe("November 2026");
    expect(formatPointMonthLabel("")).toBe("");
  });
});
