import { describe, expect, it } from "vitest";
import {
  applyPointFormStatus,
  applyPointSubmissionMonth,
  completedCurrentMonthLabel,
  COMPLETED_CURRENT_MONTH,
  currentPointMonth,
  normalizePointFormStatus,
  type PointFormStatusFields
} from "./formStatus";

const augustInVienna = new Date("2026-07-31T22:30:00.000Z");

describe("point form status", () => {
  it("labels and applies the current Vienna calendar month", () => {
    const form: PointFormStatusFields = { submissionMonth: "", status: "in_progress" };

    expect(currentPointMonth(augustInVienna)).toBe("2026-08");
    expect(completedCurrentMonthLabel(augustInVienna)).toBe("Erledigt, August");
    expect(applyPointFormStatus(form, COMPLETED_CURRENT_MONTH, augustInVienna)).toEqual({
      submissionMonth: "2026-08",
      status: COMPLETED_CURRENT_MONTH
    });
  });

  it.each(["Betriebsprüfung", "USO-Fall", "sonstige Maßnahme"])("normalizes the convenience status when saving a %s", () => {
    const selected = applyPointFormStatus<PointFormStatusFields>(
      { submissionMonth: "2026-04", status: "in_progress" },
      COMPLETED_CURRENT_MONTH,
      augustInVienna
    );

    expect({ ...selected, status: normalizePointFormStatus(selected.status) }).toEqual({
      submissionMonth: "2026-08",
      status: "completed"
    });
  });

  it("switches to regular completed when the automatic month is edited", () => {
    const selected = applyPointFormStatus<PointFormStatusFields>(
      { submissionMonth: "", status: "in_progress" },
      COMPLETED_CURRENT_MONTH,
      augustInVienna
    );

    expect(applyPointSubmissionMonth(selected, "2026-09")).toEqual({
      submissionMonth: "2026-09",
      status: "completed"
    });
  });

  it("keeps the month for regular status changes", () => {
    const form: PointFormStatusFields = { submissionMonth: "2026-03", status: "in_progress" };

    expect(applyPointFormStatus(form, "completed", augustInVienna).submissionMonth).toBe("2026-03");
    expect(applyPointFormStatus(form, "in_progress", augustInVienna).submissionMonth).toBe("2026-03");
  });
});
