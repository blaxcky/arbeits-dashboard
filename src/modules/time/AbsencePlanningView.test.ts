import { describe, expect, it } from "vitest";
import type { PlannedAbsence } from "../../db/schema";
import { summarizeAbsencePlan } from "./absencePlanning";
import { absencePlanHero, compactAbsenceRange, dayAmountLabel, requestStatusLabel } from "./AbsencePlanningView";

function absence(date: string, type: PlannedAbsence["type"]): PlannedAbsence {
  return { id: `${type}-${date}`, date, type, status: "planned", createdAt: "", updatedAt: "" };
}

const base = { today: "2026-11-16", flexLimitMinutes: 6000, dailyTargetMinutes: 480 };
const threeVacationDays = [absence("2026-12-21", "vacation"), absence("2026-12-22", "vacation"), absence("2026-12-23", "vacation")];

describe("absence plan hero", () => {
  it("answers in whole days to plan, split into vacation and flex days", () => {
    const summary = summarizeAbsencePlan({ ...base, absences: threeVacationDays, vacationRemainingMinutes: 2400, flexBalanceMinutes: 7200 });

    expect(absencePlanHero(summary, 480)).toEqual({
      title: "Bis 31.12. noch einplanen",
      value: "5 Tage",
      detail: "2 Urlaubstage · 3 Gleittage",
      tone: "open"
    });
  });

  it("switches to done, almost and overplanned wording", () => {
    const twoDays = threeVacationDays.slice(0, 2);
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: twoDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6000 }), 480)).toMatchObject({ title: "Alles verplant", value: "0 Tage", tone: "done" });
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: twoDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6180 }), 480)).toMatchObject({ title: "Fast geschafft", value: "3:00 h", tone: "open" });
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: threeVacationDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6000 }), 480)).toMatchObject({ title: "Zu viel geplant", value: "1 Tag", tone: "danger" });
  });

  it("keeps a vacation remainder below one day out of the plannable days", () => {
    const summary = summarizeAbsencePlan({ ...base, absences: [], vacationRemainingMinutes: 1200, flexBalanceMinutes: 6000 });
    expect(absencePlanHero(summary, 480)).toMatchObject({ value: "2 Tage", detail: "2 Urlaubstage · 4:00 h Resturlaub" });
  });

  it("labels whole and fractional day amounts", () => {
    expect(dayAmountLabel(480, 480)).toBe("1 Tag");
    expect(dayAmountLabel(960, 480)).toBe("2 Tage");
    expect(dayAmountLabel(1200, 480)).toBe("2,5 Tage");
  });
});

describe("absence request labels", () => {
  it("shortens ranges and keeps the weekday for single days", () => {
    expect(compactAbsenceRange({ start: "2026-12-07", end: "2026-12-07" })).toBe("Mo 07.12.");
    expect(compactAbsenceRange({ start: "2026-12-21", end: "2026-12-23" })).toBe("21.–23.12.");
    expect(compactAbsenceRange({ start: "2026-12-30", end: "2027-01-04" })).toBe("30.12. – 04.01.");
  });

  it("names the request state in a few words", () => {
    expect(requestStatusLabel({ state: "later", opensOn: "2026-12-07", daysUntil: 28 })).toBe("ab Mo 07.12.");
    expect(requestStatusLabel({ state: "urgent", opensOn: "2026-11-09", daysUntil: 7 })).toBe("noch 7 Tage");
    expect(requestStatusLabel({ state: "urgent", opensOn: "2026-11-02", daysUntil: 0 })).toBe("heute");
    expect(requestStatusLabel({ state: "missed", opensOn: "2026-10-30", daysUntil: -3 })).toBe("vorbei");
    expect(requestStatusLabel({ state: "requested", opensOn: "2026-11-23", daysUntil: 21 })).toBe("wird am Tag gebucht");
  });
});
