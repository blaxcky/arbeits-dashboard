import { describe, expect, it } from "vitest";
import type { PlannedAbsence } from "../../db/schema";
import { summarizeAbsencePlan } from "./absencePlanning";
import { absencePlanHero, dayAmountLabel } from "./AbsencePlanningView";

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
      detail: "",
      tone: "open",
      actions: [{ type: "vacation", label: "2 Urlaubstage" }, { type: "flex", label: "3 Gleittage" }]
    });
  });

  it("switches to done, almost and overplanned wording", () => {
    const twoDays = threeVacationDays.slice(0, 2);
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: twoDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6000 }), 480)).toMatchObject({ title: "Alles verplant", value: "0 Tage", tone: "done", actions: [] });
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: twoDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6180 }), 480)).toMatchObject({ title: "Fast geschafft", value: "3:00 h", tone: "open", actions: [{ type: "flex", label: "1 Gleittag" }] });
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: threeVacationDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6000 }), 480)).toMatchObject({ title: "Zu viel geplant", value: "1 Tag", tone: "danger", actions: [] });
  });

  it("keeps a vacation remainder below one day out of the plannable days", () => {
    const summary = summarizeAbsencePlan({ ...base, absences: [], vacationRemainingMinutes: 1200, flexBalanceMinutes: 6000 });
    expect(absencePlanHero(summary, 480)).toMatchObject({ value: "2 Tage", detail: "dazu 4:00 h Resturlaub", actions: [{ type: "vacation", label: "2 Urlaubstage" }] });
  });

  it("labels whole and fractional day amounts", () => {
    expect(dayAmountLabel(480, 480)).toBe("1 Tag");
    expect(dayAmountLabel(960, 480)).toBe("2 Tage");
    expect(dayAmountLabel(1200, 480)).toBe("2,5 Tage");
  });
});
