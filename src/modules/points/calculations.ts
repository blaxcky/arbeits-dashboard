import type { AuditPointCase, AuditPointCategory, AuditPointGoal, UsoCase, UsoGoal } from "../../db/schema";

export interface AuditPointCategoryRule {
  label: string;
  baseTenths: number;
  yearlyTenths: number;
}

export interface AuditPointBreakdown {
  categoryTenths: number;
  periodTenths: number;
  section99Tenths: number;
  additionalResultTenths: number;
  totalTenths: number;
  cappedYears: number;
}

export interface AuditPointSummary {
  pointsTenths: number;
  completedPointsTenths: number;
  openPointsTenths: number;
  count: number;
  completedCount: number;
  openCount: number;
  additionalResultCents: number;
  targetPointsTenths: number | null;
  progressRatio: number | null;
}

export interface YearlyMonthlyRow {
  month: string;
  submissionValue: number;
  openValue: number;
  targetValue: number | null;
  cumulativeValue: number;
  remainingValue: number | null;
  targetReached: boolean | null;
}

export const DEFAULT_USO_TARGET_COUNT = 8;

export const AUDIT_POINT_CATEGORY_RULES: Record<AuditPointCategory, AuditPointCategoryRule> = {
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

export const AUDIT_POINT_CATEGORIES = Object.keys(AUDIT_POINT_CATEGORY_RULES) as AuditPointCategory[];

export const ADDITIONAL_RESULT_BONUSES: Array<{ thresholdCents: number; pointsTenths: number }> = [
  { thresholdCents: 100_000_00, pointsTenths: 5 },
  { thresholdCents: 250_000_00, pointsTenths: 10 },
  { thresholdCents: 500_000_00, pointsTenths: 20 },
  { thresholdCents: 1_000_000_00, pointsTenths: 30 }
];

export function isAuditPointCategory(value: string): value is AuditPointCategory {
  return value in AUDIT_POINT_CATEGORY_RULES;
}

export function cappedAuditPeriodYears(startYear: number, endYear: number): number {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    throw new Error("Prüfungszeitraum ist ungültig.");
  }
  return Math.min(endYear - startYear + 1, 7);
}

export function calculateAdditionalResultBonusTenths(additionalResultCents: number): number {
  const cents = Math.max(Math.round(additionalResultCents), 0);
  return ADDITIONAL_RESULT_BONUSES.reduce((sum, bonus) => sum + (cents > bonus.thresholdCents ? bonus.pointsTenths : 0), 0);
}

export function calculateAuditPointBreakdown(input: Pick<AuditPointCase, "category" | "periodStartYear" | "periodEndYear" | "additionalResultCents" | "section99">): AuditPointBreakdown {
  const rule = AUDIT_POINT_CATEGORY_RULES[input.category];
  if (!rule) throw new Error("Betriebskategorie ist ungültig.");
  const cappedYears = cappedAuditPeriodYears(input.periodStartYear, input.periodEndYear);
  const categoryTenths = rule.baseTenths;
  const periodTenths = cappedYears * rule.yearlyTenths;
  const section99Tenths = input.section99 ? categoryTenths + periodTenths : 0;
  const additionalResultTenths = calculateAdditionalResultBonusTenths(input.additionalResultCents);
  return {
    categoryTenths,
    periodTenths,
    section99Tenths,
    additionalResultTenths,
    cappedYears,
    totalTenths: categoryTenths + periodTenths + section99Tenths + additionalResultTenths
  };
}

export function pointsForAuditCase(pointCase: AuditPointCase): number {
  if (pointCase.status === "completed" && pointCase.submittedPointsTenths !== null) {
    return pointCase.submittedPointsTenths;
  }
  return calculateAuditPointBreakdown(pointCase).totalTenths;
}

export function summarizeAuditPoints(cases: AuditPointCase[], year: number, month: string | null = null, goals: AuditPointGoal[] = []): AuditPointSummary {
  const yearPrefix = `${year}-`;
  const filtered = cases.filter((pointCase) => pointCase.submissionMonth.startsWith(yearPrefix) && (!month || pointCase.submissionMonth === month));
  const summary = filtered.reduce<AuditPointSummary>((current, pointCase) => {
    const pointsTenths = pointsForAuditCase(pointCase);
    const completed = pointCase.status === "completed";
    return {
      pointsTenths: current.pointsTenths + pointsTenths,
      completedPointsTenths: current.completedPointsTenths + (completed ? pointsTenths : 0),
      openPointsTenths: current.openPointsTenths + (completed ? 0 : pointsTenths),
      count: current.count + 1,
      completedCount: current.completedCount + (completed ? 1 : 0),
      openCount: current.openCount + (completed ? 0 : 1),
      additionalResultCents: current.additionalResultCents + pointCase.additionalResultCents,
      targetPointsTenths: current.targetPointsTenths,
      progressRatio: null
    };
  }, {
    pointsTenths: 0,
    completedPointsTenths: 0,
    openPointsTenths: 0,
    count: 0,
    completedCount: 0,
    openCount: 0,
    additionalResultCents: 0,
    targetPointsTenths: goals.find((goal) => goal.year === year)?.targetPointsTenths ?? null,
    progressRatio: null
  });

  return {
    ...summary,
    progressRatio: summary.targetPointsTenths && summary.targetPointsTenths > 0 ? summary.pointsTenths / summary.targetPointsTenths : null
  };
}

export function buildAuditPointYearRows(cases: AuditPointCase[], year: number, goals: AuditPointGoal[] = []): YearlyMonthlyRow[] {
  const targetPointsTenths = goals.find((goal) => goal.year === year)?.targetPointsTenths ?? null;
  return buildYearRows(year, targetPointsTenths, (month) => {
    const monthlyCases = cases.filter((pointCase) => pointCase.submissionMonth === month);
    return monthlyCases.reduce((current, pointCase) => {
      const pointsTenths = pointsForAuditCase(pointCase);
      if (pointCase.status === "completed") {
        return { ...current, submissionValue: current.submissionValue + pointsTenths };
      }
      return { ...current, openValue: current.openValue + pointsTenths };
    }, { submissionValue: 0, openValue: 0 });
  });
}

export function usoTargetForYear(goals: UsoGoal[], year: number): number {
  return goals.find((goal) => goal.year === year)?.targetCount ?? DEFAULT_USO_TARGET_COUNT;
}

export function buildUsoYearRows(cases: UsoCase[], year: number, goals: UsoGoal[] = []): YearlyMonthlyRow[] {
  const targetCount = usoTargetForYear(goals, year);
  return buildYearRows(year, targetCount, (month) => {
    const monthlyCases = cases.filter((usoCase) => usoCase.submissionMonth === month);
    return monthlyCases.reduce((current, usoCase) => {
      if (usoCase.status === "completed") {
        return { ...current, submissionValue: current.submissionValue + 1 };
      }
      return { ...current, openValue: current.openValue + 1 };
    }, { submissionValue: 0, openValue: 0 });
  });
}

function buildYearRows(year: number, targetValue: number | null, monthValue: (month: string) => { submissionValue: number; openValue: number }): YearlyMonthlyRow[] {
  let cumulativeValue = 0;
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const { submissionValue, openValue } = monthValue(month);
    cumulativeValue += submissionValue;
    const monthlyTarget = targetValue === null ? null : Math.ceil((targetValue * (index + 1)) / 12);
    const remainingValue = monthlyTarget === null ? null : Math.max(monthlyTarget - cumulativeValue, 0);
    return {
      month,
      submissionValue,
      openValue,
      targetValue: monthlyTarget,
      cumulativeValue,
      remainingValue,
      targetReached: monthlyTarget === null ? null : cumulativeValue >= monthlyTarget
    };
  });
}
