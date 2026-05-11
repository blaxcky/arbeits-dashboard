import { describe, expect, it } from "vitest";
import type { AuditPointCase } from "../../db/schema";
import {
  ADDITIONAL_RESULT_BONUSES,
  AUDIT_POINT_CATEGORY_RULES,
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

describe("audit point calculations", () => {
  it("uses all configured category base values and yearly supplements", () => {
    for (const [category, rule] of Object.entries(AUDIT_POINT_CATEGORY_RULES)) {
      expect(calculateAuditPointBreakdown({ ...baseCase, category: category as AuditPointCase["category"], periodStartYear: 2020, periodEndYear: 2021 })).toMatchObject({
        categoryTenths: rule.baseTenths,
        periodTenths: rule.yearlyTenths
      });
    }
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
});
