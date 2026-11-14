import type { AuditPointCase, OtherMeasure, UsoCase } from "../../db/schema";
import { formatMonthName, pointsForAuditCase, pointsForOtherMeasure, pointsForUsoCase } from "./calculations";

export type PointCaseKind = "audit" | "uso" | "other";

export interface PointCaseOverview {
  openCounts: Record<PointCaseKind, number>;
  openCount: number;
  currentMonth: { month: string; openCount: number; openPointsTenths: number };
  withoutMonth: { count: number; pointsTenths: number; title: string | null };
  year: { year: number; completedPointsTenths: number; openPointsTenths: number; totalPointsTenths: number };
}

export interface PointCaseMonthGroup<T> {
  month: string;
  cases: T[];
  pointsTenths: number;
}

interface OverviewEntry {
  kind: PointCaseKind;
  title: string;
  submissionMonth: string;
  open: boolean;
  pointsTenths: number;
}

function overviewEntries(auditCases: AuditPointCase[], usoCases: UsoCase[], otherMeasures: OtherMeasure[]): OverviewEntry[] {
  return [
    ...auditCases.map((pointCase) => ({ kind: "audit" as const, title: pointCase.name, submissionMonth: pointCase.submissionMonth, open: pointCase.status !== "completed", pointsTenths: pointsForAuditCase(pointCase) })),
    ...usoCases.map((usoCase) => ({ kind: "uso" as const, title: usoCase.title, submissionMonth: usoCase.submissionMonth, open: usoCase.status !== "completed", pointsTenths: pointsForUsoCase(usoCase) })),
    ...otherMeasures.map((measure) => ({ kind: "other" as const, title: measure.title, submissionMonth: measure.submissionMonth, open: measure.status !== "completed", pointsTenths: pointsForOtherMeasure(measure) }))
  ];
}

export function summarizePointCaseOverview(auditCases: AuditPointCase[], usoCases: UsoCase[], otherMeasures: OtherMeasure[], currentMonth: string): PointCaseOverview {
  const entries = overviewEntries(auditCases, usoCases, otherMeasures);
  const openEntries = entries.filter((entry) => entry.open);
  const year = Number(currentMonth.slice(0, 4));
  const yearEntries = entries.filter((entry) => entry.submissionMonth.startsWith(`${year}-`));
  const monthEntries = openEntries.filter((entry) => entry.submissionMonth === currentMonth);
  const withoutMonthEntries = openEntries.filter((entry) => entry.submissionMonth === "");
  const sumPoints = (list: OverviewEntry[]) => list.reduce((sum, entry) => sum + entry.pointsTenths, 0);
  const completedPointsTenths = sumPoints(yearEntries.filter((entry) => !entry.open));
  const openPointsTenths = sumPoints(yearEntries.filter((entry) => entry.open));

  return {
    openCounts: {
      audit: openEntries.filter((entry) => entry.kind === "audit").length,
      uso: openEntries.filter((entry) => entry.kind === "uso").length,
      other: openEntries.filter((entry) => entry.kind === "other").length
    },
    openCount: openEntries.length,
    currentMonth: { month: currentMonth, openCount: monthEntries.length, openPointsTenths: sumPoints(monthEntries) },
    withoutMonth: {
      count: withoutMonthEntries.length,
      pointsTenths: sumPoints(withoutMonthEntries),
      title: withoutMonthEntries.length === 1 ? withoutMonthEntries[0].title : null
    },
    year: { year, completedPointsTenths, openPointsTenths, totalPointsTenths: completedPointsTenths + openPointsTenths }
  };
}

export function groupPointCasesByMonth<T extends { submissionMonth: string }>(cases: T[], order: "asc" | "desc", pointsFor: (pointCase: T) => number): PointCaseMonthGroup<T>[] {
  const groups = new Map<string, PointCaseMonthGroup<T>>();
  for (const pointCase of cases) {
    const group = groups.get(pointCase.submissionMonth) ?? { month: pointCase.submissionMonth, cases: [], pointsTenths: 0 };
    group.cases.push(pointCase);
    group.pointsTenths += pointsFor(pointCase);
    groups.set(pointCase.submissionMonth, group);
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.month === right.month) return 0;
    if (left.month === "") return 1;
    if (right.month === "") return -1;
    return order === "asc" ? left.month.localeCompare(right.month) : right.month.localeCompare(left.month);
  });
}

export function formatPointMonthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return "";
  return `${formatMonthName(month)} ${month.slice(0, 4)}`;
}
