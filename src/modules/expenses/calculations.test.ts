import { describe, expect, it } from "vitest";
import {
  calculateDomesticPerDiemCents,
  calculatePerDiemDifferentialCents,
  calculateTaxPerDiemCents,
  calculateTransportDifferentialCents,
  calculateTripDifferentialCents,
  calculateTripDurationMinutes,
  calculateTripTotalCents,
  calculateTripTravelCostCents,
  remainingTransportSubsidyYearLimitCents,
  summarizeTripsByYear
} from "./calculations";
import type { Trip } from "../../db/schema";

const baseTrip: Trip = {
  id: "trip-1",
  date: "2026-05-06",
  startTime: "08:00",
  endTime: "11:30",
  durationMinutes: 210,
  reason: "Termin",
  origin: "Wien",
  destination: "Linz",
  transportType: "kilometergeld",
  oneWayKilometers: 10,
  perDiemCents: 1200,
  otherCostsCents: 500,
  otherCostsDescription: "",
  taxableTransportSubsidyCents: 0,
  transportSubsidyTaxCents: 0,
  note: "",
  done: false,
  createdAt: "2026-05-06T08:00:00.000Z",
  updatedAt: "2026-05-06T08:00:00.000Z"
};

describe("expense calculations", () => {
  it("calculates trip duration from clock times", () => {
    expect(calculateTripDurationMinutes("08:00", "11:30")).toBe(210);
    expect(calculateTripDurationMinutes("11:30", "08:00")).toBe(0);
  });

  it("calculates kilometer allowance as round trip", () => {
    expect(calculateTripTravelCostCents(baseTrip)).toBe(1000);
  });

  it("calculates standard transport subsidy as round trip", () => {
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 10 })).toBe(520);
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 400 })).toBe(10500);
  });

  it("calculates public transport subsidy as round trip", () => {
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "oeffi-zuschuss", oneWayKilometers: 100 })).toBe(7000);
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "oeffi-zuschuss", oneWayKilometers: 1000 })).toBe(21800);
  });

  it("calculates domestic per diem from duration", () => {
    expect(calculateDomesticPerDiemCents(300)).toBe(0);
    expect(calculateDomesticPerDiemCents(301)).toBe(1000);
    expect(calculateDomesticPerDiemCents(480)).toBe(1000);
    expect(calculateDomesticPerDiemCents(481)).toBe(2000);
    expect(calculateDomesticPerDiemCents(720)).toBe(2000);
    expect(calculateDomesticPerDiemCents(721)).toBe(3000);
  });

  it("calculates tax per diem and per diem differential", () => {
    expect(calculateTaxPerDiemCents(0)).toBe(0);
    expect(calculateTaxPerDiemCents(301)).toBe(1500);
    expect(calculateTaxPerDiemCents(721)).toBe(3000);
    expect(calculatePerDiemDifferentialCents(301, 1000)).toBe(500);
    expect(calculatePerDiemDifferentialCents(721, 3000)).toBe(0);
  });

  it("calculates transport differential against fictional kilometer allowance", () => {
    expect(calculateTransportDifferentialCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 10 })).toBe(480);
    expect(calculateTransportDifferentialCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 10, transportSubsidyTaxCents: 100 })).toBe(580);
    expect(calculateTransportDifferentialCents({ ...baseTrip, transportType: "kilometergeld", oneWayKilometers: 10 })).toBe(0);
  });

  it("adds travel cost, per diem and other costs", () => {
    expect(calculateTripTotalCents(baseTrip)).toBe(2700);
  });

  it("adds per diem and transport differential", () => {
    const trip = { ...baseTrip, transportType: "befoerderungszuschuss" as const, oneWayKilometers: 10, durationMinutes: 301, perDiemCents: 1000 };
    expect(calculateTripDifferentialCents(trip)).toBe(980);
  });

  it("summarizes trips by calendar year", () => {
    const summary = summarizeTripsByYear([{ ...baseTrip, done: true, transportType: "befoerderungszuschuss", durationMinutes: 301, perDiemCents: 1000 }, { ...baseTrip, id: "trip-2", date: "2025-12-31" }], 2026);
    expect(summary.count).toBe(1);
    expect(summary.doneCount).toBe(1);
    expect(summary.durationMinutes).toBe(301);
    expect(summary.kilometers).toBe(20);
    expect(summary.totalCents).toBe(2020);
    expect(summary.transportSubsidyCents).toBe(520);
    expect(summary.perDiemDifferentialCents).toBe(500);
    expect(summary.transportDifferentialCents).toBe(480);
    expect(summary.differentialCents).toBe(980);
    expect(remainingTransportSubsidyYearLimitCents(summary.transportSubsidyCents)).toBe(244480);
  });
});
