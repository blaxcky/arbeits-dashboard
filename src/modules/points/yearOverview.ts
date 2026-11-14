import type { AuditPointCase, OtherMeasure, UsoCase } from "../../db/schema";
import { formatMonthName, pointsForAuditCase, pointsForOtherMeasure, pointsForUsoCase } from "./calculations";
import type { PointCaseKind } from "./overview";

export type PointYearTab = "points" | "uso" | "other";

export interface PointYearCase {
  id: string;
  kind: PointCaseKind;
  title: string;
  detail: string;
  value: number;
  completed: boolean;
  submissionMonth: string;
}

export interface PointYearMonth {
  month: string;
  completedValue: number;
  openValue: number;
  openCases: PointYearCase[];
  completedCases: PointYearCase[];
  current: boolean;
}

export interface PointYearSummary {
  year: number;
  goal: number | null;
  completedValue: number;
  openValue: number;
  currentTarget: { month: string; value: number } | null;
  series: {
    stand: (number | null)[];
    projection: (number | null)[];
    target: (number | null)[];
    allTotal: number;
  };
  remainder: {
    past: { label: string; completedValue: number; months: PointYearMonth[] } | null;
    months: PointYearMonth[];
    withoutMonth: { openValue: number; cases: PointYearCase[] } | null;
  };
  calc: {
    completedValue: number;
    openValue: number;
    withoutMonthValue: number | null;
    possibleValue: number;
    goal: number | null;
    difference: number | null;
  };
}

const KIND_LABELS: Record<PointCaseKind, string> = {
  audit: "Betriebsprüfung",
  uso: "USO",
  other: "Sonstige Maßnahme"
};

export function buildPointYearCases(tab: PointYearTab, auditCases: AuditPointCase[], usoCases: UsoCase[], otherMeasures: OtherMeasure[]): PointYearCase[] {
  const audit = auditCases.map((pointCase): PointYearCase => ({
    id: pointCase.id,
    kind: "audit",
    title: pointCase.name || "Ohne Namen",
    detail: KIND_LABELS.audit,
    value: pointsForAuditCase(pointCase),
    completed: pointCase.status === "completed",
    submissionMonth: pointCase.submissionMonth
  }));
  const uso = usoCases.map((usoCase): PointYearCase => ({
    id: usoCase.id,
    kind: "uso",
    title: usoCase.title || "Ohne Titel",
    detail: tab === "points" ? KIND_LABELS.uso : "",
    value: tab === "points" ? pointsForUsoCase(usoCase) : 1,
    completed: usoCase.status === "completed",
    submissionMonth: usoCase.submissionMonth
  }));
  const other = otherMeasures.map((measure): PointYearCase => ({
    id: measure.id,
    kind: "other",
    title: measure.title || "Ohne Titel",
    detail: tab === "points" ? KIND_LABELS.other : measure.measureType.trim(),
    value: tab === "points" ? pointsForOtherMeasure(measure) : 1,
    completed: measure.status === "completed",
    submissionMonth: measure.submissionMonth
  }));

  if (tab === "uso") return uso;
  if (tab === "other") return other;
  return [...audit, ...uso, ...other];
}

export function monthlyTargetValue(goal: number, monthIndex: number): number {
  return Math.ceil((goal * (monthIndex + 1)) / 12);
}

function sum(cases: PointYearCase[]): number {
  return cases.reduce((total, pointCase) => total + pointCase.value, 0);
}

function monthKey(year: number, index: number): string {
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

export function summarizePointYear(cases: PointYearCase[], year: number, goal: number | null, currentMonth: string): PointYearSummary {
  const currentYear = Number(currentMonth.slice(0, 4));
  const currentIndex = Number(currentMonth.slice(5, 7)) - 1;
  const months: PointYearMonth[] = Array.from({ length: 12 }, (_, index) => {
    const month = monthKey(year, index);
    const monthCases = cases.filter((pointCase) => pointCase.submissionMonth === month);
    const openCases = monthCases.filter((pointCase) => !pointCase.completed);
    const completedCases = monthCases.filter((pointCase) => pointCase.completed);
    return {
      month,
      completedValue: sum(completedCases),
      openValue: sum(openCases),
      openCases,
      completedCases,
      current: month === currentMonth
    };
  });

  const completedValue = months.reduce((total, month) => total + month.completedValue, 0);
  const openValue = months.reduce((total, month) => total + month.openValue, 0);
  const splitIndex = year < currentYear ? 12 : year > currentYear ? 0 : currentIndex;

  const pastMonths = months.slice(0, splitIndex);
  const past = splitIndex > 0
    ? {
        label: splitIndex === 1 ? formatMonthName(months[0].month) : `${formatMonthName(months[0].month)} – ${formatMonthName(months[splitIndex - 1].month)}`,
        completedValue: pastMonths.reduce((total, month) => total + month.completedValue, 0),
        months: pastMonths.filter((month) => month.completedCases.length > 0)
      }
    : null;
  const remainingMonths = months.filter((month, index) => {
    if (index < splitIndex) return month.openCases.length > 0;
    if (year === currentYear) return true;
    return month.openCases.length > 0 || month.completedCases.length > 0;
  });

  const withoutMonthCases = year === currentYear ? cases.filter((pointCase) => !pointCase.completed && pointCase.submissionMonth === "") : [];
  const withoutMonth = withoutMonthCases.length > 0 ? { openValue: sum(withoutMonthCases), cases: withoutMonthCases } : null;

  let standTotal = 0;
  let allTotal = 0;
  const cumulativeCompleted: number[] = [];
  const cumulativeAll: number[] = [];
  months.forEach((month) => {
    standTotal += month.completedValue;
    allTotal += month.completedValue + month.openValue;
    cumulativeCompleted.push(standTotal);
    cumulativeAll.push(allTotal);
  });

  const standEnd = year < currentYear ? 11 : year > currentYear ? -1 : currentIndex - 1;
  const stand = cumulativeCompleted.map((value, index) => (index <= standEnd ? value : null));
  const projection: (number | null)[] = Array.from({ length: 12 }, () => null);
  const hasFutureValues = months.some((month, index) => index > standEnd && (month.openValue > 0 || month.completedValue > 0)) || (standEnd < 11 && openValue > 0);
  if (standEnd < 11 && hasFutureValues) {
    if (standEnd >= 0) projection[standEnd] = cumulativeCompleted[standEnd];
    for (let index = standEnd + 1; index < 12; index += 1) projection[index] = cumulativeAll[index];
  }
  const target = Array.from({ length: 12 }, (_, index) => (goal === null ? null : monthlyTargetValue(goal, index)));

  let currentTarget: PointYearSummary["currentTarget"] = null;
  if (goal !== null && year <= currentYear) {
    const targetIndex = year < currentYear ? 11 : currentIndex;
    currentTarget = { month: months[targetIndex].month, value: monthlyTargetValue(goal, targetIndex) };
  }

  const withoutMonthValue = withoutMonth ? withoutMonth.openValue : null;
  const possibleValue = completedValue + openValue + (withoutMonthValue ?? 0);

  return {
    year,
    goal,
    completedValue,
    openValue,
    currentTarget,
    series: { stand, projection, target, allTotal },
    remainder: { past, months: remainingMonths, withoutMonth },
    calc: {
      completedValue,
      openValue,
      withoutMonthValue,
      possibleValue,
      goal,
      difference: goal === null ? null : possibleValue - goal
    }
  };
}

export function niceAxisScale(value: number, minStep = 1): { max: number; step: number } {
  const raw = Math.max(value, minStep) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(minStep, [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? 10 * magnitude);
  return { max: Math.max(step, Math.ceil(value / step) * step), step };
}
