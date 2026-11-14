import { describe, expect, it } from "vitest";
import type { Trip } from "../../db/schema";
import { formatTripMonthLabel, groupTripsByMonth, splitTripDateLabel, summarizeTripList, tripCostShares } from "./tripOverview";

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
