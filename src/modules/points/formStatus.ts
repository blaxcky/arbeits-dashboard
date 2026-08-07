import type { AuditPointStatus } from "../../db/schema";
import { todayKey } from "../../lib/dates";
import { formatMonthName } from "./calculations";

export const COMPLETED_CURRENT_MONTH = "completed_current_month" as const;

export type PointFormStatus = AuditPointStatus | typeof COMPLETED_CURRENT_MONTH;

export interface PointFormStatusFields {
  submissionMonth: string;
  status: PointFormStatus;
}

export function currentPointMonth(now = new Date()): string {
  return todayKey(now).slice(0, 7);
}

export function completedCurrentMonthLabel(now = new Date()): string {
  return `Erledigt, ${formatMonthName(currentPointMonth(now))}`;
}

export function applyPointFormStatus<T extends PointFormStatusFields>(form: T, status: PointFormStatus, now = new Date()): T {
  if (status === COMPLETED_CURRENT_MONTH) {
    return { ...form, status, submissionMonth: currentPointMonth(now) };
  }
  return { ...form, status };
}

export function applyPointSubmissionMonth<T extends PointFormStatusFields>(form: T, submissionMonth: string): T {
  return {
    ...form,
    submissionMonth,
    status: form.status === COMPLETED_CURRENT_MONTH ? "completed" : form.status
  };
}

export function normalizePointFormStatus(status: PointFormStatus): AuditPointStatus {
  return status === COMPLETED_CURRENT_MONTH ? "completed" : status;
}
