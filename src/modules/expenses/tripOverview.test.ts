import { describe, expect, it } from "vitest";
import type { Trip } from "../../db/schema";
import { summarizeTripsByYear, summarizeTripsByYearMonth } from "./calculations";
import { addMonthsToDateKey, formatTripMonthLabel, formatTripMonthName, groupTripsByMonth, splitTripDateLabel, summarizeTripList, tripCostShares, tripSubmissionStatus } from "./tripOverview";

const baseTrip: Trip = {
  id: "trip-1",
  date: "2026-11-12",
  startTime: "07:45",
  endTime: "13:30",
  durationMinutes: 345,
  reason: "Prüfung",
  origin: "Eisenstadt",
  destination: "Neusiedl am See",
  transportType: "kilometergeld",
  oneWayKilometers: 34.5,
  perDiemCents: 1500,
  otherCostsCents: 0,
  otherCostsDescription: "",
  employerReimbursedCosts: true,
  taxableTransportSubsidyCents: 0,
  transportSubsidyTaxCents: 0,
  note: "",
  done: false,
  createdAt: "2026-11-12T06:00:00.000Z",
  updatedAt: "2026-11-12T06:00:00.000Z"
};

describe("summarizeTripList", () => {
  it("sums duration, round-trip kilometers and amounts", () => {
    const totals = summarizeTripList([baseTrip, { ...baseTrip, id: "trip-2", durationMinutes: 0, oneWayKilometers: 82, transportType: "dienstauto", perDiemCents: 0 }]);
    expect(totals.count).toBe(2);
    expect(totals.durationMinutes).toBe(345);
    expect(totals.kilometers).toBe(233);
    expect(totals.totalCents).toBeGreaterThan(1500);
  });

  it("returns zeros for an empty list", () => {
    expect(summarizeTripList([])).toEqual({ count: 0, durationMinutes: 0, kilometers: 0, totalCents: 0, differentialCents: 0 });
  });
});

describe("groupTripsByMonth", () => {
  it("groups newest months first with monthly totals", () => {
    const groups = groupTripsByMonth([
      { ...baseTrip, id: "oct", date: "2026-10-21" },
      { ...baseTrip, id: "nov-early", date: "2026-11-05" },
      { ...baseTrip, id: "nov-late", date: "2026-11-12" }
    ]);
    expect(groups.map((group) => group.monthKey)).toEqual(["2026-11", "2026-10"]);
    expect(groups[0].trips.map((trip) => trip.id)).toEqual(["nov-late", "nov-early"]);
    expect(groups[0].label).toBe("November 2026");
    expect(groups[0].totalCents).toBe(groups[1].totalCents * 2);
  });
});

describe("trip labels and shares", () => {
  it("formats month labels and splits weekday from date", () => {
    expect(formatTripMonthLabel("2026-10")).toBe("Oktober 2026");
    expect(splitTripDateLabel("2026-08-08")).toEqual({ weekday: "Sa.", date: "08.08.2026" });
    expect(splitTripDateLabel("kaputt")).toEqual({ weekday: "", date: "-" });
  });

  it("calculates cost shares in percent", () => {
    expect(tripCostShares(2000, 2800, 0)).toEqual({ perDiem: 2000 / 4800 * 100, travel: 2800 / 4800 * 100, other: 0 });
    expect(tripCostShares(0, 0, 0)).toEqual({ perDiem: 0, travel: 0, other: 0 });
  });
});

describe("trip submission deadline", () => {
  it("adds months and clamps to the end of shorter months", () => {
    expect(addMonthsToDateKey("2026-06-05", 6)).toBe("2026-12-05");
    expect(addMonthsToDateKey("2026-08-31", 6)).toBe("2027-02-28");
  });

  it("warns after five months and marks trips past six months as overdue", () => {
    expect(tripSubmissionStatus("2026-06-14", "2026-11-14")).toEqual({ deadline: "2026-12-14", daysLeft: 30, level: "ok" });
    expect(tripSubmissionStatus("2026-06-05", "2026-11-14")).toEqual({ deadline: "2026-12-05", daysLeft: 21, level: "warning" });
    expect(tripSubmissionStatus("2026-05-10", "2026-11-14")).toEqual({ deadline: "2026-11-10", daysLeft: -4, level: "overdue" });
    expect(tripSubmissionStatus("kaputt", "2026-11-14")).toBeNull();
  });
});

describe("summarizeTripsByYearMonth", () => {
  it("lists every month up to today, newest first, with open amounts", () => {
    const trips = [
      { ...baseTrip, id: "jun", date: "2026-06-05", done: false },
      { ...baseTrip, id: "nov-done", date: "2026-11-03", done: true },
      { ...baseTrip, id: "nov-open", date: "2026-11-12", done: false },
      { ...baseTrip, id: "old", date: "2025-12-01" }
    ];
    const months = summarizeTripsByYearMonth(trips, 2026, "2026-11-14");
    expect(months.map((month) => month.month)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(months[0]).toMatchObject({ count: 2, openCount: 1, oldestOpenDate: "2026-11-12", kilometers: 138 });
    expect(months[0].openTotalCents * 2).toBe(months[0].totalCents);
    expect(months[1]).toMatchObject({ count: 0, totalCents: 0, oldestOpenDate: null });
    expect(months[5]).toMatchObject({ count: 1, openCount: 1, oldestOpenDate: "2026-06-05" });
    expect(summarizeTripsByYearMonth(trips, 2025, "2026-11-14")).toHaveLength(12);
    expect(summarizeTripsByYearMonth(trips, 2027, "2026-11-14")).toEqual([]);
    expect(formatTripMonthName(1)).toBe("Jänner");
  });

  it("splits the open share of the differential in the year summary", () => {
    const summary = summarizeTripsByYear([baseTrip, { ...baseTrip, id: "done", done: true }], 2026);
    expect(summary.openPerDiemDifferentialCents * 2).toBe(summary.perDiemDifferentialCents);
    expect(summary.openDifferentialCents * 2).toBe(summary.differentialCents);
  });
});
