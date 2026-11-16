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
  it("leads with the days still to plan and splits them into vacation and flex time", () => {
    const summary = summarizeAbsencePlan({ ...base, absences: threeVacationDays, vacationRemainingMinutes: 2400, flexBalanceMinutes: 7200 });

    expect(absencePlanHero(summary, 480)).toEqual({
      title: "Bis 31.12. noch einplanen",
      value: "4,5 Tage",
      detail: "2 Tage Urlaub · 20:00 h Gleitzeit über der Grenze",
      tone: "open"
    });
  });

  it("switches to done, almost and overplanned wording", () => {
    const twoDays = threeVacationDays.slice(0, 2);
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: twoDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6000 }), 480)).toMatchObject({ title: "Alles verplant", value: "0 Tage", tone: "done" });
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: twoDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6180 }), 480)).toMatchObject({ title: "Fast geschafft", value: "3:00 h", tone: "open" });
    expect(absencePlanHero(summarizeAbsencePlan({ ...base, absences: threeVacationDays, vacationRemainingMinutes: 960, flexBalanceMinutes: 6000 }), 480)).toMatchObject({ title: "Zu viel geplant", value: "1 Tag", tone: "danger" });
  });

  it("labels whole and fractional day amounts", () => {
    expect(dayAmountLabel(480, 480)).toBe("1 Tag");
    expect(dayAmountLabel(960, 480)).toBe("2 Tage");
    expect(dayAmountLabel(1200, 480)).toBe("2,5 Tage");
  });
});
