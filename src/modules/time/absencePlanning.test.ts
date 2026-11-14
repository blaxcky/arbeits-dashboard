import { describe, expect, it } from "vitest";
import type { PlannedAbsence } from "../../db/schema";
import {
  absencePlanAction,
  absenceRequestInfo,
  absencesDueForBooking,
  austrianPublicHolidays,
  dueAbsenceRequests,
  easterSunday,
  groupOpenAbsences,
  isWorkday,
  missedAbsences,
  planningMonths,
  summarizeAbsencePlan
} from "./absencePlanning";

function absence(date: string, type: PlannedAbsence["type"], status: PlannedAbsence["status"] = "planned"): PlannedAbsence {
  return { id: `${type}-${date}`, date, type, status, createdAt: "", updatedAt: "" };
}

const plan = [
  absence("2026-11-20", "flex", "requested"),
  absence("2026-11-27", "vacation"),
  absence("2026-12-18", "flex"),
  absence("2026-12-21", "vacation"),
  absence("2026-12-22", "vacation"),
  absence("2026-12-23", "vacation"),
  absence("2026-12-28", "vacation"),
  absence("2026-12-29", "vacation")
];

describe("absence planning", () => {
  it("computes Easter-based Austrian public holidays", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    const holidays = austrianPublicHolidays(2026);
    expect(holidays.get("2026-04-06")).toBe("Ostermontag");
    expect(holidays.get("2026-05-14")).toBe("Christi Himmelfahrt");
    expect(holidays.get("2026-05-25")).toBe("Pfingstmontag");
    expect(holidays.get("2026-06-04")).toBe("Fronleichnam");
    expect(holidays.get("2026-12-08")).toBe("Mariä Empfängnis");
  });

  it("treats weekends and public holidays as non-working days", () => {
    expect(isWorkday("2026-12-07")).toBe(true);
    expect(isWorkday("2026-12-08")).toBe(false);
    expect(isWorkday("2026-12-12")).toBe(false);
  });

  it("lists the remaining months of the current year and all months of later years", () => {
    const current = planningMonths(2026, "2026-11-15");
    expect(current.map((month) => month.key)).toEqual(["2026-11", "2026-12"]);
    expect(current[0].leadingBlanks).toBe(6);
    expect(current[1].leadingBlanks).toBe(1);
    expect(current[1].days).toHaveLength(31);
    expect(planningMonths(2027, "2026-11-15")).toHaveLength(12);
  });

  it("decides whether a calendar click creates, removes or changes a plan", () => {
    expect(absencePlanAction(undefined, "vacation")).toBe("create");
    expect(absencePlanAction(absence("2026-12-21", "vacation"), "vacation")).toBe("remove");
    expect(absencePlanAction(absence("2026-12-21", "vacation"), "flex")).toBe("change-type");
    expect(absencePlanAction(absence("2026-12-21", "vacation", "booked"), "flex")).toBe("locked");
  });

  it("groups consecutive working days of the same type and status into one request", () => {
    const groups = groupOpenAbsences(plan, "2026-11-15");
    expect(groups.map((group) => [group.type, group.start, group.end, group.dates.length])).toEqual([
      ["flex", "2026-11-20", "2026-11-20", 1],
      ["vacation", "2026-11-27", "2026-11-27", 1],
      ["flex", "2026-12-18", "2026-12-18", 1],
      ["vacation", "2026-12-21", "2026-12-23", 3],
      ["vacation", "2026-12-28", "2026-12-29", 2]
    ]);
  });

  it("bridges weekends and holidays when grouping", () => {
    const groups = groupOpenAbsences([absence("2026-12-04", "vacation"), absence("2026-12-07", "vacation"), absence("2026-12-09", "vacation")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].end).toBe("2026-12-09");
  });

  it("opens the request window lead days before and turns urgent inside the urgent window", () => {
    expect(absenceRequestInfo({ start: "2026-11-27", status: "planned" }, "2026-11-15")).toEqual({ state: "open", opensOn: "2026-11-13", daysUntil: 12 });
    expect(absenceRequestInfo({ start: "2026-12-21", status: "planned" }, "2026-11-15").state).toBe("later");
    expect(absenceRequestInfo({ start: "2026-12-21", status: "planned" }, "2026-12-16").state).toBe("urgent");
    expect(absenceRequestInfo({ start: "2026-12-21", status: "requested" }, "2026-12-16").state).toBe("requested");
    expect(absenceRequestInfo({ start: "2026-12-21", status: "planned" }, "2026-12-22").state).toBe("missed");
    expect(absenceRequestInfo({ start: "2026-12-21", status: "planned" }, "2026-11-15", 40, 7).state).toBe("open");
  });

  it("reports due requests in date order", () => {
    const due = dueAbsenceRequests(plan, "2026-11-15");
    expect(due.map(({ group, info }) => [group.start, info.state])).toEqual([["2026-11-27", "open"]]);
  });

  it("books only requested absences that are due and flags missed planned days", () => {
    const absences = [absence("2026-11-10", "vacation"), absence("2026-11-12", "flex", "requested"), absence("2026-11-15", "vacation", "requested"), absence("2026-11-16", "vacation", "requested")];
    expect(absencesDueForBooking(absences, "2026-11-15").map((item) => item.date)).toEqual(["2026-11-12", "2026-11-15"]);
    expect(missedAbsences(absences, "2026-11-15").map((item) => item.date)).toEqual(["2026-11-10"]);
  });

  it("projects the year-end balances without deducting planned days twice", () => {
    const summary = summarizeAbsencePlan({ absences: plan, today: "2026-11-15", vacationRemainingMinutes: 3360, flexBalanceMinutes: 7050, flexLimitMinutes: 6000, dailyTargetMinutes: 480 });
    expect(summary.vacationPlannedDays).toBe(6);
    expect(summary.flexRequestedDays).toBe(1);
    expect(summary.vacationAfterMinutes).toBe(480);
    expect(summary.flexAfterMinutes).toBe(6090);
    expect(summary.flexOverLimitAfterMinutes).toBe(90);
    expect(summary.neededMinutes).toBe(4410);
    expect(summary.coveredRequestedMinutes).toBe(480);
    expect(summary.coveredPlannedMinutes).toBe(3360);
    expect(summary.openMinutes).toBe(570);
    expect(summary.status).toBe("open");
  });

  it("marks the plan as done, almost done or overplanned", () => {
    const base = { today: "2026-11-15", vacationRemainingMinutes: 960, flexBalanceMinutes: 6000, flexLimitMinutes: 6000, dailyTargetMinutes: 480 };
    expect(summarizeAbsencePlan({ ...base, absences: [absence("2026-12-21", "vacation"), absence("2026-12-22", "vacation")] }).status).toBe("done");
    expect(summarizeAbsencePlan({ ...base, flexBalanceMinutes: 6090, absences: [absence("2026-12-21", "vacation"), absence("2026-12-22", "vacation")] }).status).toBe("almost");
    expect(summarizeAbsencePlan({ ...base, absences: [absence("2026-12-21", "vacation"), absence("2026-12-22", "vacation"), absence("2026-12-23", "vacation")] }).status).toBe("overplanned");
    expect(summarizeAbsencePlan({ ...base, absences: [absence("2027-01-04", "vacation")] }).vacationPlannedDays).toBe(0);
  });
});
