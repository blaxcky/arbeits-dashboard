import { describe, expect, it } from "vitest";
import type { AuditPointCase, UsoCase } from "../../db/schema";
import {
  ADDITIONAL_RESULT_BONUSES,
  AUDIT_POINT_CATEGORY_RULES,
  DEFAULT_USO_TARGET_COUNT,
  buildAuditPointYearRows,
  buildUsoYearRows,
  calculateAdditionalResultBonusTenths,
  calculateAuditPointBreakdown,
  cappedAuditPeriodYears,
  pointsForAuditCase,
  summarizeAuditPoints
} from "./calculations";

const baseCase: AuditPointCase = {
  id: "case-1",
  name: "Musterfall",
  taxNumber: "12 345/6789",
  firm: "",
  category: "M1",
  periodStartYear: 2020,
  periodEndYear: 2022,
  additionalResultCents: 0,
  section99: false,
  submissionMonth: "2026-05",
  status: "in_progress",
  submittedPointsTenths: null,
  submittedAt: null,
  createdAt: "2026-05-01T08:00:00.000Z",
  updatedAt: "2026-05-01T08:00:00.000Z"
};

const baseUsoCase: UsoCase = {
  id: "uso-1",
  title: "USO Muster",
  submissionMonth: "2026-05",
  status: "completed",
  createdAt: "2026-05-01T08:00:00.000Z",
  updatedAt: "2026-05-01T08:00:00.000Z"
};

describe("audit point calculations", () => {
  it("uses all category base values and yearly supplements from the points table", () => {
    const expectedRules: typeof AUDIT_POINT_CATEGORY_RULES = {
      K3: { label: "K3", baseTenths: 30, yearlyTenths: 5 },
      K2: { label: "K2", baseTenths: 35, yearlyTenths: 10 },
      K1: { label: "K1", baseTenths: 40, yearlyTenths: 10 },
      K0: { label: "K0", baseTenths: 50, yearlyTenths: 10 },
      M2: { label: "M2", baseTenths: 50, yearlyTenths: 15 },
      M1: { label: "M1", baseTenths: 55, yearlyTenths: 15 },
      M0: { label: "M0", baseTenths: 65, yearlyTenths: 15 },
      G2: { label: "G2", baseTenths: 120, yearlyTenths: 20 },
      G1: { label: "G1", baseTenths: 170, yearlyTenths: 20 },
      G0: { label: "G0", baseTenths: 310, yearlyTenths: 20 }
    };

    expect(AUDIT_POINT_CATEGORY_RULES).toEqual(expectedRules);

    for (const [category, rule] of Object.entries(expectedRules)) {
      expect(calculateAuditPointBreakdown({ ...baseCase, category: category as AuditPointCase["category"], periodStartYear: 2020, periodEndYear: 2020 })).toMatchObject({
        categoryTenths: rule.baseTenths,
        periodTenths: rule.yearlyTenths,
        totalTenths: rule.baseTenths + rule.yearlyTenths
      });
    }
  });

  it("adds the yearly supplement for each counted audit year", () => {
    expect(calculateAuditPointBreakdown({ ...baseCase, category: "M1", periodStartYear: 2020, periodEndYear: 2020 })).toMatchObject({
      categoryTenths: 55,
      periodTenths: 15,
      totalTenths: 70
    });
    expect(calculateAuditPointBreakdown({ ...baseCase, category: "M1", periodStartYear: 2020, periodEndYear: 2022 })).toMatchObject({
      categoryTenths: 55,
      periodTenths: 45,
      totalTenths: 100
    });
    expect(calculateAuditPointBreakdown({ ...baseCase, category: "M1", periodStartYear: 2015, periodEndYear: 2026 })).toMatchObject({
      categoryTenths: 55,
      periodTenths: 105,
      totalTenths: 160
    });
  });

  it("counts inclusive periods and caps them at seven years", () => {
    expect(cappedAuditPeriodYears(2020, 2022)).toBe(3);
    expect(cappedAuditPeriodYears(2015, 2026)).toBe(7);
    expect(() => cappedAuditPeriodYears(2022, 2020)).toThrow("Prüfungszeitraum ist ungültig.");
  });

  it("doubles only category and period points for section 99", () => {
    const withoutSection99 = calculateAuditPointBreakdown({ ...baseCase, category: "M1", additionalResultCents: 1_000_000_01, section99: false });
    const withSection99 = calculateAuditPointBreakdown({ ...baseCase, category: "M1", additionalResultCents: 1_000_000_01, section99: true });

    expect(withSection99.section99Tenths).toBe(withoutSection99.categoryTenths + withoutSection99.periodTenths);
    expect(withSection99.additionalResultTenths).toBe(withoutSection99.additionalResultTenths);
    expect(withSection99.totalTenths).toBe(withoutSection99.totalTenths + withoutSection99.categoryTenths + withoutSection99.periodTenths);
  });

  it("adds additional result bonuses cumulatively and strictly above thresholds", () => {
    expect(calculateAdditionalResultBonusTenths(ADDITIONAL_RESULT_BONUSES[0].thresholdCents)).toBe(0);
    expect(calculateAdditionalResultBonusTenths(ADDITIONAL_RESULT_BONUSES[0].thresholdCents + 1)).toBe(5);
    expect(calculateAdditionalResultBonusTenths(ADDITIONAL_RESULT_BONUSES[2].thresholdCents + 1)).toBe(35);
  });

  it("rejects invalid categories", () => {
    expect(() => calculateAuditPointBreakdown({ ...baseCase, category: "X1" as AuditPointCase["category"] })).toThrow("Betriebskategorie ist ungültig.");
  });

  it("uses submitted points for completed cases and current rules for open cases", () => {
    expect(pointsForAuditCase({ ...baseCase, status: "completed", submittedPointsTenths: 123 })).toBe(123);
    expect(pointsForAuditCase({ ...baseCase, status: "in_progress", submittedPointsTenths: 123 })).toBe(calculateAuditPointBreakdown(baseCase).totalTenths);
  });

  it("summarizes cases by submission month and year", () => {
    const summary = summarizeAuditPoints([
      { ...baseCase, status: "completed", submittedPointsTenths: 80 },
      { ...baseCase, id: "case-2", submissionMonth: "2026-06", category: "K0" },
      { ...baseCase, id: "case-3", submissionMonth: "2025-05", category: "G2" }
    ], 2026, "2026-05", [{ id: "goal-2026", year: 2026, targetPointsTenths: 200, updatedAt: "2026-05-01T08:00:00.000Z" }]);

    expect(summary.count).toBe(1);
    expect(summary.completedCount).toBe(1);
    expect(summary.pointsTenths).toBe(80);
    expect(summary.progressRatio).toBe(0.4);
  });

  it("ignores cases without submission month in month and year summaries", () => {
    const unsubmittedCase = { ...baseCase, id: "case-2", submissionMonth: "", status: "completed" as const, submittedPointsTenths: 120 };

    expect(summarizeAuditPoints([baseCase, unsubmittedCase], 2026).count).toBe(1);
    expect(summarizeAuditPoints([unsubmittedCase], 2026, "2026-05").pointsTenths).toBe(0);
  });

  it("builds BP yearly rows from completed fixed values only", () => {
    const rows = buildAuditPointYearRows([
      { ...baseCase, status: "completed", submittedPointsTenths: 60, submissionMonth: "2026-01" },
      { ...baseCase, id: "case-2", status: "in_progress", submittedPointsTenths: null, submissionMonth: "2026-01" },
      { ...baseCase, id: "case-3", status: "completed", submittedPointsTenths: 40, submissionMonth: "2026-02" }
    ], 2026, [{ id: "goal-2026", year: 2026, targetPointsTenths: 120, updatedAt: "2026-05-01T08:00:00.000Z" }]);

    expect(rows[0]).toMatchObject({ submissionValue: 60, openValue: calculateAuditPointBreakdown(baseCase).totalTenths, targetValue: 10, cumulativeValue: 60, remainingValue: 0, targetReached: true });
    expect(rows[1]).toMatchObject({ submissionValue: 40, targetValue: 20, cumulativeValue: 100, remainingValue: 0, targetReached: true });
    expect(rows[11]).toMatchObject({ targetValue: 120, cumulativeValue: 100, remainingValue: 20, targetReached: false });
  });

  it("builds USO yearly rows with one completed case as one count and default target eight", () => {
    const rows = buildUsoYearRows([
      baseUsoCase,
      { ...baseUsoCase, id: "uso-2", status: "in_progress", submissionMonth: "2026-05" },
      { ...baseUsoCase, id: "uso-3", status: "completed", submissionMonth: "2026-06" }
    ], 2026);

    expect(DEFAULT_USO_TARGET_COUNT).toBe(8);
    expect(rows[4]).toMatchObject({ submissionValue: 1, openValue: 1, cumulativeValue: 1, targetValue: 4, remainingValue: 3, targetReached: false });
    expect(rows[5]).toMatchObject({ submissionValue: 1, openValue: 0, cumulativeValue: 2, targetValue: 4, remainingValue: 2, targetReached: false });
    expect(rows[11]).toMatchObject({ targetValue: 8, cumulativeValue: 2, remainingValue: 6 });
  });

  it("uses saved USO targets for yearly rows", () => {
    const rows = buildUsoYearRows([baseUsoCase], 2026, [{ id: "uso-goal-2026", year: 2026, targetCount: 12, updatedAt: "2026-05-01T08:00:00.000Z" }]);

    expect(rows[0].targetValue).toBe(1);
    expect(rows[11].targetValue).toBe(12);
  });
});
